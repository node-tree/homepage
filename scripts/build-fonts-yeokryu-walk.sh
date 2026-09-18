#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# build-fonts-yeokryu-walk.sh — 〈역류〉 사운드 산책(/yeokryu/walk) 전용 한글 서체 서브셋
#   출력: src/components/YeokryuWalk/fonts/NotoSansKR-walk-{400,500}.woff2
#   · v5 서브셋(src/assets/fonts/redesign)은 src/redesign 글자만 담아 이 페이지 글자
#     일부(流逆까꺼납논눌됩습읍 등)가 빠져 있다. 공용 파일을 바꾸지 않고 페이지 전용으로 뽑는다.
#   · 글자 수집 대상: src/components/YeokryuWalk/*.tsx (문구를 바꾸면 이 스크립트를 다시 돌린다)
#   · Plex Mono 는 v5 파일을 그대로 쓰므로 여기서 만들지 않는다.
# 요구: pip3 install --user "fonttools[woff]" brotli · 네트워크
# 같은 파이프라인: scripts/build-fonts-redesign.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PY="${PY:-python3}"
SRC_DIR="src/components/YeokryuWalk"
OUT="$SRC_DIR/fonts"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

SRC_TTF="$TMP/NotoSansKR.ttf"
curl -sSL -A "$UA" "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf" -o "$SRC_TTF"

CHARS="$TMP/chars.txt"
"$PY" - "$SRC_TTF" "$SRC_DIR" "$CHARS" <<'PYEOF'
import pathlib, re, string, sys
from fontTools.ttLib import TTFont
TTFont(sys.argv[1])  # HTML 오류 페이지를 받았으면 여기서 죽는다
# 주석(블록·줄)은 화면에 안 나오므로 빼고 모은다 → 서브셋 크기가 절반 이하로 준다
strip = lambda s: re.sub(r'(^|\s)//[^\n]*', r'\1', re.sub(r'/\*.*?\*/', '', s, flags=re.S))
txt = ''.join(strip(p.read_text(encoding='utf-8')) for p in pathlib.Path(sys.argv[2]).glob('*.tsx'))
BASE = string.printable + '·…‘’“”〈〉「」'
chars = sorted(set(txt + BASE) - set('\r'))
pathlib.Path(sys.argv[3]).write_text(''.join(chars), encoding='utf-8')
print(f'  수집 글자 {len(chars)}자')
PYEOF

for w in 400 500; do
  "$PY" -m fontTools.varLib.instancer "$SRC_TTF" "wght=$w" -o "$TMP/NotoKR-$w.ttf" >/dev/null
  "$PY" -m fontTools.subset "$TMP/NotoKR-$w.ttf" \
    --flavor=woff2 --layout-features='*' \
    --text-file="$CHARS" \
    --output-file="$OUT/NotoSansKR-walk-$w.woff2"
  printf '  %-28s %8d B\n' "NotoSansKR-walk-$w.woff2" "$(wc -c < "$OUT/NotoSansKR-walk-$w.woff2")"
done
echo "완료 → $OUT"
