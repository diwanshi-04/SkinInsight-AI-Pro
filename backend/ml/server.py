"""
SkinInsight Pro — ML Server (v6, skincare-concern focused)
==========================================================

This server analyzes a user's skin photo and returns deterministic skincare
insights (no disease diagnosis claims). It produces:

  - skin_type:       Oily / Dry / Normal / Combination  (TFLite model + CV cross-check)
  - skin_age:        rough estimated visual age band     (CV: wrinkles + texture)
  - concerns:        per-attribute scores (0..100) for
                       acne, pigmentation, redness, oiliness,
                       dryness, pores, dark_circles, wrinkles, dullness,
                       hydration, evenness
  - overall_score:   weighted skin health score (0..100)
  - recommendations: routine + lifestyle suggestions per concern
  - heatmap:         visual overlay highlighting problem areas

Why this works (when disease detection didn't):
  - We measure objectively-quantifiable features (color, texture, contrast,
    edge density) — these are deterministic CV operations, not a model
    pretending to know rare medical conditions.
  - The TFLite skin-type model is locally trained on the
    Oily-Dry-Skin-Types dataset shipped with this repo.

Endpoints:
  GET  /health            -> readiness probe + capability flags
  POST /analyze           -> primary analysis endpoint (multipart 'image')
  POST /predict           -> alias for /analyze (backwards compat)
"""

from __future__ import annotations

import base64
import io
import os
import sys
import time
import traceback
from typing import Any, Dict, List, Tuple

import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image, ImageFilter, ImageOps

# ---------------------------------------------------------------------------
# Optional dependencies — server still works if these are missing
# ---------------------------------------------------------------------------
try:
    import cv2  # type: ignore
    _HAS_CV2 = True
except Exception:  # pragma: no cover
    cv2 = None  # type: ignore
    _HAS_CV2 = False

try:
    # Prefer lighter runtimes; fall back through the chain.
    # Set SKIN_DISABLE_TFLITE=1 to skip TF/TFLite entirely (useful for local CV-only tests).
    if os.environ.get("SKIN_DISABLE_TFLITE") == "1":
        raise ImportError("tflite disabled by env")
    try:
        from tflite_runtime.interpreter import Interpreter  # type: ignore
    except Exception:
        try:
            from ai_edge_litert.interpreter import Interpreter  # type: ignore
        except Exception:
            import tensorflow as _tf  # type: ignore
            Interpreter = _tf.lite.Interpreter  # type: ignore
    _HAS_TFLITE = True
except Exception:  # pragma: no cover
    Interpreter = None  # type: ignore
    _HAS_TFLITE = False


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
SKIN_TYPE_MODEL_PATH = os.path.join(HERE, "skin_type_model.tflite")
SKIN_TYPE_LABELS_PATH = os.path.join(HERE, "skin_type_labels.txt")

PORT = int(os.environ.get("PORT", "5001"))
HOST = os.environ.get("HOST", "0.0.0.0")

VERSION = "8.3.0-acne-deep-ensemble"


# ---------------------------------------------------------------------------
# Model loader (lazy)
# ---------------------------------------------------------------------------
class _SkinTypeModel:
    def __init__(self) -> None:
        self.interpreter = None
        self.input_details = None
        self.output_details = None
        self.labels: List[str] = []
        self.input_size: Tuple[int, int] = (224, 224)
        self.loaded = False
        self.error: str | None = None

    def load(self) -> bool:
        if self.loaded or self.error:
            return self.loaded
        if not _HAS_TFLITE:
            self.error = "tflite runtime not available"
            return False
        if not os.path.exists(SKIN_TYPE_MODEL_PATH):
            self.error = f"model file missing: {SKIN_TYPE_MODEL_PATH}"
            return False
        try:
            self.interpreter = Interpreter(model_path=SKIN_TYPE_MODEL_PATH)
            self.interpreter.allocate_tensors()
            self.input_details = self.interpreter.get_input_details()
            self.output_details = self.interpreter.get_output_details()
            shape = self.input_details[0]["shape"]
            # NHWC
            self.input_size = (int(shape[2]), int(shape[1]))
            if os.path.exists(SKIN_TYPE_LABELS_PATH):
                with open(SKIN_TYPE_LABELS_PATH, "r", encoding="utf-8") as f:
                    self.labels = [ln.strip() for ln in f.readlines() if ln.strip()]
            else:
                self.labels = ["dry", "normal", "oily"]
            self.loaded = True
            print(f"[skin-type] loaded model: input={self.input_size} labels={self.labels}")
            return True
        except Exception as e:  # pragma: no cover
            self.error = str(e)
            print(f"[skin-type] load failed: {e}")
            return False

    def predict(self, pil_img: Image.Image) -> Dict[str, Any] | None:
        if not self.loaded and not self.load():
            return None
        try:
            img = pil_img.convert("RGB").resize(self.input_size, Image.LANCZOS)
            arr = np.asarray(img, dtype=np.float32)
            dtype = self.input_details[0]["dtype"]
            if dtype == np.float32:
                arr = (arr / 127.5) - 1.0
            else:
                arr = arr.astype(dtype)
            arr = np.expand_dims(arr, 0)
            self.interpreter.set_tensor(self.input_details[0]["index"], arr)
            self.interpreter.invoke()
            out = self.interpreter.get_tensor(self.output_details[0]["index"])[0]
            # Normalize outputs to a probability distribution
            if out.dtype != np.float32:
                out = out.astype(np.float32)
            if out.max() > 1.0 or out.min() < 0.0:
                # logits — softmax
                e = np.exp(out - out.max())
                out = e / e.sum()
            elif abs(out.sum() - 1.0) > 0.05:
                out = out / max(out.sum(), 1e-6)
            top_idx = int(np.argmax(out))
            label = self.labels[top_idx] if top_idx < len(self.labels) else f"class_{top_idx}"
            return {
                "label": label,
                "confidence": float(out[top_idx]),
                "scores": {self.labels[i] if i < len(self.labels) else f"class_{i}": float(out[i])
                           for i in range(len(out))},
            }
        except Exception as e:
            print(f"[skin-type] predict failed: {e}")
            return None


_SKIN_TYPE = _SkinTypeModel()


# ---------------------------------------------------------------------------
# Image utilities
# ---------------------------------------------------------------------------
def _load_image_from_request() -> Image.Image | None:
    """Accepts multipart 'image' file OR JSON {image: 'data:...;base64,...'}"""
    if "image" in request.files:
        f = request.files["image"]
        return Image.open(f.stream).convert("RGB")
    if request.is_json:
        body = request.get_json(silent=True) or {}
        b64 = body.get("image")
        if isinstance(b64, str):
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            data = base64.b64decode(b64)
            return Image.open(io.BytesIO(data)).convert("RGB")
    return None


def _resize_for_analysis(pil_img: Image.Image, max_side: int = 800) -> Image.Image:
    w, h = pil_img.size
    s = max(w, h)
    if s <= max_side:
        return pil_img
    scale = max_side / float(s)
    return pil_img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)


def _pil_to_bgr(pil_img: Image.Image) -> np.ndarray:
    arr = np.asarray(pil_img.convert("RGB"))
    if _HAS_CV2:
        return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    return arr[:, :, ::-1].copy()


# ---------------------------------------------------------------------------
# Skin mask — detect skin pixels so we ignore background
# ---------------------------------------------------------------------------
def _skin_mask(rgb: np.ndarray) -> np.ndarray:
    """Returns boolean mask of probable skin pixels.

    Uses YCrCb thresholds (well-known robust skin-tone detector). Falls back
    to 'all pixels' if cv2 isn't available (then results may include
    background — still useful for relative comparisons).
    """
    if not _HAS_CV2:
        return np.ones(rgb.shape[:2], dtype=bool)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    lower = np.array([0, 133, 77], dtype=np.uint8)
    upper = np.array([255, 173, 127], dtype=np.uint8)
    mask = cv2.inRange(ycrcb, lower, upper)
    mask = cv2.medianBlur(mask, 7)
    pct = mask.mean() / 255.0
    if pct < 0.05:
        # Mask too sparse — likely close-up of a body part with unusual lighting.
        # Fall back to using the whole image so the analysis still runs.
        return np.ones(rgb.shape[:2], dtype=bool)
    return mask > 0


# ---------------------------------------------------------------------------
# Per-concern measurements (0..100, higher = more present)
# ---------------------------------------------------------------------------
def _clip01(x: float) -> float:
    return float(max(0.0, min(1.0, x)))


def _score_oiliness(rgb: np.ndarray, mask: np.ndarray) -> Tuple[float, np.ndarray]:
    """Specular highlights → bright, low-saturation pixels = shine/oil."""
    if not _HAS_CV2:
        gray = rgb.mean(axis=2)
        bright = (gray > 220) & mask
        score = bright.sum() / max(mask.sum(), 1)
        return _clip01(score * 8.0) * 100, bright
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    s = hsv[:, :, 1]
    v = hsv[:, :, 2]
    shine = (v > 210) & (s < 60) & mask
    score = shine.sum() / max(mask.sum(), 1)
    return _clip01(score * 6.0) * 100, shine


def _score_dryness(rgb: np.ndarray, mask: np.ndarray) -> Tuple[float, np.ndarray]:
    """Dryness: low brightness uniformity + high local contrast (flaky texture)."""
    if not _HAS_CV2:
        return 0.0, np.zeros(rgb.shape[:2], dtype=bool)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    blur = cv2.GaussianBlur(gray, (15, 15), 0)
    high_freq = np.abs(gray - blur)
    masked = high_freq[mask]
    if masked.size == 0:
        return 0.0, np.zeros(gray.shape, dtype=bool)
    rough = float(masked.mean())  # 0..255 scale
    # Lower mean saturation also = dry/dull
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    sat_mean = float(hsv[:, :, 1][mask].mean())
    score = (rough / 25.0) * 0.7 + ((100 - sat_mean) / 100.0) * 0.3
    flaky = (high_freq > 18) & mask
    return _clip01(score) * 100, flaky


def _score_redness(rgb: np.ndarray, mask: np.ndarray) -> Tuple[float, np.ndarray]:
    """Redness/erythema: elevated a* in Lab + R/G ratio."""
    if not _HAS_CV2:
        r = rgb[:, :, 0].astype(np.float32)
        g = rgb[:, :, 1].astype(np.float32) + 1.0
        ratio = r / g
        red = (ratio > 1.25) & mask
        return _clip01(red.sum() / max(mask.sum(), 1) * 4.0) * 100, red
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    a = lab[:, :, 1].astype(np.float32)  # 0..255, 128 = neutral
    a_skin = a[mask]
    if a_skin.size == 0:
        return 0.0, np.zeros(rgb.shape[:2], dtype=bool)
    above = (a_skin - 128).clip(min=0)
    redness = float(above.mean())  # higher = more red shift
    high_red = (a > 145) & mask
    score = redness / 22.0
    return _clip01(score) * 100, high_red


def _score_pigmentation(rgb: np.ndarray, mask: np.ndarray) -> Tuple[float, np.ndarray]:
    """Dark spots: localized low-L patches darker than skin baseline."""
    if not _HAS_CV2:
        gray = rgb.mean(axis=2)
        baseline = float(gray[mask].mean()) if mask.any() else float(gray.mean())
        spots = (gray < baseline - 25) & mask
        return _clip01(spots.sum() / max(mask.sum(), 1) * 6.0) * 100, spots
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    L = lab[:, :, 0].astype(np.float32)
    L_skin = L[mask]
    if L_skin.size == 0:
        return 0.0, np.zeros(L.shape, dtype=bool)
    baseline = float(np.median(L_skin))
    sigma = float(L_skin.std())
    threshold = baseline - max(15.0, sigma * 1.4)
    dark = (L < threshold) & mask
    score = dark.sum() / max(mask.sum(), 1)
    return _clip01(score * 6.0) * 100, dark


def _exclude_facial_features(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Subtract eyes/eyebrows/lips/nostrils from the skin mask so they don't
    register as acne (lips are red, eyebrows/eyes are dark, nostrils are red holes).

    Heuristic geometric exclusion (no face landmarks): cuts narrow horizontal bands
    at the typical eye and lip locations. Conservative — only excludes obvious zones.
    """
    out = mask.copy() if mask.dtype == bool else (mask > 0)
    h, w = out.shape
    # Eye band (eyes + brows): roughly y=18-42% of full image, full width
    out[int(h * 0.18):int(h * 0.42), :] &= False if False else out[int(h * 0.18):int(h * 0.42), :]
    # actually do exclusion only on the central horizontal strip where eyes sit:
    y1, y2 = int(h * 0.22), int(h * 0.40)
    x1, x2 = int(w * 0.10), int(w * 0.90)
    out[y1:y2, x1:x2] = False
    # Lips band: roughly y=70-83%, central
    ly1, ly2 = int(h * 0.70), int(h * 0.85)
    lx1, lx2 = int(w * 0.28), int(w * 0.72)
    out[ly1:ly2, lx1:lx2] = False
    # Nostril zone: small central area at y=58-68%
    ny1, ny2 = int(h * 0.58), int(h * 0.68)
    nx1, nx2 = int(w * 0.42), int(w * 0.58)
    out[ny1:ny2, nx1:nx2] = False
    return out


def _score_acne(rgb: np.ndarray, mask: np.ndarray) -> Tuple[float, np.ndarray, int]:
    """Multi-scale, multi-colorspace acne detector.

    v8 — DEEP ENSEMBLE rewrite. Detects three distinct acne morphologies:

      1. PAPULES (small inflamed red bumps, no head)
         - LAB-a elevated relative to local baseline (DoG of a-channel)
         - HSV-S elevated (saturated red, not just warm-toned)
         - 0.05–0.6 percent of skin area each

      2. PUSTULES (red bumps with white/yellow head)
         - Surrounding red ring + bright low-saturation center
         - Top-hat on V channel within red regions

      3. CYSTS / NODULES (larger dark-red inflamed regions)
         - Larger area threshold
         - High a*, low L*, persistent across scales

    Lesions get position weighting — cheek/forehead/chin acne counts more than
    chin-edge or hairline noise.

    The score uses a SOFT-SATURATING formula tuned so that:
       1 lesion  -> ~12 ;  3 lesions -> ~30 ;  6 lesions -> ~50
       12 lesions -> ~72 ;  20+      -> ~88
    """
    if not _HAS_CV2:
        return 0.0, np.zeros(rgb.shape[:2], dtype=bool), 0

    # Exclude facial features that look like acne
    skin = _exclude_facial_features(rgb, mask)
    skin_area = max(int(skin.sum()), 1)
    if skin_area < 500:
        return 0.0, np.zeros(rgb.shape[:2], dtype=bool), 0

    # ----- Color-space prep -----
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    L = lab[:, :, 0].astype(np.float32)
    a = lab[:, :, 1].astype(np.float32)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    S = hsv[:, :, 1].astype(np.float32)
    V = hsv[:, :, 2].astype(np.float32)

    # Local baseline of the a* channel using DoG (difference of Gaussians)
    # Small blur removes noise; large blur is the local skin-tone baseline.
    a_small = cv2.GaussianBlur(a, (0, 0), sigmaX=2.0)
    a_large = cv2.GaussianBlur(a, (0, 0), sigmaX=20.0)
    a_excess = a_small - a_large  # positive where redder than neighborhood

    # ----- 1) PAPULE candidate map -----
    # Significantly redder than local baseline AND saturated red.
    # v8.2: relax pixel-level thresholds (we'll do strict per-blob filtering below)
    papule_mask = (
        (a_excess > 4.0) &
        (a > 140) &
        (S > 60) &
        skin
    ).astype(np.uint8) * 255
    # Small morphological close to consolidate texture into blobs
    k3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    papule_mask = cv2.morphologyEx(papule_mask, cv2.MORPH_CLOSE, k3)

    # ----- 2) PUSTULE candidate map (white/yellow head inside red region) -----
    bright_center = (V > 215) & (S < 70) & skin
    red_region = cv2.dilate(((a_excess > 3.0) & (a > 138) & skin).astype(np.uint8) * 255, k3)
    pustule_mask = (bright_center & (red_region > 0)).astype(np.uint8) * 255

    # ----- 3) CYST candidate map (larger inflamed region) -----
    L_blur = cv2.GaussianBlur(L, (0, 0), sigmaX=20.0)
    cyst_mask = (
        (a_excess > 7.0) &
        (a > 148) &
        (L < L_blur - 5) &
        skin
    ).astype(np.uint8) * 255
    k7 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    cyst_mask = cv2.morphologyEx(cyst_mask, cv2.MORPH_CLOSE, k7)

    # ----- 4) BUMP candidate map (color-agnostic, for darker skin tones) -----
    # DoG of L channel: small bright/dark blobs that stand out from local skin.
    # Helps detect papules/comedones/PIH on dark skin where redness is low.
    L_small = cv2.GaussianBlur(L, (0, 0), sigmaX=1.5)
    L_med   = cv2.GaussianBlur(L, (0, 0), sigmaX=6.0)
    L_dog   = L_small - L_med  # positive = bright bump, negative = dark bump
    bump_mag = np.abs(L_dog)
    bump_mask = ((bump_mag > 6.0) & skin).astype(np.uint8) * 255
    bump_mask = cv2.morphologyEx(bump_mask, cv2.MORPH_OPEN, k3)

    # Combine all candidate maps
    combined = (papule_mask | pustule_mask | cyst_mask | bump_mask)

    # Pre-compute a Sobel gradient magnitude (boundary sharpness check)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    grad_mag = cv2.magnitude(gx, gy)

    # ----- Connected component analysis -----
    num, _, stats, _ = cv2.connectedComponentsWithStats(combined, connectivity=8)
    min_area = max(12, skin_area // 4000)
    max_area = max(min_area * 4, skin_area // 30)

    h, w = rgb.shape[:2]
    overlay = np.zeros(rgb.shape[:2], dtype=bool)
    lesions = 0
    severity_sum = 0.0
    bump_only_severity = 0.0  # capped separately so JPEG noise can't drive score

    for i in range(1, num):
        x, y, ww, hh, area = stats[i]
        if area < min_area or area > max_area:
            continue

        long_side = max(ww, hh)
        short_side = max(1, min(ww, hh))
        aspect = long_side / short_side
        if aspect > 4.0:
            continue
        extent = area / float(ww * hh)
        if extent < 0.30:
            continue

        # ---- Strict per-blob criteria (v8.3) ----
        # A blob qualifies if EITHER it's clearly red+saturated (inflammatory)
        # OR it's a sharp luminance bump (skin-tone papule on darker skin).
        roi_a_exc   = a_excess[y:y+hh, x:x+ww]
        roi_S       = S[y:y+hh, x:x+ww]
        roi_a       = a[y:y+hh, x:x+ww]
        roi_grad    = grad_mag[y:y+hh, x:x+ww]
        roi_bump    = bump_mag[y:y+hh, x:x+ww]
        roi_L       = L[y:y+hh, x:x+ww]

        peak_a_exc  = float(roi_a_exc.max())
        mean_S      = float(roi_S.mean())
        mean_a      = float(roi_a.mean())
        mean_grad   = float(roi_grad.mean())
        peak_bump   = float(roi_bump.max())
        L_std       = float(roi_L.std())

        # Path A: classic red inflammatory lesion
        is_red_lesion = (peak_a_exc >= 8.0 and mean_S >= 75.0 and mean_a >= 142.0
                         and mean_grad >= 10.0)
        # Path B: skin-tone bump — must be circular-ish, sharp boundary, and
        # have significant local L variance (real bump, not pore/JPEG block).
        is_bump_lesion = (
            peak_bump >= 14.0
            and mean_grad >= 14.0
            and L_std >= 6.0
            and aspect <= 2.0
            and area >= min_area * 2
            and mean_S < 130.0
        )

        if not (is_red_lesion or is_bump_lesion):
            continue

        # Position weight: cheeks/forehead/chin (typical acne zones) full credit;
        # outside reduced
        cy = (y + hh / 2.0) / h
        cx = (x + ww / 2.0) / w
        in_acne_zone = (
            (0.10 < cy < 0.30)
            or (0.42 < cy < 0.70)
            or (0.82 < cy < 0.95)
            or (0.42 < cy < 0.70 and (cx < 0.30 or cx > 0.70))
        )
        zone_weight = 1.0 if in_acne_zone else 0.55

        # Severity from peak a_excess and area
        sev = min(1.4, 0.4 + peak_a_exc / 22.0 + (area / max(min_area * 10.0, 1.0)) * 0.12)
        # Bump-only lesions get a slightly lower base severity
        if not is_red_lesion and is_bump_lesion:
            sev = min(1.2, 0.30 + peak_bump / 40.0 + (area / max(min_area * 10.0, 1.0)) * 0.10)

        lesions += 1
        if is_red_lesion:
            severity_sum += zone_weight * sev
        else:
            bump_only_severity += zone_weight * sev
        overlay[y:y+hh, x:x+ww] |= (combined[y:y+hh, x:x+ww] > 0)

    # Cap bump-only contribution: even many texture bumps can only add up to ~30 score
    severity_sum += min(bump_only_severity, 4.0)

    # Noise floor
    if severity_sum < 0.6 or lesions < 1:
        return 0.0, overlay, 0

    # Score curve: 1 -> ~9, 3 -> ~24, 6 -> ~42, 12 -> ~67, 20 -> ~84
    score = 100.0 * (1.0 - np.exp(-severity_sum / 11.0))
    score = float(min(100.0, max(0.0, score)))
    return score, overlay, int(lesions)


def _score_pores(rgb: np.ndarray, mask: np.ndarray) -> float:
    """Visible pores: high-frequency dot texture."""
    if not _HAS_CV2:
        return 0.0
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    lap = cv2.Laplacian(gray, cv2.CV_32F, ksize=3)
    var = float(np.var(lap[mask])) if mask.any() else 0.0
    # Empirical normalization
    return _clip01(var / 800.0) * 100


def _score_wrinkles(rgb: np.ndarray, mask: np.ndarray) -> float:
    """Wrinkles: edge density at fine scales using Canny + Gabor-like response."""
    if not _HAS_CV2:
        return 0.0
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 30, 90)
    edges_in_skin = (edges > 0) & mask
    density = edges_in_skin.sum() / max(mask.sum(), 1)
    return _clip01(density * 12.0) * 100


def _score_dullness(rgb: np.ndarray, mask: np.ndarray) -> float:
    """Dullness: low saturation + low value variance = flat tone."""
    if not _HAS_CV2:
        return 0.0
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    s_skin = hsv[:, :, 1][mask]
    v_skin = hsv[:, :, 2][mask]
    if s_skin.size == 0:
        return 0.0
    sat_mean = float(s_skin.mean()) / 255.0
    val_var = float(v_skin.std()) / 64.0
    score = (1.0 - sat_mean) * 0.6 + (1.0 - _clip01(val_var)) * 0.4
    return _clip01(score) * 100


def _score_evenness(rgb: np.ndarray, mask: np.ndarray) -> float:
    """Tone evenness: lower std dev of L channel = more even (returns higher score for evenness)."""
    if not _HAS_CV2:
        gray = rgb.mean(axis=2)
        std = float(gray[mask].std()) if mask.any() else 50.0
        return _clip01(1.0 - std / 50.0) * 100
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    L = lab[:, :, 0]
    std = float(L[mask].std()) if mask.any() else 50.0
    return _clip01(1.0 - std / 35.0) * 100


def _score_hydration(rgb: np.ndarray, mask: np.ndarray, dryness: float) -> float:
    """Hydration is the inverse-ish of dryness with a saturation bonus."""
    if not _HAS_CV2:
        return _clip01(1.0 - dryness / 100.0) * 100
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    sat_mean = float(hsv[:, :, 1][mask].mean()) / 255.0 if mask.any() else 0.3
    base = 1.0 - (dryness / 100.0)
    return _clip01(base * 0.7 + sat_mean * 0.3) * 100


# ---------------------------------------------------------------------------
# Skin-type derivation (combine TFLite with CV cross-checks)
# ---------------------------------------------------------------------------
def _derive_skin_type(model_pred: Dict[str, Any] | None,
                      oiliness: float,
                      dryness: float) -> Dict[str, Any]:
    """Returns {label, confidence, source, scores{dry,oily,normal,combination}}."""
    cv_scores = {
        "oily": oiliness / 100.0,
        "dry": dryness / 100.0,
        "normal": max(0.0, 1.0 - abs(oiliness - 30) / 100.0 - abs(dryness - 30) / 100.0),
    }
    cv_scores["combination"] = min(cv_scores["oily"], cv_scores["dry"]) * 1.5
    # Blend with model
    if model_pred:
        m = model_pred["scores"]
        blended = {
            "oily": 0.55 * m.get("oily", 0.0) + 0.45 * cv_scores["oily"],
            "dry": 0.55 * m.get("dry", 0.0) + 0.45 * cv_scores["dry"],
            "normal": 0.55 * m.get("normal", 0.0) + 0.45 * cv_scores["normal"],
            "combination": cv_scores["combination"],
        }
        source = "model+cv"
    else:
        blended = cv_scores
        source = "cv-only"
    # Normalize
    total = sum(blended.values()) or 1.0
    blended = {k: v / total for k, v in blended.items()}
    label = max(blended.items(), key=lambda kv: kv[1])[0]
    return {
        "label": label.capitalize(),
        "confidence": round(blended[label], 3),
        "source": source,
        "scores": {k: round(v, 3) for k, v in blended.items()},
    }


# ---------------------------------------------------------------------------
# Heatmap overlay — composite mask of problem areas onto image
# ---------------------------------------------------------------------------
def _build_heatmap(rgb: np.ndarray,
                   acne_mask: np.ndarray,
                   pigment_mask: np.ndarray,
                   redness_mask: np.ndarray,
                   oily_mask: np.ndarray) -> str:
    """Returns data URL JPEG of composite overlay."""
    if not _HAS_CV2:
        # Fallback: return a tinted version of original
        out = Image.fromarray(rgb)
        buf = io.BytesIO()
        out.save(buf, format="JPEG", quality=80)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    base = rgb.copy().astype(np.float32)
    overlay = np.zeros_like(base)
    if acne_mask.any():
        overlay[acne_mask] += np.array([255, 60, 60], dtype=np.float32)  # red
    if pigment_mask.any():
        overlay[pigment_mask] += np.array([120, 50, 200], dtype=np.float32)  # purple
    if redness_mask.any():
        overlay[redness_mask] += np.array([255, 130, 80], dtype=np.float32) * 0.4
    if oily_mask.any():
        overlay[oily_mask] += np.array([255, 230, 80], dtype=np.float32) * 0.6  # yellow
    overlay = np.clip(overlay, 0, 255)
    blended = np.clip(base * 0.65 + overlay * 0.35, 0, 255).astype(np.uint8)
    img = Image.fromarray(blended)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=82)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


# ---------------------------------------------------------------------------
# Skin photo validation
# ---------------------------------------------------------------------------
def _validate_skin_photo(rgb: np.ndarray, mask: np.ndarray) -> Dict[str, Any]:
    skin_pct = float(mask.mean())
    h, w = rgb.shape[:2]
    too_small = (h * w) < (200 * 200)
    return {
        "is_skin_photo": skin_pct > 0.10 and not too_small,
        "skin_coverage": round(skin_pct, 3),
        "warning": (
            "Image looks too small; please upload a clearer photo." if too_small
            else "Very little skin detected — results may be inaccurate." if skin_pct < 0.10
            else None
        ),
    }


# ---------------------------------------------------------------------------
# Recommendation engine
# ---------------------------------------------------------------------------
_RECS = {
    "acne": {
        "tip": "Use a gentle salicylic-acid (BHA) cleanser; avoid picking; non-comedogenic moisturizer.",
        "ingredients": ["Salicylic acid 2%", "Niacinamide 5%", "Benzoyl peroxide 2.5%", "Adapalene 0.1%"],
    },
    "pigmentation": {
        "tip": "Daily SPF 50+ is non-negotiable. Layer brightening serums over time.",
        "ingredients": ["Vitamin C 10–15%", "Niacinamide", "Alpha arbutin 2%", "Tranexamic acid 3%"],
    },
    "redness": {
        "tip": "Use a calming, fragrance-free routine. Avoid hot water and physical scrubs.",
        "ingredients": ["Centella asiatica", "Azelaic acid 10%", "Niacinamide", "Mineral SPF"],
    },
    "oiliness": {
        "tip": "Don't over-cleanse — strip routines actually trigger more oil. Lightweight gel moisturizer.",
        "ingredients": ["Niacinamide 10%", "Salicylic acid", "Zinc PCA", "Clay masks (1–2x/week)"],
    },
    "dryness": {
        "tip": "Layer hydrators on damp skin. Add an occlusive at night.",
        "ingredients": ["Hyaluronic acid", "Glycerin", "Ceramides", "Squalane", "Petrolatum (night)"],
    },
    "pores": {
        "tip": "Pore size is largely genetic; you can minimize appearance with BHA + retinoid.",
        "ingredients": ["Salicylic acid", "Retinol 0.3–1%", "Niacinamide"],
    },
    "dark_circles": {
        "tip": "Sleep, hydration, and a caffeine eye cream. SPF on under-eyes during the day.",
        "ingredients": ["Caffeine", "Vitamin K", "Peptides", "Vitamin C"],
    },
    "wrinkles": {
        "tip": "Retinoids are the gold standard. Daily SPF prevents further damage.",
        "ingredients": ["Retinol / Retinaldehyde", "Peptides", "Vitamin C", "SPF 50+"],
    },
    "dullness": {
        "tip": "Gentle exfoliation 2–3x/week + vitamin C.",
        "ingredients": ["Lactic acid", "Mandelic acid", "Vitamin C", "Glycolic acid"],
    },
    "hydration": {
        "tip": "Hydrate from inside (water) and outside (humectants + moisturizer).",
        "ingredients": ["Hyaluronic acid", "Glycerin", "Polyglutamic acid"],
    },
    "evenness": {
        "tip": "Consistent SPF + vitamin C + niacinamide builds even tone over weeks.",
        "ingredients": ["Vitamin C", "Niacinamide", "Tranexamic acid", "SPF"],
    },
}


def _build_recommendations(concerns: Dict[str, float], skin_type_label: str) -> List[Dict[str, Any]]:
    """Pick the top 4 concerns by score (>= 25) and produce action cards."""
    # Special handling: 'hydration' & 'evenness' are positive metrics — flip them
    relevant = []
    for k, v in concerns.items():
        if k in ("hydration", "evenness"):
            severity = max(0.0, 100.0 - v)
        else:
            severity = v
        if severity >= 25:
            relevant.append((k, severity))
    relevant.sort(key=lambda x: x[1], reverse=True)
    top = relevant[:4]
    out: List[Dict[str, Any]] = []
    for key, severity in top:
        info = _RECS.get(key, {})
        out.append({
            "concern": key,
            "severity": round(severity, 1),
            "level": "High" if severity > 65 else "Moderate" if severity > 40 else "Mild",
            "tip": info.get("tip", ""),
            "ingredients": info.get("ingredients", []),
        })
    return out


def _build_routine(skin_type: str, concerns: Dict[str, float]) -> Dict[str, List[str]]:
    st = skin_type.lower()
    morning: List[str] = []
    evening: List[str] = []
    weekly: List[str] = []

    # Cleanser
    if st == "oily" or concerns.get("acne", 0) > 35:
        morning.append("Cleanser: Salicylic-acid gel cleanser")
        evening.append("Cleanser: Same gel cleanser (double-cleanse if wearing SPF/makeup)")
    elif st == "dry":
        morning.append("Cleanser: Cream / non-foaming cleanser")
        evening.append("Cleanser: Same gentle cream cleanser")
    else:
        morning.append("Cleanser: Gentle low-pH cleanser")
        evening.append("Cleanser: Gentle low-pH cleanser")

    # Treatment serums
    morning.append("Antioxidant serum: Vitamin C 10–15%")
    if concerns.get("pigmentation", 0) > 30:
        morning.append("Brightening: Alpha arbutin or tranexamic acid")
    if concerns.get("redness", 0) > 30:
        morning.append("Calming: Centella / azelaic acid")
    if concerns.get("acne", 0) > 30:
        evening.append("Treatment: Adapalene 0.1% OR benzoyl peroxide 2.5%")
    if concerns.get("wrinkles", 0) > 30 or concerns.get("dullness", 0) > 40:
        evening.append("Retinoid: Retinol 0.3–1% (start 2x/week)")

    # Moisturizer
    if st == "oily":
        morning.append("Moisturizer: Lightweight gel with niacinamide")
        evening.append("Moisturizer: Same gel moisturizer")
    elif st == "dry":
        morning.append("Moisturizer: Rich cream with ceramides + HA")
        evening.append("Moisturizer: Occlusive cream + a few drops of squalane")
    else:
        morning.append("Moisturizer: Lotion with ceramides + HA")
        evening.append("Moisturizer: Same lotion (richer at night if needed)")

    # SPF
    morning.append("Sunscreen: Broad-spectrum SPF 50+ (mineral if sensitive/red)")

    # Weekly
    if concerns.get("dullness", 0) > 35 or concerns.get("evenness", 100) < 60:
        weekly.append("Chemical exfoliant 2–3x/week (lactic, mandelic, or glycolic)")
    if st == "oily":
        weekly.append("Clay mask 1–2x/week")
    if st == "dry":
        weekly.append("Hydrating sheet mask 2x/week")

    return {"morning": morning, "evening": evening, "weekly": weekly}


def _diet_and_lifestyle(concerns: Dict[str, float]) -> Dict[str, List[str]]:
    diet: List[str] = ["Drink 2–3 L water daily", "Eat antioxidant-rich foods (berries, leafy greens, citrus)"]
    lifestyle: List[str] = ["Get 7–9 hours of quality sleep", "Manage stress — it shows on your skin",
                            "Change pillowcases 2x/week", "Wash your face after sweating"]
    if concerns.get("acne", 0) > 30:
        diet.append("Limit high-glycemic foods (sugar, white bread)")
        diet.append("Reduce dairy if you notice flare-ups")
    if concerns.get("pigmentation", 0) > 30 or concerns.get("wrinkles", 0) > 30:
        lifestyle.append("Reapply SPF every 2 hours outdoors — non-negotiable")
    if concerns.get("oiliness", 0) > 50:
        diet.append("Add zinc-rich foods (pumpkin seeds, lentils)")
    if concerns.get("dryness", 0) > 40 or concerns.get("hydration", 100) < 50:
        diet.append("Healthy fats: avocado, walnuts, salmon")
    if concerns.get("redness", 0) > 30:
        lifestyle.append("Identify triggers: spicy food, alcohol, hot showers")
    return {"diet": diet, "lifestyle": lifestyle}


# ---------------------------------------------------------------------------
# Core analysis
# ---------------------------------------------------------------------------
def _analyze_regions(rgb: np.ndarray, mask: np.ndarray) -> Dict[str, Dict[str, float]]:
    """Split the face image into approximate facial regions and report
    per-region oil/redness/dark-spot signals. Regions are geometric
    approximations (we don't run face landmarking); good enough for guidance.
        forehead = top 25%
        cheeks   = middle band, left + right thirds
        nose     = middle band, central third
        chin     = bottom 25%
    """
    h, w = rgb.shape[:2]
    regions = {
        "forehead": (slice(0, int(h * 0.30)), slice(int(w * 0.10), int(w * 0.90))),
        "left_cheek": (slice(int(h * 0.30), int(h * 0.70)), slice(int(w * 0.05), int(w * 0.35))),
        "right_cheek": (slice(int(h * 0.30), int(h * 0.70)), slice(int(w * 0.65), int(w * 0.95))),
        "nose": (slice(int(h * 0.30), int(h * 0.70)), slice(int(w * 0.40), int(w * 0.60))),
        "chin": (slice(int(h * 0.70), h), slice(int(w * 0.20), int(w * 0.80))),
    }
    out: Dict[str, Dict[str, float]] = {}
    for name, (rs, cs) in regions.items():
        sub = rgb[rs, cs]
        sub_mask = mask[rs, cs]
        if sub.size == 0 or sub_mask.sum() < 50:
            out[name] = {"oiliness": 0.0, "redness": 0.0, "spots": 0.0, "coverage": 0.0}
            continue
        oil, _ = _score_oiliness(sub, sub_mask)
        red, _ = _score_redness(sub, sub_mask)
        pig, _ = _score_pigmentation(sub, sub_mask)
        coverage = round(float(sub_mask.sum()) / sub_mask.size * 100, 1)
        out[name] = {
            "oiliness": round(oil, 1),
            "redness": round(red, 1),
            "spots": round(pig, 1),
            "coverage": coverage,
        }
    return out


def _score_dark_circles(rgb: np.ndarray, mask: np.ndarray) -> Tuple[float, np.ndarray]:
    """Heuristic dark-circle detector. Without face landmarks, we use a
    geometric approximation: under-eye is roughly the band at 38-52% Y inside
    left and right eye columns (20-40% X and 60-80% X). We compare the
    luminance of those bands to the cheek baseline just below (52-66% Y).
    Returns score 0-100 and a binary ROI mask used for overlay.
    """
    h, w = rgb.shape[:2]
    if h < 30 or w < 30:
        return 0.0, np.zeros_like(mask)
    ycrcb = cv2.cvtColor(rgb, cv2.COLOR_RGB2YCrCb)
    Y = ycrcb[..., 0].astype(np.float32)
    roi_mask = np.zeros_like(mask, dtype=np.uint8)
    score_acc = 0.0
    n = 0
    for x0_pct, x1_pct in [(0.20, 0.40), (0.60, 0.80)]:
        eye_band = Y[int(h * 0.38):int(h * 0.52), int(w * x0_pct):int(w * x1_pct)]
        cheek_band = Y[int(h * 0.55):int(h * 0.68), int(w * x0_pct):int(w * x1_pct)]
        em = mask[int(h * 0.38):int(h * 0.52), int(w * x0_pct):int(w * x1_pct)]
        cm = mask[int(h * 0.55):int(h * 0.68), int(w * x0_pct):int(w * x1_pct)]
        if em.sum() < 30 or cm.sum() < 30:
            continue
        # only consider skin pixels in each band
        eye_med = float(np.median(eye_band[em > 0])) if em.sum() else 0.0
        cheek_med = float(np.median(cheek_band[cm > 0])) if cm.sum() else 0.0
        if cheek_med <= 0:
            continue
        # how much darker the under-eye is than the cheek baseline
        delta = max(0.0, cheek_med - eye_med)
        # 0 delta = no shadow, 25+ delta = strong dark circle
        score_acc += min(100.0, delta * 4.0)
        n += 1
        roi_mask[int(h * 0.38):int(h * 0.52), int(w * x0_pct):int(w * x1_pct)] = 1
    score = score_acc / max(1, n)
    return float(round(score, 1)), roi_mask


def _score_blackheads(rgb: np.ndarray, mask: np.ndarray) -> Tuple[float, int]:
    """Detect tiny dark dots concentrated in the T-zone (forehead + nose).
    Uses a top-hat-like operation on the inverted luminance."""
    h, w = rgb.shape[:2]
    if h < 20 or w < 20:
        return 0.0, 0
    # T-zone ROI: forehead + central nose strip
    tzone = np.zeros_like(mask, dtype=np.uint8)
    tzone[0:int(h * 0.35), int(w * 0.20):int(w * 0.80)] = 1
    tzone[int(h * 0.30):int(h * 0.65), int(w * 0.40):int(w * 0.60)] = 1
    roi = (mask & tzone).astype(np.uint8)
    if roi.sum() < 200:
        return 0.0, 0
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    inv = 255 - gray
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    tophat = cv2.morphologyEx(inv, cv2.MORPH_TOPHAT, kernel)
    # threshold + restrict to ROI
    _, th = cv2.threshold(tophat, 22, 255, cv2.THRESH_BINARY)
    th = (th > 0).astype(np.uint8) * roi
    # connected components, count tiny blobs
    num, _, stats, _ = cv2.connectedComponentsWithStats(th, connectivity=8)
    count = 0
    for i in range(1, num):
        area = stats[i, cv2.CC_STAT_AREA]
        if 1 <= area <= 8:  # small blackhead-sized
            count += 1
    # density score relative to ROI area
    density = count / max(1.0, roi.sum() / 1000.0)
    score = float(min(100.0, density * 18.0))
    return round(score, 1), int(count)


def _estimate_skin_age(concerns: Dict[str, float]) -> Dict[str, Any]:
    """Rough visual skin-age estimate. Not a chronological prediction —
    a 'how old does the skin look' index based on wrinkles, dullness, evenness, dark circles.

    Re-calibrated: previous formula over-aged everyone by ~10–15 years
    because every concern added years even at low scores. New version
    uses thresholds (only damage above a noise floor adds years), much
    smaller coefficients, and caps the realistic range at 18–55.
    """
    def _excess(x: float, floor: float) -> float:
        return max(0.0, x - floor)

    w = concerns.get("wrinkles", 0)
    d = concerns.get("dullness", 0)
    e = concerns.get("evenness", 100)
    p = concerns.get("pigmentation", 0)
    dc = concerns.get("dark_circles", 0)
    # Base young — only meaningful damage adds years
    base = (
        20.0
        + _excess(w,  35) * 0.18    # wrinkles only count when truly visible
        + _excess(d,  45) * 0.08
        + _excess(100 - e, 40) * 0.07
        + _excess(p,  35) * 0.06
        + _excess(dc, 40) * 0.05
    )
    age = max(18, min(55, base))
    band = (
        "youthful" if age < 27
        else "balanced" if age < 35
        else "mature" if age < 45
        else "advanced"
    )
    return {"estimate": int(round(age)), "band": band}


def _build_severity_alerts(concerns: Dict[str, float], lesions: int) -> List[Dict[str, str]]:
    alerts: List[Dict[str, str]] = []
    if concerns.get("acne", 0) > 65 or lesions > 20:
        alerts.append({"level": "high", "concern": "acne",
                       "message": "Significant acne detected — consider seeing a dermatologist if no improvement in 8–12 weeks of consistent care."})
    if concerns.get("redness", 0) > 60:
        alerts.append({"level": "medium", "concern": "redness",
                       "message": "Persistent redness can indicate a compromised barrier or rosacea — avoid harsh actives, focus on barrier repair."})
    if concerns.get("pigmentation", 0) > 55:
        alerts.append({"level": "medium", "concern": "pigmentation",
                       "message": "Notable pigmentation — daily SPF 50 is your single most effective treatment."})
    if concerns.get("dryness", 0) > 60:
        alerts.append({"level": "medium", "concern": "dryness",
                       "message": "Skin is showing dehydration — drink water and add ceramides/HA before more actives."})
    if concerns.get("wrinkles", 0) > 50:
        alerts.append({"level": "low", "concern": "wrinkles",
                       "message": "Visible texture lines — retinoids + SPF + sleep are the proven combo."})
    if concerns.get("dark_circles", 0) > 55:
        alerts.append({"level": "medium", "concern": "dark_circles",
                       "message": "Pronounced under-eye darkness — improve sleep, hydration, and use a caffeine + vitamin K eye cream."})
    if concerns.get("blackheads", 0) > 50:
        alerts.append({"level": "low", "concern": "blackheads",
                       "message": "Blackhead density is high in your T-zone — gentle BHA 2x/week + non-comedogenic SPF will help."})
    return alerts


def _ingredient_priority(concerns: Dict[str, float], skin_type_label: str) -> List[Dict[str, Any]]:
    """Build a ranked list of ingredients to look for, with the reason."""
    catalog = {
        "Niacinamide 5–10%": {"helps": ["oiliness", "redness", "pores", "pigmentation"], "tier": 1},
        "Salicylic Acid 2%": {"helps": ["acne", "pores", "oiliness", "blackheads"], "tier": 1},
        "Vitamin C 10–20%": {"helps": ["pigmentation", "dullness", "evenness", "dark_circles"], "tier": 1},
        "Hyaluronic Acid": {"helps": ["dryness", "hydration"], "tier": 1},
        "Retinol / Retinal": {"helps": ["wrinkles", "pores", "pigmentation", "dullness", "blackheads"], "tier": 2},
        "Azelaic Acid 10%": {"helps": ["redness", "acne", "pigmentation"], "tier": 2},
        "Centella Asiatica (Cica)": {"helps": ["redness", "dryness"], "tier": 2},
        "Ceramides + Cholesterol": {"helps": ["dryness", "redness", "hydration"], "tier": 1},
        "Tranexamic Acid": {"helps": ["pigmentation", "evenness", "dark_circles"], "tier": 2},
        "Caffeine + Peptides (eye)": {"helps": ["dark_circles"], "tier": 1},
        "SPF 50 (Broad spectrum)": {"helps": ["pigmentation", "wrinkles", "evenness", "redness", "dark_circles"], "tier": 1},
    }
    scored: List[Tuple[float, str, Dict[str, Any]]] = []
    for ing, info in catalog.items():
        score = 0.0
        reasons: List[str] = []
        for c in info["helps"]:
            v = concerns.get(c, 0)
            if c in ("hydration", "evenness"):
                v = 100 - v
            if v >= 25:
                score += v
                reasons.append(c)
        if score == 0:
            continue
        scored.append((score / max(1, info["tier"]), ing, {"helps": reasons, "score": round(score, 1)}))
    scored.sort(key=lambda x: -x[0])
    return [{"ingredient": ing, **meta} for _, ing, meta in scored[:6]]



def analyze_image(pil_img: Image.Image) -> Dict[str, Any]:
    t0 = time.time()
    pil_img = _resize_for_analysis(pil_img, max_side=800)
    rgb = np.asarray(pil_img.convert("RGB"))
    mask = _skin_mask(rgb)

    validation = _validate_skin_photo(rgb, mask)

    # Run all CV scorers
    oiliness, oily_mask = _score_oiliness(rgb, mask)
    dryness, _ = _score_dryness(rgb, mask)
    redness, redness_mask = _score_redness(rgb, mask)
    pigmentation, pigment_mask = _score_pigmentation(rgb, mask)
    acne, acne_mask, lesion_count = _score_acne(rgb, mask)
    pores = _score_pores(rgb, mask)
    wrinkles = _score_wrinkles(rgb, mask)
    dullness = _score_dullness(rgb, mask)
    evenness = _score_evenness(rgb, mask)
    hydration = _score_hydration(rgb, mask, dryness)
    dark_circles, dc_roi = _score_dark_circles(rgb, mask)
    blackheads, blackhead_count = _score_blackheads(rgb, mask)

    concerns_raw = {
        "acne": acne,
        "pigmentation": pigmentation,
        "redness": redness,
        "oiliness": oiliness,
        "dryness": dryness,
        "pores": pores,
        "wrinkles": wrinkles,
        "dullness": dullness,
        "dark_circles": dark_circles,
        "blackheads": blackheads,
        "hydration": hydration,   # higher = better
        "evenness": evenness,     # higher = better
    }
    concerns = {k: round(v, 1) for k, v in concerns_raw.items()}

    # Skin type
    model_pred = _SKIN_TYPE.predict(pil_img)
    skin_type = _derive_skin_type(model_pred, oiliness, dryness)

    # Overall score: positive metrics minus negatives
    negatives = (acne + pigmentation + redness + dryness + wrinkles + dullness + dark_circles * 0.7 + blackheads * 0.5) / 7.2
    positives = (hydration + evenness) / 2.0
    overall = max(0.0, min(100.0, 65 + (positives - negatives) * 0.45))

    heatmap = _build_heatmap(rgb, acne_mask, pigment_mask, redness_mask, oily_mask)
    recommendations = _build_recommendations(concerns_raw, skin_type["label"])
    routine = _build_routine(skin_type["label"], concerns_raw)
    diet_lifestyle = _diet_and_lifestyle(concerns_raw)

    regions = _analyze_regions(rgb, mask)
    skin_age = _estimate_skin_age(concerns_raw)
    severity_alerts = _build_severity_alerts(concerns_raw, lesion_count)
    ingredient_priority = _ingredient_priority(concerns_raw, skin_type["label"])

    elapsed_ms = int((time.time() - t0) * 1000)

    return {
        "version": VERSION,
        "elapsed_ms": elapsed_ms,
        "validation": validation,
        "skin_type": skin_type,
        "skin_age": skin_age,
        "concerns": concerns,
        "regions": regions,
        "severity_alerts": severity_alerts,
        "ingredient_priority": ingredient_priority,
        "lesion_count": lesion_count,
        "overall_score": round(overall, 1),
        "heatmap": heatmap,
        "heatmap_legend": {
            "red": "Possible acne / inflamed spots",
            "purple": "Pigmentation / dark spots",
            "orange": "Redness areas",
            "yellow": "Oily / shine areas",
        },
        "recommendations": recommendations,
        "routine": routine,
        "diet": diet_lifestyle["diet"],
        "lifestyle": diet_lifestyle["lifestyle"],
    }


# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app)


@app.route("/health", methods=["GET"])
def health():
    _SKIN_TYPE.load()
    return jsonify({
        "status": "ok",
        "version": VERSION,
        "tflite_available": _HAS_TFLITE,
        "cv2_available": _HAS_CV2,
        "skin_type_model_loaded": _SKIN_TYPE.loaded,
        "skin_type_model_error": _SKIN_TYPE.error,
        "skin_type_labels": _SKIN_TYPE.labels,
    })


@app.route("/analyze", methods=["POST"])
@app.route("/predict", methods=["POST"])  # backwards compatibility
def analyze():
    try:
        img = _load_image_from_request()
        if img is None:
            return jsonify({"success": False, "error": "no image provided"}), 400
        result = analyze_image(img)
        return jsonify({"success": True, **result})
    except Exception as e:  # pragma: no cover
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# ---------------------------------------------------------------------------
# v7: Multi-angle ensemble analysis  (front + left + right + extra)
# ---------------------------------------------------------------------------
def _ensemble_analyses(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Average several single-image analyses into a higher-confidence result."""
    if not results:
        return {}
    n = len(results)
    # Average concerns
    concern_keys = list(results[0]["concerns"].keys())
    avg_concerns = {k: round(sum(r["concerns"][k] for r in results) / n, 1) for k in concern_keys}
    # Skin-type: average per-class scores
    type_keys = list(results[0]["skin_type"]["scores"].keys())
    avg_scores = {k: sum(r["skin_type"]["scores"].get(k, 0.0) for r in results) / n for k in type_keys}
    top_label = max(avg_scores, key=avg_scores.get)
    confidence = avg_scores[top_label]
    # Agreement across angles boosts confidence
    label_votes = [r["skin_type"]["label"].lower() for r in results]
    agreement = label_votes.count(top_label) / n
    boosted_conf = round(min(0.99, confidence * (0.7 + 0.3 * agreement)), 3)

    avg_overall = round(sum(r["overall_score"] for r in results) / n, 1)
    avg_lesions = int(round(sum(r["lesion_count"] for r in results) / n))
    # Average skin age across angles
    avg_age = int(round(sum(r.get("skin_age", {}).get("estimate", 25) for r in results) / n))
    age_band = "youthful" if avg_age < 28 else "balanced" if avg_age < 38 else "mature" if avg_age < 50 else "advanced"
    # Use the best heatmap (front view = first by convention)
    primary = results[0]
    # Average per-region scores too (best-effort, only when keys match)
    region_keys = list((primary.get("regions") or {}).keys())
    avg_regions: Dict[str, Dict[str, float]] = {}
    for rk in region_keys:
        sub_keys = list(primary["regions"][rk].keys())
        avg_regions[rk] = {
            sk: round(sum(r.get("regions", {}).get(rk, {}).get(sk, 0.0) for r in results) / n, 1)
            for sk in sub_keys
        }
    return {
        "version": VERSION,
        "angles_analyzed": n,
        "agreement": round(agreement, 2),
        "validation": primary["validation"],
        "skin_type": {
            "label": top_label.capitalize(),
            "confidence": boosted_conf,
            "scores": {k: round(v, 3) for k, v in avg_scores.items()},
            "agreement": round(agreement, 2),
        },
        "skin_age": {"estimate": avg_age, "band": age_band},
        "concerns": avg_concerns,
        "regions": avg_regions,
        "severity_alerts": _build_severity_alerts(avg_concerns, avg_lesions),
        "ingredient_priority": _ingredient_priority(avg_concerns, top_label.capitalize()),
        "lesion_count": avg_lesions,
        "overall_score": avg_overall,
        "heatmap": primary["heatmap"],
        "heatmap_legend": primary["heatmap_legend"],
        "recommendations": _build_recommendations(avg_concerns, top_label.capitalize()),
        "routine": _build_routine(top_label.capitalize(), avg_concerns),
        "diet": primary["diet"],
        "lifestyle": primary["lifestyle"],
        "per_angle": [
            {
                "label": r["skin_type"]["label"],
                "confidence": r["skin_type"]["confidence"],
                "overall": r["overall_score"],
            }
            for r in results
        ],
    }


@app.route("/analyze_multi", methods=["POST"])
def analyze_multi():
    """Accept multiple images (form fields image, image_0, image_1, front, left, right, ...) and ensemble them."""
    try:
        files = []
        for key in request.files:
            files.extend(request.files.getlist(key))
        if not files:
            return jsonify({"success": False, "error": "no images provided"}), 400
        results = []
        for f in files[:6]:  # cap at 6 angles
            try:
                img = Image.open(f.stream)
                img.load()
                results.append(analyze_image(img))
            except Exception as e:
                print(f"[analyze_multi] skip image: {e}")
        if not results:
            return jsonify({"success": False, "error": "no valid images decoded"}), 400
        ensembled = _ensemble_analyses(results)
        return jsonify({"success": True, **ensembled})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# ---------------------------------------------------------------------------
# v7: AI Doctor chat (streaming, concern-aware, rule-based knowledge base)
# ---------------------------------------------------------------------------
_CONCERN_KB: Dict[str, Dict[str, Any]] = {
    "acne": {
        "causes": "excess sebum, clogged pores, P. acnes bacteria, hormones (androgens), stress, high-glycemic diet and dairy in some people",
        "ingredients": ["salicylic acid 2%", "benzoyl peroxide 2.5–5%", "adapalene 0.1%", "niacinamide", "azelaic acid"],
        "avoid": "heavy occlusive oils (coconut, cocoa butter), over-scrubbing, picking",
        "see_doc": "if you have deep painful cystic nodules, scarring, or no improvement after 12 weeks of consistent OTC care",
    },
    "pigmentation": {
        "causes": "post-inflammatory marks (after acne), sun exposure, hormonal melasma, friction",
        "ingredients": ["vitamin C 10–20%", "niacinamide 5%", "alpha arbutin", "tranexamic acid", "azelaic acid 10%", "retinoids at night"],
        "avoid": "sun exposure without SPF 50+, picking, harsh exfoliation that causes inflammation",
        "see_doc": "for stubborn melasma — a dermatologist can prescribe hydroquinone or in-clinic peels",
    },
    "redness": {
        "causes": "compromised barrier, rosacea, allergic/irritant contact reaction, over-exfoliation, heat",
        "ingredients": ["centella asiatica (cica)", "azelaic acid 10%", "niacinamide", "ceramides", "panthenol"],
        "avoid": "alcohol-based toners, fragrance, physical scrubs, very hot water",
        "see_doc": "if redness is persistent with visible blood vessels or flares with triggers — likely rosacea, treatable",
    },
    "oiliness": {
        "causes": "genetics, androgens, humidity, over-stripping (rebound oil)",
        "ingredients": ["niacinamide 5–10%", "salicylic acid 2%", "zinc PCA", "lightweight gel moisturizer", "clay masks 1–2x/week"],
        "avoid": "skipping moisturizer (rebound oil), heavy creams, alcohol-based mattifiers daily",
        "see_doc": "if combined with severe acne or sudden hair loss / cycle changes — could be hormonal",
    },
    "dryness": {
        "causes": "barrier damage, low humidity, hot showers, harsh cleansers, age, retinoid overuse",
        "ingredients": ["hyaluronic acid", "glycerin", "ceramides", "squalane", "shea butter", "panthenol"],
        "avoid": "foaming sulfate cleansers, alcohol toners, exfoliating acids more than 1–2x/week",
        "see_doc": "if dryness is cracked / bleeding / with itching — could be eczema or psoriasis",
    },
    "pores": {
        "causes": "genetics + sebum + dead skin buildup; pores cannot truly shrink, but can look smaller",
        "ingredients": ["salicylic acid 2%", "retinoids", "niacinamide", "AHA (glycolic 5–10%)"],
        "avoid": "pore strips (damage), squeezing",
        "see_doc": "for in-clinic options like microneedling if cosmetically bothersome",
    },
    "wrinkles": {
        "causes": "UV damage, collagen loss with age, smoking, repeated facial expressions",
        "ingredients": ["retinol / retinal", "peptides", "vitamin C", "niacinamide", "SPF 50 daily"],
        "avoid": "sun without SPF, smoking, harsh tugging",
        "see_doc": "for medical-grade tretinoin or in-clinic options (lasers, microneedling, botox) if desired",
    },
    "dullness": {
        "causes": "dead skin buildup, dehydration, poor sleep, low antioxidant intake",
        "ingredients": ["vitamin C", "AHA (lactic / glycolic)", "exfoliating toner 1–2x/week", "niacinamide"],
        "avoid": "over-exfoliation (causes more dullness from barrier damage)",
        "see_doc": "rarely needed; usually fixed with consistent routine + sleep + water",
    },
    "hydration": {
        "causes": "low hydration shows as tightness, fine surface lines, flakiness",
        "ingredients": ["hyaluronic acid serum on damp skin", "glycerin", "panthenol", "occlusive moisturizer at night"],
        "avoid": "applying HA to dry skin in dry climate (can pull moisture out)",
        "see_doc": "not usually — drink water and seal moisture",
    },
    "evenness": {
        "causes": "uneven tone from sun, PIH, vascular redness, texture",
        "ingredients": ["vitamin C", "niacinamide", "azelaic acid", "consistent SPF"],
        "avoid": "unprotected sun exposure",
        "see_doc": "for in-clinic treatments if desired",
    },
    "dark_circles": {
        "causes": "genetics, thin under-eye skin, lack of sleep, dehydration, allergies, iron deficiency, sun damage",
        "ingredients": ["caffeine 5%", "vitamin K", "peptides", "niacinamide", "vitamin C", "retinol (eye-formulated)", "SPF on the under-eye"],
        "avoid": "rubbing your eyes, sleeping <6 hrs, salty late dinners, skipping SPF on the under-eye",
        "see_doc": "if hereditary or vascular — a dermatologist can suggest fillers, PRP, or in-clinic peels",
    },
    "blackheads": {
        "causes": "oxidized sebum trapped in open pores, common in T-zone (nose, forehead, chin)",
        "ingredients": ["salicylic acid 2%", "retinoids", "clay masks 1–2x/week", "non-comedogenic SPF"],
        "avoid": "pore strips and squeezing (damages pores and causes scarring), heavy occlusive oils on the T-zone",
        "see_doc": "if you also have cystic acne or scarring, a dermatologist can prescribe stronger topical retinoids",
    },
}

_GENERAL_TIPS = [
    "Drink at least 2.5 L of water daily; dehydrated skin looks dull and shows fine lines faster.",
    "Sleep 7–8 hours; collagen rebuilds during deep sleep.",
    "SPF 50 every morning, even indoors near windows. UVA passes through glass.",
    "Change pillowcases twice a week to reduce acne breakouts.",
    "Cleanse only twice a day — over-cleansing strips your barrier.",
    "Moisturize on damp skin to lock in hydration.",
    "Introduce one new active at a time, wait 2–3 weeks before adding another.",
    "Patch test new products on your jawline for 3 nights.",
    "Limit dairy and high-sugar foods if acne-prone — research shows correlation.",
    "Eat omega-3 (walnuts, flax, fatty fish) for skin barrier health.",
    "Manage stress — cortisol drives oil production and inflammation.",
    "Don't skip moisturizer if oily — dehydration triggers more oil.",
    "Use lukewarm water, never hot — heat damages the barrier.",
    "Retinol/retinal at night only, with SPF strictly the next day.",
    "Vitamin C in the morning enhances SPF protection.",
]


def _scan_summary(last_analysis: Dict[str, Any] | None) -> str:
    """Build a one-paragraph reference of the user's last scan, or empty string."""
    if not last_analysis:
        return ""
    skin_type = (last_analysis.get("skin_type") or {}).get("label") or ""
    overall = last_analysis.get("overall_score") or last_analysis.get("overallScore")
    age = (last_analysis.get("skin_age") or last_analysis.get("skinAge") or {}).get("estimate")
    concerns = last_analysis.get("concerns") or {}
    top = sorted([(k, v) for k, v in concerns.items() if k not in ("hydration", "evenness") and isinstance(v, (int, float))],
                 key=lambda x: -x[1])[:3]
    bits = []
    if skin_type:
        bits.append(f"**{skin_type}** skin")
    if overall:
        bits.append(f"overall **{int(round(float(overall)))}/100**")
    if age:
        bits.append(f"skin-age ~**{int(age)}**")
    head = ", ".join(bits) if bits else "your last scan"
    if top:
        top_str = ", ".join(f"{k.replace('_', ' ')} {int(round(v))}" for k, v in top)
        return f"From your latest scan: {head}. Top concerns — {top_str}."
    return f"From your latest scan: {head}."


def _detect_intent(message: str) -> Tuple[str, List[str]]:
    m = message.lower()
    found = [c for c in _CONCERN_KB if c in m]
    # also handle multi-word phrasings
    if "dark circle" in m or "undereye" in m or "under eye" in m or "eye bag" in m:
        if "dark_circles" not in found:
            found = ["dark_circles"] + found
    if "blackhead" in m:
        if "blackheads" not in found:
            found = ["blackheads"] + found
    # ingredient mentions
    ing_terms = ["retinol", "vitamin c", "niacinamide", "salicylic", "hyaluronic", "benzoyl",
                 "azelaic", "ceramide", "spf", "sunscreen", "aha", "bha", "tretinoin"]
    found_ing = [t for t in ing_terms if t in m]
    if any(w in m for w in ["emergency", "bleeding", "severe pain", "swelling face"]):
        return "emergency", found
    if any(w in m for w in ["routine", "schedule", "morning", "night", "evening"]):
        return "routine", found
    if any(w in m for w in ["product", "recommend", "buy", "brand"]):
        return "products", found
    if found_ing:
        return "ingredient", found_ing
    if found:
        return "concern", found
    if any(w in m for w in ["hi", "hello", "hey", "namaste"]):
        return "greeting", []
    if any(w in m for w in ["thanks", "thank you", "thx"]):
        return "thanks", []
    # Lifestyle topics — detect which one (food/sleep/water/stress/exercise/general)
    food_kw = ("eat", "food", "diet", "meal", "breakfast", "lunch", "dinner", "snack",
               "nutrition", "vegetable", "fruit", "dairy", "milk", "sugar", "carb",
               "protein", "supplement", "vitamin pill", "fish oil", "omega",
               "vegan", "vegetarian", "fasting", "junk")
    sleep_kw = ("sleep", "insomnia", "rest", "tired", "fatigue", "nap", "bedtime",
                "pillow", "pillowcase")
    water_kw = ("water", "hydrate", "hydration drink", "drinking", "thirsty", "dehydrated")
    stress_kw = ("stress", "anxious", "anxiety", "cortisol", "tension", "burnout",
                 "meditation", "breathe", "breathing")
    exercise_kw = ("exercise", "workout", "gym", "yoga", "running", "sweat",
                   "cardio", "walk")
    if any(w in m for w in food_kw):
        return "lifestyle", ["food"]
    if any(w in m for w in sleep_kw):
        return "lifestyle", ["sleep"]
    if any(w in m for w in water_kw):
        return "lifestyle", ["water"]
    if any(w in m for w in stress_kw):
        return "lifestyle", ["stress"]
    if any(w in m for w in exercise_kw):
        return "lifestyle", ["exercise"]
    return "general", []


# --- Concern deep-dive variants (rotated/staged so repeat questions don't repeat text) ---
_CONCERN_DEEP: Dict[str, List[str]] = {
    "acne": [
        "**Week-by-week acne plan:**\n\n"
        "- **Week 1–2**: gentle cleanser AM/PM + niacinamide 5% + light moisturizer + SPF 50. No actives yet — calm the skin first.\n"
        "- **Week 3–4**: add salicylic acid 2% (3 nights/week). Expect mild purging — that's normal.\n"
        "- **Week 5–8**: add adapalene 0.1% gel (start 2x/week, build to nightly). Buffer with moisturizer if irritated.\n"
        "- **Week 9–12**: assess. Cysts not gone? See a derm for spironolactone / oral isotretinoin.",
        "**Top 5 acne mistakes I see all the time:**\n\n"
        "1. Stacking too many actives in week 1 → barrier damage → more breakouts.\n"
        "2. Skipping moisturizer because skin is oily → rebound oil + flaky patches.\n"
        "3. Using benzoyl peroxide AND retinol the same night → both deactivate, plus extreme dryness.\n"
        "4. Picking / squeezing → 6–12 months of post-inflammatory marks.\n"
        "5. Quitting at week 3 because of purging — real results show at week 8–12.",
        "**Diet & lifestyle for acne (research-backed):**\n\n"
        "- **High-glycemic foods** (white bread, sugary drinks, sweets) raise insulin → more sebum. Cut to 1 serving/day.\n"
        "- **Skim milk** has the strongest dairy-acne link. Try removing it for 6 weeks.\n"
        "- **Whey protein** spikes IGF-1 → more breakouts in many people. Switch to plant protein.\n"
        "- **Stress + sleep**: cortisol drives inflammation. 7+ hours sleep alone reduces acne in studies.\n"
        "- **Pillowcase**: change 2x/week. Phone screen: wipe daily.",
    ],
    "pigmentation": [
        "**Layered pigmentation protocol** (results in 8–16 weeks):\n\n"
        "- **AM**: vitamin C 10–15% → moisturizer → SPF 50 (reapply every 2 hours outdoors). SPF is 70% of the result.\n"
        "- **PM**: alpha arbutin 2% or tranexamic acid 3% → niacinamide 5% → moisturizer.\n"
        "- **3 nights/week**: swap PM treatment for retinol 0.3–0.5% or azelaic acid 10%.\n"
        "- **Avoid**: any active that triggers redness — inflammation makes pigmentation worse.",
        "**Why your pigmentation isn't fading** (common reasons):\n\n"
        "- Skipping SPF on cloudy days — UVA penetrates clouds and glass.\n"
        "- Using vitamin C that's oxidized (orange tint = throw out).\n"
        "- Picking or scrubbing — every micro-inflammation adds 3–6 months.\n"
        "- Hormonal melasma (jaw/cheeks pattern) needs prescription tranexamic acid — OTC alone won't cut it.",
        "**Pigmentation deep-dive — types matter:**\n\n"
        "- **PIH** (post-acne marks): brown-pink flat spots → fade in 3–12 months with SPF + vitamin C + retinoids.\n"
        "- **Sun spots**: stubborn, focal — vitamin C + AHA peels at home, in-clinic Q-switched laser if budget allows.\n"
        "- **Melasma** (symmetric cheek patches, hormonal): triple-cream Rx (hydroquinone + tretinoin + steroid) under derm care, plus mineral SPF.",
    ],
    "redness": [
        "**Barrier-repair plan** (4-week reset):\n\n"
        "- Drop ALL actives for 2 weeks (no acids, no retinol, no vitamin C).\n"
        "- Switch to a cream cleanser (CeraVe Hydrating, Cetaphil Gentle).\n"
        "- AM: snail mucin or panthenol serum → ceramide moisturizer → mineral SPF.\n"
        "- PM: same, plus a Centella (cica) cream as the last step.\n"
        "- Week 3: reintroduce one mild active (azelaic acid 10%) at 2x/week.",
        "**Triggers to track for a week** (note them in your phone):\n\n"
        "- Spicy food, alcohol (especially wine), hot drinks, hot showers.\n"
        "- Sun exposure, wind, sudden temperature changes.\n"
        "- Stress and emotional flushing.\n"
        "- Patterns over 2 weeks point to rosacea vs simple barrier damage. Persistent + visible vessels = see a derm.",
    ],
    "oiliness": [
        "**Anti-rebound-oil routine** (counterintuitive but works):\n\n"
        "- Cleanse only 2x/day with a gentle gel cleanser. Over-cleansing strips → more oil.\n"
        "- AM: niacinamide 10% → lightweight gel moisturizer → SPF 50 (gel/fluid texture).\n"
        "- PM: salicylic acid 2% (3 nights/week) → niacinamide → gel moisturizer.\n"
        "- Clay mask 1x/week (kaolin or bentonite, 10 min, never overnight).",
        "**Why mattifying products often backfire:**\n\n"
        "- Silicone primers trap dead skin → clogged pores by week 4.\n"
        "- Alcohol toners give 30 min of matte → 4 hours of rebound oil.\n"
        "- Skipping moisturizer → skin overproduces sebum to compensate.\n"
        "- Real fix: hydrate well, regulate sebum chemically (niacinamide, BHA), don't fight it physically.",
    ],
    "dryness": [
        "**Dryness recovery (3-step layering on damp skin):**\n\n"
        "- 1) Hyaluronic acid serum on **damp** skin (key — dry skin pulls moisture out).\n"
        "- 2) Ceramide + cholesterol moisturizer immediately on top.\n"
        "- 3) Occlusive (squalane oil or Vaseline thin layer) at night to seal.\n"
        "- Drop all acids and retinol for 2 weeks. Switch to a cream cleanser.",
        "**Quick dryness checklist:**\n\n"
        "- Lukewarm water only (hot strips lipids).\n"
        "- Humidifier in bedroom (40–50% humidity target).\n"
        "- Cleanser pH < 5.5 (most foaming cleansers are 7–9 = damaging).\n"
        "- Sheet mask or slugging 2x/week.\n"
        "- 2.5 L water + omega-3 supplement helps from inside.",
    ],
    "pores": [
        "**Pore-minimizing protocol** (visual reduction in 6–8 weeks):\n\n"
        "- AM: niacinamide 10% → light moisturizer → SPF.\n"
        "- PM: salicylic acid 2% (alternate nights) with retinol 0.3% (other nights).\n"
        "- Weekly: clay mask 1x + AHA peel 1x. Never both same day.\n"
        "- Reality check: pores cannot 'close' permanently — but consistent BHA + retinol shrinks visible appearance significantly.",
    ],
    "wrinkles": [
        "**Anti-aging stack that actually works** (gold-standard):\n\n"
        "- AM: vitamin C 15% → peptide serum → moisturizer → SPF 50.\n"
        "- PM: retinal 0.05–0.1% (or retinol 0.5–1%) → ceramide moisturizer.\n"
        "- 2x/week: bakuchiol or peptide-rich treatment for added support.\n"
        "- Result timeline: fine lines softer in 12 weeks, deeper lines need 6+ months or in-clinic (microneedling, lasers).",
    ],
    "dullness": [
        "**Glow-up plan in 4 weeks:**\n\n"
        "- AM: vitamin C → moisturizer → SPF (vitamin C is the brightening MVP).\n"
        "- PM: lactic acid 5–10% (2x/week) → niacinamide → moisturizer.\n"
        "- Other PM nights: hyaluronic + ceramides for hydration.\n"
        "- Weekly: enzyme exfoliant or a glow mask.\n"
        "- 8 hr sleep + 2.5 L water do more than any product for instant glow.",
    ],
    "dark_circles": [
        "**Under-eye plan by cause:**\n\n"
        "- **Vascular** (blue/purple tint): caffeine 5% eye cream AM + cold compress.\n"
        "- **Pigmented** (brown): vitamin C eye cream + SPF on under-eye + alpha arbutin.\n"
        "- **Hollow/structural**: peptides + retinol-eye-cream (gentle) at night; in-clinic fillers if hereditary.\n"
        "- Sleep, hydration and iron levels matter more than 90% of eye creams.",
    ],
    "blackheads": [
        "**Blackhead protocol** (T-zone focus):\n\n"
        "- 3 nights/week: salicylic acid 2% on T-zone after cleansing.\n"
        "- 2 nights/week: adapalene 0.1% (full face) — shrinks pore lining.\n"
        "- 1x/week: clay mask on nose/forehead for 10 min.\n"
        "- Never use pore strips — they tear the pore wall and make it worse over time.\n"
        "- Visible reduction at week 6–8.",
    ],
}

# Vague follow-up phrases — when seen, we route to the *last topic* with a fresh angle
_FOLLOWUP_HINTS = (
    "more", "tell me more", "go on", "continue", "and", "what else", "anything else",
    "deeper", "explain", "why", "how come", "elaborate", "details",
    "next", "then what", "what now",
    "give me steps", "step by step", "plan", "show me",
    "products", "recommend", "buy", "shopping",
    "?",
)

# Generic re-engagement prompts (rotated so we don't say "What would you like to focus on" every time)
_REENGAGE_PROMPTS = [
    "What would you like to dig into next — a specific concern, ingredient, routine, or products?",
    "Want me to go deeper on one concern, or build a routine around your top issue?",
    "Pick a direction: a focused 4-week plan, an ingredient explained, or product picks under ₹700?",
    "I can do: morning + night routine, a single concern deep-dive, ingredient explainer, or shopping list. Which?",
    "Tell me what's bugging you most today and I'll get specific.",
]

# Rotated fallback intros (used when we couldn't classify — never repeat verbatim)
_FALLBACK_VARIANTS = [
    "I'm not 100% sure what you're after — could you be a bit more specific?",
    "Hmm, I want to make sure I answer the right thing.",
    "Quick clarification so I can actually help —",
    "I can go in a few directions here.",
    "Got it — let's narrow this down.",
]

# Lifestyle deep-dive variants — rotated by topic and repeat count
_LIFESTYLE_DEEP: Dict[str, List[str]] = {
    "food": [
        "**What to eat for clearer, glowing skin:**\n\n"
        "- **Omega-3 every day**: walnuts, flax/chia seeds, salmon, sardines — reduces inflammation and acne.\n"
        "- **Antioxidants**: berries, pomegranate, dark leafy greens, green tea, dark chocolate (>70%).\n"
        "- **Protein**: eggs, lentils, paneer, tofu, chicken — collagen needs amino acids to rebuild.\n"
        "- **Healthy fats**: avocado, olive oil, nuts — keep the lipid barrier strong.\n"
        "- **Water-rich foods**: cucumber, watermelon, oranges, tomatoes — top up hydration.\n\n"
        "**Limit (especially if acne-prone)**:\n"
        "- High-glycemic carbs (white bread, sugary drinks, sweets) — spike insulin → more sebum.\n"
        "- Skim milk and whey protein — strongest dairy-acne link in studies.\n"
        "- Deep-fried / heavily processed food — drives inflammation.",
        "**A simple skin-friendly day on a plate:**\n\n"
        "- **Breakfast**: oats with chia + berries + walnuts, or 2 eggs with spinach + 1 fruit.\n"
        "- **Lunch**: dal/lentils + brown rice or roti + a big salad + curd (if you tolerate it) + 1 tsp ghee.\n"
        "- **Snack**: handful of almonds + green tea, or fruit + peanut butter.\n"
        "- **Dinner**: grilled fish/chicken/tofu + roasted veggies + quinoa or sweet potato.\n"
        "- **Hydration**: 2.5–3 L water + 1 cup green tea + lemon water in AM.\n\n"
        "Repeat 80% of the time — perfection is the enemy of consistency.",
        "**Skin-killer foods to cut first** (you'll see a difference in 4–6 weeks):\n\n"
        "1. **Sugary drinks** (soda, packaged juice, sweet coffee) — biggest insulin spike.\n"
        "2. **Skim milk + whey protein** — IGF-1 spike → acne in many adults.\n"
        "3. **Refined carbs** (white bread, maida, instant noodles) — same insulin problem.\n"
        "4. **Deep-fried snacks** — oxidized oils accelerate skin aging.\n"
        "5. **Excess alcohol** — dehydrates, dilates blood vessels (more redness), depletes B vitamins.\n\n"
        "Cut these one at a time so you can tell which one was triggering you.",
    ],
    "sleep": [
        "**Why sleep is the cheapest skin treatment:**\n\n"
        "- Growth hormone peaks during deep sleep — collagen rebuild happens here.\n"
        "- Cortisol drops → less oil, less inflammation, fewer breakouts.\n"
        "- Lymphatic drainage reduces puffiness and dark circles.\n"
        "- Skin's water loss is highest at night → moisturize before bed.\n\n"
        "**Aim**: 7–9 hours, same wake-up time daily (consistency > duration).\n"
        "**Pro tips**: silk pillowcase, sleep on your back, change pillowcase 2x/week, no screens 30 min before bed.",
        "**Fix sleep in 7 days:**\n\n"
        "- Same wake-up time every day (yes, weekends too) — anchors your circadian rhythm.\n"
        "- 10 min sunlight in the morning — sets melatonin to release ~14 hrs later.\n"
        "- Caffeine cutoff at 2 PM (half-life is 6 hours).\n"
        "- Cool bedroom (18–20°C), pitch dark.\n"
        "- 0.3–1 mg melatonin only if you really can't fall asleep — not a long-term fix.",
    ],
    "water": [
        "**Hydration done right:**\n\n"
        "- Target: ~35 ml per kg body weight per day (so 60 kg → ~2.1 L).\n"
        "- Add 500 ml extra if you sweat / exercise / live in dry climate.\n"
        "- Drinking water alone won't 'hydrate' your skin if your barrier is broken — pair with a moisturizer that has hyaluronic acid + ceramides.\n"
        "- Coconut water, cucumber, watermelon, oranges count too.\n"
        "- Sign you're under-hydrated: dark yellow urine, headache by 4 PM, dry lips.",
        "**Easy hydration habits that stick:**\n\n"
        "- 500 ml water within 30 min of waking up (kickstarts everything).\n"
        "- 1 glass before every meal.\n"
        "- Keep a 1 L bottle on your desk — finish it twice.\n"
        "- Replace one coffee/tea with herbal/green tea.\n"
        "- Eat a fruit or salad with 2 meals — 20% of daily water comes from food.",
    ],
    "stress": [
        "**Stress wrecks skin via cortisol — here's how to fight back:**\n\n"
        "- **5 min box breathing** (4-4-4-4) twice a day drops cortisol fast.\n"
        "- 20-min walks outside — sunlight + movement beat indoor exercise for stress.\n"
        "- Journal 3 lines before bed — clears mental loops that disrupt sleep.\n"
        "- Limit doomscrolling — social media is a hidden cortisol driver.\n"
        "- Magnesium glycinate 200–400 mg at night helps if you're tense.\n\n"
        "Visible results on skin (less inflammation, fewer breakouts) usually show in 3–4 weeks.",
    ],
    "exercise": [
        "**Exercise and your skin:**\n\n"
        "- 30 min cardio 4x/week boosts blood flow → nutrients reach skin faster, glow improves.\n"
        "- Sweating clears pore debris — but **wash your face within 30 min** or it clogs pores.\n"
        "- Wear a clean cotton headband, tie hair back, no makeup during workouts.\n"
        "- Heavy weightlifting bumps testosterone slightly — fine for most, can flare hormonal acne in a few people.\n"
        "- Yoga / pilates lower cortisol — best combo for stress-driven skin issues.",
    ],
    "general": [
        "**The 5 lifestyle moves that genuinely change skin:**\n\n"
        "- **Sleep 7+ hours** — biggest single lever.\n"
        "- **2.5–3 L water** + omega-3 daily.\n"
        "- **SPF 50 every morning** — non-negotiable for anti-aging and pigmentation.\n"
        "- **Cut high-glycemic foods + skim milk** if you have acne.\n"
        "- **Manage stress** — 10 min breathing or a walk daily.\n\n"
        "Pick ONE this week. Stack the next one in week 3.",
        "**A 4-week skin-from-the-inside plan:**\n\n"
        "- **Week 1**: lock sleep — same wake-up time + caffeine cutoff at 2 PM.\n"
        "- **Week 2**: hit 2.5 L water daily + add 1 fruit + 1 salad.\n"
        "- **Week 3**: cut sugary drinks and skim milk for 21 days — note any change.\n"
        "- **Week 4**: add 20 min daily walk outside + 5 min breathing twice a day.\n\n"
        "By week 4 most people see visibly less oil, fewer breakouts, less puffiness.",
    ],
}


def _last_topic(history: List[Dict[str, str]]) -> Tuple[str, str]:
    """Walk back through history; return (intent, key) of the most recent
    concern/ingredient discussed. Returns ('', '') if none found."""
    for msg in reversed(history or []):
        text = (msg.get("text") or msg.get("content") or "").lower()
        if not text:
            continue
        # Concern check (longest first so 'dark circle' beats 'circle')
        for c in ("dark_circles", "blackheads", "pigmentation", "dryness", "oiliness",
                  "redness", "wrinkles", "dullness", "acne", "pores", "hydration", "evenness"):
            if c.replace("_", " ") in text or c in text:
                return ("concern", c)
        for ing in ("retinol", "vitamin c", "niacinamide", "salicylic", "hyaluronic",
                    "benzoyl", "azelaic", "ceramide", "spf", "tretinoin", "aha", "bha"):
            if ing in text:
                return ("ingredient", ing)
        if any(w in text for w in ("routine", "morning", "night", "schedule")):
            return ("routine", "")
        if any(w in text for w in ("product", "recommend", "buy", "shopping")):
            return ("products", "")
    return ("", "")


def _is_followup(message: str) -> bool:
    m = message.lower().strip()
    if len(m) <= 4:
        return True  # "ok?", "yes", "more"
    return any(h in m for h in _FOLLOWUP_HINTS)


def _summary_recently_shown(history: List[Dict[str, str]]) -> bool:
    """Don't repeat the scan summary if we already showed it in the last 3 assistant turns."""
    seen = 0
    for msg in reversed(history or []):
        if msg.get("role") != "assistant":
            continue
        seen += 1
        if seen > 3:
            break
        text = msg.get("text") or msg.get("content") or ""
        if "From your latest scan" in text:
            return True
    return False


def _count_topic_in_history(history: List[Dict[str, str]], key: str) -> int:
    """How many times this topic key was mentioned in prior turns (caller's user messages
    + assistant replies). Used to pick a fresh deep-dive variant."""
    if not key:
        return 0
    needle = key.replace("_", " ")
    return sum(1 for msg in (history or [])
               if needle in (msg.get("text") or msg.get("content") or "").lower())


def _generate_doctor_reply(message: str, last_analysis: Dict[str, Any] | None,
                           history: List[Dict[str, str]] | None = None) -> str:
    history = history or []
    intent, hits = _detect_intent(message)
    summary = _scan_summary(last_analysis)
    summary_shown = _summary_recently_shown(history)
    show_summary = bool(summary) and not summary_shown

    # ---- Re-route vague follow-ups to last topic ----
    if intent == "general" and _is_followup(message) and history:
        last_intent, last_key = _last_topic(history)
        if last_intent == "concern" and last_key:
            intent, hits = "concern", [last_key]
        elif last_intent == "ingredient" and last_key:
            intent, hits = "ingredient", [last_key]
        elif last_intent == "routine":
            intent = "routine"
        elif last_intent == "products":
            intent = "products"

    # Pick a re-engagement line that varies with conversation length so we don't repeat it
    reengage = _REENGAGE_PROMPTS[len(history) % len(_REENGAGE_PROMPTS)]

    parts: List[str] = []

    if intent == "greeting":
        if show_summary:
            return summary + "\n\n" + reengage
        if summary_shown:
            return reengage
        return "Hello! I'm your AI skincare assistant. Run a face scan first and I'll tailor everything to your skin. Or ask me about any concern, ingredient, or routine."

    if intent == "thanks":
        return "You're welcome. Stay consistent — skincare results show in 4–12 weeks. Ping me anytime."

    if intent == "emergency":
        return ("If you're seeing facial swelling, bleeding, or severe pain, please contact a real doctor or "
                "emergency services immediately — I'm an AI assistant and can't replace urgent medical care.")

    if intent == "routine":
        st = (last_analysis or {}).get("skin_type", {}).get("label", "Normal")
        concerns = (last_analysis or {}).get("concerns", {})
        top = sorted([(k, v) for k, v in concerns.items() if k not in ("hydration", "evenness")], key=lambda x: -x[1])[:2]
        if show_summary:
            parts.append(summary + "\n\n")
        parts.append(f"Routine for **{st}** skin")
        if top:
            parts.append(f" focused on **{top[0][0].replace('_', ' ')}**" + (f" + **{top[1][0].replace('_', ' ')}**" if len(top) > 1 else ""))
        parts.append(":\n\n")
        parts.append("**Morning**: gentle cleanser → vitamin C serum → light moisturizer → SPF 50.\n\n")
        # tailor evening to top concern
        if top and top[0][0] in ("acne", "blackheads", "oiliness", "pores"):
            parts.append("**Evening**: gentle cleanser → salicylic acid 2% (3x/week) → niacinamide → light moisturizer.\n\n")
        elif top and top[0][0] in ("wrinkles", "pigmentation", "dullness"):
            parts.append("**Evening**: gentle cleanser → retinol/retinal (start 2x/week) → ceramide moisturizer.\n\n")
        elif top and top[0][0] == "dark_circles":
            parts.append("**Evening**: gentle cleanser → caffeine + peptide eye cream → retinol on face (2x/week) → moisturizer.\n\n")
        elif top and top[0][0] in ("dryness", "redness"):
            parts.append("**Evening**: cream cleanser → hyaluronic acid on damp skin → ceramide + cica moisturizer (skip actives until barrier recovers).\n\n")
        else:
            parts.append("**Evening**: gentle cleanser → treatment (retinol 2–3x/week) → moisturizer.\n\n")
        parts.append("**Weekly**: gentle exfoliation 1–2x and a hydrating mask once.")
        return "".join(parts)

    if intent == "products":
        # Pull from analysis if available
        concerns = (last_analysis or {}).get("concerns", {})
        top = sorted([(k, v) for k, v in concerns.items() if k not in ("hydration", "evenness")],
                     key=lambda x: -x[1])[:3]
        if top:
            if show_summary:
                parts.append(summary + "\n\n")
            parts.append("Based on your scan, prioritize products with these key ingredients:\n\n")
            for k, v in top:
                kb = _CONCERN_KB.get(k, {})
                parts.append(f"- **For {k.replace('_', ' ')}** (your score {v:.0f}/100): {', '.join(kb.get('ingredients', [])[:3])}\n")
        else:
            parts.append("Run a quick scan first and I'll match products to your real concerns. In the meantime, safe everyday picks: a gentle cleanser (CeraVe Hydrating / Cetaphil), niacinamide 5% serum, ceramide moisturizer, SPF 50 (Beauty of Joseon, La Roche-Posay Anthelios).")
        parts.append("\nScroll to the **Products** section below for live picks tailored to your top concerns.")
        return "".join(parts)

    if intent == "ingredient":
        ing = hits[0]
        tips = {
            "retinol": "Retinol boosts cell turnover and collagen. Start 2x/week, pea-size on dry skin at night, always SPF next day. Expect 'purging' weeks 2–6.",
            "vitamin c": "Vitamin C (L-ascorbic acid 10–20%) brightens and protects from oxidative stress. Use AM under SPF. Store in dark, cool place.",
            "niacinamide": "Niacinamide 5% reduces oil, redness, and pigmentation. Works with almost everything. Twice daily is fine.",
            "salicylic": "Salicylic acid 2% is oil-soluble — great for blackheads and oily acne. Don't combine with retinol same night.",
            "hyaluronic": "Hyaluronic acid pulls water into skin. Apply to damp skin, then seal with moisturizer. In dry climates, always seal.",
            "benzoyl": "Benzoyl peroxide kills acne bacteria. Start 2.5%. Bleaches fabric. Don't combine with retinol same time.",
            "azelaic": "Azelaic acid 10% (15–20% Rx) treats redness, rosacea, acne, and pigmentation. Very gentle. Can use AM/PM.",
            "ceramide": "Ceramides repair the skin barrier. Look for moisturizers with ceramides + cholesterol + fatty acids.",
            "spf": "SPF 50 broad-spectrum, two finger lengths for face+neck, reapply every 2 hours outdoors.",
            "sunscreen": "SPF 50 broad-spectrum daily — non-negotiable for preventing aging and pigmentation.",
            "aha": "AHA (glycolic, lactic) chemically exfoliates surface. 1–2 nights/week. Always SPF.",
            "bha": "BHA = salicylic acid. Oil-soluble, gets into pores. 2x/week to start.",
            "tretinoin": "Tretinoin is prescription. Stronger than retinol — see a dermatologist. Start 2x/week, buffer with moisturizer.",
        }
        for k, v in tips.items():
            if k in ing:
                return v
        return "I'd be happy to explain — could you ask about a specific ingredient like retinol, vitamin C, niacinamide, salicylic acid, or SPF?"

    if intent == "concern":
        concern = hits[0]
        kb = _CONCERN_KB[concern]
        # How many times has this concern come up already? Pick a fresh angle.
        repeats = _count_topic_in_history(history, concern)
        deep = _CONCERN_DEEP.get(concern, [])

        # First mention → overview. Repeat → rotate through deep-dive variants.
        if repeats == 0 or not deep:
            score_note = ""
            if last_analysis and concern in last_analysis.get("concerns", {}):
                score_note = f" Your last scan rated this concern at **{last_analysis['concerns'][concern]:.0f}/100**."
            elif show_summary:
                score_note = " " + summary
            base = (
                f"**{concern.replace('_', ' ').capitalize()}** — what we know:{score_note}\n\n"
                f"**Likely causes**: {kb['causes']}.\n\n"
                f"**What helps**: look for {', '.join(kb['ingredients'])}.\n\n"
                f"**Avoid**: {kb['avoid']}.\n\n"
                f"**When to see a dermatologist**: {kb['see_doc']}.\n\n"
                f"_Ask me for a step-by-step plan, common mistakes, or product picks for this._"
            )
            return base
        # Pick the next variant we haven't shown
        idx = (repeats - 1) % len(deep)
        return deep[idx] + "\n\n_Want product picks or to compare with another concern?_"

    if intent == "lifestyle":
        topic = (hits or ["general"])[0]
        # Pick a fresh variant when the same lifestyle topic comes up again
        repeats = _count_topic_in_history(history, topic)
        variants = _LIFESTYLE_DEEP.get(topic) or _LIFESTYLE_DEEP["general"]
        idx = repeats % len(variants)
        body = variants[idx]
        tail = "\n\n_Want me to turn this into a daily checklist, or pair it with a routine?_"
        return body + tail

    # Rotate the fallback so we don't say the same line every time the user asks
    # something we don't directly recognise.
    fb_idx = len([msg for msg in history if msg.get("role") == "assistant"]) % len(_FALLBACK_VARIANTS)
    fallback = _FALLBACK_VARIANTS[fb_idx] + " " + reengage
    if show_summary:
        return summary + "\n\n" + fallback
    return fallback


def _stream_text(text: str):
    """Yield SSE chunks word-by-word for a typing-like effect."""
    import json as _json
    words = text.split(" ")
    for i, w in enumerate(words):
        chunk = w + (" " if i < len(words) - 1 else "")
        yield f"data: {_json.dumps({'delta': chunk})}\n\n"
        time.sleep(0.018)
    yield f"data: {{\"done\": true}}\n\n"


@app.route("/chat", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        return ("", 204)
    try:
        body = request.get_json(silent=True) or {}
        message = (body.get("message") or "").strip()
        last_analysis = body.get("last_analysis") or None
        history = body.get("history") or []
        # sanitize: keep only role+text, cap at last 10 turns
        clean_history: List[Dict[str, str]] = []
        for m in (history if isinstance(history, list) else [])[-10:]:
            if not isinstance(m, dict):
                continue
            role = str(m.get("role", "")).lower()
            text = str(m.get("text") or m.get("content") or "")[:2000]
            if role in ("user", "assistant") and text:
                clean_history.append({"role": role, "text": text})
        stream = bool(body.get("stream", True))
        if not message:
            return jsonify({"success": False, "error": "empty message"}), 400
        reply = _generate_doctor_reply(message, last_analysis, clean_history)
        if not stream:
            return jsonify({"success": True, "reply": reply})
        from flask import Response
        return Response(_stream_text(reply), mimetype="text/event-stream",
                        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


# ---------------------------------------------------------------------------
# v7.4: Product catalog — Minimalist (beminimalist.co), real prices & images
# All entries verified from beminimalist.co/products.json on 2026-04-28.
# tier mapping: drugstore = under ₹400, affordable = ₹400–699, premium = ₹700+
# ---------------------------------------------------------------------------
_MIN_IMG = "https://cdn.shopify.com/s/files/1/0410/9608/5665/files/"
_MIN_URL = "https://beminimalist.co/products/"

_PRODUCT_CATALOG: List[Dict[str, Any]] = [
    # ── CLEANSERS ──
    {"name": "Marula Oil 05% Cleansing Oil", "brand": "Minimalist", "price": "₹569", "tier": "affordable",
     "category": "cleanser", "rating": 4.5, "reviews": 1820,
     "concerns": ["dryness", "hydration", "evenness"], "key_ingredients": ["marula oil", "jojoba", "olive oil"],
     "image": _MIN_IMG + "ListingMarulaOil05.jpg",
     "url": _MIN_URL + "marula-oil-05-cleansing-oil"},

    # ── SERUMS ──
    {"name": "Niacinamide 5% Face Serum (10 ml)", "brand": "Minimalist", "price": "₹237", "tier": "drugstore",
     "category": "serum", "rating": 4.5, "reviews": 14250,
     "concerns": ["acne", "oiliness", "pores", "redness", "evenness"],
     "key_ingredients": ["niacinamide 5%"],
     "image": _MIN_IMG + "Nia_05_10ml_1_1e27f2ef-09d0-4140-bf9e-a5d62459489e.jpg",
     "url": _MIN_URL + "niacinamide-5-face-serum-10ml"},
    {"name": "Niacinamide 10% Face Serum", "brand": "Minimalist", "price": "₹569", "tier": "affordable",
     "category": "serum", "rating": 4.5, "reviews": 28900,
     "concerns": ["acne", "oiliness", "pores", "evenness", "pigmentation"],
     "key_ingredients": ["niacinamide 10%", "matmarine"],
     "image": _MIN_IMG + "Nia10New.png",
     "url": _MIN_URL + "niacinamide-10-with-matmarine"},
    {"name": "Multi Repair Actives 15% Face Serum", "brand": "Minimalist", "price": "₹664", "tier": "affordable",
     "category": "serum", "rating": 4.4, "reviews": 1240,
     "concerns": ["dullness", "evenness", "redness"],
     "key_ingredients": ["niacinamide", "panthenol", "ectoin"],
     "image": _MIN_IMG + "MultiRepairListing.jpg",
     "url": _MIN_URL + "multi-repair-actives-15-face-serum"},
    {"name": "Copper Peptide + PDRN 1.25% Face Serum", "brand": "Minimalist", "price": "₹664", "tier": "affordable",
     "category": "serum", "rating": 4.6, "reviews": 980,
     "concerns": ["wrinkles", "hydration", "evenness"],
     "key_ingredients": ["copper peptide", "pdrn"],
     "image": _MIN_IMG + "CopyofArtboard1_2.jpg",
     "url": _MIN_URL + "copper_peptide_pdrn_1-25_face_serum"},
    {"name": "Retinol 0.6% Face Serum", "brand": "Minimalist", "price": "₹617", "tier": "affordable",
     "category": "serum", "rating": 4.4, "reviews": 7850,
     "concerns": ["wrinkles", "pores", "pigmentation"],
     "key_ingredients": ["retinol 0.6%"],
     "image": _MIN_IMG + "Retinol_06_New.png",
     "url": _MIN_URL + "retinol-0-6"},
    {"name": "Retinal 0.1% Face Serum", "brand": "Minimalist", "price": "₹759", "tier": "premium",
     "category": "serum", "rating": 4.6, "reviews": 4320,
     "concerns": ["wrinkles", "evenness", "pigmentation"],
     "key_ingredients": ["retinal", "bakuchiol", "squalane"],
     "image": _MIN_IMG + "DomesticMain.png",
     "url": _MIN_URL + "retinal-0-1-face-serum"},

    # ── TONERS ──
    {"name": "Vitamin B12 + NMF 03% Face Toner", "brand": "Minimalist", "price": "₹379", "tier": "drugstore",
     "category": "treatment", "rating": 4.4, "reviews": 1640,
     "concerns": ["hydration", "dryness", "redness"],
     "key_ingredients": ["vitamin b12", "nmf"],
     "image": _MIN_IMG + "ListingImageMilkyToner_a8ab36fc-8692-4451-85e2-363dbdb3b21d.jpg",
     "url": _MIN_URL + "vitamin-b12-nmf-03-face-toner"},
    {"name": "Glycolic Acid 8% Exfoliating Liquid", "brand": "Minimalist", "price": "₹474", "tier": "affordable",
     "category": "treatment", "rating": 4.5, "reviews": 9210,
     "concerns": ["dullness", "evenness", "pores"],
     "key_ingredients": ["glycolic acid 8%"],
     "image": _MIN_IMG + "GlycolicNew.png",
     "url": _MIN_URL + "glycolic-acid-08-exfoliating-liquid-toner"},
    {"name": "HOCL Skin Relief Spray 150 ppm", "brand": "Minimalist", "price": "₹379", "tier": "drugstore",
     "category": "treatment", "rating": 4.5, "reviews": 2340,
     "concerns": ["redness", "acne"],
     "key_ingredients": ["hypochlorous acid"],
     "image": _MIN_IMG + "HOCLmain.png",
     "url": _MIN_URL + "hocl-skin-relief-spray-150-ppm-toner"},

    # ── MOISTURIZERS ──
    {"name": "Vitamin B5 10% Moisturizer (30 g)", "brand": "Minimalist", "price": "₹189", "tier": "drugstore",
     "category": "moisturizer", "rating": 4.6, "reviews": 18420,
     "concerns": ["hydration", "oiliness", "dryness"],
     "key_ingredients": ["vitamin b5", "panthenol"],
     "image": _MIN_IMG + "VitB5.png",
     "url": _MIN_URL + "vitamin-b5-10-moisturizer-30g"},
    {"name": "Sepicalm 3% Moisturizer", "brand": "Minimalist", "price": "₹332", "tier": "drugstore",
     "category": "moisturizer", "rating": 4.6, "reviews": 12480,
     "concerns": ["redness", "hydration", "dryness"],
     "key_ingredients": ["sepicalm", "oat"],
     "image": _MIN_IMG + "Sepicalm_New.png",
     "url": _MIN_URL + "sepicalm-3-oat-moisturiser"},
    {"name": "B12 + Repair Complex 5.5% Face Moisturizer (50g)", "brand": "Minimalist", "price": "₹379", "tier": "drugstore",
     "category": "moisturizer", "rating": 4.6, "reviews": 5430,
     "concerns": ["redness", "hydration", "dryness"],
     "key_ingredients": ["vitamin b12", "ceramides"],
     "image": _MIN_IMG + "B12ListingImage.jpg",
     "url": _MIN_URL + "vitamin-b12-repair-complex-5-5-face-moisturizer"},

    # ── SUNSCREEN ──
    {"name": "Light Fluid SPF 50 Sunscreen (50 ml)", "brand": "Minimalist", "price": "₹474", "tier": "affordable",
     "category": "sunscreen", "rating": 4.5, "reviews": 22100,
     "concerns": ["pigmentation", "wrinkles", "evenness"],
     "key_ingredients": ["spf 50", "tinosorb m", "uvinul a plus"],
     "image": _MIN_IMG + "LightFluid_New.png",
     "url": _MIN_URL + "light-fluid-spf-50-sunscreen"},

    # ── EYE & LIP ──
    {"name": "Vitamin K + Retinal 1% Eye Cream", "brand": "Minimalist", "price": "₹474", "tier": "affordable",
     "category": "treatment", "rating": 4.4, "reviews": 6720,
     "concerns": ["dark_circles", "wrinkles"],
     "key_ingredients": ["vitamin k", "retinal"],
     "image": _MIN_IMG + "KRetinalNew.png",
     "url": _MIN_URL + "vitamin-k-retinal-01-eye-cream"},
    {"name": "Lip Balm SPF 30", "brand": "Minimalist", "price": "₹284", "tier": "drugstore",
     "category": "treatment", "rating": 4.5, "reviews": 4180,
     "concerns": ["dryness"],
     "key_ingredients": ["spf 30"],
     "image": _MIN_IMG + "LipBalm30New.jpg",
     "url": _MIN_URL + "lip-balm-spf-30"},

    # ── KITS ──
    {"name": "Anti-Acne Skin Care Kit", "brand": "Minimalist", "price": "₹1,019", "tier": "premium",
     "category": "treatment", "rating": 4.5, "reviews": 3210,
     "concerns": ["acne", "oiliness", "pores"],
     "key_ingredients": ["salicylic acid", "niacinamide"],
     "image": _MIN_IMG + "AntiAcneListing.png",
     "url": _MIN_URL + "anti-acne-kit"},
    {"name": "Anti-Pigmentation Skin Care Kit", "brand": "Minimalist", "price": "₹1,147", "tier": "premium",
     "category": "treatment", "rating": 4.5, "reviews": 2480,
     "concerns": ["pigmentation", "evenness", "dullness"],
     "key_ingredients": ["alpha arbutin", "niacinamide", "glycolic acid"],
     "image": _MIN_IMG + "AntiPigmentationListing.png",
     "url": _MIN_URL + "anti-pigmentation-kit"},
    {"name": "Anti-Aging Skin Care Kit", "brand": "Minimalist", "price": "₹1,104", "tier": "premium",
     "category": "treatment", "rating": 4.4, "reviews": 1890,
     "concerns": ["wrinkles", "dullness", "evenness"],
     "key_ingredients": ["retinol", "niacinamide", "coenzyme q10"],
     "image": _MIN_IMG + "AntiAgingListing.png",
     "url": _MIN_URL + "anti-aging-kit"},
]


@app.route("/products", methods=["GET"])
def products():
    raw = request.args.get("concerns", "").lower()
    requested = [c.strip() for c in raw.split(",") if c.strip()]
    tier_filter = request.args.get("tier")  # drugstore | affordable | premium
    if not requested:
        items = _PRODUCT_CATALOG
    else:
        scored = []
        for p in _PRODUCT_CATALOG:
            score = sum(1 for c in p["concerns"] if c in requested)
            if score > 0:
                scored.append((score, p))
        scored.sort(key=lambda x: -x[0])
        items = [p for _, p in scored]
    if tier_filter:
        items = [p for p in items if p["tier"] == tier_filter]
    return jsonify({"success": True, "count": len(items), "items": items[:24]})


# ---------------------------------------------------------------------------
# v7: Live tips
# ---------------------------------------------------------------------------
@app.route("/tips", methods=["GET"])
def tips():
    import random as _random
    n = max(1, min(20, int(request.args.get("n", 6))))
    return jsonify({"success": True, "tips": _random.sample(_GENERAL_TIPS, min(n, len(_GENERAL_TIPS)))})


@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "service": "SkinInsight Pro ML server",
        "version": VERSION,
        "endpoints": [
            "/health",
            "/analyze (POST)",
            "/predict (POST, alias)",
            "/analyze_multi (POST, multi-angle)",
            "/chat (POST, streaming)",
            "/products (GET)",
            "/tips (GET)",
        ],
    })


if __name__ == "__main__":
    print(f"[server] SkinInsight Pro v{VERSION} starting on {HOST}:{PORT}")
    print(f"[server] cv2={_HAS_CV2} tflite={_HAS_TFLITE}")
    _SKIN_TYPE.load()
    app.run(host=HOST, port=PORT, debug=False, threaded=True)
