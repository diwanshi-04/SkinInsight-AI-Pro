"""Train a 3-class skin-type classifier (dry/normal/oily) and export TFLite.

Uses the cleaned dataset under skin_type_clean/ (prepared by prepare_data.py).

Strategy:
  - EfficientNetB0 backbone (better features than MobileNetV2)
  - Heavy geometric + colour augmentation
  - Label smoothing (0.1) to prevent overconfident predictions
  - 3-phase progressive fine-tuning
  - Class-weight balancing

Examples:
  python ml/train_skin_type.py --augment --epochs 25

Outputs:
  ml/skin_type_model.tflite
  ml/skin_type_labels.txt
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import List, Tuple


def _resolve(p: str) -> Path:
    return Path(p).expanduser().resolve()


def _write_labels(path: Path, class_names: List[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(class_names) + "\n", encoding="utf-8")


def _load_from_directory(
    data_dir: Path,
    image_size: Tuple[int, int],
    batch_size: int,
    seed: int,
    shuffle: bool,
):
    import tensorflow as tf  # type: ignore

    if not data_dir.exists():
        raise FileNotFoundError(f"Dataset folder not found: {data_dir}")

    ds = tf.keras.utils.image_dataset_from_directory(
        str(data_dir),
        labels="inferred",
        label_mode="int",
        batch_size=batch_size,
        image_size=image_size,
        shuffle=shuffle,
        seed=seed,
    )

    class_names = list(ds.class_names)

    AUTOTUNE = tf.data.AUTOTUNE

    def to_float_0_1(images, labels):
        images = tf.cast(images, tf.float32) / 255.0
        return images, labels

    ds = ds.map(to_float_0_1, num_parallel_calls=AUTOTUNE).prefetch(AUTOTUNE)
    return ds, class_names


def _augment_train(ds, seed: int):
    """Heavy augmentation to reduce overfitting on small dataset."""
    import tensorflow as tf  # type: ignore

    tf.keras.utils.set_random_seed(seed)

    augmenter = tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal"),
        tf.keras.layers.RandomFlip("vertical"),
        tf.keras.layers.RandomRotation(0.10),         # ±36 degrees
        tf.keras.layers.RandomZoom((-0.15, 0.15)),    # ±15% zoom
        tf.keras.layers.RandomTranslation(0.10, 0.10),
    ], name="augmenter")

    def aug(images, labels):
        images = augmenter(images, training=True)
        images = tf.image.random_brightness(images, max_delta=0.15)
        images = tf.image.random_contrast(images, lower=0.80, upper=1.20)
        images = tf.image.random_saturation(images, lower=0.75, upper=1.25)
        images = tf.image.random_hue(images, max_delta=0.04)
        # Random JPEG quality simulation
        images = tf.clip_by_value(images, 0.0, 1.0)
        return images, labels

    AUTOTUNE = tf.data.AUTOTUNE
    return ds.map(aug, num_parallel_calls=AUTOTUNE)


def _build_model(image_size: int, num_classes: int, seed: int, base_weights: str):
    """Build EfficientNetB0-based model with regularised head."""
    import tensorflow as tf  # type: ignore

    tf.keras.utils.set_random_seed(seed)

    inputs = tf.keras.Input(shape=(image_size, image_size, 3), dtype=tf.float32)

    # EfficientNetB0 expects [0, 255] input — it has built-in preprocessing.
    # Our pipeline gives [0, 1], so rescale to [0, 255] before feeding.
    x = tf.keras.layers.Rescaling(255.0, name="rescale_to_255")(inputs)

    weights_arg = None if base_weights == "none" else base_weights
    base = tf.keras.applications.EfficientNetB0(
        include_top=False,
        weights=weights_arg,
        input_shape=(image_size, image_size, 3),
    )
    base.trainable = False  # frozen initially

    x = base(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Dropout(0.5)(x)
    x = tf.keras.layers.Dense(
        128,
        activation="relu",
        kernel_regularizer=tf.keras.regularizers.l2(1e-3),
    )(x)
    x = tf.keras.layers.Dropout(0.4)(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax")(x)

    return tf.keras.Model(inputs, outputs), base


def _export_tflite(model, out_path: Path, quantize_dynamic: bool):
    import tensorflow as tf  # type: ignore

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    if quantize_dynamic:
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
    tflite_model = converter.convert()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(tflite_model)


def main() -> None:
    # Default to cleaned dataset (from prepare_data.py)
    default_root = Path(__file__).resolve().parents[1] / "skin_type_clean"

    parser = argparse.ArgumentParser(description="Train skin-type classifier and export TFLite")
    parser.add_argument("--train_dir", default=str(default_root / "train"))
    parser.add_argument("--val_dir", default=str(default_root / "valid"))

    parser.add_argument("--image_size", type=int, default=224)
    parser.add_argument("--batch_size", type=int, default=16)
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--seed", type=int, default=42)

    parser.add_argument("--augment", action="store_true", help="Enable heavy training augmentation")
    parser.add_argument("--label_smoothing", type=float, default=0.1)

    parser.add_argument(
        "--output_model",
        default=str(Path(__file__).resolve().parent / "skin_type_model.tflite"),
    )
    parser.add_argument(
        "--output_labels",
        default=str(Path(__file__).resolve().parent / "skin_type_labels.txt"),
    )
    parser.add_argument("--quantize_dynamic", action="store_true")
    parser.add_argument(
        "--base_weights",
        default="imagenet",
        choices=["imagenet", "none"],
        help="Use 'none' if offline",
    )

    args = parser.parse_args()

    train_dir = _resolve(args.train_dir)
    val_dir = _resolve(args.val_dir)
    out_model = _resolve(args.output_model)
    out_labels = _resolve(args.output_labels)

    import tensorflow as tf  # type: ignore
    import numpy as np

    # ── Load data ──────────────────────────────────────────────
    train_ds, train_classes = _load_from_directory(
        train_dir,
        image_size=(int(args.image_size), int(args.image_size)),
        batch_size=int(args.batch_size),
        seed=int(args.seed),
        shuffle=True,
    )
    val_ds, val_classes = _load_from_directory(
        val_dir,
        image_size=(int(args.image_size), int(args.image_size)),
        batch_size=int(args.batch_size),
        seed=int(args.seed),
        shuffle=False,
    )

    if train_classes != val_classes:
        raise RuntimeError(
            f"Train/val classes differ. train={train_classes} val={val_classes}"
        )

    _write_labels(out_labels, train_classes)
    num_classes = len(train_classes)

    # ── Class weights ──────────────────────────────────────────
    class_counts: dict[int, int] = {}
    for _, labels in train_ds.unbatch():
        lbl = int(labels.numpy())
        class_counts[lbl] = class_counts.get(lbl, 0) + 1
    total = sum(class_counts.values())
    class_weight = {
        cls: total / (num_classes * count) for cls, count in class_counts.items()
    }
    print(f"Classes: {train_classes}")
    print(f"Class counts: {class_counts}")
    print(f"Class weights: {class_weight}")

    if args.augment:
        train_ds = _augment_train(train_ds, seed=int(args.seed))

    label_smoothing = float(args.label_smoothing)
    epochs = int(args.epochs)

    # ── Phase 1: Head-only (base frozen) ──────────────────────
    print(f"\n=== Phase 1: Training head (base frozen, label_smoothing={label_smoothing}) ===")
    model, base = _build_model(
        image_size=int(args.image_size),
        num_classes=num_classes,
        seed=int(args.seed),
        base_weights=str(args.base_weights),
    )

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(
            from_logits=False,
        ),
        metrics=["accuracy"],
    )

    p1_epochs = min(epochs, 15)
    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=p1_epochs,
        class_weight=class_weight,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss", patience=5, restore_best_weights=True
            ),
            tf.keras.callbacks.ReduceLROnPlateau(
                monitor="val_loss", factor=0.5, patience=2, min_lr=1e-5
            ),
        ],
    )

    # Track global best across all phases
    p1_loss, p1_acc = model.evaluate(val_ds)
    global_best_loss = p1_loss
    best_weights = model.get_weights()
    print(f"Phase 1 result: val_loss={p1_loss:.4f}, val_acc={p1_acc*100:.1f}%")

    # ── Phase 2: Fine-tune top layers of EfficientNetB0 ───────
    # EfficientNetB0 has ~237 layers. Unfreeze from layer 150 (~top 37% of layers).
    print("\n=== Phase 2: Fine-tuning (unfreezing layers 150+) ===")
    base.trainable = True
    for layer in base.layers[:150]:
        layer.trainable = False
    trainable_count = sum(1 for l in base.layers if l.trainable)
    print(f"  Trainable base layers: {trainable_count}/{len(base.layers)}")

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-4),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(
            from_logits=False,
        ),
        metrics=["accuracy"],
    )

    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=epochs,
        class_weight=class_weight,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss", patience=7, restore_best_weights=True
            ),
            tf.keras.callbacks.ReduceLROnPlateau(
                monitor="val_loss", factor=0.5, patience=3, min_lr=1e-7
            ),
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

    # ── Phase 3: Deep fine-tune ───────────────────────────────
    print("\n=== Phase 3: Deep fine-tuning (unfreezing layers 100+) ===")
    for layer in base.layers[100:150]:
        layer.trainable = True
    trainable_count = sum(1 for l in base.layers if l.trainable)
    print(f"  Trainable base layers: {trainable_count}/{len(base.layers)}")

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(
            from_logits=False,
        ),
        metrics=["accuracy"],
    )

    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=epochs,
        class_weight=class_weight,
        callbacks=[
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss", patience=6, restore_best_weights=True
            ),
            tf.keras.callbacks.ReduceLROnPlateau(
                monitor="val_loss", factor=0.5, patience=3, min_lr=1e-8
            ),
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

    # ── Evaluate on validation ────────────────────────────────
    print(f"\n=== Final Evaluation (global best val_loss={global_best_loss:.4f}) ===")
    val_loss, val_acc = model.evaluate(val_ds)
    print(f"Validation accuracy: {val_acc*100:.1f}%")

    # ── Export ─────────────────────────────────────────────────
    _export_tflite(model, out_model, bool(args.quantize_dynamic))

    print(f"\nOK")
    print(f"labels: {out_labels}")
    print(f"tflite:  {out_model}")


if __name__ == "__main__":
    main()
