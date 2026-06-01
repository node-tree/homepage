#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


def edge_touch_count(path: Path, margin: int, white_threshold: int):
    rgb = np.asarray(Image.open(path).convert("RGB"))
    fg = ~(
        (rgb[:, :, 0] >= white_threshold)
        & (rgb[:, :, 1] >= white_threshold)
        & (rgb[:, :, 2] >= white_threshold)
    )
    border = np.concatenate([
        fg[:margin, :].ravel(),
        fg[-margin:, :].ravel(),
        fg[:, :margin].ravel(),
        fg[:, -margin:].ravel(),
    ])
    return int(border.sum())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--margin", type=int, default=8)
    parser.add_argument("--white-threshold", type=int, default=248)
    args = parser.parse_args()

    source = Path(args.source)
    touching = []
    clean = []
    for path in sorted(source.rglob("*.png")):
        count = edge_touch_count(path, args.margin, args.white_threshold)
        rel = str(path.relative_to(source))
        if count:
            touching.append({"file": rel, "edgePixels": count})
        else:
            clean.append(rel)

    output = {
        "source": str(source),
        "margin": args.margin,
        "whiteThreshold": args.white_threshold,
        "total": len(touching) + len(clean),
        "touchingCount": len(touching),
        "cleanCount": len(clean),
        "touching": touching,
    }
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(output, ensure_ascii=False, indent=2))
    print(f"Checked {output['total']} frames: {output['touchingCount']} touch the {args.margin}px edge margin.")


if __name__ == "__main__":
    main()
