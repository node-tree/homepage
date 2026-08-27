#!/usr/bin/env python3
"""build-fonts-redesign.sh 보조 — src/redesign 에서 실사용 글자를 모아 text-file 로 쓴다.

인자: 1) 원본 가변 TTF(유효성 확인용)  2) 출력 텍스트 파일
"""
import pathlib
import string
import sys

from fontTools.ttLib import TTFont

TTFont(sys.argv[1])  # HTML 오류 페이지를 받았으면 여기서 죽는다

root = pathlib.Path('src/redesign')
txt = ''.join(
    p.read_text(encoding='utf-8', errors='ignore')
    for p in root.rglob('*')
    if p.suffix in {'.ts', '.tsx', '.css'}
)
BASE = string.printable + '·—–‖〈〉《》「」『』…‘’“”→←↑↓±×÷°∙•▪■□※'
chars = sorted(set(txt + BASE) - set('\r'))
pathlib.Path(sys.argv[2]).write_text(''.join(chars), encoding='utf-8')
print(f'  수집 글자 {len(chars)}자')
