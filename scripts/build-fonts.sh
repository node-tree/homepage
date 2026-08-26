#!/usr/bin/env bash
# S-CoreDream OTF → WOFF2 서브셋 재생성
#   입력: src/assets/fonts/SCDream{3,4,5,6}.otf  (서브셋 원본, 런타임 미사용)
#   출력: public/fonts/SCDream{3,4,5,6}.woff2    (src/index.css @font-face 가 참조)
# 요구: pip3 install --user "fonttools[woff]" brotli
set -euo pipefail
cd "$(dirname "$0")/.."

PYFTSUBSET="${PYFTSUBSET:-$HOME/Library/Python/3.14/bin/pyftsubset}"
command -v "$PYFTSUBSET" >/dev/null 2>&1 || PYFTSUBSET="pyftsubset"

# KS 한글 완성형 + 한글 자모 + 라틴1 + 문장부호 + 통화 + 화살표/수학/도형/딩벳 + CJK 기호 + 카나 + 전각
RANGES="U+0000-00FF,U+1100-11FF,U+2000-206F,U+2070-209F,U+20A0-20CF,U+2100-2BFF,U+3000-303F,U+3040-30FF,U+3131-318E,U+3200-33FF,U+AC00-D7A3,U+FF00-FFEF"

mkdir -p public/fonts
for n in 3 4 5 6; do
  "$PYFTSUBSET" "src/assets/fonts/SCDream${n}.otf" \
    --flavor=woff2 \
    --layout-features='*' \
    --unicodes="$RANGES" \
    --output-file="public/fonts/SCDream${n}.woff2"
  printf '  SCDream%s.otf %8d B  ->  SCDream%s.woff2 %8d B\n' \
    "$n" "$(wc -c < "src/assets/fonts/SCDream${n}.otf")" \
    "$n" "$(wc -c < "public/fonts/SCDream${n}.woff2")"
done
