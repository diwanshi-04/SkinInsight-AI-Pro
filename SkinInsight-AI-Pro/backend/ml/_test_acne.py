"""End-to-end test for the upgraded acne detector (v8 deep ensemble).

Downloads public-domain acne reference images from Wikimedia Commons (via
Special:FilePath redirect) and runs each through the local analyzer. Also
runs negative controls from the local healthy-skin dataset shipped in the
repo.

Run:
    python ml/_test_acne.py
"""
from __future__ import annotations

import io
import os
import sys
import urllib.parse
import urllib.request
from typing import List, Tuple, Optional

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, ".."))
sys.path.insert(0, HERE)

# Skip TFLite for the CV regression test — we only need the OpenCV pipeline.
os.environ.setdefault("SKIN_DISABLE_TFLITE", "1")

from server import analyze_image  # type: ignore  # noqa: E402

# Wikimedia Commons file names — fetched via Special:FilePath redirect.
COMMONS_SAMPLES: List[Tuple[str, str, float, float]] = [
    ("commons_pimples_human_boy",   "Pimples-human-boy.jpg",          25.0, 100.0),
    ("commons_pimples",             "Pimples.jpg",                    20.0, 100.0),
    ("commons_reddish_zit",         "Reddish_zit.png",                15.0, 100.0),
    ("commons_acne_blood",          "Acne_blood.jpg",                 25.0, 100.0),
    ("commons_zits",                "Zits.jpg",                       20.0, 100.0),
]

LOCAL_HEALTHY_DIR = os.path.join(
    PROJECT_ROOT,
    "Skin-Disease-Detection-Team-Technophile-main",
    "MamData800",
    "healthy",
)
# Higher-quality clean-skin Wikimedia portraits (negative controls). The local
# baby .jfif files are 4-6 KB JPEGs whose compression artifacts mimic bumps,
# so they are not reliable negatives.
HEALTHY_COMMONS_SAMPLES: List[Tuple[str, str, float, float]] = [
    ("commons_clean_face_2",  "Young_woman_smiling.jpg",       0.0, 40.0),
]
LOCAL_HEALTHY_SAMPLES: List[Tuple[str, str, float, float]] = [
    ("local_healthy_side_face",     "normal side face.jfif",          0.0, 35.0),
    ("local_healthy_skin",          "normal skins.jfif",              0.0, 35.0),
]

CACHE_DIR = os.path.join(HERE, "_test_cache")
os.makedirs(CACHE_DIR, exist_ok=True)


def _fetch_commons(name: str, filename: str) -> Optional[Image.Image]:
    cache = os.path.join(CACHE_DIR, f"{name}.bin")
    if not os.path.exists(cache) or os.path.getsize(cache) < 1000:
        url = f"https://commons.wikimedia.org/wiki/Special:FilePath/{urllib.parse.quote(filename)}?width=640"
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "skininsight-acne-test/1.0 (+https://skininsightai.app)"
            })
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            with open(cache, "wb") as f:
                f.write(data)
            print(f"  downloaded {len(data)} bytes")
        except Exception as e:
            print(f"  ! download failed: {e}")
            return None
    try:
        with open(cache, "rb") as f:
            return Image.open(io.BytesIO(f.read())).convert("RGB")
    except Exception as e:
        print(f"  ! decode failed: {e}")
        return None


def _load_local(path: str) -> Optional[Image.Image]:
    if not os.path.exists(path):
        print(f"  ! missing: {path}")
        return None
    try:
        return Image.open(path).convert("RGB")
    except Exception as e:
        print(f"  ! decode failed: {e}")
        return None


def _run(label: str, img: Optional[Image.Image], lo: float, hi: float) -> Tuple[str, str, str]:
    if img is None:
        return (label, "?", "LOAD-FAIL")
    try:
        res = analyze_image(img)
    except Exception as e:
        return (label, "?", f"ERR:{e}")
    score = float(res["concerns"]["acne"])
    lesions = int(res.get("lesion_count", 0))
    ok = lo <= score <= hi
    verdict = "PASS" if ok else "FAIL"
    print(f"  acne_score={score:.1f}  lesions={lesions}  expected={lo:.0f}-{hi:.0f}  -> {verdict}")
    return (label, f"{score:.1f}", verdict)


def main() -> int:
    print("=== Acne detector regression test (v8 deep ensemble) ===\n")
    rows: List[Tuple[str, str, str]] = []

    print("-- POSITIVE CASES (real acne images from Wikimedia Commons) --")
    for name, fname, lo, hi in COMMONS_SAMPLES:
        print(f"[{name}] {fname}")
        img = _fetch_commons(name, fname)
        rows.append(_run(name, img, lo, hi))

    print("\n-- NEGATIVE CONTROLS (clean skin from Wikimedia) --")
    for name, fname, lo, hi in HEALTHY_COMMONS_SAMPLES:
        print(f"[{name}] {fname}")
        img = _fetch_commons(name, fname)
        rows.append(_run(name, img, lo, hi))

    print("\n-- NEGATIVE CONTROLS (clear/healthy skin from local dataset) --")
    for name, fname, lo, hi in LOCAL_HEALTHY_SAMPLES:
        print(f"[{name}] {fname}")
        img = _load_local(os.path.join(LOCAL_HEALTHY_DIR, fname))
        rows.append(_run(name, img, lo, hi))

    print("\n=== Summary ===")
    name_w = max(len(r[0]) for r in rows)
    for n, s, v in rows:
        print(f"  {n.ljust(name_w)}  score={s:>5}  {v}")
    passed = sum(1 for _, _, v in rows if v == "PASS")
    print(f"\n  {passed}/{len(rows)} samples within expected range")
    return 0 if passed == len(rows) else 1


if __name__ == "__main__":
    sys.exit(main())
