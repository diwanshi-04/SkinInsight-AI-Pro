"""Train a 4-class skin disease classifier and export TFLite.

Dataset: MamData800 (healthy / lupus / ringworm / scalp_infections).

Strategy:
  - EfficientNetB0 backbone
  - Augmentation + class weights
  - 3-phase progressive fine-tuning

Examples:
  python ml/train.py --augment --epochs 20

Outputs:
  ml/model.tflite
  ml/labels.txt
"""

import argparse
from pathlib import Path
from typing import List, Tuple


def _write_labels(labels_path: Path, class_names: List[str]) -> None:
    labels_path.parent.mkdir(parents=True, exist_ok=True)
    labels_path.write_text("\n".join(class_names) + "\n", encoding="utf-8")


def _resolve_path(p: str) -> Path:
    return Path(p).expanduser().resolve()


def _load_datasets(
    data_dir: Path,
    image_size: Tuple[int, int],
    batch_size: int,
    seed: int,
    val_split: float,
    augment: bool,
):
    import tensorflow as tf  # type: ignore

    if not data_dir.exists():
        raise FileNotFoundError(f"Dataset folder not found: {data_dir}")

    train_ds = tf.keras.utils.image_dataset_from_directory(
        str(data_dir),
        labels="inferred",
        label_mode="int",
        batch_size=batch_size,
        image_size=image_size,
        shuffle=True,
        seed=seed,
        validation_split=val_split,
        subset="training",
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        str(data_dir),
        labels="inferred",
        label_mode="int",
        batch_size=batch_size,
        image_size=image_size,
        shuffle=True,
        seed=seed,
        validation_split=val_split,
        subset="validation",
    )

    class_names = list(train_ds.class_names)

    AUTOTUNE = tf.data.AUTOTUNE

    def to_float_0_1(images, labels):
        images = tf.cast(images, tf.float32) / 255.0
        return images, labels

    train_ds = train_ds.map(to_float_0_1, num_parallel_calls=AUTOTUNE)

    if augment:
        augmenter = tf.keras.Sequential([
            tf.keras.layers.RandomFlip("horizontal"),
            tf.keras.layers.RandomRotation(0.05),
            tf.keras.layers.RandomZoom((-0.1, 0.1)),
            tf.keras.layers.RandomTranslation(0.05, 0.05),
        ], name="augmenter")

        def aug(images, labels):
            images = augmenter(images, training=True)
            images = tf.image.random_brightness(images, max_delta=0.1)
            images = tf.image.random_contrast(images, lower=0.9, upper=1.1)
            images = tf.clip_by_value(images, 0.0, 1.0)
            return images, labels

        train_ds = train_ds.map(aug, num_parallel_calls=AUTOTUNE)

    train_ds = train_ds.prefetch(AUTOTUNE)
    val_ds = val_ds.map(to_float_0_1, num_parallel_calls=AUTOTUNE).prefetch(AUTOTUNE)

    return train_ds, val_ds, class_names


def _build_model(image_size: int, num_classes: int, seed: int, base_weights: str):
    import tensorflow as tf  # type: ignore

    tf.keras.utils.set_random_seed(seed)

    inputs = tf.keras.Input(shape=(image_size, image_size, 3), dtype=tf.float32)

    # Inference sends [0, 1] floats. EfficientNetB0 expects [0, 255].
    x = tf.keras.layers.Rescaling(255.0, name="rescale_to_255")(inputs)

    weights_arg = None if base_weights == "none" else base_weights
    base = tf.keras.applications.EfficientNetB0(
        include_top=False,
        weights=weights_arg,
        input_shape=(image_size, image_size, 3),
    )
    base.trainable = False

    x = base(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dropout(0.4)(x)
    x = tf.keras.layers.Dense(
        128,
        activation="relu",
        kernel_regularizer=tf.keras.regularizers.l2(1e-4),
    )(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax")(x)

    return tf.keras.Model(inputs, outputs), base


def _export_tflite(model, tflite_path: Path, quantize_dynamic: bool) -> None:
    import tensorflow as tf  # type: ignore

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    if quantize_dynamic:
        converter.optimizations = [tf.lite.Optimize.DEFAULT]

    tflite_model = converter.convert()
    tflite_path.parent.mkdir(parents=True, exist_ok=True)
    tflite_path.write_bytes(tflite_model)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train skin disease classifier and export TFLite")

    parser.add_argument(
        "--data_dir",
        default=str(Path(__file__).resolve().parents[1] / "Skin-Disease-Detection-Team-Technophile-main" / "MamData800"),
    )
    parser.add_argument("--image_size", type=int, default=224)
    parser.add_argument("--batch_size", type=int, default=32)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--val_split", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--augment", action="store_true")
    parser.add_argument(
        "--output_model",
        default=str(Path(__file__).resolve().parent / "model.tflite"),
    )
    parser.add_argument(
        "--output_labels",
        default=str(Path(__file__).resolve().parent / "labels.txt"),
    )
    parser.add_argument("--quantize_dynamic", action="store_true")
    parser.add_argument(
        "--base_weights",
        default="imagenet",
        choices=["imagenet", "none"],
    )

    args = parser.parse_args()

    data_dir = _resolve_path(args.data_dir)
    out_model = _resolve_path(args.output_model)
    out_labels = _resolve_path(args.output_labels)

    import tensorflow as tf  # type: ignore
    import numpy as np

    train_ds, val_ds, class_names = _load_datasets(
        data_dir=data_dir,
        image_size=(int(args.image_size), int(args.image_size)),
        batch_size=int(args.batch_size),
        seed=int(args.seed),
        val_split=float(args.val_split),
        augment=bool(args.augment),
    )

    _write_labels(out_labels, class_names)
    num_classes = len(class_names)

    # Compute class weights
    class_counts: dict[int, int] = {}
    for _, labels in train_ds.unbatch():
        lbl = int(labels.numpy())
        class_counts[lbl] = class_counts.get(lbl, 0) + 1
    total = sum(class_counts.values())
    class_weight = {
        cls: total / (num_classes * count) for cls, count in class_counts.items()
    }
    print(f"Classes: {class_names}")
    print(f"Class counts: {class_counts}")
    print(f"Class weights: {class_weight}")

    epochs = int(args.epochs)

    # Phase 1: Head only
    print("\n=== Phase 1: Training head (base frozen) ===")
    model, base = _build_model(
        int(args.image_size), num_classes, int(args.seed), str(args.base_weights),
    )
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(),
        metrics=["accuracy"],
    )
    model.fit(
        train_ds, validation_data=val_ds,
        epochs=min(epochs, 10),
        class_weight=class_weight,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=4, restore_best_weights=True),
            tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=1e-5),
        ],
    )

    # Track global best across all phases
    p1_loss, p1_acc = model.evaluate(val_ds)
    global_best_loss = p1_loss
    best_weights = model.get_weights()
    print(f"Phase 1 result: val_loss={p1_loss:.4f}, val_acc={p1_acc*100:.1f}%")

    # Phase 2: Fine-tune top layers
    print("\n=== Phase 2: Fine-tuning (layers 150+) ===")
    base.trainable = True
    for layer in base.layers[:150]:
        layer.trainable = False
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=3e-5),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(),
        metrics=["accuracy"],
    )
    model.fit(
        train_ds, validation_data=val_ds,
        epochs=epochs,
        class_weight=class_weight,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=6, restore_best_weights=True),
            tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, min_lr=1e-7),
        ],
    )

    p2_loss, p2_acc = model.evaluate(val_ds)
    if p2_loss < global_best_loss:
        global_best_loss = p2_loss
        best_weights = model.get_weights()
        print(f"Phase 2 improved: val_loss={p2_loss:.4f}, val_acc={p2_acc*100:.1f}%")
    else:
        model.set_weights(best_weights)
        print(f"Phase 2 did NOT improve ({p2_loss:.4f} vs {global_best_loss:.4f}). Restoring best.")

    # Phase 3: Deep fine-tune
    print("\n=== Phase 3: Deep fine-tuning (layers 100+) ===")
    for layer in base.layers[100:150]:
        layer.trainable = True
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=5e-6),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(),
        metrics=["accuracy"],
    )
    model.fit(
        train_ds, validation_data=val_ds,
        epochs=epochs,
        class_weight=class_weight,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True),
            tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=1e-8),
        ],
    )

    p3_loss, p3_acc = model.evaluate(val_ds)
    if p3_loss < global_best_loss:
        global_best_loss = p3_loss
        best_weights = model.get_weights()
        print(f"Phase 3 improved: val_loss={p3_loss:.4f}, val_acc={p3_acc*100:.1f}%")
    else:
        model.set_weights(best_weights)
        print(f"Phase 3 did NOT improve ({p3_loss:.4f} vs {global_best_loss:.4f}). Restoring best.")

    # Final eval (model already has global best weights)
    print(f"\n=== Final Evaluation (global best val_loss={global_best_loss:.4f}) ===")
    val_loss, val_acc = model.evaluate(val_ds)
    print(f"Validation accuracy: {val_acc*100:.1f}%")

    _export_tflite(model, out_model, bool(args.quantize_dynamic))

    print(f"\nOK")
    print(f"labels: {out_labels}")
    print(f"tflite:  {out_model}")


if __name__ == "__main__":
    main()
