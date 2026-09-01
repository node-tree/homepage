// ═══════════════════════════════════════════════════════════════════════
// wobble.ts — 손선 생성기 (마을의 신호 웹지도)
//   피그마 설계 목업을 그린 제너레이터의 런타임 이식판.
//   직선·정원을 절대 그리지 않는다 — 모든 선은 시드 PRNG 지터 Q커브.
//   보일링: 같은 폴리라인을 시드만 바꿔 3벌 만들어 10fps로 순환(잉크가 숨 쉰다).
// ═══════════════════════════════════════════════════════════════════════
export type Pt = [number, number];

/** mulberry32 — 시드 고정 PRNG (변형이 재현 가능해야 보일 프레임이 안정된다) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const jt = (rnd: () => number, a: number) => (rnd() - 0.5) * 2 * a;

/** 폴리라인 → 흔들리는 Q커브 Path2D. seg≈48px 간격으로 수직 지터. */
export function wobPath(pts: Pt[], rnd: () => number, amp = 2.2, seg = 48): Path2D {
  const p = new Path2D();
  p.moveTo(pts[0][0] + jt(rnd, 1.4), pts[0][1] + jt(rnd, 1.4));
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const n = Math.max(1, Math.round(len / seg));
    const px = -(y1 - y0) / len;
    const py = (x1 - x0) / len;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const tm = t - 0.5 / n;
      const o = jt(rnd, amp);
      p.quadraticCurveTo(
        x0 + (x1 - x0) * tm + px * o, y0 + (y1 - y0) * tm + py * o,
        x0 + (x1 - x0) * t + jt(rnd, 1), y0 + (y1 - y0) * t + jt(rnd, 1),
      );
    }
  }
  return p;
}

/** 닫힌 사각 손선 — 마지막 획이 시작점을 살짝 지나친다(overshoot). */
export function wobRect(x: number, y: number, w: number, h: number, rnd: () => number, amp = 2.2): Path2D {
  return wobPath([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x + 1.5, y - 2]], rnd, amp);
}

/** 유기 블롭(원·연못·수풀) — 반지름 지터 + 중점 스무딩, 닫힘. */
export function wobBlob(cx: number, cy: number, rx: number, ry: number, rnd: () => number, irr = 0.07): Path2D {
  const n = 10;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 1 + jt(rnd, irr);
    pts.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
  }
  const mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const p = new Path2D();
  const m0 = mid(pts[n - 1], pts[0]);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const v = pts[i];
    const m = mid(v, pts[(i + 1) % n]);
    p.quadraticCurveTo(v[0], v[1], m[0], m[1]);
  }
  p.closePath();
  return p;
}

/** 폴리라인 경로 추종 — 누적 길이표 기반 위치·접선 보간 (drive·walk·pulse 공용) */
export interface PathTrack { pts: Pt[]; cum: number[]; total: number; }
export function buildTrack(pts: Pt[]): PathTrack {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, total: cum[cum.length - 1] || 1 };
}
export function trackAt(tr: PathTrack, dist: number): { x: number; y: number; ang: number } {
  const d = Math.max(0, Math.min(tr.total, dist));
  let i = 1;
  while (i < tr.cum.length - 1 && tr.cum[i] < d) i++;
  const seg = tr.cum[i] - tr.cum[i - 1] || 1;
  const t = (d - tr.cum[i - 1]) / seg;
  const [x0, y0] = tr.pts[i - 1];
  const [x1, y1] = tr.pts[i];
  return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, ang: Math.atan2(y1 - y0, x1 - x0) };
}
