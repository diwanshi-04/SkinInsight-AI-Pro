# Local ML inference (TFLite)

This project can run **local** TFLite inference for the `/api/predict` endpoint.

## What’s included

- `ml/model.tflite` and `ml/labels.txt` (extracted from the GitHub-hosted APK in `shhubhxm/Skin-Disease-Detection-Team-Technophile`)
- `ml/predict.py` — CLI that runs TFLite inference and prints JSON
- `/api/predict` can call the CLI when enabled

## Enable local ML

1) Use a Python version that TensorFlow supports (typically **Python 3.11 or 3.12**).

2) Install dependencies:

- `pip install -r ml/requirements.txt`

3) Start Next.js with env vars:

- `SKINPRO_ML_MODE=local`
- Optional: `PYTHON_BIN` (path to python executable to run inference)

Examples (Windows PowerShell):

- `$env:SKINPRO_ML_MODE = "local"`
- `$env:PYTHON_BIN = "C:\\Path\\To\\Python311\\python.exe"`
- `npm run dev`

## Notes

- If local ML fails (Python not found, TensorFlow not installed, model missing, etc.), the API automatically falls back to the existing **simulated** prediction.
- The bundled model’s labels are: `healthy`, `lupus`, `ringworm`, `scalp_infections`.

## Train / replace the model

If you want to **re-train** using the dataset you downloaded in `Skin-Disease-Detection-Team-Technophile-main/MamData800/`, run:

Windows PowerShell (from the project root):

- `python ml/train.py --epochs 5`

This will export:

- `ml/model.tflite`
- `ml/labels.txt`

### Use a different dataset folder

- `python ml/train.py --data_dir "E:\\path\\to\\your\\dataset" --epochs 10`

Dataset format must be:

- `<data_dir>/<class_name>/*.(jpg|png|jfif|...)`

### Quick smoke test

To confirm the pipeline works without waiting for a full training run:

- `python ml/train.py --epochs 1 --max_train_steps 1 --max_val_steps 1 --output_model ml/_smoke.tflite --output_labels ml/_smoke_labels.txt`

### Keep inference compatible

Your inference code (`ml/predict.py`) scales float images to **[0, 1]**.
The training script keeps this consistent so the exported TFLite model also expects float input in **[0, 1]**.
