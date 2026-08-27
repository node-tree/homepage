#!/opt/homebrew/bin/python3.10
# -*- coding: utf-8 -*-
"""
build-clock-atlas.py — 다라니 시계용 **서브아틀라스** 빌더

  랩(WG-018) 재조판 자산에서 시계 고리에 쓸 **글자 군**만 골라, 그 조각들의
  SDF(R)+먹 농도(G) 텍셀을 잘라 하나의 작은 2채널 PNG 으로 다시 싣는다.
  potrace(윤곽 추적) 아님 — 원본 파이프라인의 텍셀을 그대로 옮긴다.

  입력 (읽기 전용):
    ~/공생직조-lab/webgpu/wg-018-retypeset/assets/retypeset.json
    ~/공생직조-lab/webgpu/wg-018-retypeset/assets/sdf_atlas_p0.png   (8192x3355, R=SDF·G=농도)

  출력:
    public/dharani/clock-glyphs.png    (2채널 유지 · <=2048^2 · <=600KB)
    public/dharani/clock-glyphs.json   (군 id·판·주서·densGate·uv·조각 bbox)

  합성 규칙
  ---------
  * 한 **글자 군**(glyph group) = 여러 조각(piece). 조각마다 랩 아틀라스 안 자리가
    따로 있으므로, 군의 판(plate) 좌표계에 되돌려 놓아 한 장의 타일로 만든다.
  * 두 조각이 겹치는 자리는 R(부호 거리)의 **max** = 거리장의 합집합.
    G(농도)는 R 이 큰 쪽 값을 따른다 — 조각 밖 농도 채움이 안쪽으로 새지 않게.
  * 배율은 랩 3배 초과표본을 그대로 쓰지 않고 고리별로 내린다(웹 표시 크기 기준).
    SDF 는 거리장이라 면적 평균 축소가 성립한다.
"""
import json, math, os, sys, time
import numpy as np
from PIL import Image
from scipy.ndimage import zoom as ndzoom
from scipy.cluster.vq import kmeans2

Image.MAX_IMAGE_PIXELS = None

LAB = os.path.expanduser('~/공생직조-lab/webgpu/wg-018-retypeset/assets')
SRC_JSON = os.path.join(LAB, 'retypeset.json')
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'dharani')

# ── 웹 전송량을 위한 세 가지 되감기(원본 규칙을 깨지 않는 선에서) ─────────────
#  ① 여백 잘라내기: 조각 bbox 는 SDF 여백 6 판화소를 물고 있다. 가장자리 AA 에 필요한
#     것은 문턱 근방 2~3 텍셀뿐이라 바깥 여백을 줄여도 그림이 달라지지 않는다.
TRIM_PLATE_PX = 3.0
#  ② 거리장 이득: 문턱(128)에서 먼 값은 쓰이지 않는다. ±BAND 텍셀 밖을 포화시키면
#     넓은 평면이 생겨 PNG 가 작아진다. 셰이더의 AA 폭은 fwidth 기반이라 기울기가
#     변해도 **자동으로 따라온다** — 알파 결과는 같다.
SDF_BAND_TEXELS = float(os.environ.get('BAND', 2.0))
#  ③ 농도 계단: 먹 루마 밴드가 110~140(30단)이라 16단이면 눈에 띄는 손실이 없다.
GDENS_STEP = float(os.environ.get('GSTEP', 17.0))

ATLAS_MAX = 2048
PAD = 2              # 타일 사이 여백 텍셀 (선형 보간 새어나옴 방지)
LAB_SS = 3.0         # 랩 아틀라스 텍셀 / 판 화소
RING_SCALE = float(os.environ.get('RSCALE', 1.3))   # 서브아틀라스 텍셀 / 판 화소
SEED_SCALE = float(os.environ.get('SSCALE', 1.5))   # 중심 종자자는 크게 쓰이므로 더 촘촘히

# ── 고리 정의 (바깥→안). 목업 v5/hero-dark.html 의 반지름·글자 높이 그대로 ──────
RINGS = [
    # (id,        판 파일들,                                        군 수, 배율,       주서만)
    #  seed 는 **군집 모드** — 아래 SEED_CLUSTER 참조
    ('donor',   ['donor_page_yangju_p088.png'],                      48, RING_SCALE, False),
    ('vow',     ['vow_gwaneum_p062.png'],                            48, RING_SCALE, False),
    ('dharani', ['dharani_ink_1_p066.png', 'dharani_ink_2_p066.png',
                 'dharani_jijang_1_p078.png'],                       40, RING_SCALE, False),
    ('charm',   ['colophon_left_p107_artifact.png',
                 'red_dharani_sheet_p107_artifact.png'],             24, RING_SCALE, True),
    ('seed',    ['dharani_ink_3_seed_p066.png'],                      9, SEED_SCALE, False),
]
# ── 중심 종자자 ────────────────────────────────────────────────────────────
#  자료집 p.66 종자자 판은 **넓은 붓 범자 9자가 3×3 으로** 앉아 있다(사용자 확정 §0-e).
#  재조판 자동 군집(glyphPitch 31.8 기준)은 한 자를 여러 군으로 쪼개므로, 이 판만은
#  **조각 무게중심을 9 군집(3열×3행 초기값)으로 다시 묶어** 한 자를 한 타일로 만든다.
SEED_PLATE = 'dharani_ink_3_seed_p066.png'
SEED_K = 9


def log(*a):
    print(*a, flush=True)


def cluster_seed_glyphs(meta, pieces, k):
    """
    종자자 판(p.66)의 조각을 **한 자 = 한 군집**으로 다시 묶는다.
      재조판의 자동 군집은 판마다의 글자 피치(여기선 31.8)로 잘라서, 넓은 붓으로 쓴
      범자 한 자(≈110×150 판화소)를 여러 군으로 쪼개 놓았다. 중심 종자자는 한 자가
      통째여야 하므로, 조각 무게중심을 3열×3행 초기값의 k-means 로 9 군집으로 묶는다.
      (판의 배열이 3×3 이라는 것은 도판에서 관찰된 사실이다 — 임의값이 아니다)
    """
    pl = [p for p in meta['pieces'] if p['plate'] == SEED_PLATE]
    xs = np.array([p['centroidPlate'] for p in pl], dtype=np.float64)

    def axis3(v):
        """한 축을 3 무리로 — 열/행이 규칙적이라 축마다 1차원으로 가르는 편이
        2차원 k-means 보다 글자 경계를 덜 넘는다."""
        lo, hi = v.min(), v.max()
        init = np.array([[lo + (hi - lo) * (i + 0.5) / 3] for i in range(3)])
        c, l = kmeans2(v.reshape(-1, 1), init, minit='matrix', iter=64, seed=0)
        order = np.argsort(c[:, 0])            # 왼→오 / 위→아래 순번으로 다시 매긴다
        remap = np.zeros(3, int)
        for rank, ci in enumerate(order):
            remap[ci] = rank
        return remap[l], c[:, 0][order]

    cols, cx = axis3(xs[:, 0])
    rows, cy = axis3(xs[:, 1])
    lab = rows * 3 + cols
    cent = np.array([[cx[c % 3], cy[c // 3]] for c in range(9)])
    out = []
    for c in range(k):
        idx = [pl[i]['id'] for i in range(len(pl)) if lab[i] == c]
        if not idx:
            continue
        bx0 = min(pieces[i]['bboxPlate'][0] for i in idx)
        by0 = min(pieces[i]['bboxPlate'][1] for i in idx)
        bx1 = max(pieces[i]['bboxPlate'][0] + pieces[i]['bboxPlate'][2] for i in idx)
        by1 = max(pieces[i]['bboxPlate'][1] + pieces[i]['bboxPlate'][3] for i in idx)
        out.append(dict(
            key=-1 - c, plate=SEED_PLATE, plateIndex=-1, pieces=idx, n=len(idx),
            bboxPlate=[bx0, by0, bx1 - bx0, by1 - by0],
            centroidPlate=[float(cent[c][0]), float(cent[c][1])],
            area=int(sum(pieces[i]['area'] for i in idx)),
            segGlyphId=None, vermilion=False, source='cluster',
        ))
    # 판 읽는 순서(위→아래, 오른쪽→왼쪽 = 동양 조판)로 정렬해 9자 순환이 판을 따르게 한다
    out.sort(key=lambda g: (round(g['centroidPlate'][1] / 60), -g['centroidPlate'][0]))
    return out


def main():
    t0 = time.time()
    meta = json.load(open(SRC_JSON, encoding='utf-8'))
    plates = {p['file']: p for p in meta['plates']}
    pieces = {p['id']: p for p in meta['pieces']}
    glyphs = meta['glyphs']
    atlas_files = meta['_meta']['atlasFiles']
    assert len(atlas_files) == 1, '이 빌더는 단일 페이지 아틀라스 전제'
    src_png = os.path.join(LAB, atlas_files[0])
    log('[load] atlas', src_png)
    big = np.asarray(Image.open(src_png).convert('RGB'))          # (H,W,3) uint8
    log('[load] atlas shape', big.shape)

    by_plate = {}
    for g in glyphs:
        by_plate.setdefault(g['plate'], []).append(g)

    # ── 1) 고리별 글자 군 선정 ───────────────────────────────────────────
    picked = []   # dict(ring, glyph, scale)
    report = {}
    for rid, files, count, scale, red_only in RINGS:
        if files == [SEED_PLATE]:
            sel = cluster_seed_glyphs(meta, pieces, count)
            report[rid] = dict(mode='cluster-kmeans2', k=count, picked=len(sel),
                               piecesPerGlyph=[g['n'] for g in sel],
                               bboxPlate=[[round(v, 1) for v in g['bboxPlate']] for g in sel],
                               areaMin=min(g['area'] for g in sel),
                               areaMax=max(g['area'] for g in sel))
            for g in sel:
                picked.append(dict(ring=rid, g=g, scale=scale))
            log(f'[pick] {rid:8s} 군집 {count} 자  조각/자 '
                f'{[g["n"] for g in sel]}  area {report[rid]["areaMin"]}..{report[rid]["areaMax"]}')
            continue
        pool = []
        for f in files:
            pm = plates[f]
            pitch = pm['glyphPitch']
            cap = meta['_meta']['thresholds']['glyph_cap'] * pitch   # 2.0 * pitch
            floor = meta['_meta']['thresholds']['glyph_gap'] * pitch  # 0.3 * pitch
            for g in by_plate.get(f, []):
                w, h = g['bboxPlate'][2], g['bboxPlate'][3]
                if w > cap or h > cap:          # 병합된 거대 덩어리(주서판 테두리 등) 배제
                    continue
                if w < floor or h < floor:      # 티끌 배제
                    continue
                if red_only and not g['vermilion']:
                    continue
                pool.append(g)
        # 면적 상위 · seg 유래 우선
        pool.sort(key=lambda g: (0 if g['source'] == 'seg' else 1, -g['area']))
        sel = pool[:count]
        if len(sel) < count:
            log(f'  ! {rid}: 후보 {len(pool)} < 요구 {count}')
        report[rid] = dict(pool=len(pool), picked=len(sel),
                           seg=sum(1 for g in sel if g['source'] == 'seg'),
                           areaMin=min(g['area'] for g in sel),
                           areaMax=max(g['area'] for g in sel))
        for g in sel:
            picked.append(dict(ring=rid, g=g, scale=scale))
        log(f'[pick] {rid:8s} pool={len(pool):4d} -> {len(sel):3d}  '
            f'seg={report[rid]["seg"]:3d}  area {report[rid]["areaMin"]}..{report[rid]["areaMax"]}')

    # ── 2) 군마다 타일 합성 (판 좌표계로 되돌린 뒤 축소) ─────────────────
    tiles = []
    for idx, rec in enumerate(picked):
        g = rec['g']
        pl = g['pieces']
        # 군의 판 bbox = 조각 bbox 합집합 (조각 bbox 는 이미 SDF 여백 포함)
        x0 = min(pieces[i]['bboxPlate'][0] for i in pl)
        y0 = min(pieces[i]['bboxPlate'][1] for i in pl)
        x1 = max(pieces[i]['bboxPlate'][0] + pieces[i]['bboxPlate'][2] for i in pl)
        y1 = max(pieces[i]['bboxPlate'][1] + pieces[i]['bboxPlate'][3] for i in pl)
        # 여백 잘라내기 — 군 전체가 사라지지 않는 선에서만
        tr = min(TRIM_PLATE_PX, (x1 - x0) / 4.0, (y1 - y0) / 4.0)
        x0 += tr; y0 += tr; x1 -= tr; y1 -= tr
        gw, gh = int(round(x1 - x0)), int(round(y1 - y0))
        # 랩 배율(3배)로 먼저 합성 — 원 텍셀을 재표본 없이 얹는다
        LW, LH = int(round(gw * LAB_SS)), int(round(gh * LAB_SS))
        R = np.zeros((LH, LW), np.uint8)
        G = np.zeros((LH, LW), np.uint8)
        for i in pl:
            p = pieces[i]
            ax, ay, aw, ah = p['atlas']
            crop = big[ay:ay + ah, ax:ax + aw]
            bx, by = p['bboxPlate'][0], p['bboxPlate'][1]
            ox = int(round((bx - x0) * LAB_SS)); oy = int(round((by - y0) * LAB_SS))
            sh, sw = crop.shape[0], crop.shape[1]
            # 양쪽 잘라내기(여백 트림으로 원점이 음수가 될 수 있다)
            sx0 = max(0, -ox); sy0 = max(0, -oy)
            dx0 = max(0, ox); dy0 = max(0, oy)
            cw = min(sw - sx0, LW - dx0); ch = min(sh - sy0, LH - dy0)
            if cw <= 0 or ch <= 0:
                continue
            cR = crop[sy0:sy0 + ch, sx0:sx0 + cw, 0]
            cG = crop[sy0:sy0 + ch, sx0:sx0 + cw, 1]
            dstR = R[dy0:dy0 + ch, dx0:dx0 + cw]
            dstG = G[dy0:dy0 + ch, dx0:dx0 + cw]
            take = cR > dstR                       # 거리장 합집합 = max(R), G 는 R 승자를 따른다
            dstR[take] = cR[take]
            dstG[take] = cG[take]
        # 목표 배율로 축소 (거리장 = 면적 평균이 성립)
        s = rec['scale'] / LAB_SS
        if abs(s - 1.0) > 1e-6:
            Rf = ndzoom(R.astype(np.float32), s, order=1, mode='nearest')
            Gf = ndzoom(G.astype(np.float32), s, order=1, mode='nearest')
        else:
            Rf = R.astype(np.float32); Gf = G.astype(np.float32)
        # 거리장 이득 — 문턱 ±BAND 텍셀 밖을 포화 (기울기만 바뀌고 가장자리 자리는 그대로)
        units_per_texel = (127.0 / meta['_meta']['thresholds']['sdf_range']) / rec['scale']
        gain = 127.0 / max(1e-6, SDF_BAND_TEXELS * units_per_texel)
        Rq = np.clip((Rf - 128.0) * gain + 128.0, 0, 255)
        Gq = np.where(Rq <= 0.5, 0.0, Gf)          # 완전 바깥의 농도 채움값은 버린다(알파 0)
        #  ③ 농도 계단 낮추기: 먹 루마 밴드가 110~140(30단)이라 16단이면 눈에 띄는 손실이 없다
        Gq = np.clip(np.round(Gq / GDENS_STEP) * GDENS_STEP, 0, 255)
        tw, th = Rf.shape[1], Rf.shape[0]
        # ── 먹이 실제로 서 있는 사각 ─────────────────────────────────────
        #   타일에는 SDF 여백이 남아 있어, 타일 높이를 고리 높이에 맞추면 글자가 그만큼
        #   작아진다(목업 대비 글자가 줄어든 원인). 문턱(128) 위 텍셀의 사각을 재고
        #   가장자리 AA 에 필요한 2 텍셀만 넓혀 **먹 사각**을 낸다. 렌더는 이 사각을 쓴다.
        ink = Rq >= 128.0
        if ink.any():
            ys, xs_ = np.where(ink)
            ix0 = max(0, int(xs_.min()) - 2); iy0 = max(0, int(ys.min()) - 2)
            ix1 = min(tw, int(xs_.max()) + 3); iy1 = min(th, int(ys.max()) + 3)
        else:
            ix0, iy0, ix1, iy1 = 0, 0, tw, th
        tiles.append(dict(idx=idx, ring=rec['ring'], g=g, w=tw, h=th, gain=gain,
                          R=Rq.astype(np.uint8),
                          Gc=np.clip(Gq, 0, 255).astype(np.uint8),
                          inkBox=[ix0, iy0, ix1 - ix0, iy1 - iy0],
                          plateBox=[x0, y0, gw, gh]))

    total_texels = sum(t['w'] * t['h'] for t in tiles)
    log(f'[tile] {len(tiles)} tiles  texels={total_texels}  '
        f'({total_texels / (ATLAS_MAX ** 2) * 100:.1f}% of {ATLAS_MAX}^2)')

    # ── 3) 선반(shelf) 패킹 ────────────────────────────────────────────
    order = sorted(tiles, key=lambda t: -t['h'])
    AW = ATLAS_MAX
    cx = cy = shelf_h = 0
    for t in order:
        w, h = t['w'] + PAD, t['h'] + PAD
        if cx + w > AW:
            cx = 0; cy += shelf_h; shelf_h = 0
        t['ax'], t['ay'] = cx, cy
        cx += w; shelf_h = max(shelf_h, h)
    AH = cy + shelf_h
    AH = min(2 ** math.ceil(math.log2(max(AH, 1))), ATLAS_MAX)
    if cy + shelf_h > AH:
        raise SystemExit(f'패킹 실패: 필요 높이 {cy + shelf_h} > {AH}')
    log(f'[pack] atlas {AW}x{AH}  occupancy={total_texels / (AW * AH) * 100:.1f}%')

    out = np.zeros((AH, AW, 3), np.uint8)
    for t in tiles:
        x, y, w, h = t['ax'], t['ay'], t['w'], t['h']
        out[y:y + h, x:x + w, 0] = t['R']
        out[y:y + h, x:x + w, 1] = t['Gc']
    os.makedirs(OUT_DIR, exist_ok=True)
    png_path = os.path.join(OUT_DIR, 'clock-glyphs.png')
    Image.fromarray(out, 'RGB').save(png_path, optimize=True, compress_level=9)
    size = os.path.getsize(png_path)
    log(f'[write] {png_path}  {size} bytes ({size/1024:.1f} KB)')

    # ── 4) JSON ────────────────────────────────────────────────────────
    rings_out = {}
    groups = []
    for t in tiles:
        g = t['g']; pm = plates[g['plate']]; ib = t['inkBox']
        entry = dict(
            id=len(groups), key=g['key'], ring=t['ring'], plate=g['plate'],
            label=pm['label'], vermilion=bool(g['vermilion']),
            source=g['source'], area=g['area'], n=g['n'],
            # 판 화소 단위 사각 (SDF 여백 포함) — 화면 비율의 근거
            plateBox=[float(v) for v in t['plateBox']],
            # 서브아틀라스 텍셀 사각 — **먹 사각**(렌더가 쓰는 것)
            atlas=[t['ax'] + ib[0], t['ay'] + ib[1], ib[2], ib[3]],
            uv=[round((t['ax'] + ib[0]) / AW, 8), round((t['ay'] + ib[1]) / AH, 8),
                round((t['ax'] + ib[0] + ib[2]) / AW, 8), round((t['ay'] + ib[1] + ib[3]) / AH, 8)],
            aspect=round(ib[2] / ib[3], 6),
            # 타일 전체(여백 포함) — 대조 시트·디버깅용
            atlasTile=[t['ax'], t['ay'], t['w'], t['h']],
            densGate=pm['densGate'],
        )
        rings_out.setdefault(t['ring'], []).append(entry['id'])
        groups.append(entry)

    doc = dict(
        _meta=dict(
            source=os.path.join(LAB, atlas_files[0]),
            sourceJson=SRC_JSON,
            note='WG-018 재조판 자산에서 시계용 글자 군만 잘라낸 서브아틀라스. '
                 'potrace 아님 — 원본 SDF/농도 텍셀 이식.',
            channels={'R': 'SDF(128 = 획의 가장자리 · ±8 판화소)',
                      'G': '먹 농도 0..255 (조각 안의 농담 · 조각 밖은 최근접 안쪽 값)',
                      'B': '0'},
            sdfEdge=128, sdfRange=meta['_meta']['thresholds']['sdf_range'],
            sdfBandTexels=SDF_BAND_TEXELS, trimPlatePx=TRIM_PLATE_PX,
            densStep=GDENS_STEP, ringScale=RING_SCALE, seedScale=SEED_SCALE,
            labOversample=LAB_SS,
            atlas=[AW, AH], bytes=size,
            builtAt=time.strftime('%Y-%m-%dT%H:%M:%S%z'),
            builder='scripts/build-clock-atlas.py',
            select=report,
        ),
        rings=rings_out,
        groups=groups,
    )
    json_path = os.path.join(OUT_DIR, 'clock-glyphs.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
    log(f'[write] {json_path}  {os.path.getsize(json_path)} bytes')
    log(f'[done] {time.time() - t0:.1f}s  groups={len(groups)} '
        f'rings={ {k: len(v) for k, v in rings_out.items()} }')
    if size > 600 * 1024:
        log(f'!! PNG {size/1024:.1f}KB > 600KB 한도')
        sys.exit(2)


if __name__ == '__main__':
    main()
