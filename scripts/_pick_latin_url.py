#!/usr/bin/env python3
"""build-fonts-redesign.sh 보조 — css2 응답에서 /* latin */ 블록의 woff2 URL 하나만 뽑는다."""
import re
import sys

css = open(sys.argv[1], encoding='utf-8').read()
blocks = re.split(r'/\*\s*([a-z0-9-]+)\s*\*/', css)
for i in range(1, len(blocks), 2):
    if blocks[i] == 'latin':
        m = re.search(r'url\((https://[^)]+\.woff2)\)', blocks[i + 1])
        if m:
            print(m.group(1))
            break
