// ════════════════════════════════════════════════════════════════════════
// atlas.ts — 시계 글자 서브아틀라스 로더 + 고리 배치
//   자산은 `scripts/build-clock-atlas.py` 가 WG-018 재조판 자산에서 잘라낸
//   2채널 PNG(R = SDF · G = 먹 농도) + JSON 뿐이다. 도판 화소는 들어가지 않는다.
// ════════════════════════════════════════════════════════════════════════

export interface GlyphGroup {
  id: number;
  key: number;
  ring: RingId;
  plate: string;
  label: string;
  vermilion: boolean;
  source: 'seg' | 'cluster';
  area: number;
  n: number;
  /** 판 화소 사각 [x,y,w,h] — 화면 비율의 근거 */
  plateBox: [number, number, number, number];
  /** 서브아틀라스 텍셀 사각 */
  atlas: [number, number, number, number];
  /** [u0,v0,u1,v1] */
  uv: [number, number, number, number];
  aspect: number;
  /** 종이/먹을 가른 문턱(판마다 다르다) — 셰이더가 그대로 쓴다 */
  densGate: number;
  /** [종자자만] 통일 창 안에서 먹 무게중심이 어긋난 정도(창 크기의 비율).
   *  렌더가 이만큼 되밀어 9자를 모두 중심에 세운다. */
  centerOffset?: [number, number];
}

export type RingId = 'donor' | 'vow' | 'dharani' | 'charm' | 'seed';

export interface ClockGlyphSet {
  meta: any;
  rings: Record<RingId, number[]>;
  groups: GlyphGroup[];
  image: HTMLImageElement;
  atlasSize: [number, number];
}

const BASE = (process.env.PUBLIC_URL || '') + '/dharani/';

let cache: Promise<ClockGlyphSet> | null = null;

export function loadClockGlyphs(): Promise<ClockGlyphSet> {
  if (cache) return cache;
  cache = (async () => {
    const doc = await (await fetch(BASE + 'clock-glyphs.json')).json();
    const image = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('clock-glyphs.png 로드 실패'));
      im.src = BASE + 'clock-glyphs.png';
    });
    const [AW, AH] = doc._meta.atlas;
    if (image.naturalWidth !== AW || image.naturalHeight !== AH) {
      // fail-fast — 자산과 JSON 이 어긋나면 조용히 어긋난 그림을 그리게 된다
      throw new Error(
        `서브아틀라스 크기 불일치: png ${image.naturalWidth}x${image.naturalHeight} vs json ${AW}x${AH}`
      );
    }
    return { meta: doc._meta, rings: doc.rings, groups: doc.groups, image, atlasSize: [AW, AH] };
  })();
  return cache;
}

// ── 고리 배치 (목업 v5/hero-dark.html 의 수치 그대로) ─────────────────────
//   바깥→안: donor(시주 명단) · vow(발원문) · dharani(다라니) · charm(주서 부적) · seed(종자자)
export const RING_SPEC: { id: RingId; r: number; h: number }[] = [
  { id: 'donor', r: 380, h: 26 },
  { id: 'vow', r: 316, h: 30 },
  { id: 'dharani', r: 253, h: 30 },
  { id: 'charm', r: 191, h: 34 },
  { id: 'seed', r: 136, h: 22 },
];

export interface Slot {
  /** 고리 번호 0(바깥)…4 */
  ri: number;
  ring: RingId;
  /** 칸 번호 */
  i: number;
  /** 각도(도) — 12시에서 시계방향 */
  a: number;
  r: number;
  w: number;
  h: number;
  /** 가림(REDACTED) 자리인가 — 결측·실명 자리 */
  red: boolean;
  group: GlyphGroup | null;
}

/**
 * 결정적 배치 — 임의값 0. 목업의 규칙을 그대로 옮긴다.
 *   n = floor(둘레 / (글자높이 × 0.78))
 *   군 = list[(i×7 + ri) % list.length]
 *   가림 = donor 6칸마다(i%6===2) · vow 11칸마다(i%11===5)
 */
export function buildSlots(set: ClockGlyphSet): Slot[] {
  const slots: Slot[] = [];
  RING_SPEC.forEach((spec, ri) => {
    const ids = set.rings[spec.id] || [];
    const list = ids.map((id) => set.groups[id]);
    if (!list.length) return;
    const n = Math.floor((2 * Math.PI * spec.r) / (spec.h * 0.78));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 360;
      const g = list[(i * 7 + ri) % list.length];
      const red =
        (spec.id === 'donor' && i % 6 === 2) || (spec.id === 'vow' && i % 11 === 5);
      slots.push({
        ri,
        ring: spec.id,
        i,
        a,
        r: spec.r,
        w: spec.h * g.aspect,
        h: spec.h,
        red,
        group: red ? null : g,
      });
    }
  });
  return slots;
}
