#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# build-fonts-redesign.sh — v5 리디자인(src/redesign) 서체 self-host 파이프라인
#   출력: src/assets/fonts/redesign/*.woff2  (src/redesign/fonts.css 가 참조)
#   · IBM Plex Sans 400/500 · IBM Plex Mono 400/500 → Google Fonts 의 latin 서브셋 woff2 그대로
#   · Noto Sans KR 300/400/500 → 가변 TTF 를 weight 로 고정(instancer) 후
#     **src/redesign 안에서 실제로 쓰이는 글자만** 서브셋(pyftsubset --text-file).
#     완성형 전체(11,172자)를 받으면 weight 당 1.5 MB 를 넘는다. 실사용 글자는 1천 자 미만.
#   ⚠ 국문/한자 본문을 추가했으면 이 스크립트를 다시 돌려야 새 글자가 들어간다.
#     (누락 시에도 font stack 의 시스템 한글 폰트로 폴백되어 깨지지는 않는다)
# 요구: pip3 install --user "fonttools[woff]" brotli · 네트워크
# 참고: 기존 scripts/build-fonts.sh(S-CoreDream)와 같은 파이프라인·같은 도구.
set -euo pipefail
cd "$(dirname "$0")/.."

# pyftsubset 실행 파일 대신 python 모듈로 부른다 — 홈브루 pyftsubset(3.10)에는 brotli 가 없어
#  WOFF2 인코딩이 실패한다. 같은 인터프리터($PY)로 부르면 fontTools+brotli 가 함께 잡힌다.
PYFTSUBSET_MOD="fontTools.subset"
PY="${PY:-python3}"
OUT="src/assets/fonts/redesign"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# ── 1. IBM Plex Sans / Mono — latin 서브셋만 (국문은 Noto 가 맡는다)
fetch_latin () {                     # $1=family(css) $2=weight $3=출력이름
  local css="$TMP/$3.css"
  curl -sS -A "$UA" "https://fonts.googleapis.com/css2?family=${1}:wght@${2}&display=swap" -o "$css"
  local url
  url="$($PY "scripts/_pick_latin_url.py" "$css")"
  [ -n "$url" ] || { echo "  ! latin subset URL 못 찾음: $1 $2"; exit 1; }
  curl -sS -A "$UA" "$url" -o "$OUT/$3.woff2"
  printf '  %-28s %8d B\n' "$3.woff2" "$(wc -c < "$OUT/$3.woff2")"
}
echo "── IBM Plex (latin)"
fetch_latin "IBM+Plex+Sans" 400 "PlexSans-400"
fetch_latin "IBM+Plex+Sans" 500 "PlexSans-500"
fetch_latin "IBM+Plex+Mono" 400 "PlexMono-400"
fetch_latin "IBM+Plex+Mono" 500 "PlexMono-500"

# ── 2. Noto Sans KR — 실사용 글자만
echo "── Noto Sans KR (실사용 글자 서브셋)"
SRC_TTF="$TMP/NotoSansKR.ttf"
curl -sSL -A "$UA" "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf" -o "$SRC_TTF"
CHARS="$TMP/chars.txt"
$PY "scripts/_collect_glyphs.py" "$SRC_TTF" "$CHARS"

for w in 300 400 500; do
  $PY -m fontTools.varLib.instancer "$SRC_TTF" "wght=$w" -o "$TMP/NotoKR-$w.ttf" >/dev/null
  $PY -m "$PYFTSUBSET_MOD" "$TMP/NotoKR-$w.ttf" \
    --flavor=woff2 --layout-features='*' \
    --text-file="$CHARS" \
    --output-file="$OUT/NotoSansKR-$w.woff2"
  printf '  %-28s %8d B\n' "NotoSansKR-$w.woff2" "$(wc -c < "$OUT/NotoSansKR-$w.woff2")"
done
echo "완료 → $OUT"
