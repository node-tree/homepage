/* 자동 생성 — scripts/build-flipbook-variants.py 가 씁니다. 손으로 고치지 마세요. */
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

export const FLIPBOOK_VARIANTS: Record<string, FlipbookVariant> = {
  "chars-v2/character-01": {
    "fx": 1.04835,
    "fy": 1.00896,
    "h": 169,
    "smH": 84,
    "smW": 103,
    "w": 206
  },
  "chars-v2/character-02": {
    "fx": 1.05943,
    "fy": 1.0,
    "h": 150,
    "smH": 75,
    "smW": 102,
    "w": 205
  },
  "chars-v2/character-03": {
    "fx": 1.12048,
    "fy": 1.0,
    "h": 136,
    "smH": 68,
    "smW": 93,
    "w": 186
  },
  "chars-v2/character-04": {
    "fx": 1.02162,
    "fy": 1.0,
    "h": 149,
    "smH": 74,
    "smW": 94,
    "w": 189
  },
  "chars-v2/character-05": {
    "fx": 1.04891,
    "fy": 1.0,
    "h": 159,
    "smH": 80,
    "smW": 96,
    "w": 193
  },
  "chars-v2/character-06": {
    "fx": 1.10843,
    "fy": 1.0,
    "h": 210,
    "smH": 105,
    "smW": 92,
    "w": 184
  },
  "chars-v2/character-07": {
    "fx": 1.05915,
    "fy": 1.00865,
    "h": 175,
    "smH": 88,
    "smW": 94,
    "w": 188
  },
  "chars-v2/character-08": {
    "fx": 1.07104,
    "fy": 1.0,
    "h": 157,
    "smH": 78,
    "smW": 98,
    "w": 196
  },
  "chars-v2/character-09": {
    "fx": 1.02902,
    "fy": 1.0,
    "h": 162,
    "smH": 81,
    "smW": 98,
    "w": 195
  },
  "chars-v2/character-10": {
    "fx": 1.02139,
    "fy": 1.0,
    "h": 154,
    "smH": 77,
    "smW": 96,
    "w": 191
  },
  "chars-v2/character-11": {
    "fx": 1.07692,
    "fy": 1.0,
    "h": 153,
    "smH": 76,
    "smW": 108,
    "w": 217
  },
  "chars-v2/character-12": {
    "fx": 1.09317,
    "fy": 1.01695,
    "h": 180,
    "smH": 90,
    "smW": 88,
    "w": 176
  },
  "chars-v2/character-13": {
    "fx": 1.18557,
    "fy": 1.00529,
    "h": 190,
    "smH": 95,
    "smW": 115,
    "w": 230
  },
  "chars-v2/character-14": {
    "fx": 1.01942,
    "fy": 1.0,
    "h": 161,
    "smH": 80,
    "smW": 105,
    "w": 210
  },
  "chars-v2/character-15": {
    "fx": 1.05882,
    "fy": 1.0,
    "h": 181,
    "smH": 90,
    "smW": 94,
    "w": 189
  },
  "chars-v2/character-16": {
    "fx": 1.01587,
    "fy": 1.00552,
    "h": 182,
    "smH": 91,
    "smW": 96,
    "w": 192
  },
  "chars-v2/character-17": {
    "fx": 1.02902,
    "fy": 1.0,
    "h": 170,
    "smH": 85,
    "smW": 98,
    "w": 195
  },
  "chars-v2/character-18": {
    "fx": 1.12903,
    "fy": 1.01961,
    "h": 182,
    "smH": 91,
    "smW": 105,
    "w": 210
  },
  "chars-v2/character-19": {
    "fx": 1.0383,
    "fy": 1.01392,
    "h": 255,
    "smH": 128,
    "smW": 122,
    "w": 244
  },
  "chars-v2/character-20": {
    "fx": 1.01145,
    "fy": 1.07048,
    "h": 243,
    "smH": 122,
    "smW": 132,
    "w": 265
  },
  "chars-v2/character-21": {
    "fx": 1.14103,
    "fy": 1.00832,
    "h": 303,
    "smH": 152,
    "smW": 134,
    "w": 267
  },
  "nature-loops/fireflies-fly": {
    "fx": 1.04289,
    "fy": 1.02469,
    "h": 166,
    "smH": 83,
    "smW": 116,
    "w": 231
  },
  "nature-loops/leaves-seeds-drift": {
    "fx": 1.05122,
    "fy": 1.05483,
    "h": 202,
    "smH": 101,
    "smW": 118,
    "w": 236
  }
};

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
