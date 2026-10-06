#!/usr/bin/env python3
"""Read PDFs only; generate reproducible WebP previews inside this worktree.
Requires Poppler (pdftoppm) and Pillow. Run: python3 scripts/render-pdf-pages.py
"""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LONG_EDGE = 1600
QUALITY = 88

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def render(item):
    source = ROOT / 'public' / item['pdfUrl'].lstrip('/')
    original = digest(source)
    target = ROOT / 'public/pdf-pages' / item['id']
    target.mkdir(parents=True, exist_ok=True)
    scratch = ROOT / '_comp/pdf-render-tmp'
    scratch.mkdir(exist_ok=True)
    pages = []
    with tempfile.TemporaryDirectory(dir=scratch) as tmp:
        subprocess.run(['pdftoppm', '-scale-to', str(LONG_EDGE), '-png', str(source), str(Path(tmp) / 'page')], check=True, capture_output=True)
        for i, png in enumerate(sorted(Path(tmp).glob('page-*.png')), 1):
            name = f'p{i:03}.webp'
            with Image.open(png) as image:
                image = image.convert('RGB')
                image.save(target / name, 'WEBP', quality=QUALITY, method=6)
                pages.append({'src': f'/pdf-pages/{item["id"]}/{name}', 'width': image.width, 'height': image.height, 'bytes': (target / name).stat().st_size})
                if i == 1:
                    image.thumbnail((360, 360))
                    image.save(target / 'cover.webp', 'WEBP', quality=QUALITY, method=6)
    assert pages, 'No rendered pages'
    assert digest(source) == original, 'Source PDF changed during rendering'
    manifest = {'version': 1, 'sourceSha256': original, 'sourceBytes': source.stat().st_size, 'pageCount': len(pages), 'longEdge': LONG_EDGE, 'quality': QUALITY, 'previewBytes': sum(p['bytes'] for p in pages), 'cover': f'/pdf-pages/{item["id"]}/cover.webp', 'pages': pages}
    (target / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'{item["id"]}: {len(pages)} pages, {manifest["previewBytes"]:,} bytes; original hash verified', flush=True)

if __name__ == '__main__':
    items = json.loads((ROOT / 'src/redesign/pdfAttachments.json').read_text())
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(render, items))
    (ROOT / '_comp/pdf-render-tmp').rmdir()
