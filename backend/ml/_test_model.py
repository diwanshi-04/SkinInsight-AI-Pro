"""Quick test: check if existing models give correct predictions on known images."""
import os, time, sys
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

print("Loading TensorFlow...")
t0 = time.time()
import tensorflow as tf
import numpy as np
from PIL import Image
print(f"TF loaded in {time.time()-t0:.1f}s")

ML_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(ML_DIR)

def test_model(model_path, labels_path, test_images, model_name):
    print(f"\n{'='*60}")
    print(f"Testing: {model_name}")
    print(f"{'='*60}")
    
    if not os.path.exists(model_path):
        print(f"  MODEL NOT FOUND: {model_path}")
        return
    
    interp = tf.lite.Interpreter(model_path=model_path)
    interp.allocate_tensors()
    inp = interp.get_input_details()[0]
    out = interp.get_output_details()[0]
    h, w = inp["shape"][1], inp["shape"][2]
    print(f"  Input: {inp['shape'].tolist()}, dtype={inp['dtype']}")
    
    labels = []
    if os.path.exists(labels_path):
        with open(labels_path) as f:
            labels = [l.strip() for l in f if l.strip()]
    print(f"  Labels: {labels}")
    
    correct = 0
    total = 0
    per_class_correct = {}
    per_class_total = {}
    
    for expected_label, img_path in test_images:
        if not os.path.exists(img_path):
            continue
        img = Image.open(img_path).convert("RGB").resize((w, h))
        arr = np.expand_dims(np.asarray(img).astype(np.float32) / 255.0, axis=0)
        interp.set_tensor(inp["index"], arr)
        interp.invoke()
        probs = interp.get_tensor(out["index"])[0]
        
        predicted_idx = int(np.argmax(probs))
        predicted_label = labels[predicted_idx] if predicted_idx < len(labels) else str(predicted_idx)
        conf = float(probs[predicted_idx]) * 100
        
        is_correct = predicted_label.lower() == expected_label.lower()
        if is_correct:
            correct += 1
        total += 1
        
        # Per-class tracking
        per_class_total[expected_label] = per_class_total.get(expected_label, 0) + 1
        if is_correct:
            per_class_correct[expected_label] = per_class_correct.get(expected_label, 0) + 1
        
        # Only print wrong predictions (less clutter)
        if not is_correct:
            details = ", ".join(f"{labels[i]}={probs[i]*100:.1f}%" for i in range(len(labels)))
            print(f"  [WRONG] Expected={expected_label}, Got={predicted_label} ({conf:.1f}%)  [{details}]")
    
    if total > 0:
        print(f"\n  Overall Accuracy: {correct}/{total} = {correct/total*100:.1f}%")
        print(f"  Per-class breakdown:")
        for cls in sorted(per_class_total.keys()):
            cls_correct = per_class_correct.get(cls, 0)
            cls_total = per_class_total[cls]
            print(f"    {cls}: {cls_correct}/{cls_total} = {cls_correct/cls_total*100:.1f}%")

# Test disease model
disease_model = os.path.join(ML_DIR, "model.tflite")
disease_labels = os.path.join(ML_DIR, "labels.txt")
mamdata = os.path.join(PROJECT_DIR, "Skin-Disease-Detection-Team-Technophile-main", "MamData800")

disease_tests = []
for cls in ["healthy", "lupus", "ringworm", "scalp_infections"]:
    cls_dir = os.path.join(mamdata, cls)
    if os.path.isdir(cls_dir):
        files = sorted(os.listdir(cls_dir))[:10]  # test 10 per class
        for f in files:
            disease_tests.append((cls, os.path.join(cls_dir, f)))

test_model(disease_model, disease_labels, disease_tests, "Disease Model")

# Test skin type model — use the clean test set if available
skin_model = os.path.join(ML_DIR, "skin_type_model.tflite")
skin_labels = os.path.join(ML_DIR, "skin_type_labels.txt")

# Prefer clean test data, fall back to original
skin_clean = os.path.join(PROJECT_DIR, "skin_type_clean", "test")
skin_orig = os.path.join(PROJECT_DIR, "Oily-Dry-Skin-Types", "test")
skin_data = skin_clean if os.path.isdir(skin_clean) else skin_orig
print(f"\nUsing skin type test data from: {skin_data}")

skin_tests = []
for cls in ["dry", "normal", "oily"]:
    cls_dir = os.path.join(skin_data, cls)
    if os.path.isdir(cls_dir):
        files = sorted(os.listdir(cls_dir))  # test ALL images
        for f in files:
            skin_tests.append((cls, os.path.join(cls_dir, f)))

test_model(skin_model, skin_labels, skin_tests, "Skin Type Model")

print("\nDone.")
