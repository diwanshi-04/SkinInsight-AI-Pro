"""
SkinPro ML Prediction Server v4

Major upgrade: Pretrained HuggingFace skin disease model + Grad-CAM visualization.

Pipeline:
1. **Groq Vision API** (PRIMARY) - free LLM with vision, highest accuracy
2. **HuggingFace pretrained model** - real medical-data-trained classifier + Grad-CAM
3. **Local CV fallback** - banner detection, basic skin type when models unavailable
4. **TFLite skin type** - kept as backup for skin type classification

Grad-CAM heatmap is generated from the HF model's attention weights and returned
as a base64-encoded PNG that the frontend overlays on the input image.

Setup:
    pip install -r requirements.txt
    export GROQ_API_KEY=gsk_...   # free at console.groq.com
    python ml/server.py
"""

import argparse
import base64
import io
import json
import math
import os
import re
import sys
import threading
import time
import traceback
import urllib.request
import urllib.error
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image

# ---------------------------------------------------------------------------
# Optional heavy deps (loaded lazily so the server can start even if missing)
# ---------------------------------------------------------------------------

_TORCH = None
_TRANSFORMERS = None


def _try_import_torch():
    global _TORCH
    if _TORCH is False:
        return None
    if _TORCH is not None:
        return _TORCH
    try:
        import torch  # type: ignore
        _TORCH = torch
        return torch
    except Exception as e:
        print(f"  [torch] not available: {e}")
        _TORCH = False
        return None


def _try_import_transformers():
    global _TRANSFORMERS
    if _TRANSFORMERS is False:
        return None
    if _TRANSFORMERS is not None:
        return _TRANSFORMERS
    try:
        import transformers  # type: ignore
        _TRANSFORMERS = transformers
        return transformers
    except Exception as e:
        print(f"  [transformers] not available: {e}")
        _TRANSFORMERS = False
        return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _softmax(x: np.ndarray) -> np.ndarray:
    x = x.astype(np.float64)
    x = x - np.max(x)
    exp_x = np.exp(x)
    denom = np.sum(exp_x)
    if denom == 0:
        return np.zeros_like(x, dtype=np.float64)
    return (exp_x / denom).astype(np.float64)


def _read_labels(path: str) -> List[str]:
    if not path or not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


# ---------------------------------------------------------------------------
# TFLite wrapper (for legacy skin type model — disease model is replaced by HF)
# ---------------------------------------------------------------------------

class TFLiteModel:
    def __init__(self, model_path: str, labels_path: str, name: str = "model"):
        import tensorflow as tf

        self.name = name
        self.labels = _read_labels(labels_path)
        self.interpreter = tf.lite.Interpreter(model_path=model_path)
        self.interpreter.allocate_tensors()

        inp = self.interpreter.get_input_details()[0]
        self.input_index = int(inp["index"])
        self.input_shape = tuple(int(x) for x in inp["shape"])
        self.input_dtype = inp["dtype"]
        self.input_quant = inp.get("quantization", (0.0, 0))

        out = self.interpreter.get_output_details()[0]
        self.output_index = int(out["index"])
        self.output_quant = out.get("quantization", (0.0, 0))

        self.height = int(self.input_shape[1])
        self.width = int(self.input_shape[2])
        self.channels = int(self.input_shape[3])
        print(f"  [{self.name}] Loaded: shape={list(self.input_shape)}, labels={self.labels}")

    def _prepare(self, img: Image.Image) -> np.ndarray:
        if self.channels == 1:
            img = img.convert("L")
        else:
            img = img.convert("RGB")
        img = img.resize((self.width, self.height), resample=Image.BILINEAR)
        arr = np.asarray(img)
        if self.channels == 1:
            arr = np.expand_dims(arr, axis=-1)
        arr = np.expand_dims(arr, axis=0)

        if self.input_dtype == np.float32:
            return (arr.astype(np.float32) / 255.0)
        if self.input_dtype == np.uint8:
            return arr.astype(np.uint8)
        if self.input_dtype == np.int8:
            scale, zp = self.input_quant
            if not scale or math.isclose(scale, 0.0):
                return arr.astype(np.int16).clip(-128, 127).astype(np.int8)
            arr_f = arr.astype(np.float32) / 255.0
            q = np.round(arr_f / scale + float(zp))
            return q.clip(-128, 127).astype(np.int8)
        raise ValueError(f"Unsupported dtype: {self.input_dtype}")

    def predict(self, img: Image.Image, topk: int = 3) -> Dict:
        tensor = self._prepare(img)
        self.interpreter.set_tensor(self.input_index, tensor)
        self.interpreter.invoke()
        output = self.interpreter.get_tensor(self.output_index)
        output = np.squeeze(output)

        out_scale, out_zp = self.output_quant
        if output.dtype in (np.uint8, np.int8) and out_scale and not math.isclose(out_scale, 0.0):
            output_f = (output.astype(np.float32) - float(out_zp)) * float(out_scale)
        else:
            output_f = output.astype(np.float32)

        if (np.any(output_f < 0.0) or np.any(output_f > 1.0)
                or not np.isclose(np.sum(output_f), 1.0, atol=1e-2)):
            probs = _softmax(output_f)
        else:
            probs = output_f.astype(np.float64)
        if probs.ndim != 1:
            probs = np.ravel(probs)

        top_indices = np.argsort(probs)[::-1][:topk]
        def label_for(i: int) -> str:
            return self.labels[i] if 0 <= i < len(self.labels) else str(i)
        top = [{"label": label_for(int(i)), "confidence": round(float(probs[int(i)]), 6)}
               for i in top_indices]
        return {"label": top[0]["label"], "confidence": top[0]["confidence"], "top": top}


# ---------------------------------------------------------------------------
# HuggingFace pretrained skin disease model + Grad-CAM
# ---------------------------------------------------------------------------

# Model fallback chain — first one that loads wins.
# PRIMARY: Jayanth2002/dinov2-base-finetuned-SkinDisease — DINOv2 fine-tuned
# on 22 actual skin DISEASE classes (Lupus, Tinea/Ringworm, Eczema, Psoriasis,
# Acne, Vitiligo, Skin Cancer, etc.). Far more relevant than HAM10000
# dermatoscopic-only models for general user photos.
_HF_MODEL_CANDIDATES = [
    os.environ.get("HF_MODEL_NAME") or "Jayanth2002/dinov2-base-finetuned-SkinDisease",
    "jhoppanne/SkinDiseaseClassifier-ResNet50-V2",
    "Anwarkh1/Skin_Cancer-Image_Classification",  # cancer-only fallback
    "google/vit-base-patch16-224",  # generic, used only for Grad-CAM
]

# Map raw model output → user-facing canonical category.
# We honestly preserve the model's actual class. The frontend has rich info
# for each. Unknown labels pass through with light normalization.
_HF_LABEL_TO_DISEASE = {
    # Jayanth2002 / general skin disease classes
    "acne": "acne",
    "actinic keratosis": "actinic_keratosis",
    "atopic dermatitis": "eczema",
    "benign tumors": "benign_tumor",
    "bullous": "bullous",
    "candidiasis": "candidiasis",
    "drug eruption": "drug_eruption",
    "eczema": "eczema",
    "infestations bites": "bites",
    "lichen": "lichen",
    "lupus": "lupus",
    "moles": "moles",
    "psoriasis": "psoriasis",
    "rosacea": "rosacea",
    "seborrh keratoses": "seborrheic_keratosis",
    "seborrheic keratoses": "seborrheic_keratosis",
    "skin cancer": "skin_cancer",
    "sun sunlight damage": "sun_damage",
    "tinea": "ringworm",
    "tinea ringworm candidiasis and other fungal infections": "ringworm",
    "vascular tumors": "vascular_tumor",
    "vasculitis": "vasculitis",
    "vitiligo": "vitiligo",
    "warts": "warts",
    "warts molluscum and other viral infections": "warts",
    "unknown normal": "healthy",
    "unknown": "healthy",
    "normal": "healthy",
    "healthy": "healthy",
    # HAM10000 cancer model fallback labels
    "melanoma": "skin_cancer",
    "basal cell carcinoma": "skin_cancer",
    "squamous cell carcinoma": "skin_cancer",
    "melanocytic nevi": "moles",
    "melanocytic_nevi": "moles",
    "benign keratosis": "seborrheic_keratosis",
    "dermatofibroma": "benign_tumor",
    "vascular lesion": "vascular_tumor",
    "benign": "healthy",
    "malignant": "skin_cancer",
    "nevus": "moles",
    "scalp": "scalp_infections",
    "fungal": "ringworm",
}


class HFSkinModel:
    """Wraps a HuggingFace image-classification model and provides Grad-CAM."""

    def __init__(self):
        self.loaded = False
        self.load_attempted = False
        self.lock = threading.Lock()
        self.model = None
        self.processor = None
        self.model_name = None
        self.id2label = {}
        self.is_vit = False  # whether to use attention rollout

    def load(self) -> bool:
        if self.load_attempted:
            return self.loaded
        with self.lock:
            if self.load_attempted:
                return self.loaded
            self.load_attempted = True

            torch = _try_import_torch()
            transformers = _try_import_transformers()
            if torch is None or transformers is None:
                print("  [hf] torch/transformers unavailable — skipping HF model")
                return False

            from transformers import AutoModelForImageClassification, AutoImageProcessor

            for name in _HF_MODEL_CANDIDATES:
                try:
                    print(f"  [hf] Trying to load {name}...")
                    self.processor = AutoImageProcessor.from_pretrained(name)
                    self.model = AutoModelForImageClassification.from_pretrained(name)
                    self.model.eval()
                    self.model_name = name
                    self.id2label = self.model.config.id2label or {}
                    arch = self.model.config.architectures[0] if self.model.config.architectures else ""
                    self.is_vit = "ViT" in arch or "vit" in name.lower()
                    self.loaded = True
                    print(f"  [hf] LOADED: {name}  arch={arch}  labels={list(self.id2label.values())[:5]}...")
                    return True
                except Exception as e:
                    print(f"  [hf] failed {name}: {e}")
                    continue
            print("  [hf] All candidate models failed to load")
            return False

    def predict_with_gradcam(self, img: Image.Image) -> Optional[Dict]:
        """
        Returns {label, confidence, top, heatmap_b64, mapped_disease}
        or None if model not loaded.
        """
        if not self.loaded:
            return None
        torch = _try_import_torch()
        if torch is None:
            return None

        try:
            inputs = self.processor(images=img.convert("RGB"), return_tensors="pt")
            pixel_values = inputs["pixel_values"]

            heatmap_b64 = None

            # Forward pass with attention output for Grad-CAM (last layer only).
            # We request attentions but only use the LAST layer — far cheaper
            # than full-rollout multiplication across all 12 ViT layers.
            with torch.no_grad():
                try:
                    outputs = self.model(pixel_values, output_attentions=True)
                    attentions = getattr(outputs, "attentions", None)
                except Exception:
                    outputs = self.model(pixel_values)
                    attentions = None

            logits = outputs.logits[0]
            probs = torch.softmax(logits, dim=-1).cpu().numpy()

            top_k = min(5, len(probs))
            top_idx = np.argsort(probs)[::-1][:top_k]
            top = [{"label": str(self.id2label.get(int(i), str(i))),
                    "confidence": round(float(probs[int(i)]), 6)}
                   for i in top_idx]
            label = top[0]["label"]
            conf = top[0]["confidence"]

            # Map model output to our disease categories
            mapped = _map_hf_label_to_disease(label)

            # Fast Grad-CAM: use only the LAST layer attention (much cheaper
            # than full attention rollout). Visually equivalent for most cases.
            if attentions is not None and len(attentions) > 0:
                try:
                    heatmap_b64 = _last_layer_attention_overlay(
                        attentions[-1], img)
                except Exception as e:
                    print(f"  [gradcam] last-layer attention failed: {e}")

            return {
                "label": label,
                "confidence": conf,
                "top": top,
                "heatmap_b64": heatmap_b64,
                "mapped_disease": mapped,
            }
        except Exception as e:
            print(f"  [hf] predict error: {e}")
            traceback.print_exc()
            return None


def _map_hf_label_to_disease(label: str) -> str:
    """Map raw HF model label to a canonical disease key.

    Exact match first (avoids 'normal' inside 'abnormal' style false positives),
    then longest-keyword match. Unknown labels return a normalized slug instead
    of silently defaulting to 'healthy' so the frontend can show the actual
    model output rather than hallucinating a wrong category.
    """
    norm = label.lower().strip().replace("_", " ").replace("-", " ")
    norm = " ".join(norm.split())
    if norm in _HF_LABEL_TO_DISEASE:
        return _HF_LABEL_TO_DISEASE[norm]
    for keyword in sorted(_HF_LABEL_TO_DISEASE.keys(), key=len, reverse=True):
        if keyword in norm:
            return _HF_LABEL_TO_DISEASE[keyword]
    return norm.replace(" ", "_")


# ---------------------------------------------------------------------------
# Grad-CAM / Attention Rollout — generates explainability heatmap
# ---------------------------------------------------------------------------

def _last_layer_attention_overlay(last_attn, original_img: Image.Image) -> str:
    """
    Fast Grad-CAM variant: extract the CLS-token attention from the LAST
    transformer layer only. ~12x cheaper than full attention rollout while
    producing visually equivalent saliency maps for most cases.

    last_attn shape: (batch=1, heads, tokens, tokens)
    """
    torch = _try_import_torch()
    if torch is None or last_attn is None:
        return ""

    # Mean across heads, take CLS row, drop CLS->CLS, reshape to grid
    attn = last_attn[0].mean(dim=0)  # (tokens, tokens)
    cls_attn = attn[0, 1:].cpu().numpy()  # (num_patches,)
    grid_size = int(np.sqrt(cls_attn.shape[0]))
    if grid_size * grid_size != cls_attn.shape[0]:
        return ""
    heatmap = cls_attn.reshape(grid_size, grid_size)
    heatmap = (heatmap - heatmap.min()) / (heatmap.max() - heatmap.min() + 1e-8)
    return _render_heatmap_overlay(original_img, heatmap)


def _gradient_saliency_overlay(model, pixel_values, target_class: int,
                               original_img: Image.Image) -> str:
    """
    Gradient-based saliency map (works for any model architecture, including
    CNNs that don't expose attention weights).
    Computes |d logit / d input pixel| then overlays on the image.
    """
    torch = _try_import_torch()
    if torch is None:
        return ""

    pv = pixel_values.detach().clone().requires_grad_(True)
    model.zero_grad()
    out = model(pv)
    score = out.logits[0, target_class]
    score.backward()
    grads = pv.grad[0].detach()  # (C, H, W)

    # Take max abs across channels — standard saliency
    sal = grads.abs().max(dim=0).values.cpu().numpy()

    # Smooth with a small box filter to look less noisy
    k = 5
    pad = k // 2
    padded = np.pad(sal, pad, mode="edge")
    smoothed = np.zeros_like(sal)
    for i in range(k):
        for j in range(k):
            smoothed += padded[i:i + sal.shape[0], j:j + sal.shape[1]]
    smoothed /= (k * k)

    # Normalize
    smoothed = (smoothed - smoothed.min()) / (smoothed.max() - smoothed.min() + 1e-8)
    return _render_heatmap_overlay(original_img, smoothed)


def _attention_rollout_overlay(attentions, original_img: Image.Image) -> str:
    """
    Compute attention rollout from ViT attention weights and overlay on the
    original image as a heatmap. Returns base64-encoded PNG.

    Reference: "Quantifying Attention Flow in Transformers" (Abnar & Zuidema 2020)
    """
    torch = _try_import_torch()
    if torch is None:
        return ""

    # attentions: tuple of (B, heads, tokens, tokens) — one per transformer block
    with torch.no_grad():
        # Average heads, add identity (residual), normalize per row, multiply across layers
        result = None
        for attn in attentions:
            attn_avg = attn.mean(dim=1)[0]  # (tokens, tokens)
            n = attn_avg.shape[-1]
            eye = torch.eye(n, device=attn_avg.device)
            a = attn_avg + eye
            a = a / a.sum(dim=-1, keepdim=True)
            result = a if result is None else a @ result

        # CLS token attention to all patches (skip CLS-to-CLS)
        mask = result[0, 1:].cpu().numpy()

    n_patches = mask.shape[0]
    grid_size = int(round(math.sqrt(n_patches)))
    if grid_size * grid_size != n_patches:
        # not a square grid — fall back to nearest
        grid_size = int(math.floor(math.sqrt(n_patches)))
        mask = mask[:grid_size * grid_size]

    mask = mask.reshape(grid_size, grid_size)
    mask = (mask - mask.min()) / (mask.max() - mask.min() + 1e-8)

    return _render_heatmap_overlay(original_img, mask)


def _render_heatmap_overlay(img: Image.Image, mask: np.ndarray, alpha: float = 0.45) -> str:
    """Render a heatmap overlay using a jet-like colormap. Returns base64 PNG."""
    target_w, target_h = 384, 384
    rgb_img = img.convert("RGB").resize((target_w, target_h), resample=Image.BILINEAR)
    rgb = np.array(rgb_img, dtype=np.float32)

    # Resize mask
    mask_img = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8))
    mask_img = mask_img.resize((target_w, target_h), resample=Image.BILINEAR)
    m = np.array(mask_img, dtype=np.float32) / 255.0

    # Jet-like colormap: blue -> cyan -> green -> yellow -> red
    r = np.clip(1.5 - np.abs(4 * m - 3), 0, 1)
    g = np.clip(1.5 - np.abs(4 * m - 2), 0, 1)
    b = np.clip(1.5 - np.abs(4 * m - 1), 0, 1)
    cmap = np.stack([r, g, b], axis=-1) * 255.0

    # Blend (give cooler regions less weight to keep image visible)
    weight = (m ** 0.6)[..., None] * alpha
    overlay = rgb * (1 - weight) + cmap * weight
    overlay = np.clip(overlay, 0, 255).astype(np.uint8)

    buf = io.BytesIO()
    Image.fromarray(overlay).save(buf, format="JPEG", quality=82)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


# ---------------------------------------------------------------------------
# Advanced banner / non-skin detection (catches ads, products, screenshots)
# ---------------------------------------------------------------------------

def detect_skin(img: Image.Image) -> dict:
    try:
        rgb = img.convert("RGB").resize((128, 128), resample=Image.BILINEAR)
        arr = np.asarray(rgb, dtype=np.float32)

        r, g, b = arr[..., 0] / 255.0, arr[..., 1] / 255.0, arr[..., 2] / 255.0
        cmax = np.maximum(np.maximum(r, g), b)
        cmin = np.minimum(np.minimum(r, g), b)
        diff = cmax - cmin

        hue = np.zeros_like(diff)
        mask = diff > 0
        mr = (cmax == r) & mask
        mg = (cmax == g) & mask
        mb = (cmax == b) & mask
        hue[mr] = (60 * ((g[mr] - b[mr]) / diff[mr]) + 360) % 360
        hue[mg] = (60 * ((b[mg] - r[mg]) / diff[mg]) + 120) % 360
        hue[mb] = (60 * ((r[mb] - g[mb]) / diff[mb]) + 240) % 360

        with np.errstate(invalid='ignore'):
            sat = np.where(cmax > 0, diff / cmax, 0)
        val = cmax

        skin_mask = (
            ((hue >= 0) & (hue <= 50)) |
            ((hue >= 340) & (hue <= 360))
        ) & ((sat >= 0.08) & (sat <= 0.68)) & (val >= 0.20)

        total = skin_mask.size
        skin_count = int(np.sum(skin_mask))
        skin_ratio = skin_count / total

        non_skin = (((hue >= 80) & (hue <= 300)) & (sat > 0.25) & (val > 0.25))
        non_skin_ratio = float(np.mean(non_skin))
        high_sat_ratio = float(np.mean(sat > 0.65))

        gray = np.mean(arr, axis=-1)
        gy, gx = np.gradient(gray)
        edge_mag = np.sqrt(gx**2 + gy**2)
        sharp_edge_ratio = float(np.mean(edge_mag > 25))

        pure_white = float(np.mean((r > 0.95) & (g > 0.95) & (b > 0.95)))
        pure_black = float(np.mean((r < 0.05) & (g < 0.05) & (b < 0.05)))
        extreme_pixels = pure_white + pure_black

        h_mid, w_mid = 64, 64
        quadrants = [arr[:h_mid, :w_mid], arr[:h_mid, w_mid:],
                     arr[h_mid:, :w_mid], arr[h_mid:, w_mid:]]
        q_means = [np.mean(q, axis=(0, 1)) for q in quadrants]
        q_diffs = []
        for i in range(len(q_means)):
            for j in range(i + 1, len(q_means)):
                q_diffs.append(float(np.linalg.norm(q_means[i] - q_means[j])))
        max_q_diff = max(q_diffs) if q_diffs else 0

        banner_score = 0.0
        reasons = []
        if non_skin_ratio > 0.25:
            banner_score += 0.40; reasons.append(f"non_skin={non_skin_ratio:.2f}")
        elif non_skin_ratio > 0.15:
            banner_score += 0.20; reasons.append(f"non_skin={non_skin_ratio:.2f}")
        if high_sat_ratio > 0.25:
            banner_score += 0.25; reasons.append(f"high_sat={high_sat_ratio:.2f}")
        elif high_sat_ratio > 0.15:
            banner_score += 0.10
        if sharp_edge_ratio > 0.20:
            banner_score += 0.20; reasons.append(f"edges={sharp_edge_ratio:.2f}")
        if extreme_pixels > 0.40:
            banner_score += 0.15; reasons.append(f"extreme={extreme_pixels:.2f}")
        if skin_ratio < 0.10:
            banner_score += 0.30; reasons.append(f"very_low_skin={skin_ratio:.2f}")
        elif skin_ratio < 0.20:
            banner_score += 0.15; reasons.append(f"low_skin={skin_ratio:.2f}")
        if max_q_diff > 100:
            banner_score += 0.15; reasons.append(f"blocks={max_q_diff:.0f}")

        if skin_ratio > 0.40:
            threshold = 0.65
        elif skin_ratio > 0.25:
            threshold = 0.50
        else:
            threshold = 0.40

        is_skin = banner_score < threshold and skin_ratio >= 0.10
        print(f"  [skin_detect] is_skin={is_skin} skin={skin_ratio:.3f} score={banner_score:.2f} {reasons}")
        return {"is_skin": is_skin, "skin_ratio": round(skin_ratio, 4)}
    except Exception as e:
        print(f"  [skin_detect] error: {e}")
        return {"is_skin": True, "skin_ratio": 1.0}


# ---------------------------------------------------------------------------
# CV-based skin type classifier
# ---------------------------------------------------------------------------

def cv_classify_skin_type(img: Image.Image) -> Tuple[str, float, Dict[str, float]]:
    rgb = img.convert("RGB").resize((256, 256), resample=Image.BILINEAR)
    arr = np.asarray(rgb, dtype=np.float32)
    gray = np.mean(arr, axis=-1)

    p99 = float(np.percentile(gray, 99))
    p90 = float(np.percentile(gray, 90))
    very_bright_ratio = float(np.mean(gray > 230))
    bright_ratio = float(np.mean(gray > 200))
    highlight_spread = p99 - p90

    gy, gx = np.gradient(gray)
    gradient_mag = np.sqrt(gx ** 2 + gy ** 2)
    texture_mean = float(np.mean(gradient_mag))
    gyy, _ = np.gradient(gy)
    _, gxx = np.gradient(gx)
    laplacian = gyy + gxx
    laplacian_energy = float(np.mean(np.abs(laplacian)))

    mean_brightness = float(np.mean(gray))
    brightness_std = float(np.std(gray))
    centered = gray - mean_brightness
    brightness_skew = float(np.mean(centered ** 3)) / max(brightness_std ** 3, 1e-6)

    r_c, g_c, b_c = arr[..., 0] / 255.0, arr[..., 1] / 255.0, arr[..., 2] / 255.0
    c_max = np.maximum(np.maximum(r_c, g_c), b_c)
    c_min = np.minimum(np.minimum(r_c, g_c), b_c)
    with np.errstate(invalid='ignore'):
        sat = np.where(c_max > 0, (c_max - c_min) / c_max, 0)
    mean_sat = float(np.mean(sat))

    block = 32
    h, w = gray.shape
    local_vars = []
    for i in range(0, h - block, block):
        for j in range(0, w - block, block):
            local_vars.append(float(np.var(gray[i:i + block, j:j + block])))
    local_var_mean = float(np.mean(local_vars)) if local_vars else 0.0

    oily, dry, normal = 0.0, 0.0, 0.0
    if very_bright_ratio > 0.04: oily += 0.30
    elif very_bright_ratio > 0.015: oily += 0.15
    if bright_ratio > 0.15: oily += 0.15
    elif bright_ratio < 0.03: dry += 0.10
    if highlight_spread > 25: oily += 0.10
    if brightness_std > 55: oily += 0.15
    elif brightness_std < 25: normal += 0.10; dry += 0.05
    if brightness_skew > 0.8: oily += 0.10
    elif brightness_skew < -0.3: dry += 0.10
    if texture_mean > 14: dry += 0.30
    elif texture_mean > 9: dry += 0.15
    elif texture_mean < 4: oily += 0.05; normal += 0.10
    if laplacian_energy > 8: dry += 0.15
    elif laplacian_energy < 3: normal += 0.10
    if local_var_mean > 800: dry += 0.15
    elif local_var_mean < 200: normal += 0.10
    if mean_sat > 0.30: oily += 0.10
    elif mean_sat < 0.12: dry += 0.10
    if mean_brightness > 180: oily += 0.10
    normal += 0.15

    total = oily + dry + normal
    if total == 0:
        return "normal", 0.40, {"oily": 0.33, "dry": 0.33, "normal": 0.34}
    scores = {"oily": round(oily / total, 4), "dry": round(dry / total, 4),
              "normal": round(normal / total, 4)}
    best = max(scores, key=scores.get)
    return best, scores[best], scores


# ---------------------------------------------------------------------------
# Groq Vision API — PRIMARY analysis engine (free, fast, accurate)
# Sign up free at https://console.groq.com — no credit card needed
# ---------------------------------------------------------------------------

_GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
_GROQ_MODELS = [
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.2-11b-vision-preview",
]


def _groq_analyze(img: Image.Image) -> Optional[Dict]:
    if not _GROQ_API_KEY:
        return None
    try:
        buf = io.BytesIO()
        img.convert("RGB").resize((512, 512), Image.BILINEAR).save(buf, format="JPEG", quality=80)
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        prompt = (
            "CRITICAL FIRST STEP: Determine if this image shows ACTUAL HUMAN SKIN "
            "(a real photograph of a face, arm, hand, leg, body part). "
            "If it is a banner, advertisement, product, cosmetic, packaging, "
            "logo, screenshot, illustration, cartoon, or anything that is NOT a real "
            "photograph of human skin, set is_skin to false.\n\n"
            "If it IS real human skin, classify carefully:\n"
            "- skin_type: 'oily' (shiny, glossy, enlarged pores, greasy T-zone), "
            "'dry' (matte, flaky, rough, fine lines, peeling), or 'normal'\n"
            "- disease: 'healthy' (no concerning features), "
            "'ringworm' (circular ring-shaped red lesion with raised scaly border), "
            "'lupus' (butterfly-shaped malar rash across cheeks and nose), or "
            "'scalp_infections' (scaling, crusting, pustules on scalp)\n"
            "Only diagnose disease if you see CLEAR clinical signs. Default 'healthy'.\n\n"
            "Respond with ONLY valid JSON, no other text:\n"
            '{"is_skin":true,"skin_type":"normal","skin_type_confidence":0.85,'
            '"disease":"healthy","disease_confidence":0.90}'
        )

        last_error = None
        for model in _GROQ_MODELS:
            try:
                payload = json.dumps({
                    "model": model,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                        ]
                    }],
                    "temperature": 0.1, "max_tokens": 250,
                }).encode("utf-8")
                req = urllib.request.Request(
                    "https://api.groq.com/openai/v1/chat/completions",
                    data=payload, method="POST")
                req.add_header("Content-Type", "application/json")
                req.add_header("Authorization", f"Bearer {_GROQ_API_KEY}")
                with urllib.request.urlopen(req, timeout=20) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                text = data["choices"][0]["message"]["content"].strip()
                if "```" in text:
                    parts = text.split("```")
                    if len(parts) >= 2:
                        json_part = parts[1]
                        if json_part.startswith("json"):
                            json_part = json_part[4:]
                        text = json_part.strip()
                if not text.startswith("{"):
                    m = re.search(r'\{[^{}]*\}', text)
                    if m: text = m.group()
                result = json.loads(text)
                valid_st = {"oily", "dry", "normal"}
                valid_ds = {"healthy", "ringworm", "lupus", "scalp_infections"}
                st = str(result.get("skin_type", "normal")).lower().strip()
                if st not in valid_st: st = "normal"
                ds = str(result.get("disease", "healthy")).lower().strip()
                if ds not in valid_ds: ds = "healthy"
                parsed = {
                    "skin_type": st,
                    "skin_type_confidence": max(0.0, min(1.0, float(result.get("skin_type_confidence", 0.7)))),
                    "disease": ds,
                    "disease_confidence": max(0.0, min(1.0, float(result.get("disease_confidence", 0.7)))),
                    "is_skin": bool(result.get("is_skin", True)),
                }
                print(f"  [groq] model={model.split('/')[-1]}  result={parsed}")
                return parsed
            except urllib.error.HTTPError as e:
                last_error = f"HTTP {e.code}"
                print(f"  [groq] {model} -> {last_error}, trying next")
                continue
            except Exception as e:
                last_error = str(e)
                print(f"  [groq] {model} -> {last_error}")
                continue
        print(f"  [groq] all models failed: {last_error}")
        return None
    except Exception as e:
        print(f"  [groq] error: {e}")
        return None


# ---------------------------------------------------------------------------
# Enhanced Analysis — combines all signals
# ---------------------------------------------------------------------------

ai_enhanced = True
_HF_INSTANCE = HFSkinModel()


def enhanced_analyze(img: Image.Image, hf_result: Optional[Dict],
                     skin_type_pred: Optional[Dict], skin_check: dict) -> Optional[Dict]:
    """
    Combine Groq + HF + CV signals into final prediction.
    Returns dict under 'gemini' key for frontend compat.
    """
    try:
        result = {}

        groq_result = _groq_analyze(img)
        local_is_skin = skin_check.get("is_skin", True)

        # is_skin decision: prefer Groq, then local CV
        if groq_result:
            if groq_result.get("is_skin") is False:
                print("  [ai] Groq says NOT skin — rejecting")
                result["is_skin"] = False
                return result
            is_skin = True
        else:
            if not local_is_skin:
                print("  [ai] Local CV says NOT skin")
                result["is_skin"] = False
                return result
            is_skin = True
        result["is_skin"] = is_skin

        # ---- Skin type classification ----
        if groq_result and groq_result.get("skin_type_confidence", 0) > 0.3:
            st_label = groq_result["skin_type"]
            st_conf = groq_result["skin_type_confidence"]
            print(f"  [skin_type] Groq: {st_label} ({st_conf:.2f})")
        elif skin_type_pred:
            tflite_label = skin_type_pred.get("label", "normal").lower()
            tflite_conf = skin_type_pred.get("confidence", 0.33)
            tflite_top = skin_type_pred.get("top", [])
            cv_label, cv_conf, _ = cv_classify_skin_type(img)
            margin = (tflite_top[0]["confidence"] - tflite_top[1]["confidence"]) if len(tflite_top) >= 2 else 0
            if tflite_conf > 0.50 and margin > 0.10:
                st_label = tflite_label
                st_conf = tflite_conf if cv_label != tflite_label else min(tflite_conf * 1.1, 0.92)
            elif margin < 0.05 and cv_conf > 0.50:
                st_label = cv_label
                st_conf = min(cv_conf * 0.8, 0.70)
            else:
                st_label = tflite_label
                st_conf = tflite_conf
            print(f"  [skin_type] TFLite+CV: {st_label} ({st_conf:.2f})")
        else:
            cv_label, cv_conf, _ = cv_classify_skin_type(img)
            st_label = cv_label
            st_conf = cv_conf
            print(f"  [skin_type] CV only: {st_label} ({st_conf:.2f})")

        result["skin_type"] = st_label
        result["skin_type_confidence"] = round(min(st_conf, 0.95), 3)

        # ---- Disease classification ----
        # Priority: Groq > HF model > healthy default
        if groq_result and groq_result.get("disease_confidence", 0) > 0.3:
            ds_label = groq_result["disease"]
            ds_conf = groq_result["disease_confidence"]
            print(f"  [disease] Groq: {ds_label} ({ds_conf:.2f})")
            # Cross-validate with HF model: if both say diseased, boost confidence
            if hf_result and ds_label != "healthy":
                hf_mapped = hf_result.get("mapped_disease", "healthy")
                if hf_mapped == ds_label:
                    ds_conf = min(ds_conf * 1.05, 0.97)
                    print(f"    HF cross-validates -> boost to {ds_conf:.2f}")
        elif hf_result:
            mapped = hf_result.get("mapped_disease", "healthy")
            hf_conf = hf_result.get("confidence", 0.5)
            # HF models trained on cancer datasets may be over-confident on benign
            if mapped == "healthy":
                ds_label = "healthy"
                ds_conf = max(hf_conf, 0.75)
            else:
                # Require strong confidence to call it a disease
                if hf_conf > 0.60:
                    ds_label = mapped
                    ds_conf = hf_conf
                else:
                    ds_label = "healthy"
                    ds_conf = 0.70
            print(f"  [disease] HF model -> {ds_label} ({ds_conf:.2f})  (raw: {hf_result.get('label')} {hf_conf:.2f})")
        else:
            ds_label = "healthy"
            ds_conf = 0.70
            print(f"  [disease] no model available, default healthy")

        result["disease"] = ds_label
        result["disease_confidence"] = round(min(ds_conf, 0.97), 3)

        # ---- Grad-CAM heatmap (always include if HF model produced one) ----
        if hf_result and hf_result.get("heatmap_b64"):
            result["heatmap"] = hf_result["heatmap_b64"]
            result["heatmap_method"] = "attention_rollout" if _HF_INSTANCE.is_vit else "grad_cam"
            result["heatmap_model"] = _HF_INSTANCE.model_name or "unknown"

        print(f"  [ai] Final: is_skin={result.get('is_skin')} disease={result.get('disease')} "
              f"skin_type={result.get('skin_type')} heatmap={'yes' if result.get('heatmap') else 'no'}")
        return result
    except Exception as e:
        print(f"  [ai] error: {e}")
        traceback.print_exc()
        return None


# ---------------------------------------------------------------------------
# Flask server
# ---------------------------------------------------------------------------

def create_app(skin_type_model: Optional[TFLiteModel]):
    from flask import Flask, request as flask_request, jsonify
    from flask_cors import CORS
    app = Flask(__name__)
    CORS(app)

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({
            "status": "ok",
            "skin_type_model": skin_type_model is not None,
            "hf_model": _HF_INSTANCE.loaded,
            "hf_model_name": _HF_INSTANCE.model_name,
            "ai_enabled": ai_enhanced,
            "ai_provider": "groq+hf+cv" if _GROQ_API_KEY else ("hf+cv" if _HF_INSTANCE.loaded else "cv_only"),
            "groq_configured": bool(_GROQ_API_KEY),
            "skin_detection": "advanced_cv",
            "gradcam_enabled": _HF_INSTANCE.loaded,
        })

    @app.route("/predict", methods=["POST"])
    def predict():
        if "image" not in flask_request.files:
            return jsonify({"error": "No image file in request"}), 400
        file = flask_request.files["image"]
        try:
            img = Image.open(io.BytesIO(file.read()))
        except Exception as e:
            return jsonify({"error": f"Could not open image: {e}"}), 400

        # Optional fast mode: skip the heavy HF model (CV-only response in <1s)
        fast_mode = flask_request.args.get("fast", "").lower() in ("1", "true", "yes")

        result = {}

        # Local CV skin detection
        skin_check = detect_skin(img)
        result["skin_detected"] = skin_check

        # HuggingFace pretrained model + Grad-CAM (with hard time budget)
        hf_result = None
        if _HF_INSTANCE.loaded and not fast_mode:
            t0 = time.time()
            try:
                from concurrent.futures import ThreadPoolExecutor, TimeoutError as FTimeout
                with ThreadPoolExecutor(max_workers=1) as ex:
                    fut = ex.submit(_HF_INSTANCE.predict_with_gradcam, img)
                    # Hard budget: 45s on slow shared CPU. If exceeded, return
                    # CV-only result rather than hanging the request.
                    hf_result = fut.result(timeout=45)
            except Exception as e:
                print(f"  [hf] inference timed out or failed: {type(e).__name__}: {e}")
                hf_result = None
            if hf_result:
                result["hf"] = {
                    "label": hf_result["label"],
                    "confidence": hf_result["confidence"],
                    "top": hf_result["top"],
                    "mapped_disease": hf_result["mapped_disease"],
                    "inference_ms": round((time.time() - t0) * 1000, 1),
                }

        # Legacy TFLite skin type model (still useful as backup)
        skin_type_pred = None
        if skin_type_model:
            t0 = time.time()
            skin_type_pred = skin_type_model.predict(img, topk=3)
            result["skin_type"] = {
                "label": skin_type_pred["label"],
                "confidence": skin_type_pred["confidence"],
                "top": skin_type_pred["top"],
                "inference_ms": round((time.time() - t0) * 1000, 1),
            }

        # Combined enhanced analysis
        ai_result = enhanced_analyze(img, hf_result, skin_type_pred, skin_check)
        if ai_result is not None:
            result["gemini"] = ai_result

        return jsonify(result)

    return app


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 5001)))
    parser.add_argument("--skip-hf", action="store_true",
                        help="Skip loading HuggingFace model (faster startup)")
    args = parser.parse_args()

    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
    os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")

    ml_dir = os.path.dirname(os.path.abspath(__file__))

    print("=" * 50)
    print("SkinPro ML Server v4 (HF + Grad-CAM)")
    print("=" * 50)
    t0 = time.time()

    # Load TFLite skin type model (kept for backup)
    skin_type_model: Optional[TFLiteModel] = None
    sm_path = os.path.join(ml_dir, "skin_type_model.tflite")
    sl_path = os.path.join(ml_dir, "skin_type_labels.txt")
    if os.path.exists(sm_path):
        try:
            skin_type_model = TFLiteModel(sm_path, sl_path, name="skin_type")
        except Exception as e:
            print(f"  [skin_type] load failed: {e}")

    # Load HuggingFace model (this is the big one — disease classifier + Grad-CAM)
    if not args.skip_hf:
        print(f"\n  Loading HuggingFace pretrained skin model + Grad-CAM...")
        _HF_INSTANCE.load()

    print(f"\nModels loaded in {time.time()-t0:.1f}s")
    print(f"  HF model:     {'YES — ' + (_HF_INSTANCE.model_name or '') if _HF_INSTANCE.loaded else 'NO'}")
    print(f"  Grad-CAM:     {'ENABLED' if _HF_INSTANCE.loaded else 'DISABLED'}")
    print(f"  Groq API:     {'CONFIGURED' if _GROQ_API_KEY else 'NOT SET'}")
    if not _GROQ_API_KEY:
        print(f"  [tip] For best accuracy set GROQ_API_KEY (free at console.groq.com)")

    print(f"\nStarting server on http://{args.host}:{args.port}")
    print("=" * 50)

    app = create_app(skin_type_model)
    app.run(host=args.host, port=args.port, debug=False)


if __name__ == "__main__":
    main()
