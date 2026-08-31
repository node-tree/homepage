#!/usr/bin/env python3
"""
플립북 프레임 캔버스 정규화 (/iso 캐릭터 깜박임 수정)

배경(실측):
  public/kkumdarak/chars-v2/character-*/frame-0*.webp 와
  nature-loops/{fireflies-fly,leaves-seeds-drift} 의 6프레임은
  프레임마다 캔버스 크기가 다르다 (예: character-13 은 188~230px).
  원인은 원본 SVG 단계의 "내용 bbox + 20px 여백" 타이트 크롭이다.
  렌더는 `.kd-loop-frame { object-fit: contain }` 이므로
  넓은 프레임일수록 축소율이 커져(최대 -17%) 한 프레임만 작아졌다 커진다
  = 한 프레임이 빠진 듯한 움찔거림.

하는 일:
  폴더별 최대 폭 x 최대 높이 캔버스로 6프레임을 통일한다(투명 패딩).
  스케일이 프레임 전체에서 동일해지므로 깜박임이 사라진다.

배치 규칙(원본 크롭 규칙의 역산):
  크롭 여백은 사방 20px 이 기본이고, 원본 아트보드 경계에 닿은 쪽만 20 미만으로 잘렸다.
  따라서 축마다 프레임별로
    - 양쪽 여백 < CLAMP  -> 그 프레임이 아트보드 전체 = offset 0
    - 앞쪽만 < CLAMP     -> 앞쪽(위/왼쪽) 정렬
    - 뒤쪽만 < CLAMP     -> 뒤쪽(아래/오른쪽) 정렬
    - 둘 다 >= CLAMP     -> 절대 위치 복원 불가 = 중앙 정렬
                            (현재 object-fit:contain 렌더도 중앙이므로 시각 위치 불변)
  가로는 실측상 전 프레임 여백이 20/20 이라 항상 중앙 정렬이 된다.

인코딩:
  cwebp -lossless -z 9 (기존 scripts/svg-base64-to-webp.js 와 동일 무손실 경로).
  변환 후 디코드해 패딩본과 RGBA 픽셀 동일성을 검증한다.

원본은 _workspace/09_perf/backup-webp-original/ 로 백업한다(public 밖 = 배포 산출물 불변).

사용:
  python3 scripts/normalize-flipbook-frames.py            # 실행
  python3 scripts/normalize-flipbook-frames.py --dry-run  # 계획만 출력
"""
import os, sys, glob, shutil, subprocess, tempfile
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PUB = os.path.join(ROOT, 'public', 'kkumdarak')
BACKUP = os.path.join(ROOT, '_workspace', '09_perf', 'backup-webp-original')
CLAMP = 18          # 여백이 이 값 미만이면 "아트보드 경계에 닿아 잘린 쪽"으로 본다(안티에일리어싱 ±1 흡수)
DRY = '--dry-run' in sys.argv


def target_dirs():
    ds = sorted(glob.glob(os.path.join(PUB, 'chars-v2', '*')))
    ds += [os.path.join(PUB, 'nature-loops', 'fireflies-fly'),
           os.path.join(PUB, 'nature-loops', 'leaves-seeds-drift')]
    return [d for d in ds if os.path.isdir(d) and glob.glob(os.path.join(d, 'frame-*.webp'))]


def place(size, canvas, m0, m1):
    """축 하나의 배치 오프셋. size=프레임 길이, canvas=목표 길이, m0/m1=앞/뒤 여백."""
    if size >= canvas:
        return 0
    front, back = m0 < CLAMP, m1 < CLAMP
    if front and back:
        return 0                      # 아트보드 전체를 담은 프레임(이론상 size==canvas)
    if front:
        return 0                      # 앞쪽 경계 정렬
    if back:
        return canvas - size          # 뒤쪽 경계 정렬
    return (canvas - size) // 2       # 절대위치 미상 -> 중앙


def encode_lossless(img, dst):
    with tempfile.TemporaryDirectory() as td:
        png = os.path.join(td, 'p.png')
        img.save(png)
        subprocess.run(['cwebp', '-quiet', '-lossless', '-z', '9', '-exact', png, '-o', dst], check=True)
        # 검증: 디코드 결과가 패딩본과 픽셀 동일해야 한다
        back = os.path.join(td, 'b.png')
        subprocess.run(['dwebp', '-quiet', dst, '-o', back], check=True)
        a = Image.open(png).convert('RGBA').tobytes()
        b = Image.open(back).convert('RGBA').tobytes()
        if a != b:
            raise SystemExit('무손실 검증 실패: %s' % dst)


def main():
    changed = tot_before = tot_after = 0
    for d in target_dirs():
        rel = os.path.relpath(d, PUB)
        fs = sorted(glob.glob(os.path.join(d, 'frame-*.webp')))
        info = []
        for f in fs:
            im = Image.open(f).convert('RGBA')
            w, h = im.size
            bb = im.getchannel('A').getbbox() or (0, 0, w, h)
            info.append((f, im, w, h, bb))
        W = max(i[2] for i in info)
        H = max(i[3] for i in info)
        if all(i[2] == W and i[3] == H for i in info):
            print('  skip (이미 균일) %s %dx%d' % (rel, W, H))
            continue
        print('  %-34s -> %dx%d' % (rel, W, H))
        for f, im, w, h, bb in info:
            dx = place(w, W, bb[0], w - bb[2])
            dy = place(h, H, bb[1], h - bb[3])
            print('     %s %3dx%3d  offset(%3d,%3d)' % (os.path.basename(f), w, h, dx, dy))
            if DRY:
                continue
            bdst = os.path.join(BACKUP, rel, os.path.basename(f))
            os.makedirs(os.path.dirname(bdst), exist_ok=True)
            if not os.path.exists(bdst):
                shutil.copy2(f, bdst)
            canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            canvas.paste(im, (dx, dy))
            tot_before += os.path.getsize(f)
            encode_lossless(canvas, f)
            tot_after += os.path.getsize(f)
            changed += 1
    print('\n프레임 %d개 정규화. %.1fKB -> %.1fKB' % (changed, tot_before / 1024, tot_after / 1024))


if __name__ == '__main__':
    main()
