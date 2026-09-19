"""
SkinPro ML Prediction Server v3

Uses Groq Vision AI as the PRIMARY analysis engine for accurate skin detection,
skin type classification, and disease detection. Falls back to local TFLite + CV
analysis when Groq is unavailable.

Key improvements over v2:
- Groq is PRIMARY, not optional fallback
- Advanced banner/non-skin image detection (rejects ads, products, screenshots)
- TFLite model NEVER overrides skin detection
- Better prompt engineering for Groq vision model

Setup:
    1. Get free Groq API key: https://console.groq.com (no credit card)
    2. Set GROQ_API_KEY environment variable
    3. python ml/server.py

Usage:
    python ml/server.py                          # default port 5001
    python ml/server.py --port 5002              # custom port
    python ml/server.py --host 0.0.0.0           # expose on LAN
"""

import argparse
import base64
import io
import json
import math
import os
import re
import sys
import time
import traceback
import urllib.request
import urllib.error
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image

# ---------------------------------------------------------------------------
# Model helpers
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


class TFLiteModel:
    """Wrapper around a TFLite interpreter that stays loaded in memory."""

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

        print(f"  [{self.name}] Loaded: shape={list(self.input_shape)}, "
              f"labels={self.labels}")

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

        top = [
            {"label": label_for(int(i)), "confidence": round(float(probs[int(i)]), 6)}
            for i in top_indices
        ]

        return {
            "label": top[0]["label"],
            "confidence": top[0]["confidence"],
            "top": top,
        }


# ---------------------------------------------------------------------------
# Advanced skin detection — catches banners, products, screenshots, etc.
# ---------------------------------------------------------------------------

def detect_skin(img: Image.Image) -> dict:
    """
    Detect if image contains actual human skin vs banners, products, graphics.
    Uses multiple signals: HSV skin pixels, non-skin colors, edge density,
    color saturation, pure white/black pixels, color block variance.
    Returns {"is_skin": True/False, "skin_ratio": float}.
    """
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

        # --- Signal 1: Skin-tone pixels (HSV range for human skin) ---
        skin_mask = (
            ((hue >= 0) & (hue <= 50)) |
            ((hue >= 340) & (hue <= 360))
        ) & (
            (sat >= 0.08) & (sat <= 0.68)
        ) & (
            (val >= 0.20)
        )

        total = skin_mask.size
        skin_count = int(np.sum(skin_mask))
        skin_ratio = skin_count / total

        # --- Signal 2: Non-skin colors (blues, greens, cyans, purples) ---
        non_skin = (
            ((hue >= 80) & (hue <= 300)) &
            (sat > 0.25) &
            (val > 0.25)
        )
        non_skin_ratio = float(np.mean(non_skin))

        # --- Signal 3: Very saturated pixels (vivid graphics/banners) ---
        high_sat_ratio = float(np.mean(sat > 0.65))

        # --- Signal 4: Sharp edge density (text/graphics have many edges) ---
        gray = np.mean(arr, axis=-1)
        gy, gx = np.gradient(gray)
        edge_mag = np.sqrt(gx**2 + gy**2)
        sharp_edge_ratio = float(np.mean(edge_mag > 25))

        # --- Signal 5: Pure white/black pixels (graphics, not skin) ---
        pure_white = float(np.mean((r > 0.95) & (g > 0.95) & (b > 0.95)))
        pure_black = float(np.mean((r < 0.05) & (g < 0.05) & (b < 0.05)))
        extreme_pixels = pure_white + pure_black

        # --- Signal 6: Color block variance (banners have distinct color blocks) ---
        h_mid, w_mid = 64, 64
        quadrants = [
            arr[:h_mid, :w_mid],
            arr[:h_mid, w_mid:],
            arr[h_mid:, :w_mid],
            arr[h_mid:, w_mid:],
        ]
        q_means = [np.mean(q, axis=(0, 1)) for q in quadrants]
        q_diffs = []
        for i in range(len(q_means)):
            for j in range(i + 1, len(q_means)):
                q_diffs.append(float(np.linalg.norm(q_means[i] - q_means[j])))
        max_q_diff = max(q_diffs) if q_diffs else 0

        # --- Decision: weighted banner score ---
        banner_score = 0.0
        reasons = []

        # Non-skin colors are the STRONGEST signal for banners
        if non_skin_ratio > 0.25:
            banner_score += 0.40
            reasons.append(f"non_skin={non_skin_ratio:.2f}")
        elif non_skin_ratio > 0.15:
            banner_score += 0.20
            reasons.append(f"non_skin={non_skin_ratio:.2f}")

        # High saturation — only flag if very saturated (banners are vivid)
        if high_sat_ratio > 0.25:
            banner_score += 0.25
            reasons.append(f"high_sat={high_sat_ratio:.2f}")
        elif high_sat_ratio > 0.15:
            banner_score += 0.10

        # Sharp edges — raise threshold (skin texture has edges too)
        if sharp_edge_ratio > 0.20:
            banner_score += 0.20
            reasons.append(f"edges={sharp_edge_ratio:.2f}")

        # Extreme pixels — many real photos have white/dark backgrounds
        if extreme_pixels > 0.40:
            banner_score += 0.15
            reasons.append(f"extreme_px={extreme_pixels:.2f}")

        # Very low skin ratio is a strong signal
        if skin_ratio < 0.10:
            banner_score += 0.30
            reasons.append(f"very_low_skin={skin_ratio:.2f}")
        elif skin_ratio < 0.20:
            banner_score += 0.15
            reasons.append(f"low_skin={skin_ratio:.2f}")

        # Large color block differences (product packaging, graphics)
        if max_q_diff > 100:
            banner_score += 0.15
            reasons.append(f"color_blocks={max_q_diff:.0f}")

        # Adaptive threshold: harder to reject when lots of skin pixels present
        if skin_ratio > 0.40:
            banner_threshold = 0.65  # very hard to reject — lots of skin pixels
        elif skin_ratio > 0.25:
            banner_threshold = 0.50  # moderately hard to reject
        else:
            banner_threshold = 0.40  # easier to reject — few skin pixels

        is_skin = banner_score < banner_threshold and skin_ratio >= 0.10

        debug = (f"skin={skin_ratio:.3f} non_skin={non_skin_ratio:.3f} "
                 f"sat={high_sat_ratio:.3f} edges={sharp_edge_ratio:.3f} "
                 f"extreme={extreme_pixels:.3f} blocks={max_q_diff:.0f} "
                 f"banner_score={banner_score:.2f}")
        if reasons:
            debug += f" [{', '.join(reasons)}]"
        print(f"  [skin_detect] is_skin={is_skin} {debug}")

        return {"is_skin": is_skin, "skin_ratio": round(skin_ratio, 4)}
    except Exception as e:
        print(f"  [skin_detect] Error: {e}")
        return {"is_skin": True, "skin_ratio": 1.0}


# ---------------------------------------------------------------------------
# Computer-Vision Skin Type Classifier (independent of TFLite model)
# ---------------------------------------------------------------------------

def cv_classify_skin_type(img: Image.Image) -> Tuple[str, float, Dict[str, float]]:
    """
    Classify skin type using computer vision features.
    Features: specular highlights, texture roughness, brightness, saturation, contrast.
    Returns (label, confidence, scores_dict).
    """
    rgb = img.convert("RGB").resize((256, 256), resample=Image.BILINEAR)
    arr = np.asarray(rgb, dtype=np.float32)
    gray = np.mean(arr, axis=-1)

    # Specular highlights (shine → oily)
    p90 = float(np.percentile(gray, 90))
    p99 = float(np.percentile(gray, 99))
    very_bright_ratio = float(np.mean(gray > 230))
    bright_ratio = float(np.mean(gray > 200))
    highlight_spread = p99 - p90

    # Texture roughness (flakiness → dry)
    gy, gx = np.gradient(gray)
    gradient_mag = np.sqrt(gx ** 2 + gy ** 2)
    texture_mean = float(np.mean(gradient_mag))
    texture_p90 = float(np.percentile(gradient_mag, 90))

    gyy, _ = np.gradient(gy)
    _, gxx = np.gradient(gx)
    laplacian = gyy + gxx
    laplacian_var = float(np.var(laplacian))
    laplacian_energy = float(np.mean(np.abs(laplacian)))

    # Brightness distribution
    mean_brightness = float(np.mean(gray))
    brightness_std = float(np.std(gray))
    centered = gray - mean_brightness
    brightness_skew = float(np.mean(centered ** 3)) / max(brightness_std ** 3, 1e-6)

    # Color saturation
    r_c, g_c, b_c = arr[..., 0] / 255.0, arr[..., 1] / 255.0, arr[..., 2] / 255.0
    c_max = np.maximum(np.maximum(r_c, g_c), b_c)
    c_min = np.minimum(np.minimum(r_c, g_c), b_c)
    c_diff = c_max - c_min
    with np.errstate(invalid='ignore'):
        sat = np.where(c_max > 0, c_diff / c_max, 0)
    mean_sat = float(np.mean(sat))

    # Local contrast blocks
    block = 32
    h, w = gray.shape
    local_vars = []
    for i in range(0, h - block, block):
        for j in range(0, w - block, block):
            blk = gray[i:i + block, j:j + block]
            local_vars.append(float(np.var(blk)))
    local_var_mean = float(np.mean(local_vars)) if local_vars else 0.0
    local_var_std = float(np.std(local_vars)) if local_vars else 0.0

    # --- Scoring ---
    oily_score = 0.0
    dry_score = 0.0
    normal_score = 0.0

    # Specular highlights → oily
    if very_bright_ratio > 0.04:
        oily_score += 0.30
    elif very_bright_ratio > 0.015:
        oily_score += 0.15
    elif very_bright_ratio < 0.005:
        dry_score += 0.05

    if bright_ratio > 0.15:
        oily_score += 0.15
    elif bright_ratio < 0.03:
        dry_score += 0.10

    if highlight_spread > 25:
        oily_score += 0.10

    if brightness_std > 55:
        oily_score += 0.15
    elif brightness_std < 25:
        normal_score += 0.10
        dry_score += 0.05

    if brightness_skew > 0.8:
        oily_score += 0.10
    elif brightness_skew < -0.3:
        dry_score += 0.10

    if texture_mean > 14:
        dry_score += 0.30
    elif texture_mean > 9:
        dry_score += 0.15
    elif texture_mean < 4:
        oily_score += 0.05
        normal_score += 0.10

    if laplacian_energy > 8:
        dry_score += 0.15
    elif laplacian_energy < 3:
        normal_score += 0.10

    if laplacian_var > 120:
        dry_score += 0.10

    if local_var_mean > 800:
        dry_score += 0.15
    elif local_var_mean < 200:
        normal_score += 0.10

    if local_var_std > 500:
        dry_score += 0.10

    if mean_sat > 0.30:
        oily_score += 0.10
    elif mean_sat < 0.12:
        dry_score += 0.10

    if mean_brightness > 180:
        oily_score += 0.10
    elif mean_brightness < 100:
        dry_score += 0.05

    normal_score += 0.15

    total = oily_score + dry_score + normal_score
    if total == 0:
        return "normal", 0.40, {"oily": 0.33, "dry": 0.33, "normal": 0.34}

    scores = {
        "oily": round(oily_score / total, 4),
        "dry": round(dry_score / total, 4),
        "normal": round(normal_score / total, 4),
    }
    best = max(scores, key=scores.get)
    conf = scores[best]

    print(f"  [cv_skin] {best}={conf:.2f} scores={scores}")
    return best, conf, scores


# ---------------------------------------------------------------------------
# Computer-Vision Disease Validator
# ---------------------------------------------------------------------------

def cv_validate_disease(img: Image.Image, tflite_label: str, tflite_conf: float,
                        tflite_top: List[Dict]) -> Tuple[str, float]:
    """
    Validate / correct the TFLite disease prediction using visual features.
    Only predicts a disease if there is STRONG visual evidence.
    Otherwise defaults to 'healthy'.
    """
    rgb = img.convert("RGB").resize((128, 128), resample=Image.BILINEAR)
    arr = np.asarray(rgb, dtype=np.float32)
    gray = np.mean(arr, axis=-1)

    r_ch = arr[..., 0]
    g_ch = arr[..., 1]
    b_ch = arr[..., 2]

    redness = float(np.mean(r_ch)) - (float(np.mean(g_ch)) + float(np.mean(b_ch))) / 2.0
    red_pixel_ratio = float(np.mean((r_ch > g_ch + 20) & (r_ch > b_ch + 20)))

    gy, gx = np.gradient(gray)
    edge_mag = np.sqrt(gx ** 2 + gy ** 2)
    strong_edge_ratio = float(np.mean(edge_mag > np.percentile(edge_mag, 85)))

    gyy, _ = np.gradient(gy)
    _, gxx = np.gradient(gx)
    lap_energy = float(np.mean(np.abs(gyy + gxx)))

    margin = 1.0
    if len(tflite_top) >= 2:
        margin = tflite_top[0].get("confidence", 0) - tflite_top[1].get("confidence", 0)

    label = tflite_label.lower()
    conf = tflite_conf

    print(f"  [cv_disease] tflite={label}({conf:.2f}) margin={margin:.2f} "
          f"redness={redness:.1f} red_px={red_pixel_ratio:.3f} "
          f"edge={strong_edge_ratio:.3f} lap={lap_energy:.1f}")

    if label == "healthy":
        if redness < 15 and red_pixel_ratio < 0.15 and strong_edge_ratio < 0.25:
            conf = max(conf, 0.85)
        return "healthy", min(conf, 0.97)

    if label == "ringworm":
        if conf < 0.70 or margin < 0.15:
            print("    -> overriding to healthy (low confidence/margin for ringworm)")
            return "healthy", 0.80
        if red_pixel_ratio < 0.05 and redness < 5:
            print("    -> overriding to healthy (no redness for ringworm)")
            return "healthy", 0.75
        return "ringworm", min(conf, 0.95)

    if label == "lupus":
        if conf < 0.65 or margin < 0.12:
            print("    -> overriding to healthy (low confidence/margin for lupus)")
            return "healthy", 0.78
        if redness < 10 and red_pixel_ratio < 0.10:
            print("    -> overriding to healthy (no redness for lupus)")
            return "healthy", 0.75
        return "lupus", min(conf, 0.95)

    if label == "scalp_infections":
        if conf < 0.65 or margin < 0.12:
            print("    -> overriding to healthy (low conf/margin for scalp_infections)")
            return "healthy", 0.78
        if lap_energy < 4 and strong_edge_ratio < 0.15:
            print("    -> overriding to healthy (no texture evidence for scalp)")
            return "healthy", 0.75
        return "scalp_infections", min(conf, 0.95)

    return label, min(conf, 0.85)


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
    """
    Call Groq free API with a vision model for accurate skin analysis.
    This is the PRIMARY analysis engine — not a fallback.
    Returns dict with skin_type, disease, is_skin, etc. or None on failure.
    """
    if not _GROQ_API_KEY:
        return None

    try:
        # Convert image to base64
        buf = io.BytesIO()
        img_resized = img.convert("RGB").resize((512, 512), resample=Image.BILINEAR)
        img_resized.save(buf, format="JPEG", quality=80)
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        prompt = (
            "CRITICAL FIRST STEP: Determine if this image shows ACTUAL HUMAN SKIN "
            "(a real photograph of a face, arm, hand, leg, body part). "
            "If the image is a banner, advertisement, product photo, cosmetic product, "
            "skincare product, text graphic, logo, screenshot, illustration, cartoon, "
            "packaging, stock photo with text overlay, promotional material, or ANYTHING "
            "that is NOT a real close-up photograph of actual human skin, "
            "you MUST set is_skin to false.\n\n"
            "If it IS a real photo of human skin, analyze carefully:\n"
            "- skin_type: 'oily' (shiny, glossy, visible enlarged pores, greasy/dewy T-zone, "
            "sebum visible), 'dry' (matte, flaky patches, rough texture, fine lines, "
            "tightness, dull/ashy appearance, peeling), or 'normal' (balanced, smooth, "
            "even tone, small pores, no excess oil or dryness)\n"
            "- disease: 'healthy' (normal skin, no concerning features), "
            "'ringworm' (circular/ring-shaped red lesion with raised scaly border, "
            "clearing center), 'lupus' (butterfly-shaped rash across both cheeks and nose "
            "bridge, malar rash), or 'scalp_infections' (scaling, crusting, pustules, "
            "redness specifically on the scalp)\n"
            "IMPORTANT: Only diagnose a disease if you see CLEAR unmistakable clinical signs. "
            "Default to 'healthy' when unsure.\n\n"
            "Respond with ONLY valid JSON, absolutely no other text:\n"
            '{"is_skin":true,"skin_type":"normal","skin_type_confidence":0.85,'
            '"disease":"healthy","disease_confidence":0.90}'
        )

        last_error = None
        for model in _GROQ_MODELS:
            try:
                payload = json.dumps({
                    "model": model,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/jpeg;base64,{b64}"
                                    }
                                }
                            ]
                        }
                    ],
                    "temperature": 0.1,
                    "max_tokens": 250,
                }).encode("utf-8")

                req = urllib.request.Request(
                    "https://api.groq.com/openai/v1/chat/completions",
                    data=payload,
                    method="POST",
                )
                req.add_header("Content-Type", "application/json")
                req.add_header("Authorization", f"Bearer {_GROQ_API_KEY}")

                with urllib.request.urlopen(req, timeout=20) as resp:
                    data = json.loads(resp.read().decode("utf-8"))

                text = data["choices"][0]["message"]["content"].strip()

                # Extract JSON from response (handles markdown wrapping)
                if "```" in text:
                    parts = text.split("```")
                    if len(parts) >= 2:
                        json_part = parts[1]
                        if json_part.startswith("json"):
                            json_part = json_part[4:]
                        text = json_part.strip()

                # Fallback: find JSON object in text
                if not text.startswith("{"):
                    match = re.search(r'\{[^{}]*\}', text)
                    if match:
                        text = match.group()

                result = json.loads(text)

                # Validate and normalize fields
                valid_skin_types = {"oily", "dry", "normal"}
                valid_diseases = {"healthy", "ringworm", "lupus", "scalp_infections"}

                st = str(result.get("skin_type", "normal")).lower().strip()
                if st not in valid_skin_types:
                    st = "normal"
                ds = str(result.get("disease", "healthy")).lower().strip()
                if ds not in valid_diseases:
                    ds = "healthy"

                parsed = {
                    "skin_type": st,
                    "skin_type_confidence": max(0.0, min(1.0, float(result.get("skin_type_confidence", 0.7)))),
                    "disease": ds,
                    "disease_confidence": max(0.0, min(1.0, float(result.get("disease_confidence", 0.7)))),
                    "is_skin": bool(result.get("is_skin", True)),
                }
                print(f"  [groq] Model={model} Result: {parsed}")
                return parsed

            except urllib.error.HTTPError as e:
                last_error = f"HTTP {e.code} for model {model}"
                print(f"  [groq] {last_error}, trying next model...")
                continue
            except json.JSONDecodeError as e:
                last_error = f"JSON parse error for model {model}: {e}"
                print(f"  [groq] {last_error}")
                continue

        print(f"  [groq] All models failed. Last error: {last_error}")
        return None

    except Exception as e:
        print(f"  [groq] Error (falling back to local): {e}")
        return None


# ---------------------------------------------------------------------------
# Enhanced Analysis — Groq PRIMARY, local TFLite+CV as fallback
# ---------------------------------------------------------------------------

ai_enhanced = True


def enhanced_analyze(img: Image.Image, disease_pred: Optional[Dict],
                     skin_type_pred: Optional[Dict], skin_check: dict) -> Optional[Dict]:
    """
    Primary analysis engine. Uses Groq Vision AI when available,
    falls back to TFLite + CV analysis.
    Returns a result dict under the 'gemini' key for frontend compatibility.
    """
    try:
        result = {}

        # --- Step 1: Groq API (PRIMARY — most accurate) ---
        groq_result = _groq_analyze(img)

        # --- Step 2: Determine if this is actually skin ---
        local_is_skin = skin_check.get("is_skin", True)

        if groq_result:
            # Groq is the most trusted judge of is_skin
            if groq_result.get("is_skin") is False:
                print("  [ai] Groq says NOT skin — rejecting image")
                result["is_skin"] = False
                return result
            # Groq says it IS skin — trust it even if local disagrees
            is_skin = True
        else:
            # No Groq — trust local CV detection
            # Do NOT let TFLite model override this (it was trained on banners!)
            if not local_is_skin:
                print("  [ai] Local CV says NOT skin (no Groq available)")
                result["is_skin"] = False
                return result
            is_skin = True

        result["is_skin"] = is_skin

        # --- Step 3: Skin type classification ---
        if groq_result and groq_result.get("skin_type_confidence", 0) > 0.3:
            # Groq available — use it (most accurate)
            final_st_label = groq_result["skin_type"]
            final_st_conf = groq_result["skin_type_confidence"]
            print(f"  [skin_type] Using Groq: {final_st_label} ({final_st_conf:.2f})")
        elif skin_type_pred:
            # Fallback: TFLite + CV
            tflite_label = skin_type_pred.get("label", "normal").lower()
            tflite_conf = skin_type_pred.get("confidence", 0.33)
            tflite_top = skin_type_pred.get("top", [])

            cv_label, cv_conf, cv_scores = cv_classify_skin_type(img)

            tflite_margin = 0.0
            if len(tflite_top) >= 2:
                tflite_margin = tflite_top[0].get("confidence", 0) - tflite_top[1].get("confidence", 0)

            if tflite_conf > 0.50 and tflite_margin > 0.10:
                final_st_label = tflite_label
                final_st_conf = tflite_conf
                if cv_label == tflite_label:
                    final_st_conf = min(final_st_conf * 1.1, 0.92)
                print(f"  [skin_type] TFLite: {final_st_label} ({final_st_conf:.2f})")
            elif tflite_margin < 0.05:
                if cv_conf > 0.50:
                    final_st_label = cv_label
                    final_st_conf = min(cv_conf * 0.8, 0.70)
                    print(f"  [skin_type] CV tiebreak: {final_st_label} ({final_st_conf:.2f})")
                else:
                    final_st_label = tflite_label
                    final_st_conf = max(tflite_conf * 0.9, 0.35)
                    print(f"  [skin_type] Both uncertain: {final_st_label} ({final_st_conf:.2f})")
            else:
                final_st_label = tflite_label
                final_st_conf = tflite_conf
                print(f"  [skin_type] TFLite default: {final_st_label} ({final_st_conf:.2f})")
        else:
            final_st_label = "normal"
            final_st_conf = 0.40

        result["skin_type"] = final_st_label
        result["skin_type_confidence"] = round(min(final_st_conf, 0.95), 3)

        # --- Step 4: Disease classification ---
        if groq_result and groq_result.get("disease_confidence", 0) > 0.3:
            # Groq available — use it but validate diseases with CV
            g_disease = groq_result["disease"]
            g_conf = groq_result["disease_confidence"]

            if g_disease == "healthy":
                final_ds_label = "healthy"
                final_ds_conf = g_conf
            else:
                # Groq says disease — validate with CV for safety
                if disease_pred:
                    cv_label, cv_conf = cv_validate_disease(
                        img, g_disease, g_conf, disease_pred.get("top", []))
                    final_ds_label = cv_label
                    final_ds_conf = cv_conf
                else:
                    final_ds_label = g_disease
                    final_ds_conf = g_conf
            print(f"  [disease] Groq+CV: {final_ds_label} ({final_ds_conf:.2f})")
        elif disease_pred:
            # Fallback: TFLite + CV validation
            tflite_label = disease_pred.get("label", "healthy").lower()
            tflite_conf = disease_pred.get("confidence", 0.5)
            tflite_top = disease_pred.get("top", [])

            cv_label, cv_conf = cv_validate_disease(img, tflite_label, tflite_conf, tflite_top)
            final_ds_label = cv_label
            final_ds_conf = cv_conf
            print(f"  [disease] TFLite+CV: {final_ds_label} ({final_ds_conf:.2f})")
        else:
            final_ds_label = "healthy"
            final_ds_conf = 0.70

        result["disease"] = final_ds_label
        result["disease_confidence"] = round(min(final_ds_conf, 0.97), 3)

        print(f"  [ai] Final: {result}")
        return result
    except Exception as e:
        print(f"  [ai] Enhanced analysis error: {e}")
        traceback.print_exc()
        return None


# ---------------------------------------------------------------------------
# Flask server
# ---------------------------------------------------------------------------

def create_app(
    disease_model: Optional[TFLiteModel],
    skin_type_model: Optional[TFLiteModel],
):
    from flask import Flask, request as flask_request, jsonify
    from flask_cors import CORS
    app = Flask(__name__)
    CORS(app)

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({
            "status": "ok",
            "disease_model": disease_model is not None,
            "skin_type_model": skin_type_model is not None,
            "ai_enabled": ai_enhanced,
            "ai_provider": "groq_vision" if _GROQ_API_KEY else "local_cv_only",
            "groq_configured": bool(_GROQ_API_KEY),
            "skin_detection": "advanced_cv",
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

        result = {}

        # Local skin detection (fast CV check)
        skin_check = detect_skin(img)
        result["skin_detected"] = skin_check

        disease_pred = None
        skin_type_pred = None

        if disease_model:
            t0 = time.time()
            disease_pred = disease_model.predict(img, topk=4)
            dt = time.time() - t0
            result["disease"] = {
                "label": disease_pred["label"],
                "confidence": disease_pred["confidence"],
                "top": disease_pred["top"],
                "inference_ms": round(dt * 1000, 1),
            }

        if skin_type_model:
            t0 = time.time()
            skin_type_pred = skin_type_model.predict(img, topk=3)
            dt = time.time() - t0
            result["skin_type"] = {
                "label": skin_type_pred["label"],
                "confidence": skin_type_pred["confidence"],
                "top": skin_type_pred["top"],
                "inference_ms": round(dt * 1000, 1),
            }

        # Enhanced analysis (Groq primary, local fallback)
        ai_result = enhanced_analyze(img, disease_pred, skin_type_pred, skin_check)
        if ai_result is not None:
            result["gemini"] = ai_result  # key name kept for frontend compat

        return jsonify(result)

    return app


def main():
    parser = argparse.ArgumentParser(description="SkinPro ML prediction server")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 5001)))
    args = parser.parse_args()

    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

    ml_dir = os.path.dirname(os.path.abspath(__file__))

    print("=" * 50)
    print("SkinPro ML Server v3 — loading models...")
    print("=" * 50)
    t0 = time.time()

    disease_model: Optional[TFLiteModel] = None
    dm_path = os.path.join(ml_dir, "model.tflite")
    dl_path = os.path.join(ml_dir, "labels.txt")
    if os.path.exists(dm_path):
        disease_model = TFLiteModel(dm_path, dl_path, name="disease")
    else:
        print(f"  [disease] model.tflite NOT FOUND — skipping")

    skin_type_model: Optional[TFLiteModel] = None
    sm_path = os.path.join(ml_dir, "skin_type_model.tflite")
    sl_path = os.path.join(ml_dir, "skin_type_labels.txt")
    if os.path.exists(sm_path):
        skin_type_model = TFLiteModel(sm_path, sl_path, name="skin_type")
    else:
        print(f"  [skin_type] skin_type_model.tflite NOT FOUND — skipping")

    print(f"\nModels loaded in {time.time()-t0:.1f}s")

    if _GROQ_API_KEY:
        print(f"  [ai] Groq Vision AI ACTIVE — best accuracy mode")
        print(f"  [ai] Models: {_GROQ_MODELS}")
    else:
        print(f"  [ai] WARNING: No GROQ_API_KEY — using local analysis only (limited accuracy)")
        print(f"  [ai] Banners/non-skin detection: ACTIVE (local CV)")
        print(f"  [ai] For best accuracy, set GROQ_API_KEY (free at console.groq.com)")

    print(f"\nStarting server on http://{args.host}:{args.port}")
    print("=" * 50)

    app = create_app(disease_model, skin_type_model)
    app.run(host=args.host, port=args.port, debug=False)


if __name__ == "__main__":
    main()
