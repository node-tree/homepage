#!/usr/bin/env python3
import argparse
import json
import os
import re
import subprocess
import tempfile
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


def flood_background(rgb: np.ndarray, threshold: int = 248) -> np.ndarray:
    h, w, _ = rgb.shape
    near_white = (
        (rgb[:, :, 0] >= threshold)
        & (rgb[:, :, 1] >= threshold)
        & (rgb[:, :, 2] >= threshold)
        & (np.max(rgb, axis=2) - np.min(rgb, axis=2) <= 10)
    )
    bg = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        if near_white[0, x]:
            bg[0, x] = True
            q.append((0, x))
        if near_white[h - 1, x]:
            bg[h - 1, x] = True
            q.append((h - 1, x))
    for y in range(h):
        if near_white[y, 0]:
            bg[y, 0] = True
            q.append((y, 0))
        if near_white[y, w - 1]:
            bg[y, w - 1] = True
            q.append((y, w - 1))

    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and near_white[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))
    return bg


def color_to_hex(color) -> str:
    r, g, b = [int(v) for v in color[:3]]
    return f"#{r:02x}{g:02x}{b:02x}"


def extract_paths(svg_text: str):
    return re.findall(r'<path[^>]*\sd="([^"]+)"[^>]*/?>', svg_text)


def trace_mask(mask: np.ndarray, tmp_dir: Path, name: str, turdsize: int):
    if not np.any(mask):
        return []
    # Potrace traces black pixels. PBM: 0 black foreground, 255 white background.
    bitmap = np.where(mask, 0, 255).astype(np.uint8)
    img = Image.fromarray(bitmap, mode="L").convert("1")
    pbm = tmp_dir / f"{name}.pbm"
    svg = tmp_dir / f"{name}.svg"
    img.save(pbm)
    subprocess.run(
        [
            "potrace",
            str(pbm),
            "--svg",
            "--flat",
            "--turdsize",
            str(turdsize),
            "--alphamax",
            "1.0",
            "--opttolerance",
            "0.25",
            "-o",
            str(svg),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return extract_paths(svg.read_text())


def quantize_foreground(rgb: np.ndarray, fg: np.ndarray, colors: int):
    rgba = np.zeros((*rgb.shape[:2], 4), dtype=np.uint8)
    rgba[:, :, :3] = rgb
    rgba[:, :, 3] = np.where(fg, 255, 0).astype(np.uint8)
    pil = Image.fromarray(rgba, mode="RGBA")
    palette = pil.quantize(colors=colors, method=Image.Quantize.FASTOCTREE)
    indexed = np.asarray(palette)
    pal = np.asarray(palette.getpalette(), dtype=np.uint8).reshape(-1, 3)
    used = [idx for idx in np.unique(indexed[fg]) if np.any(indexed[fg] == idx)]
    return indexed, pal, used


def vectorize_png(source: Path, target: Path, colors: int, min_area: int, turdsize: int, padding: int):
    img = Image.open(source).convert("RGB")
    rgb = np.asarray(img)
    h, w = rgb.shape[:2]
    bg = flood_background(rgb)
    fg = ~bg

    if not np.any(fg):
        target.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w + padding * 2} {h + padding * 2}"></svg>\n')
        return {"source": str(source), "target": str(target), "paths": 0, "colors": 0}

    indexed, palette, used = quantize_foreground(rgb, fg, colors)

    layers = []
    with tempfile.TemporaryDirectory() as d:
      tmp_dir = Path(d)
      for idx in used:
          mask = fg & (indexed == idx)
          if int(mask.sum()) < min_area:
              continue
          color = color_to_hex(palette[idx])
          paths = trace_mask(mask, tmp_dir, f"c_{int(idx)}", turdsize)
          if paths:
              layers.append((color, paths))

    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w + padding * 2} {h + padding * 2}" width="{w + padding * 2}" height="{h + padding * 2}" role="img">',
        f'  <g id="{source.stem}-vectorized" fill-rule="evenodd">',
    ]
    for color, paths in layers:
        parts.append(f'    <g fill="{color}" transform="translate({padding} {h + padding}) scale(0.1 -0.1)">')
        for d in paths:
            parts.append(f'      <path d="{d}"/>')
        parts.append('    </g>')
    parts.append('  </g>')
    parts.append('</svg>')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(parts) + "\n")
    return {
        "source": str(source),
        "target": str(target),
        "paths": sum(len(paths) for _, paths in layers),
        "colors": len(layers),
        "padding": padding,
    }


def vectorize_tree(source_root: Path, target_root: Path, colors: int, min_area: int, turdsize: int, padding: int):
    results = []
    for source in sorted(source_root.rglob("*.png")):
        rel = source.relative_to(source_root)
        target = target_root / rel.with_suffix(".svg")
        results.append(vectorize_png(source, target, colors, min_area, turdsize, padding))
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--target", required=True)
    parser.add_argument("--colors", type=int, default=14)
    parser.add_argument("--min-area", type=int, default=24)
    parser.add_argument("--turdsize", type=int, default=6)
    parser.add_argument("--padding", type=int, default=48)
    parser.add_argument("--manifest", default=None)
    args = parser.parse_args()

    results = vectorize_tree(Path(args.source), Path(args.target), args.colors, args.min_area, args.turdsize, args.padding)
    if args.manifest:
        Path(args.manifest).parent.mkdir(parents=True, exist_ok=True)
        Path(args.manifest).write_text(json.dumps({"count": len(results), "frames": results}, indent=2, ensure_ascii=False))
    print(f"Vectorized {len(results)} PNG frames into SVG.")


if __name__ == "__main__":
    main()
