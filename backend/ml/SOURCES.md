# ML sources (GitHub repos) + dataset options

This project’s `/api/predict` endpoint can call a local ML runner (`ml/predict.py`) that uses a TensorFlow Lite model (`ml/model.tflite`).

To *modify/train* a CNN properly, you typically:
1) pick a training repo / codebase
2) prepare your dataset in a folder structure
3) train / evaluate
4) export to TFLite
5) drop the new `model.tflite` + `labels.txt` into `ml/`

## Repo used right now (already integrated)

- Repo: https://github.com/shhubhxm/Skin-Disease-Detection-Team-Technophile
- License: MIT (has a LICENSE file)
- What it provides:
  - A working TFLite model (distributed inside the APK in the repo)
  - Training script: `image_classification_code.py` (uses `tflite_model_maker.image_classifier`)
  - Labels: `healthy`, `lupus`, `ringworm`, `scalp_infections`

This is why your app can already do real inference locally.

## Recommended training repos (good starting points)

These are solid bases when you want to train on *your* dataset and export TFLite.

1) TensorFlow Lite Model Maker (official)
- Repo: https://github.com/tensorflow/examples
- License: Apache-2.0
- Why: has examples for image classification + easy transfer learning; you can adapt to your dataset and export TFLite.

2) TensorFlow / TFLite Model Maker (library)
- Repo: https://github.com/tensorflow/examples/tree/master/tensorflow_examples/lite/model_maker
- License: Apache-2.0 (part of TensorFlow examples)
- Why: aligns with the training approach used by the MIT repo above.

3) Any clean “transfer learning” Keras repo (MobileNet/EfficientNet)
- Goal: train a small CNN/feature extractor on your classes and export to TFLite.
- Tip: pick repos that clearly include a LICENSE (MIT/Apache/BSD) and a reproducible training script.

## Dataset options (important)

The biggest practical blocker is getting a dataset that is:
- legally usable (license/terms)
- labeled the way you want (same class names)
- big enough to train a model that generalizes

Common sources (you must verify terms for your usage):
- ISIC Archive (skin lesion images; often used for melanoma/lesion tasks): https://www.isic-archive.com/
- HAM10000 (lesion dataset; often used for 7 lesion classes)

Note: Many “skin disease” datasets you see referenced online (e.g., DermNet) are often **not** freely reusable for training/commercial use. Always verify the dataset’s license/terms.

## What we need to decide next

1) Your target classes:
- Option A (current model): Healthy / Lupus / Ringworm / Scalp Infections
- Option B (your original UI): Acne / Eczema / Psoriasis / Melanoma / Ringworm
- Option C: your own custom list

2) Where your dataset will live and its folder format.
A common format is:

- dataset/
  - train/
    - class_a/
    - class_b/
  - val/
    - class_a/
    - class_b/
  - test/
    - class_a/
    - class_b/

Once you tell me the class list + dataset format, I can:
- clone the chosen repo into this workspace
- adapt the training script to your dataset
- export a new `model.tflite` + `labels.txt`
- connect it to `/api/predict` (already done; it will automatically use the new files)
