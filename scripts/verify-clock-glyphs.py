#!/opt/homebrew/bin/python3.10
# -*- coding: utf-8 -*-
"""
verify-clock-glyphs.py — 서브아틀라스 대조 검증

  같은 **글자 군**을 세 가지로 나란히 200% 로 놓고 본다.
    ① 원본 판 크롭            (자료집 도판 화소 — 화면에는 안 들어가지만 대조 기준)
    ② 랩 재조판 SDF (3×)      (WG-018 정본 자산을 판 좌표계로 되돌린 것)
    ③ 웹 서브아틀라스 (1.3×)  (이 프로젝트가 굽고 셰이더 규칙으로 그린 것)
  ②③ 의 먹 사각(알파 ≥ 0.5) 사이 IoU 를 잰다 — 잘라내기·이득·양자화·축소가
  획의 모양을 바꾸지 않았는지의 수치.

  출력: _workspace/06_impl/glyph_compare.png · glyph_compare.json
"""
import json, os
import numpy as np
from PIL import Image
from scipy.ndimage import zoom as ndzoom

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LAB = os.path.expanduser('~/공생직조-lab/webgpu/wg-018-retypeset/assets')
REFS = os.path.expanduser('~/공생직조-lab/shared/refs/bokjang_gaesimsa')
OUT = os.path.join(ROOT, '_workspace', '06_impl')
ZOOM = 2.0          # 200 %
LAB_SS = 3.0

# 판 이름 → 원본 도판 파일 (artifact 접미는 랩이 잘라 만든 이름)
REF_MAP = {'red_dharani_sheet_p107_artifact.png': 'red_dharani_sheet_p107.png'}


def smooth(a, b, x):
    t = np.clip((x - a) / max(b - a, 1e-6), 0, 1)
    return t * t * (3 - 2 * t)


def alpha_of(R, G, gate, w=0.03):
    """셰이더와 같은 규칙 — paper 문턱 × SDF 문턱"""
    paper = smooth(gate * 0.5, gate, G)
    return smooth(128 / 255 - w, 128 / 255 + w, R) * paper


def main():
    meta = json.load(open(os.path.join(LAB, 'retypeset.json'), encoding='utf-8'))
    pieces = {p['id']: p for p in meta['pieces']}
    plates = {p['file']: p for p in meta['plates']}
    big = np.asarray(Image.open(os.path.join(LAB, 'sdf_atlas_p0.png')).convert('RGB'))

    doc = json.load(open(os.path.join(ROOT, 'public', 'dharani', 'clock-glyphs.json'), encoding='utf-8'))
    sub = np.asarray(Image.open(os.path.join(ROOT, 'public', 'dharani', 'clock-glyphs.png')).convert('RGB'))

    # 고리마다 한 자씩 (charm 은 원본 도판이 있는 주서판에서)
    picks = []
    for ring in ['donor', 'vow', 'dharani', 'charm', 'seed']:
        for gid in doc['rings'][ring]:
            g = doc['groups'][gid]
            ref = REF_MAP.get(g['plate'], g['plate'])
            if os.path.exists(os.path.join(REFS, ref)):
                picks.append(g)
                break

    rows, report = [], []
    for g in picks:
        px, py, pw, ph = g['plateBox']
        px, py, pw, ph = float(px), float(py), int(pw), int(ph)
        W = int(round(pw * ZOOM)); H = int(round(ph * ZOOM))

        # ① 원본 판 크롭
        ref = Image.open(os.path.join(REFS, REF_MAP.get(g['plate'], g['plate']))).convert('RGB')
        crop = ref.crop((int(round(px)), int(round(py)), int(round(px)) + pw, int(round(py)) + ph))
        colA = np.asarray(crop.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255.

        # ② 랩 SDF 를 판 좌표계로 되돌린 합성(빌더 1단계와 같은 규칙)
        LW, LH = int(round(pw * LAB_SS)), int(round(ph * LAB_SS))
        R = np.zeros((LH, LW), np.uint8); G = np.zeros((LH, LW), np.uint8)
        gsrc = None
        for gg in meta['glyphs']:
            if gg['key'] == g['key'] and gg['plate'] == g['plate']:
                gsrc = gg; break
        ids = gsrc['pieces'] if gsrc else [
            p['id'] for p in meta['pieces']
            if p['plate'] == g['plate']
            and px - 1 <= p['bboxPlate'][0] + p['bboxPlate'][2] and p['bboxPlate'][0] <= px + pw + 1
            and py - 1 <= p['bboxPlate'][1] + p['bboxPlate'][3] and p['bboxPlate'][1] <= py + ph + 1]
        for i in ids:
            p = pieces[i]
            ax, ay, aw, ah = p['atlas']
            c = big[ay:ay + ah, ax:ax + aw]
            ox = int(round((p['bboxPlate'][0] - px) * LAB_SS)); oy = int(round((p['bboxPlate'][1] - py) * LAB_SS))
            sx0 = max(0, -ox); sy0 = max(0, -oy); dx0 = max(0, ox); dy0 = max(0, oy)
            cw = min(c.shape[1] - sx0, LW - dx0); ch = min(c.shape[0] - sy0, LH - dy0)
            if cw <= 0 or ch <= 0:
                continue
            cR = c[sy0:sy0 + ch, sx0:sx0 + cw, 0]; cG = c[sy0:sy0 + ch, sx0:sx0 + cw, 1]
            dR = R[dy0:dy0 + ch, dx0:dx0 + cw]; dG = G[dy0:dy0 + ch, dx0:dx0 + cw]
            take = cR > dR
            dR[take] = cR[take]; dG[take] = cG[take]
        gate = plates[g['plate']]['densGate']
        aLab = alpha_of(R.astype(np.float32) / 255., G.astype(np.float32) / 255., gate, w=0.012)
        aLab2 = np.clip(ndzoom(aLab, (H / LH, W / LW), order=1, mode='nearest'), 0, 1)

        # ③ 웹 서브아틀라스 타일(여백 포함 = 판 사각과 1:1)
        tx, ty, tw, th = g['atlasTile']
        t = sub[ty:ty + th, tx:tx + tw].astype(np.float32) / 255.
        aSub = alpha_of(t[:, :, 0], t[:, :, 1], gate, w=0.10)
        aSub2 = np.clip(ndzoom(aSub, (H / th, W / tw), order=1, mode='nearest'), 0, 1)

        mL = aLab2 >= 0.5; mS = aSub2 >= 0.5
        inter = int(np.logical_and(mL, mS).sum()); union = int(np.logical_or(mL, mS).sum())
        iou = inter / max(1, union)
        report.append(dict(ring=g['ring'], id=g['id'], plate=g['plate'], key=g['key'],
                           plateBox=[px, py, pw, ph], tile=[tw, th], render=[W, H],
                           labPx=int(mL.sum()), subPx=int(mS.sum()), iou=round(iou, 4),
                           vermilion=g['vermilion']))

        ink = np.array([0.06, 0.06, 0.10]) if not g['vermilion'] else np.array([190, 60, 40]) / 255.
        colB = np.ones((H, W, 3)) * 1.0 * (1 - aLab2[..., None]) + ink * aLab2[..., None]
        colC = np.ones((H, W, 3)) * 1.0 * (1 - aSub2[..., None]) + ink * aSub2[..., None]
        # 차이(빨강 = 랩만 · 파랑 = 웹만)
        diff = np.ones((H, W, 3))
        diff[np.logical_and(mL, ~mS)] = [0.85, 0.15, 0.10]
        diff[np.logical_and(~mL, mS)] = [0.10, 0.30, 0.85]
        diff[np.logical_and(mL, mS)] = [0.80, 0.80, 0.78]
        rows.append((g, [colA, colB, colC, diff], iou))

    # 시트 조판 — 한 자 = 한 줄(원본판 · 랩SDF3× · 웹1.3× · 차이)
    GAP, LEFT, HEAD = 18, 176, 26
    WW = LEFT + max(sum(c.shape[1] + GAP for c in r[1]) for r in rows) + GAP
    HH = sum(max(c.shape[0] for c in r[1]) + GAP + HEAD for r in rows) + GAP
    sheet = np.ones((HH, WW, 3))
    ys = []
    y = GAP
    for g, cols, iou in rows:
        h = max(c.shape[0] for c in cols)
        ys.append(y)
        x = LEFT
        for c in cols:
            sheet[y:y + c.shape[0], x:x + c.shape[1]] = c
            x += c.shape[1] + GAP
        y += h + GAP + HEAD
    img = Image.fromarray((np.clip(sheet, 0, 1) * 255).astype(np.uint8))
    from PIL import ImageDraw
    dr = ImageDraw.Draw(img)
    for (g, cols, iou), y in zip(rows, ys):
        dr.text((12, y + 4), f"{g['ring']}", fill=(20, 20, 20))
        dr.text((12, y + 20), f"id {g['id']} · key {g['key']}", fill=(90, 90, 90))
        dr.text((12, y + 36), f"IoU {iou:.4f}", fill=(190, 60, 40))
        dr.text((12, y + 52), f"tile {cols[2].shape[1]}x{cols[2].shape[0]}px @200%", fill=(140, 140, 140))
        x = LEFT
        for lbl, c in zip(['A. plate crop (original)', 'B. lab SDF 3x', 'C. web sub-atlas 1.3x', 'D. diff  red=lab only / blue=web only'], cols):
            dr.text((x, y + max(cc.shape[0] for cc in cols) + 6), lbl, fill=(90, 90, 90))
            x += c.shape[1] + GAP
    path = os.path.join(OUT, 'glyph_compare.png')
    img.save(path)
    with open(os.path.join(OUT, 'glyph_compare.json'), 'w', encoding='utf-8') as f:
        json.dump(dict(zoom=ZOOM, rows=report,
                       iouMin=min(r['iou'] for r in report),
                       iouMean=round(sum(r['iou'] for r in report) / len(report), 4)), f,
                  ensure_ascii=False, indent=1)
    for r in report:
        print(f"{r['ring']:8s} id{r['id']:<4d} 판사각 {r['plateBox']}  타일 {r['tile']}  "
              f"랩화소 {r['labPx']:6d}  웹화소 {r['subPx']:6d}  IoU {r['iou']:.4f}")
    print('IoU min %.4f  mean %.4f' % (min(r['iou'] for r in report),
                                       sum(r['iou'] for r in report) / len(report)))
    print('sheet:', path, img.size)


if __name__ == '__main__':
    main()
