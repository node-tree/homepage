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
const boilerSet = () => new Set(boilers.map(b => b.line));
const dropBoilers = set => { boilers = boilers.filter(b => !set.has(b.line)); };
const addBoiler = line => { boilers.push({ line, base: line.geometry.attributes.position.array.slice() }); };

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

// ═══════════════════════════════════════════════════════════════════════
// 정적 지오메트리 병합 — 드로우콜 절감(같은 그림, 적은 호출)
//   '정적'은 코드 추측이 아니라 실측이다: ticks를 여러 t로 돌려 world 행렬·머티리얼 색·
//   visible이 한 번이라도 변한 오브젝트를 동적으로 판정하고, 나머지만 묶는다.
//   프로브가 남긴 포즈·색은 원상복구한다(reduced-motion 화면이 달라지면 안 된다).
//   원본은 씬에 남기되 visible=false — placed 기반 감사·디버그 리그가 그대로 동작한다.
//   먹선(EdgesGeometry LineSegments)도 병합하고, 보일링은 원본에서 떼어 병합본에 재등록한다.
// ═══════════════════════════════════════════════════════════════════════
const MERGE_T = [0, 137, 411, 900, 1733, 2600, 3700, 5300, 7900, 11300, 15100, 21000, 33000];

// 병합 가능한 머티리얼만 서명을 돌려준다(파선·투명·텍스처는 제외 — 위상/정렬이 깨진다)
const mergeKey = m => {
  if (!m || m.isLineDashedMaterial || m.transparent || m.opacity < 1) return null;
  if (!(m.isMeshBasicMaterial || m.isLineBasicMaterial)) return null;
  if (m.map || m.vertexColors || m.alphaMap) return null;
  return [m.type, m.color.getHexString(), m.side, m.depthTest, m.depthWrite, m.blending,
    m.polygonOffset, m.polygonOffsetFactor, m.polygonOffsetUnits, m.toneMapped].join('|');
};

//   keep = 병합 금지 오브젝트(자손 포함). ticks 밖에서 색·포즈가 바뀌는 것들 — 신호 전구는
//   도시 루프(SignalMap3D)가 blink 리듬으로 색을 갈아끼우므로 프로브가 볼 수 없다. 반드시 제외.
export function mergeStatics(scene, ticks, keep) {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : 0);
  scene.updateMatrixWorld(true);
  const objs = [];
  scene.traverse(o => { if (o.isMesh || o.isLine || o.isLineSegments || o.isLineLoop || o.isPoints) objs.push(o); });

  // ① 원상복구 스냅샷(트랜스폼 + 머티리얼 색)
  const nodes = [];
  scene.traverse(o => nodes.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone(), o.visible]));
  const mats = new Map();
  for (const o of objs) if (o.material && o.material.color && !mats.has(o.material)) mats.set(o.material, o.material.color.getHex());

  // ② 동적 판정 — ticks를 샘플 t로 돌려 변화를 관찰
  const sig = () => objs.map(o => {
    const e = o.matrixWorld.elements; let s = '';
    for (let i = 0; i < 16; i++) s += Math.round(e[i] * 1e4) + ',';
    return s + (o.material && o.material.color ? o.material.color.getHex() : 0) + (o.visible ? 1 : 0);
  });
  const base = sig();
  const dyn = new Uint8Array(objs.length);
  for (const t of MERGE_T) {
    for (const fn of ticks) { try { fn(t); } catch (e) { /* 프로브 실패는 보수적으로 무시 */ } }
    scene.updateMatrixWorld(true);
    const s = sig();
    for (let i = 0; i < objs.length; i++) if (s[i] !== base[i]) dyn[i] = 1;
  }
  for (const [o, p, q, sc, v] of nodes) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(sc); o.visible = v; }
  for (const [m, hex] of mats) m.color.setHex(hex);
  scene.updateMatrixWorld(true);

  // ③ 버킷 수집 — (타입 × 머티리얼 서명 × 보일링 여부)
  const boilSet = boilerSet();
  const banned = new Set();
  if (keep) for (const k of keep) k && k.traverse(o => banned.add(o));
  const buckets = new Map();
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    if (dyn[i] || banned.has(o) || o.isPoints || !o.geometry || !o.geometry.attributes.position) continue;
    const k = mergeKey(o.material);
    if (!k) continue;
    const kind = o.isMesh ? 'mesh' : 'line';
    const boil = kind === 'line' && boilSet.has(o);
    const key = `${kind}|${k}|${boil ? 'boil' : 'flat'}`;
    let rec = buckets.get(key);
    if (!rec) buckets.set(key, rec = { kind, boil, mat: o.material, src: [], arr: [] });
    rec.src.push(o);
  }

  // ④ world 좌표로 구워 한 덩어리로
  const v = new THREE.Vector3();
  const bake = (rec, o) => {
    const g = o.geometry, pos = g.attributes.position, idx = g.index, mw = o.matrixWorld;
    const n = idx ? idx.count : pos.count;
    const at3 = i => v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(mw);
    if (rec.kind === 'mesh') {
      for (let i = 0; i < n; i++) { at3(i); rec.arr.push(v.x, v.y, v.z); }
    } else if (o.isLineSegments) {
      for (let i = 0; i + 1 < n; i += 2) { at3(i); rec.arr.push(v.x, v.y, v.z); at3(i + 1); rec.arr.push(v.x, v.y, v.z); }
    } else {                                        // Line(스트립) · LineLoop → 세그먼트로 변환
      const cnt = o.isLineLoop ? n : n - 1;
      for (let i = 0; i < cnt; i++) { at3(i); rec.arr.push(v.x, v.y, v.z); at3((i + 1) % n); rec.arr.push(v.x, v.y, v.z); }
    }
  };
  const merged = [], dropped = new Set();
  let saved = 0;
  for (const [key, rec] of buckets) {
    if (rec.src.length < 2) continue;               // 하나짜리는 병합 이득이 없다
    for (const o of rec.src) bake(rec, o);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(rec.arr, 3));
    const m = rec.kind === 'mesh' ? new THREE.Mesh(g, rec.mat) : new THREE.LineSegments(g, rec.mat);
    m.name = '__merged:' + key;
    m.matrixAutoUpdate = false;
    m.frustumCulled = false;                        // 도시 전체 크기 — 컬링 이득 없음
    scene.add(m);
    for (const o of rec.src) { o.visible = false; if (rec.boil) dropped.add(o); }
    if (rec.boil) addBoiler(m);                     // 보일링 승계 — 먹선 지터가 끊기지 않게
    saved += rec.src.length - 1;
    merged.push({ key, n: rec.src.length, verts: rec.arr.length / 3 });
  }
  if (dropped.size) dropBoilers(dropped);
  return { merged, saved, objs: objs.length, dyn: dyn.reduce((a, b) => a + b, 0),
    ms: Math.round(((typeof performance !== 'undefined' ? performance.now() : 0) - t0)) };
}
