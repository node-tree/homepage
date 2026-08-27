#!/usr/bin/env python3
"""crop.py <png> <y> <h> [outWidth] — 풀페이지 스크린샷에서 y..y+h 구간을 잘라 /tmp/crop.png 로."""
import sys
from PIL import Image

src, y, h = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
w = int(sys.argv[4]) if len(sys.argv) > 4 else 0
im = Image.open(src)
box = im.crop((0, max(0, y), im.width, min(im.height, y + h)))
if w and box.width > w:
    box = box.resize((w, int(box.height * w / box.width)))
out = sys.argv[5] if len(sys.argv) > 5 else '/tmp/crop.png'
box.save(out)
print(out, box.size, 'of', im.size)
