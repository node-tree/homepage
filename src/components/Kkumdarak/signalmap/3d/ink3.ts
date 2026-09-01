// @ts-nocheck
// ═══════════════════════════════════════════════════════════════════════
// ink3.ts — 3D 먹선 공용 헬퍼 (마을의 신호 · 작은 부여)
//   흰 면 + 먹선 엣지(조립도 문법) · 보일링 레지스트리 · 경로 추종.
//   도감 스파이크(models-catalog.html)에서 이식 — 도감이 룩 정본.
// ═══════════════════════════════════════════════════════════════════════
import * as THREE from 'three';

export const INK = 0x1f1e1c;
export const PAPER = 0xfcfbf9;
export const GRAY = 0x8c8a82;
// LED 팔레트 — 무채색 마을에서 색을 갖는 건 LED뿐(여러 색)
export const LED_COLORS = [0xfe5000, 0xe2402f, 0xf5b52e, 0x3f9b4f, 0x2f6fe4];

export const matWhite = new THREE.MeshBasicMaterial({ color: PAPER, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
export const matInk = new THREE.MeshBasicMaterial({ color: INK, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
export const inkLine = new THREE.LineBasicMaterial({ color: INK });
export const grayLine = new THREE.LineBasicMaterial({ color: GRAY });

// 보일링 레지스트리 — 씬 빌드 전 reset, 루프에서 boilTick
let boilers = [];
export const resetBoilers = () => { boilers = []; };
export const boilTick = (amp = 0.045) => {
  for (const { line, base } of boilers) {
    const a = line.geometry.attributes.position;
    for (let i = 0; i < a.array.length; i++) a.array[i] = base[i] + (Math.random() - 0.5) * amp;
    a.needsUpdate = true;
  }
};
export const boilerCount = () => boilers.length;

export function inked(geo, opts = {}) {
  const g = new THREE.Group();
  let mat = matWhite;
  if (opts.fill === 'ink') mat = matInk;
  else if (typeof opts.fill === 'number')
    mat = new THREE.MeshBasicMaterial({ color: opts.fill, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const mesh = new THREE.Mesh(geo, mat);
  g.add(mesh);
  const edges = new THREE.EdgesGeometry(geo, opts.thresh ?? 12);
  const line = new THREE.LineSegments(edges, inkLine);
  boilers.push({ line, base: edges.attributes.position.array.slice() });
  g.add(line);
  g.userData.mesh = mesh;
  return g;
}
export const box = (w, h, d, o) => inked(new THREE.BoxGeometry(w, h, d), o);
export const cyl = (rt, rb, h, seg, o) => inked(new THREE.CylinderGeometry(rt, rb, h, seg), o);
export const ico = (r, o) => inked(new THREE.IcosahedronGeometry(r, 0), { thresh: 1, ...o });
export const at = (obj, x, y, z, ry = 0) => { obj.position.set(x, y, z); obj.rotation.y = ry; return obj; };
export function prismGeo(len, w, h) {
  const L = len / 2, W = w / 2;
  const v = [-L, 0, -W, -L, 0, W, -L, h, 0, L, 0, -W, L, 0, W, L, h, 0];
  const idx = [0, 1, 2, 3, 5, 4, 0, 2, 5, 0, 5, 3, 1, 4, 5, 1, 5, 2, 0, 3, 4, 0, 4, 1];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
export const osc = (t, period, amp, phase = 0) => Math.sin((t / period + phase) * Math.PI * 2) * amp;

// 경로 추종(도로·강) — XZ 평면 폴리라인
export function buildTrack(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, total: cum[cum.length - 1] || 1 };
}
export function trackAt(tr, dist) {
  const d = ((dist % tr.total) + tr.total) % tr.total;
  let i = 1;
  while (i < tr.cum.length - 1 && tr.cum[i] < d) i++;
  const seg = tr.cum[i] - tr.cum[i - 1] || 1;
  const t = (d - tr.cum[i - 1]) / seg;
  const [x0, z0] = tr.pts[i - 1];
  const [x1, z1] = tr.pts[i];
  return { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, ang: Math.atan2(-(z1 - z0), x1 - x0) };
}
