import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildSlots, loadClockGlyphs, type ClockGlyphSet, type Slot } from '../DharaniClock/atlas';
import { BEATS, BEATS_PER_GAK, BEAT_SEC, beatAt, gakAngle, pad4, readingAngle } from '../DharaniClock/beat';
import { CREAM, INK_BAND, SDF_EDGE, VERM } from '../DharaniClock/glyphRenderer';
import './DharaniClock3D.css';

// ════════════════════════════════════════════════════════════════════════
// DharaniClock3D — 陀羅尼 時計의 3차원 판(2026-08-30, 사용자 "비주얼만 · 컨셉에 맞게 · 3차원으로").
//   개념(설계 v1 §0-c~e): 봉안(奉安)된 사이트. 복장 속에 말려 있던 다라니가 검정 무대 위에 펼쳐진다.
//   · 2D 시계의 다섯 고리(donor·vow·dharani·charm·seed)를 **깊이가 다른 층**으로 세운다(바깥일수록 뒤 = 얕은 원뿔).
//   · 글자는 서체가 아니라 실제 먹 조각(WG-018 SDF 아틀라스). 셰이더 규칙은 glyphRenderer.ts 그대로 이식.
//   · 원반은 아주 느리게 자전(한 각 20박 = 190 s 에 1주)하고 ±12° 안에서 기울며 호흡한다. 마우스 시차 ±3°.
//   · 讀誦 바늘(주서)은 박(9.508 s)마다 한 눈금 스텝(300 ms), 角 바늘(먹)은 20박에 한 각. 중심 종자자 9자 순환.
//   · 렌더러 = WebGL2(three r158). 공개 홈이라 폭넓은 브라우저를 우선 — WebGPU/TSL 은 r158 에서 미성숙.
//   · reduced-motion = 정지 프레임. 모바일 = 시차 off · dpr ≤ 1.5 · 30fps 상한. WebGL 불가 → 2D 시계 폴백(Home 에서).
// ════════════════════════════════════════════════════════════════════════

const RING_DEPTH = 62;      // 고리 한 겹당 뒤로 물러나는 깊이
const ROT_SEC = BEAT_SEC * BEATS_PER_GAK; // 자전 1주 = 한 각
const STEP_MS = 300;
const SEED_H = 190;
const BG = 0x0b0b0e;
const REDACT = 0x151519;

const VS = /* glsl */ `
in float aGate; in float aVerm; in float aAlpha;
out vec2 vUv; out float vGate; out float vVerm; out float vAlpha;
void main() {
  vUv = uv; vGate = aGate; vVerm = aVerm; vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// glyphRenderer.ts FS(다크)와 같은 규칙. uAlphaMul = 종자자 크로스페이드용.
const FS = /* glsl */ `
precision highp float;
in vec2 vUv; in float vGate; in float vVerm; in float vAlpha;
uniform sampler2D uAtlas; uniform vec3 uInk; uniform vec3 uVerm; uniform vec2 uBand; uniform float uEdge; uniform float uAlphaMul;
out vec4 o;
void main() {
  vec2 t = texture(uAtlas, vUv).rg;
  float d = t.r; float dens = t.g;
  float w = clamp(fwidth(d) * 0.75, 0.002, 0.25);
  float paper = smoothstep(vGate * 0.5, vGate, dens);
  float a = smoothstep(uEdge - w, uEdge + w, d) * paper;
  vec3 rgb;
  if (vVerm > 0.5) rgb = uVerm * 1.20 * (0.70 + dens * 0.30);
  else rgb = uInk * mix(uBand.x, uBand.y, clamp(dens, 0.0, 1.0));
  float aa = a * vAlpha * uAlphaMul;
  o = vec4(rgb * aa, aa);
}`;

function glyphMaterial(atlas: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VS,
    fragmentShader: FS,
    uniforms: {
      uAtlas: { value: atlas },
      uInk: { value: new THREE.Vector3(...CREAM) },
      uVerm: { value: new THREE.Vector3(...VERM) },
      uBand: { value: new THREE.Vector2(INK_BAND[0], INK_BAND[1]) },
      uEdge: { value: SDF_EDGE },
      uAlphaMul: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}

/** 12시 기준 시계방향 각도(도) → 원반 평면 좌표. y 는 위가 + */
const polar = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a) * r, Math.cos(a) * r];
};

/** 고리 글자 전부를 한 지오메트리로. 접선 방향으로 서고, 하반부는 반전해 항상 읽힌다(2D 규칙). */
function buildGlyphGeometry(slots: Slot[]): { geo: THREE.BufferGeometry; redact: THREE.BufferGeometry } {
  const pos: number[] = [], uv: number[] = [], gate: number[] = [], verm: number[] = [], alpha: number[] = [], idx: number[] = [];
  const rpos: number[] = [], ridx: number[] = [];
  let v = 0, rv = 0;
  slots.forEach((s) => {
    const [cx, cy] = polar(s.r, s.a);
    const z = -s.ri * RING_DEPTH;
    const lower = s.a > 90 && s.a < 270;
    // 접선 방향: 각도 a 에서 접선은 a+90°. 하반부는 180° 더 돌려 글자가 바로 선다.
    const rot = ((-s.a + (lower ? 180 : 0)) * Math.PI) / 180;
    const c = Math.cos(rot), sn = Math.sin(rot);
    const hw = s.w / 2, hh = s.h / 2;
    const corners: [number, number][] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    if (s.red || !s.group) {
      corners.forEach(([x, y]) => rpos.push(cx + x * c - y * sn, cy + x * sn + y * c, z));
      ridx.push(rv, rv + 1, rv + 2, rv, rv + 2, rv + 3);
      rv += 4;
      return;
    }
    const g = s.group;
    const [u0, v0, u1, v1] = g.uv;
    // 아틀라스 v 는 위가 0 — three 텍스처는 flipY 로 뒤집으므로 1-v
    const uvs: [number, number][] = [[u0, 1 - v1], [u1, 1 - v1], [u1, 1 - v0], [u0, 1 - v0]];
    corners.forEach(([x, y], k) => {
      pos.push(cx + x * c - y * sn, cy + x * sn + y * c, z);
      uv.push(uvs[k][0], uvs[k][1]);
      gate.push(g.densGate);
      verm.push(g.vermilion ? 1 : 0);
      // 뒤 고리일수록 아주 조금 옅게(깊이감) — 임의 장식이 아니라 대기 원근
      alpha.push(1 - s.ri * 0.06);
    });
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    v += 4;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aGate', new THREE.Float32BufferAttribute(gate, 1));
  geo.setAttribute('aVerm', new THREE.Float32BufferAttribute(verm, 1));
  geo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alpha, 1));
  geo.setIndex(idx);
  const redact = new THREE.BufferGeometry();
  redact.setAttribute('position', new THREE.Float32BufferAttribute(rpos, 3));
  redact.setIndex(ridx);
  return { geo, redact };
}

/** 종자자 한 장(중심) — h 높이, centerOffset 되밀기 */
function seedGeometry(set: ClockGlyphSet, seedId: number): THREE.BufferGeometry {
  const g = set.groups[seedId];
  const h = SEED_H, w = h * g.aspect;
  const [ox, oy] = g.centerOffset ?? [0, 0];
  const dx = -ox * w, dy = oy * h;
  const [u0, v0, u1, v1] = g.uv;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2 + dx, -h / 2 + dy, 2, w / 2 + dx, -h / 2 + dy, 2, w / 2 + dx, h / 2 + dy, 2, -w / 2 + dx, h / 2 + dy, 2], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([u0, 1 - v1, u1, 1 - v1, u1, 1 - v0, u0, 1 - v0], 2));
  geo.setAttribute('aGate', new THREE.Float32BufferAttribute([g.densGate, g.densGate, g.densGate, g.densGate], 1));
  geo.setAttribute('aVerm', new THREE.Float32BufferAttribute([0, 0, 0, 0], 1));
  geo.setAttribute('aAlpha', new THREE.Float32BufferAttribute([1, 1, 1, 1], 1));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  return geo;
}

/** 3,029 눈금 + 대강 굵게 — 라인 세그먼트 */
function tickGeometry(): THREE.BufferGeometry {
  const pts: number[] = [];
  const R = 432;
  for (let i = 0; i < BEATS; i++) {
    const deg = (i / BEATS) * 360;
    const major = i % BEATS_PER_GAK === 0;
    const len = major ? 18 : i % 5 === 0 ? 8 : 4;
    const [x0, y0] = polar(R, deg);
    const [x1, y1] = polar(R + len, deg);
    pts.push(x0, y0, 0, x1, y1, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}

function ringLine(r: number, z: number, n = 256): THREE.BufferGeometry {
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const [x, y] = polar(r, (i / n) * 360);
    pts.push(x, y, z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return geo;
}

function needle(len: number, width: number, color: number, z: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, len);
  geo.translate(0, len / 2 - 20, z); // 중심에서 20 뒤로 빼 꼬리를 남긴다(2D 바늘 규칙)
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
  return new THREE.Mesh(geo, mat);
}

export interface DharaniClock3DProps {
  /** 검증용 시각 오버라이드 */
  now?: () => Date;
  onFallback?: () => void;
}

export function webgl2Available(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

const DharaniClock3D: React.FC<DharaniClock3DProps> = ({ now, onFallback }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [beat, setBeat] = useState(() => beatAt((now ?? (() => new Date()))()));
  const [ready, setReady] = useState(false);
  const nowRef = useRef(now);
  nowRef.current = now;

  // 讀誦 카운터(HTML) — 500 ms 마다 박 확인
  useEffect(() => {
    const t = window.setInterval(() => setBeat(beatAt((nowRef.current ?? (() => new Date()))())), 500);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const host = hostRef.current, canvas = canvasRef.current;
    if (!host || !canvas) return;
    if (!webgl2Available()) {
      onFallback?.();
      return;
    }
    let disposed = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.innerWidth < 768;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    renderer.setClearColor(BG, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 10, 6000);
    const disc = new THREE.Group();
    scene.add(disc);

    const stat = { frames: 0, ms: 0, last: 0, draws: 0, tris: 0 };
    const state = { theta: 0, tilt: -0.34, px: 0, py: 0, tx: 0, ty: 0, readDeg: 0, readFrom: 0, readT0: 0, gakDeg: 0, gakFrom: 0, gakT0: 0, seedCur: 0, seedPrev: 0, seedT0: 0, lastIndex: -1 };
    let raf = 0;
    let set: ClockGlyphSet | null = null;
    let seedMat: THREE.ShaderMaterial | null = null, seedPrevMat: THREE.ShaderMaterial | null = null;
    let seedMesh: THREE.Mesh | null = null, seedPrevMesh: THREE.Mesh | null = null;
    let seedIds: number[] = [];
    const disposables: { dispose(): void }[] = [];

    const fit = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // 원반(반지름 470 + 눈금)이 짧은 변의 88% 에 들어오게 카메라 거리를 잡는다
      const halfVisible = 540;
      const vFov = (camera.fov * Math.PI) / 180;
      const distH = halfVisible / Math.tan(vFov / 2);
      const distW = halfVisible / (Math.tan(vFov / 2) * camera.aspect);
      camera.position.z = Math.max(distH, distW) * (mobile ? 1.0 : 0.92);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    fit();

    // 눈금·고리선(먹, 옅게)
    const tickMat = new THREE.LineBasicMaterial({ color: 0xdcddd3, transparent: true, opacity: 0.28 });
    const ticks = new THREE.LineSegments(tickGeometry(), tickMat);
    disc.add(ticks);
    disposables.push(ticks.geometry, tickMat);
    const ringMat = new THREE.LineBasicMaterial({ color: 0xdcddd3, transparent: true, opacity: 0.10 });
    [[380, 0], [316, 1], [253, 2], [191, 3], [136, 4]].forEach(([r, ri]) => {
      const l = new THREE.LineLoop(ringLine(r + 22, -ri * RING_DEPTH), ringMat);
      disc.add(l);
      disposables.push(l.geometry);
    });
    disposables.push(ringMat);
    // 중심 지(紙) 바탕 — 검정 무대 위 아주 옅은 원
    const paper = new THREE.Mesh(new THREE.CircleGeometry(112, 96), new THREE.MeshBasicMaterial({ color: 0x141418 }));
    paper.position.z = 1;
    disc.add(paper);
    disposables.push(paper.geometry, paper.material as THREE.Material);
    // 바늘
    const readNeedle = needle(418, 2.2, 0xbe3c28, 6);
    const gakNeedle = needle(300, 1.4, 0xdcddd3, 5);
    disc.add(readNeedle, gakNeedle);
    disposables.push(readNeedle.geometry, readNeedle.material as THREE.Material, gakNeedle.geometry, gakNeedle.material as THREE.Material);
    const pin = new THREE.Mesh(new THREE.CircleGeometry(4, 24), new THREE.MeshBasicMaterial({ color: 0xbe3c28 }));
    pin.position.z = 7;
    disc.add(pin);
    disposables.push(pin.geometry, pin.material as THREE.Material);

    // 글자 고리(아틀라스)
    loadClockGlyphs().then((s) => {
      if (disposed) return;
      set = s;
      const tex = new THREE.Texture(s.image);
      tex.needsUpdate = true;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.colorSpace = THREE.NoColorSpace;
      disposables.push(tex);
      const slots = buildSlots(s);
      const { geo, redact } = buildGlyphGeometry(slots);
      const mat = glyphMaterial(tex);
      const glyphs = new THREE.Mesh(geo, mat);
      disc.add(glyphs);
      disposables.push(geo, mat);
      const rmat = new THREE.MeshBasicMaterial({ color: REDACT });
      const rmesh = new THREE.Mesh(redact, rmat);
      disc.add(rmesh);
      disposables.push(redact, rmat);
      // 종자자 두 장(크로스페이드)
      seedIds = s.rings.seed || [];
      seedMat = glyphMaterial(tex);
      seedPrevMat = glyphMaterial(tex);
      disposables.push(seedMat, seedPrevMat);
      const b0 = beatAt((nowRef.current ?? (() => new Date()))());
      state.seedCur = b0.index % 9;
      state.seedPrev = state.seedCur;
      seedMesh = new THREE.Mesh(seedGeometry(s, seedIds[state.seedCur % seedIds.length]), seedMat);
      seedPrevMesh = new THREE.Mesh(seedGeometry(s, seedIds[state.seedPrev % seedIds.length]), seedPrevMat);
      seedPrevMat.uniforms.uAlphaMul.value = 0;
      disc.add(seedMesh, seedPrevMesh);
      setReady(true);
      if (reduced) frame(performance.now());
    });

    const onMove = (e: PointerEvent) => {
      if (mobile) return;
      const r = host.getBoundingClientRect();
      state.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      state.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    host.addEventListener('pointermove', onMove);

    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const swapSeed = (nextIdx: number) => {
      if (!set || !seedMesh || !seedPrevMesh) return;
      state.seedPrev = state.seedCur;
      state.seedCur = nextIdx % 9;
      seedPrevMesh.geometry.dispose();
      seedPrevMesh.geometry = seedGeometry(set, seedIds[state.seedPrev % seedIds.length]);
      seedMesh.geometry.dispose();
      seedMesh.geometry = seedGeometry(set, seedIds[state.seedCur % seedIds.length]);
    };

    const frame = (t: number) => {
      if (disposed) return;
      const nowD = (nowRef.current ?? (() => new Date()))();
      const b = beatAt(nowD);
      // 박이 바뀌면 바늘 스텝·종자자 교체
      if (b.index !== state.lastIndex) {
        state.readFrom = state.lastIndex < 0 ? readingAngle(b.index) : state.readDeg;
        state.readT0 = t;
        state.gakFrom = state.lastIndex < 0 ? gakAngle(b.index) : state.gakDeg;
        state.gakT0 = t;
        if (state.lastIndex >= 0) {
          swapSeed(b.index);
          state.seedT0 = t;
        }
        state.lastIndex = b.index;
      }
      const targetRead = readingAngle(b.index);
      const targetGak = gakAngle(b.index);
      const kR = Math.min(1, (t - state.readT0) / STEP_MS);
      const kG = Math.min(1, (t - state.gakT0) / STEP_MS);
      // 각도는 12시 기준 시계방향(도) — three z회전은 반시계이므로 부호 반전
      state.readDeg = state.readFrom + (targetRead - state.readFrom) * ease(kR);
      state.gakDeg = state.gakFrom + (targetGak - state.gakFrom) * ease(kG);
      readNeedle.rotation.z = (-state.readDeg * Math.PI) / 180;
      gakNeedle.rotation.z = (-state.gakDeg * Math.PI) / 180;
      if (seedMat && seedPrevMat) {
        const kS = Math.min(1, (t - state.seedT0) / STEP_MS);
        seedMat.uniforms.uAlphaMul.value = ease(kS);
        seedPrevMat.uniforms.uAlphaMul.value = 1 - ease(kS);
      }
      // 원반: 느린 자전(한 각에 1주) + 기울기 호흡(±12°) + 시차
      const sec = b.sec;
      const spin = reduced ? 0 : ((sec % ROT_SEC) / ROT_SEC) * Math.PI * 2;
      const breathe = reduced ? 0 : Math.sin(sec / 23) * (12 * Math.PI) / 180;
      state.px += (state.tx - state.px) * 0.04;
      state.py += (state.ty - state.py) * 0.04;
      disc.rotation.set(state.tilt + breathe * 0.6 + state.py * 0.05, state.px * 0.05 + breathe * 0.35, spin);
      camera.position.x = state.px * 40;
      camera.position.y = -state.py * 30;
      camera.lookAt(0, 0, -RING_DEPTH * 2);
      renderer.render(scene, camera);
      stat.frames += 1;
      if (stat.last) stat.ms += t - stat.last;
      stat.last = t;
      stat.draws = renderer.info.render.calls;
      stat.tris = renderer.info.render.triangles;
      if (!reduced) raf = mobile ? window.setTimeout(() => (raf = requestAnimationFrame(frame)), 16) as unknown as number : requestAnimationFrame(frame);
    };
    if (!reduced) raf = requestAnimationFrame(frame);

    // 검증 손잡이(개발)
    if (process.env.NODE_ENV !== 'production') {
      (window as any).__ntHero = { renderer, scene, camera, disc, stat, state, frameOnce: () => frame(performance.now()) };
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(raf);
      ro.disconnect();
      host.removeEventListener('pointermove', onMove);
      disposables.forEach((d) => d.dispose());
      if (seedMesh) seedMesh.geometry.dispose();
      if (seedPrevMesh) seedPrevMesh.geometry.dispose();
      renderer.dispose();
      if (process.env.NODE_ENV !== 'production') (window as any).__ntHero = null;
    };
  }, [onFallback]);

  return (
    <div className={`dclock3d${ready ? ' is-ready' : ''}`} ref={hostRef} aria-label="陀羅尼 時計 — 3차원 봉안 원반" role="img">
      <canvas ref={canvasRef} className="dclock3d__gl" />
      <div className="dclock3d__grain" aria-hidden />
      <div className="dclock3d__lab" aria-hidden>
        陀羅尼 時計 · 奉安 · <span>WEBGL2 · 5 RINGS · Z −{RING_DEPTH * 4}</span>
      </div>
      <div className="dclock3d__read" aria-hidden>
        <span className="k">讀誦</span> <b>{pad4(beat.index)}</b> <span>/ {BEATS}</span>
        <span className="sub">
          角 {String(beat.gak).padStart(3, '0')} · {String(beat.phase).padStart(2, '0')}/{BEATS_PER_GAK} · 種字 {(beat.index % 9) + 1}/9 · {BEAT_SEC.toFixed(3)} s
        </span>
      </div>
      <div className="dclock3d__cap" aria-hidden>
        사라진 것들이 돌아오는 방식
      </div>
    </div>
  );
};

export default DharaniClock3D;
