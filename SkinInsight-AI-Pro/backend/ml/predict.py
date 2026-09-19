import argparse
import json
import math
import os
from typing import List, Tuple

import numpy as np
from PIL import Image


def _softmax(x: np.ndarray) -> np.ndarray:
    x = x.astype(np.float64)
    x = x - np.max(x)
    exp_x = np.exp(x)
    denom = np.sum(exp_x)
    if denom == 0:
        return np.zeros_like(x, dtype=np.float64)
    return (exp_x / denom).astype(np.float64)


def _read_labels(labels_path: str) -> List[str]:
    if not labels_path or not os.path.exists(labels_path):
        return []
    with open(labels_path, "r", encoding="utf-8") as f:
        return [line.strip() for line in f.read().splitlines() if line.strip()]


def _load_interpreter(model_path: str):
    try:
        import tensorflow as tf  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "TensorFlow is required to run TFLite inference. "
            "Install dependencies from ml/requirements.txt"
        ) from exc

    interpreter = tf.lite.Interpreter(model_path=model_path)
    interpreter.allocate_tensors()
    return interpreter


def _prepare_input(
    img: Image.Image,
    input_shape: Tuple[int, int, int, int],
    input_dtype: np.dtype,
    quant: Tuple[float, int],
) -> np.ndarray:
    if len(input_shape) != 4 or input_shape[0] != 1:
        raise ValueError(f"Unsupported input tensor shape: {input_shape}")

    height = int(input_shape[1])
    width = int(input_shape[2])
    channels = int(input_shape[3])

    if channels == 1:
        img = img.convert("L")
    else:
        img = img.convert("RGB")

    img = img.resize((width, height), resample=Image.BILINEAR)

    arr = np.asarray(img)
    if channels == 1:
        arr = np.expand_dims(arr, axis=-1)

    arr = np.expand_dims(arr, axis=0)

    if input_dtype == np.float32:
        return (arr.astype(np.float32) / 255.0).astype(np.float32)

    if input_dtype == np.uint8:
        return arr.astype(np.uint8)

    if input_dtype == np.int8:
        scale, zero_point = quant
        if not scale or math.isclose(scale, 0.0):
            # Fallback: cast to int8 without scaling (may reduce accuracy)
            return arr.astype(np.int16).clip(-128, 127).astype(np.int8)

        arr_f = (arr.astype(np.float32) / 255.0)
        q = np.round(arr_f / scale + float(zero_point))
        return q.clip(-128, 127).astype(np.int8)

    raise ValueError(f"Unsupported input dtype: {input_dtype}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--labels", default="")
    parser.add_argument("--topk", type=int, default=3)
    args = parser.parse_args()

    if not os.path.exists(args.image):
        raise FileNotFoundError(f"Image not found: {args.image}")
    if not os.path.exists(args.model):
        raise FileNotFoundError(f"Model not found: {args.model}")

    labels = _read_labels(args.labels)

    interpreter = _load_interpreter(args.model)

    input_details = interpreter.get_input_details()
    if not input_details:
        raise RuntimeError("Model has no input tensors")

    input0 = input_details[0]
    input_index = int(input0["index"])
    input_shape = tuple(int(x) for x in input0["shape"])
    input_dtype = input0["dtype"]
    input_quant = input0.get("quantization", (0.0, 0))

    with Image.open(args.image) as img:
        input_tensor = _prepare_input(img, input_shape, input_dtype, input_quant)

    interpreter.set_tensor(input_index, input_tensor)
    interpreter.invoke()

    output_details = interpreter.get_output_details()
    if not output_details:
        raise RuntimeError("Model has no output tensors")

    output0 = output_details[0]
    output_index = int(output0["index"])
    output = interpreter.get_tensor(output_index)
    output = np.squeeze(output)

    output_quant = output0.get("quantization", (0.0, 0))
    out_scale, out_zero = output_quant
    if output.dtype in (np.uint8, np.int8) and out_scale and not math.isclose(out_scale, 0.0):
        output_f = (output.astype(np.float32) - float(out_zero)) * float(out_scale)
    else:
        output_f = output.astype(np.float32)

    # Try to interpret as probabilities; if not, apply softmax.
    if np.any(output_f < 0.0) or np.any(output_f > 1.0) or not np.isclose(np.sum(output_f), 1.0, atol=1e-2):
        probs = _softmax(output_f)
    else:
        probs = output_f.astype(np.float64)

    if probs.ndim != 1:
        probs = np.ravel(probs)

    topk = max(1, int(args.topk))
    top_indices = np.argsort(probs)[::-1][:topk]

    def label_for(i: int) -> str:
        if 0 <= i < len(labels):
            return labels[i]
        return str(i)

    top = [
        {"label": label_for(int(i)), "confidence": float(probs[int(i)])}
        for i in top_indices
    ]

    result = {
        "label": top[0]["label"],
        "confidence": float(top[0]["confidence"]),
        "top": top,
        "input": {
            "shape": list(input_shape),
            "dtype": str(input_dtype),
        },
    }

    print(json.dumps(result))


if __name__ == "__main__":
    main()
