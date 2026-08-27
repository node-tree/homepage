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
from scipy import ndimage as ndi

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
SEED_SPECK_TEXELS = 60      # 이보다 작은 연결 성분은 먼지·반점으로 보고 버린다
SEED_WIN_MARGIN = 1.10      # 통일 창 = 성분 bbox 중앙값 × 여유
SEED_ASPECT = (0.55, 0.70)  # 창 종횡비 허용 범위(원본 9자는 세로로 길다)
SEED_KEEP = float(os.environ.get('SKEEP', 0.90))   # 창 밖 잘림 허용 하한(칸 잉크의 포함율)
SEED_GROW_MAX = int(os.environ.get('SGROW', 4))    # 창 확대 반복 상한


def log(*a):
    print(*a, flush=True)


def assemble_group(pieces, big, pl):
    """글자 군의 조각들을 판 좌표계에 되돌려 한 장으로 합성한다(랩 3배 격자)."""
    x0 = min(pieces[i]['bboxPlate'][0] for i in pl)
    y0 = min(pieces[i]['bboxPlate'][1] for i in pl)
    x1 = max(pieces[i]['bboxPlate'][0] + pieces[i]['bboxPlate'][2] for i in pl)
    y1 = max(pieces[i]['bboxPlate'][1] + pieces[i]['bboxPlate'][3] for i in pl)
    # 여백 잘라내기 — 군 전체가 사라지지 않는 선에서만
    tr = min(TRIM_PLATE_PX, (x1 - x0) / 4.0, (y1 - y0) / 4.0)
    x0 += tr; y0 += tr; x1 -= tr; y1 -= tr
    gw, gh = int(round(x1 - x0)), int(round(y1 - y0))
    LW, LH = int(round(gw * LAB_SS)), int(round(gh * LAB_SS))
    R = np.zeros((LH, LW), np.uint8)
    G = np.zeros((LH, LW), np.uint8)
    for i in pl:
        p = pieces[i]
        ax, ay, aw, ah = p['atlas']
        crop = big[ay:ay + ah, ax:ax + aw]
        ox = int(round((p['bboxPlate'][0] - x0) * LAB_SS))
        oy = int(round((p['bboxPlate'][1] - y0) * LAB_SS))
        sh, sw = crop.shape[0], crop.shape[1]
        sx0 = max(0, -ox); sy0 = max(0, -oy)
        dx0 = max(0, ox); dy0 = max(0, oy)
        cw = min(sw - sx0, LW - dx0); ch = min(sh - sy0, LH - dy0)
        if cw <= 0 or ch <= 0:
            continue
        cR = crop[sy0:sy0 + ch, sx0:sx0 + cw, 0]
        cG = crop[sy0:sy0 + ch, sx0:sx0 + cw, 1]
        dstR = R[dy0:dy0 + ch, dx0:dx0 + cw]
        dstG = G[dy0:dy0 + ch, dx0:dx0 + cw]
        take = cR > dstR                 # 거리장 합집합 = max(R), G 는 R 승자를 따른다
        dstR[take] = cR[take]
        dstG[take] = cG[take]
    return R, G, x0, y0, gw, gh


def _valley(proj, center, half):
    """투영 곡선에서 중심 근방 골짜기(글자 사이 빈 줄)의 자리를 찾는다."""
    lo = max(1, int(center - half)); hi = min(len(proj) - 1, int(center + half))
    seg = proj[lo:hi]
    return lo + int(np.argmin(seg)), float(seg.min())


def seed_lattice_tiles(meta, big, pm, scale):
    """
    종자자 판(p.66) — **격자 창 + 연결성분 소유**로 9자를 낸다.

      it.1 은 조각 무게중심의 1차원 k-means 로 갈랐고, 넓은 붓의 긴 꼬리가 이웃 칸까지
      뻗어 군집이 글자 경계를 물었다(높이 편차 2.38배·종횡비 0.51~1.50·중심 이탈 0.474R).
      이 판은 3행 × 3열로 정연하게 **쓰여 있으므로**, 조각을 나누는 대신
        ① 판 전체 SDF 를 합성해 잉크장을 만들고
        ② 행 경계는 전역 가로 투영의 골짜기, 열 경계는 **행마다** 세로 투영의 골짜기로 찾고
           (아래 행은 글자가 왼쪽으로 몰려 있어 열 경계가 행마다 다르다 — 실측)
        ③ 연결 성분을 그 무게중심이 속한 칸의 것으로 **소유**시켜 이웃의 꼬리를 제거하고
        ④ 창은 성분 bbox 중앙값에서 얻은 **한 가지 크기**로 통일해 각 칸의 잉크 무게중심에
           맞춰 놓는다(판 밖으로 나가지 않게 클램프).
      결과: 9자 모두 같은 크기·같은 종횡비·중심 정렬.
    """
    PW, PH = pm['size']
    SS = int(LAB_SS)
    LW, LH = PW * SS, PH * SS
    R = np.zeros((LH, LW), np.uint8)
    G = np.zeros((LH, LW), np.uint8)
    for p in meta['pieces']:
        if p['plate'] != SEED_PLATE:
            continue
        ax, ay, aw, ah = p['atlas']
        c = big[ay:ay + ah, ax:ax + aw]
        ox = int(round(p['bboxPlate'][0] * SS)); oy = int(round(p['bboxPlate'][1] * SS))
        sx0 = max(0, -ox); sy0 = max(0, -oy); dx0 = max(0, ox); dy0 = max(0, oy)
        cw = min(c.shape[1] - sx0, LW - dx0); ch = min(c.shape[0] - sy0, LH - dy0)
        if cw <= 0 or ch <= 0:
            continue
        cR = c[sy0:sy0 + ch, sx0:sx0 + cw, 0]; cG = c[sy0:sy0 + ch, sx0:sx0 + cw, 1]
        dR = R[dy0:dy0 + ch, dx0:dx0 + cw]; dG = G[dy0:dy0 + ch, dx0:dx0 + cw]
        t = cR > dR
        dR[t] = cR[t]; dG[t] = cG[t]

    gate = pm['densGate']
    mask = (R >= 128) & (G / 255.0 >= gate)

    # ② 행 경계 → 행별 열 경계
    rowp = mask.sum(1).reshape(-1, SS).sum(1)
    ry = [0]
    for k in (1, 2):
        v, _ = _valley(rowp, PH * k / 3.0, PH * 0.12)
        ry.append(v)
    ry.append(PH)
    cxr = []
    for r in range(3):
        strip = mask[ry[r] * SS:ry[r + 1] * SS, :]
        colp = strip.sum(0).reshape(-1, SS).sum(1)
        e = [0]
        for k in (1, 2):
            v, _ = _valley(colp, PW * k / 3.0, PW * 0.12)
            e.append(v)
        e.append(PW)
        if not (e[0] < e[1] < e[2] < e[3]):
            raise SystemExit(f'종자자 격자 실패: 행 {r} 열 경계 {e}')
        cxr.append(e)
    log(f'[seed] 행 경계 y={ry[1:3]}  행별 열 경계 x={[c[1:3] for c in cxr]}')

    # ③ 연결 성분 소유
    lab, nl = ndi.label(mask, np.ones((3, 3), bool))
    sizes = np.array(ndi.sum(mask, lab, range(1, nl + 1)))
    com = ndi.center_of_mass(mask, lab, range(1, nl + 1))
    ccy = np.array([c[0] for c in com]) / SS
    ccx = np.array([c[1] for c in com]) / SS
    keep = sizes >= SEED_SPECK_TEXELS
    owner = np.zeros(nl + 1, np.int16) - 1
    for i in range(nl):
        if not keep[i]:
            continue
        r = 0 if ccy[i] < ry[1] else (1 if ccy[i] < ry[2] else 2)
        e = cxr[r]
        c = 0 if ccx[i] < e[1] else (1 if ccx[i] < e[2] else 2)
        owner[i + 1] = r * 3 + c
    cellOwner = owner[lab]                     # 화소마다 소유 칸(-1 = 티끌/종이)
    log(f'[seed] 성분 {nl} · 유효 {int(keep.sum())} · 버린 잉크 '
        f'{100 * sizes[~keep].sum() / sizes.sum():.3f}%')

    stats = []
    for k in range(9):
        m = cellOwner == k
        if not m.any():
            raise SystemExit(f'종자자 격자 실패: 칸 {k} 가 비었다')
        ys, xs = np.where(m)
        stats.append(dict(k=k, ink=int(m.sum()),
                          cx=xs.mean() / SS, cy=ys.mean() / SS,
                          bw=(xs.max() - xs.min() + 1) / SS,
                          bh=(ys.max() - ys.min() + 1) / SS))

    # ④ 한 가지 창 크기 — 성분 bbox 중앙값에서 시작해, **어느 자도 잘리지 않을 때까지**
    #    (칸 잉크의 SEED_KEEP 이상이 창 안에 들 때까지) 종횡비를 지킨 채 키운다.
    def fit(W, H):
        if W / H > SEED_ASPECT[1]:
            H = int(round(W / SEED_ASPECT[1]))
        if W / H < SEED_ASPECT[0]:
            W = int(round(H * SEED_ASPECT[0]))
        return min(W, PW), min(H, PH)

    def kept(W, H):
        out = []
        for t in stats:
            X = int(round(min(max(t['cx'] - W / 2.0, 0), PW - W)))
            Y = int(round(min(max(t['cy'] - H / 2.0, 0), PH - H)))
            m = (cellOwner == t['k'])
            out.append(m[Y * SS:(Y + H) * SS, X * SS:(X + W) * SS].sum() / max(1, m.sum()))
        return out

    W, H = fit(int(round(np.median([t['bw'] for t in stats]) * SEED_WIN_MARGIN)),
               int(round(np.median([t['bh'] for t in stats]) * SEED_WIN_MARGIN)))
    grow = 0
    while min(kept(W, H)) < SEED_KEEP and (W < PW and H < PH) and grow < SEED_GROW_MAX:
        W, H = fit(int(round(W * 1.05)), int(round(H * 1.05)))
        grow += 1
    log(f'[seed] 통일 창 {W}x{H} 종횡비 {W / H:.3f} (확장 {grow}회 · 최소 포함율 {min(kept(W, H)):.3f})')

    out = []
    for t in stats:
        X = int(round(min(max(t['cx'] - W / 2.0, 0), PW - W)))
        Y = int(round(min(max(t['cy'] - H / 2.0, 0), PH - H)))
        m = (cellOwner == t['k'])
        # 소유 성분의 SDF 감쇠 폭(≈4 판화소)까지만 남기고 나머지는 종이로 둔다
        grow = ndi.binary_dilation(m, ndi.generate_binary_structure(2, 2),
                                   iterations=int(4 * SS))
        sl = (slice(Y * SS, (Y + H) * SS), slice(X * SS, (X + W) * SS))
        tR = np.where(grow[sl], R[sl], 0).astype(np.uint8)
        tG = np.where(grow[sl], G[sl], 0).astype(np.uint8)
        ys, xs = np.where(m[sl])
        off = (float(xs.mean() / SS - W / 2.0), float(ys.mean() / SS - H / 2.0))
        out.append(dict(
            g=dict(key=-1 - t['k'], plate=SEED_PLATE, plateIndex=-1, pieces=[], n=0,
                   bboxPlate=[X, Y, W, H], centroidPlate=[t['cx'], t['cy']],
                   area=int(t['ink'] / (SS * SS)), segGlyphId=None,
                   vermilion=False, source='lattice'),
            R=tR, G=tG, plateBox=[X, Y, W, H],
            inkPx=int(m[sl].sum()), inkRatio=float(m[sl].sum() / m[sl].size),
            keptRatio=float(m[sl].sum() / max(1, m.sum())),
            offR=float((off[0] ** 2 + off[1] ** 2) ** 0.5 / (H / 2.0)),
        ))
    # 판 읽는 순서(위→아래, 오른쪽→왼쪽 = 동양 조판)
    order = [2, 1, 0, 5, 4, 3, 8, 7, 6]
    return [out[i] for i in order]


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
            sel = seed_lattice_tiles(meta, big, plates[SEED_PLATE], scale)
            if len(sel) != count:
                raise SystemExit(f'종자자 {count} 자를 얻지 못했다: {len(sel)}')
            boxes = [t['plateBox'] for t in sel]
            hs = [b[3] for b in boxes]; asp = [b[2] / b[3] for b in boxes]
            ratios = [t['inkRatio'] for t in sel]
            report[rid] = dict(
                mode='lattice+component-ownership', k=count, picked=len(sel),
                bboxPlate=boxes,
                aspect=[round(a, 4) for a in asp],
                heightSpread=round(max(hs) / min(hs), 4),
                aspectRange=[round(min(asp), 4), round(max(asp), 4)],
                inkRatio=[round(r, 4) for r in ratios],
                inkSpread=round(max(ratios) / min(ratios), 4),
                centerOffsetR=[round(t['offR'], 4) for t in sel],
                centerOffsetMax=round(max(t['offR'] for t in sel), 4),
                keptRatio=[round(t['keptRatio'], 4) for t in sel],
                inPlate=all(b[0] >= 0 and b[1] >= 0 for b in boxes),
                areaMin=min(t['g']['area'] for t in sel),
                areaMax=max(t['g']['area'] for t in sel))
            for t in sel:
                picked.append(dict(ring=rid, g=t['g'], scale=scale, prebuilt=t))
            log(f'[pick] {rid:8s} 격자 {count} 자  높이편차 {report[rid]["heightSpread"]:.2f}배 · '
                f'종횡비 {report[rid]["aspectRange"]} · 잉크비 편차 {report[rid]["inkSpread"]:.2f}배 · '
                f'중심이탈 최대 {report[rid]["centerOffsetMax"]:.3f}R · 판안쪽 {report[rid]["inPlate"]}')
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
        if rec.get('prebuilt') is not None:
            # 종자자 — 격자 창으로 이미 판 좌표계에서 잘라 왔다(조각 조립을 거치지 않는다)
            pb = rec['prebuilt']
            R, G = pb['R'], pb['G']
            x0, y0, gw, gh = pb['plateBox']
        else:
            R, G, x0, y0, gw, gh = assemble_group(pieces, big, g['pieces'])

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
        #   작아진다. 문턱(128) 위 텍셀의 사각을 재고 가장자리 AA 에 필요한 2 텍셀만
        #   넓혀 **먹 사각**을 낸다. 렌더는 이 사각을 쓴다.
        ink = Rq >= 128.0
        if ink.any():
            ys, xs_ = np.where(ink)
            ix0 = max(0, int(xs_.min()) - 2); iy0 = max(0, int(ys.min()) - 2)
            ix1 = min(tw, int(xs_.max()) + 3); iy1 = min(th, int(ys.max()) + 3)
        else:
            ix0, iy0, ix1, iy1 = 0, 0, tw, th
        if ink.any():
            inkC = (float(xs_.mean()), float(ys.mean()))
        else:
            inkC = (tw / 2.0, th / 2.0)
        tiles.append(dict(idx=idx, ring=rec['ring'], g=g, w=tw, h=th, gain=gain, inkC=inkC,
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
            #  ⚠ 종자자만 예외: 통일 창 자체를 렌더 사각으로 쓴다. 먹 사각으로 정규화하면
            #    판에서 작게 쓰인 자(아래 행)가 화면에서 홀로 크게 부풀고, 납작한 자는
            #    좌우로 늘어나 한 글자로 읽히지 않는다(it.1 판정 種字 07).
            atlas=[t['ax'] + ib[0], t['ay'] + ib[1], ib[2], ib[3]],
            uv=[round((t['ax'] + ib[0]) / AW, 8), round((t['ay'] + ib[1]) / AH, 8),
                round((t['ax'] + ib[0] + ib[2]) / AW, 8), round((t['ay'] + ib[1] + ib[3]) / AH, 8)],
            aspect=round(ib[2] / ib[3], 6),
            # 타일 전체(여백 포함) — 대조 시트·디버깅용
            atlasTile=[t['ax'], t['ay'], t['w'], t['h']],
            densGate=pm['densGate'],
        )
        if t['ring'] == 'seed':
            # 종자자는 통일 창을 그대로 렌더 사각으로 쓰고, 창 안 잉크 무게중심의
            # 어긋남을 함께 실어 렌더가 **중심에 세우도록** 한다(판 가장자리 칸은 창이
            # 클램프되어 글자가 창 안에서 치우친다).
            entry['atlas'] = [t['ax'], t['ay'], t['w'], t['h']]
            entry['uv'] = [round(t['ax'] / AW, 8), round(t['ay'] / AH, 8),
                           round((t['ax'] + t['w']) / AW, 8), round((t['ay'] + t['h']) / AH, 8)]
            entry['aspect'] = round(t['w'] / t['h'], 6)
            entry['inkBox'] = ib
            entry['centerOffset'] = [round(t['inkC'][0] / t['w'] - 0.5, 6),
                                     round(t['inkC'][1] / t['h'] - 0.5, 6)]
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
