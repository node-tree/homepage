#!/usr/bin/env python3
"""
플립북 프레임 축소 변형(-sm) 생성 + 치수 매니페스트 출력 (/iso srcset)

배경(실측 — 팀 전제와 다른 부분 포함):
  프레임 소스는 176~236px 인데 실제 표시 박스는
    데스크톱 46~160px, 모바일 30~58px 이다.
  다만 과대 배율은 devicePixelRatio 를 넣어야 제대로 나온다.
    · 데스크톱 DPR1 : 2.4~4.2배 과대  <- 여기가 진짜 낭비
    · 모바일  DPR2 : 1.6~2.6배 과대
    · 모바일  DPR3 : 1.3~2.1배 과대  (일부는 오히려 소스가 부족)
  즉 "소스를 그냥 줄이면" 레티나에서 뭉개진다. DPR 별로 알아서 고르게 하는
  srcset(w 서술자) + 정확한 sizes 가 유일하게 옳은 방법이다.

하는 일:
  1. 무손실 정규화 백업(_workspace/09_perf/backup-webp-normalized-lossless)에서
     0.5배로 Lanczos 리샘플 -> q88 WebP 를 `frame-0N-sm.webp` 로 저장.
  2. 폴더별 원본/축소 치수 + **지배 캔버스**를 src/components/Kkumdarak/flipbookVariants.ts 로 출력.
     컴포넌트는 이 매니페스트에 있는 폴더에만 srcSet 을 붙인다(없으면 기존 동작 그대로).

  ── 지배 캔버스(domW/domH)가 왜 필요한가 ────────────────────────────
  캔버스를 "최대"로 통일하면 깜박임은 사라지지만, object-fit:contain 의 배율이
  min(box/최대캔버스) 로 굳어 캐릭터가 정규화 전보다 1.9~17.8% **작아진다**.
  정규화 전 6프레임 중 다수가 쓰던 크기(= 축별 중앙값 캔버스)가 원래 체감 크기다.
  그래서 프레임 박스를 fx=W/domW, fy=H/domH 만큼 키워
  min(box*fx/W, box*fy/H) = min(box/domW, box/domH) 로 되돌린다.
  이 값은 박스 크기와 무관하므로 히어로 좌표(CharSpot)를 손대지 않아도 된다.
  (원본 캔버스 = 내용 bbox + 사방 20px 이라, 캔버스 중앙 = 내용 중앙 -> 위치도 보존된다.)

  ※ scripts/normalize-flipbook-frames.py -> scripts/webp-lossy-q88.py 다음에 돌린다.

사용: python3 scripts/build-flipbook-variants.py
"""
import os, glob, json, subprocess, tempfile
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PUB = os.path.join(ROOT, 'public', 'kkumdarak')
SRC = os.path.join(ROOT, '_workspace', '09_perf', 'backup-webp-normalized-lossless')
ORIG = os.path.join(ROOT, '_workspace', '09_perf', 'backup-webp-original')  # 정규화 이전 원본
TS = os.path.join(ROOT, 'src', 'components', 'Kkumdarak', 'flipbookVariants.ts')
SCALE = 0.5
Q = 88


def folders():
    ds = sorted(glob.glob(os.path.join(PUB, 'chars-v2', '*')))
    ds += [os.path.join(PUB, 'nature-loops', 'fireflies-fly'),
           os.path.join(PUB, 'nature-loops', 'leaves-seeds-drift')]
    return [d for d in ds if os.path.isdir(d) and glob.glob(os.path.join(d, 'frame-0?.webp'))]


def main():
    manifest = {}
    tot = 0
    for d in folders():
        rel = os.path.relpath(d, PUB).replace(os.sep, '/')
        frames = sorted(glob.glob(os.path.join(d, 'frame-0?.webp')))
        sizes = set()
        allw, allh = [], []
        for f in frames:
            base = os.path.basename(f)
            lossless = os.path.join(SRC, rel, base)
            if not os.path.exists(lossless):
                raise SystemExit('무손실 정규화 백업이 없다: %s' % os.path.join(rel, base))
            im = Image.open(lossless).convert('RGBA')
            w, h = im.size
            sizes.add((w, h))
            ow, oh = Image.open(os.path.join(ORIG, rel, base)).size   # 정규화 이전 캔버스
            allw.append(ow); allh.append(oh)
            sw, sh = max(1, round(w * SCALE)), max(1, round(h * SCALE))
            out = f[:-5] + '-sm.webp'
            with tempfile.TemporaryDirectory() as td:
                png = os.path.join(td, 'p.png')
                im.resize((sw, sh), Image.LANCZOS).save(png)
                subprocess.run(['cwebp', '-quiet', '-q', str(Q), '-alpha_q', '100',
                                '-m', '6', '-sharp_yuv', png, '-o', out], check=True)
            tot += os.path.getsize(out)
        if len(sizes) != 1:
            raise SystemExit('%s 의 프레임 치수가 균일하지 않다(정규화 먼저): %s' % (rel, sizes))
        w, h = sizes.pop()
        allw.sort(); allh.sort()
        n = len(allw)
        domW = (allw[(n - 1) // 2] + allw[n // 2]) / 2      # 축별 중앙값 = 지배 캔버스
        domH = (allh[(n - 1) // 2] + allh[n // 2]) / 2
        manifest[rel] = {
            'w': w, 'h': h,
            'smW': max(1, round(w * SCALE)), 'smH': max(1, round(h * SCALE)),
            'fx': round(w / domW, 5), 'fy': round(h / domH, 5),
        }

    body = json.dumps(manifest, indent=2, ensure_ascii=False, sort_keys=True)
    with open(TS, 'w') as fp:
        fp.write('''/* 자동 생성 — scripts/build-flipbook-variants.py 가 씁니다. 손으로 고치지 마세요. */
import type React from 'react';

/**
 * 플립북 프레임 치수 매니페스트 (/iso srcset)
 *
 * 프레임은 폴더별로 한 가지 캔버스 크기로 정규화돼 있고(깜박임 수정),
 * 같은 폴더에 0.5배 축소본 `frame-0N-sm.webp` 가 함께 있다.
 * 컴포넌트는 이 표의 폭으로 `srcSet`(w 서술자)을 만들고,
 * 표시 박스 폭을 `sizes` 로 정확히 알려 준다 -> 브라우저가 DPR 에 맞게 고른다.
 *
 * 여기 없는 폴더(예: 축소본을 만들지 않은 루프)는 srcSet 없이 기존대로 원본만 쓴다.
 *
 * fx/fy = 표시 크기 복원 계수.
 *   캔버스를 최대치로 통일하면 object-fit:contain 배율이 min(box/최대캔버스)로 굳어
 *   캐릭터가 정규화 전보다 작아진다. 프레임 박스를 fx/fy 만큼 키우면
 *   min(box*fx/W, box*fy/H) = min(box/지배캔버스) 가 되어 원래 체감 크기로 돌아온다.
 *   박스 크기와 무관한 값이라 히어로 좌표를 건드리지 않는다.
 */
export type FlipbookVariant = { w: number; h: number; smW: number; smH: number; fx: number; fy: number };

export const FLIPBOOK_VARIANTS: Record<string, FlipbookVariant> = ''' + body + ''';

/**
 * 프레임 컨테이너에 얹을 복원 계수 CSS 변수.
 * kkumdarak.css 의 `.kd-loop-frame` 이 --kd-fx/--kd-fy 로 자기 박스를 키운다(기본값 1 = 무보정).
 */
export function flipbookFit(key: string): React.CSSProperties | undefined {
  const v = FLIPBOOK_VARIANTS[key];
  if (!v) return undefined;
  return { '--kd-fx': String(v.fx), '--kd-fy': String(v.fy) } as React.CSSProperties;
}

/** `/kkumdarak/<key>/frame-0N.webp` 의 srcSet 문자열. 변형이 없으면 undefined. */
export function flipbookSrcSet(key: string, i: number): string | undefined {
  const v = FLIPBOOK_VARIANTS[key];
  if (!v) return undefined;
  const base = `/kkumdarak/${key}/frame-0${i}`;
  return `${base}-sm.webp ${v.smW}w, ${base}.webp ${v.w}w`;
}
''')
    print('폴더 %d개 / -sm 프레임 %d개 %.1fKB 생성' % (len(manifest), len(manifest) * 6, tot / 1024))
    print('매니페스트:', os.path.relpath(TS, ROOT))


if __name__ == '__main__':
    main()
