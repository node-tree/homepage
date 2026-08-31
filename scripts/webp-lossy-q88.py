#!/usr/bin/env python3
"""
플립북 WebP 무손실 -> 손실(q88) 재인코딩 (/iso 전송량 최적화)

배경:
  scripts/svg-base64-to-webp.js 로 만든 138개 프레임은 무손실 WebP 라 약 4MB 다.
  이 프레임들은 실제로 데스크톱 40~90px, 모바일 25~40px 로 축소돼 그려진다
  (원본 190~270px). 이 배율에서 q88 손실은 육안·수치 모두 무시 가능하다.

하는 일:
  cwebp -q 88 -alpha_q 100 -m 6 -sharp_yuv 로 재인코딩.
  알파는 무손실 유지(-alpha_q 100)라 캐릭터 외곽선이 뭉개지지 않는다.
  무손실 원본은 _workspace/09_perf/backup-webp-normalized-lossless/ 로 백업(public 밖).

  ※ 반드시 scripts/normalize-flipbook-frames.py (캔버스 정규화) 이후에 돌린다.

사용:
  python3 scripts/webp-lossy-q88.py
  python3 scripts/webp-lossy-q88.py --rmse   # 재인코딩 없이 현재 파일 vs 백업 RMSE 만 출력
"""
import os, sys, glob, shutil, subprocess, tempfile, math
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PUB = os.path.join(ROOT, 'public', 'kkumdarak')
BACKUP = os.path.join(ROOT, '_workspace', '09_perf', 'backup-webp-normalized-lossless')
Q = 88
RMSE_ONLY = '--rmse' in sys.argv


def targets():
    ds = sorted(glob.glob(os.path.join(PUB, 'chars-v2', '*')))
    ds += [os.path.join(PUB, 'nature-loops', 'fireflies-fly'),
           os.path.join(PUB, 'nature-loops', 'leaves-seeds-drift')]
    out = []
    for d in ds:
        out += sorted(glob.glob(os.path.join(d, 'frame-*.webp')))
    return out


def rmse(a, b):
    """RGBA 를 흰 배경에 합성한 뒤 RGB RMSE. 투명 픽셀 노이즈를 실제 보이는 것으로 환산."""
    bg = Image.new('RGB', a.size, (255, 255, 255))
    A = Image.alpha_composite(Image.new('RGBA', a.size, (255, 255, 255, 255)), a).convert('RGB')
    B = Image.alpha_composite(Image.new('RGBA', b.size, (255, 255, 255, 255)), b).convert('RGB')
    pa, pb = A.tobytes(), B.tobytes()
    s = sum((x - y) ** 2 for x, y in zip(pa, pb))
    return math.sqrt(s / len(pa))


def main():
    files = targets()
    before = after = 0
    worst = []
    for f in files:
        rel = os.path.relpath(f, PUB)
        bdst = os.path.join(BACKUP, rel)
        if not RMSE_ONLY:
            os.makedirs(os.path.dirname(bdst), exist_ok=True)
            if not os.path.exists(bdst):
                shutil.copy2(f, bdst)
            before += os.path.getsize(bdst)
            with tempfile.TemporaryDirectory() as td:
                png = os.path.join(td, 'p.png')
                Image.open(bdst).convert('RGBA').save(png)
                subprocess.run(['cwebp', '-quiet', '-q', str(Q), '-alpha_q', '100',
                                '-m', '6', '-sharp_yuv', png, '-o', f], check=True)
            after += os.path.getsize(f)
        else:
            before += os.path.getsize(bdst)
            after += os.path.getsize(f)
        o = Image.open(bdst).convert('RGBA')
        n = Image.open(f).convert('RGBA')
        if o.size != n.size:
            raise SystemExit('크기 불일치: %s' % rel)
        worst.append((rmse(o, n), rel))
    worst.sort(reverse=True)
    print('프레임 %d개  %.1fKB -> %.1fKB  (%.1f%% 감소)'
          % (len(files), before / 1024, after / 1024, (1 - after / before) * 100))
    print('원본 해상도 RMSE 상위 10:')
    for r, rel in worst[:10]:
        print('   %5.2f  %s' % (r, rel))
    print('   평균 %.2f / 최대 %.2f' % (sum(w[0] for w in worst) / len(worst), worst[0][0]))


if __name__ == '__main__':
    main()
