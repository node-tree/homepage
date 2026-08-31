import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildSlots, loadClockGlyphs, type ClockGlyphSet, type GlyphGroup, type Slot } from '../DharaniClock/atlas';
import { BEATS, BEATS_PER_GAK, BEAT_SEC, beatAt, gakAngle, pad4, readingAngle } from '../DharaniClock/beat';
import { CREAM, INK_BAND, INK_DARKROOM, SDF_EDGE, VERM } from '../DharaniClock/glyphRenderer';
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

// 고리 깊이 층 = 0 (2026-08-30 사용자 "중앙이 안 맞아": 층이 다르면 기울였을 때 바늘 축과 바깥 고리의 동심이 깨진다).
// 3D 감은 원반 전체의 기울기·자전·원근으로만 낸다. 값을 올리면 얕은 원뿔로 돌아간다.
const RING_DEPTH = 0;
const ROT_SEC = BEAT_SEC * BEATS_PER_GAK; // 자전 1주 = 한 각
const STEP_MS = 300;
const SEED_H = 190;
/**
 * 상태 한 바퀴(초) — 시계(A) ⇄ 글리프 필드(B·R03) 양방향 천이 하나뿐이다.
 *   0…40 시계 · 40…50 흩어져 격자에 앉는다 · 50…70 필드 · 70…82 되말려 시계로 · 82…88 시계
 *   (스펙트로그램 C 는 2026-08-31 설계 정정으로 사이클에서 뺐다. 셰이더 경로는 남아 있고
 *    검수 때 ev.spec = 1 로만 켠다 — R07 은 질감 참고로만 쓴다.)
 */
const FIELD_CYCLE = 88;
/**
 * 조각마다 도착 시각을 어긋내는 폭(0…1). 크게 둘수록 스캔 전선이 좁아진다 —
 * 판이 한 번에 뒤집히지 않고, 전선이 지나간 자리부터 차례로 흩어져 앉는다.
 * 전선 폭 ≈ (1−STAGGER)/STAGGER 즉 판 너비의 약 22%.
 */
const STAGGER = 0.82;
/** a…b 구간을 0→1 로 부드럽게(스무스스텝). 획이 흘러가는 시간이지 컷이 아니다. */
const ramp = (x: number, a: number, b: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export type Theme3D = 'light' | 'dark';
/** 테마 팔레트 — 2D 시계(glyphRenderer.ts)와 같은 규칙: 라이트 = 흰 바탕 + 먹(농담→불투명도), 다크 = 검정 무대 + 크림(루마 밴드)
 *  다크 값은 〈이물〉 설계 D18(색·재질) 정본: 바탕 근흑 rgb(10,10,10)("검정은 빛이 없음" — 순흑 아님) ·
 *  먹 크림 rgb(220,221,211)=CREAM · 주서 10R rgb(190,60,40)=VERM. 가림칸·무채는 색기 없는 순회색으로
 *  둔다(이전 0x151519 는 푸른 기가 있었다 — 비적색 유채 0% 규칙). */
const PALETTE = {
  light: { bg: 0xfafaf9, ink: INK_DARKROOM, redact: 0xe6e6e1, paper: 0xf1f1ee, line: 0x0f0f1a, tickA: 0.14, ringA: 0, gakNeedle: 0x0f0f1a, uLight: 1 },
  dark: { bg: 0x0a0a0a, ink: CREAM, redact: 0x141414, paper: 0x141414, line: 0xdcddd3, tickA: 0.26, ringA: 0, gakNeedle: 0xdcddd3, uLight: 0 },
} as const;
/** 시각 중심 보정용 표본 고리: 앞(눈금 r432, z0)·뒤(donor r402, z −4층) */
const SAMPLE_RINGS: [number, number][] = [[432, 0], [402, -RING_DEPTH * 4]];
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

const VS = /* glsl */ `
in float aGate; in float aVerm; in float aAlpha; in float aRing; in float aAng;
// 상태 천이(2026-08-31, 〈이물〉 R03·R07): 같은 먹 조각이 세 배열 사이를 흘러간다.
//   aCorner = 회전 전 제 몸(±w/2, ±h/2) · aG = 격자/휠 자리(정규화, z=배율)
//   aS = 스펙트로그램 자리(정규화, z=세로배율, w=가로배율) · aBase = 시계 상태에서 존재하는가
in vec2 aCorner; in vec3 aG; in vec4 aS; in float aBase; in float aFieldA; in float aDelay;
uniform float uDepth; uniform float uStrikeAng; uniform float uStrike;
uniform float uGrid; uniform float uSpec; uniform float uScan; uniform float uStag;
uniform vec2 uFieldHalf; uniform float uWheelR; uniform float uPart;
out vec2 vUv; out float vGate; out float vVerm; out float vAlpha; out float vHit;

const float PI = 3.14159265;

void main() {
  vUv = uv; vGate = aGate; vVerm = aVerm;
  // ── 조각마다 제 시각에 움직인다: 스캔 전선이 제 자리(aDelay = 격자에서의 가로 자리)를
  //    지날 때 비로소 흩어져 날아간다. 그래서 「한 번에 뒤집힘」이 아니라 쓸려 가는 스캔이 된다.
  float s = clamp((uGrid - aDelay * uStag) / max(1e-3, 1.0 - uStag), 0.0, 1.0);
  float w = s * s * (3.0 - 2.0 * s);              // 안착은 부드럽게
  float spike = pow(sin(PI * s), 0.8) * uScan;    // 통과하는 순간만 1 — R07 의 사건 획

  // 시계 자리(원반 위) — 이벤트 층 깊이 포함
  vec3 p = position; p.z -= aRing * uDepth;
  // 輪(R03) 자리 — 원이 타원으로 눌리면 통이 아니다. 한 스칼라 반지름만 곱한다.
  // uPart = 화면 밀도 보정. 입자의 **화면상 크기**를 기기와 무관하게 맞춘다
  // (모바일은 같은 월드 크기가 1/2.5 로 보여 입자가 사라진다).
  vec3 pG = vec3(aG.xy * uWheelR + aCorner * (aG.z * uPart), 0.0);
  // 스펙트로그램(R07) 자리 — 상태가 아니라 **천이의 질감**(가로로 눌리고 세로로 늘어난 획)
  vec3 pS = vec3(aS.xy * uFieldHalf + aCorner * vec2(aS.w, aS.z), 0.0);

  // 경로: 원반 위 제자리 → (스캔에 쓸려 세로 사건 획) → 격자 칸.
  vec2 base = mix(p.xy, pG.xy, w);
  // 직선으로 끌려가지 않게 살짝 휘어 흐른다(획이 흘러가는 감각)
  vec2 d = pG.xy - p.xy;
  base += vec2(-d.y, d.x) * (sin(PI * s) * (aDelay - 0.5) * 0.14);
  // 스캔 전선이 지나는 순간: 그 자리에서 가로로 눌리고 세로로 늘어난다(R07 광대역 수직선).
  // 베드로 표시된 조각(aS.y 가 위쪽·가로 배율 큰 것)은 가로 그레인 띠로 눕는다.
  vec2 scanPos = vec2(base.x, aS.y * uFieldHalf.y) + aCorner * vec2(aS.w, aS.z);
  vec2 fin = mix(base, scanPos, spike * 0.85);
  p = vec3(fin, mix(p.z, 0.0, w));
  // 스펙트로그램 정지 상태(검수 전용 uSpec) — 사이클에서는 0 이다.
  p = mix(p, pS, uSpec);

  // 필드에서는 국소 대비 값으로(어둠이 지배한다). 덧댄 조각은 시계 상태에 없다(aBase=0).
  float vis = max(w, spike * 0.9);
  vAlpha = mix(aAlpha * aBase, aFieldA, max(vis, uSpec));
  // 스캔 스트라이크: 讀誦 바늘 근처(±14°) 글자가 한 순간 튄다(시계 상태에서만)
  float da = abs(mod(aAng - uStrikeAng + 540.0, 360.0) - 180.0);
  vHit = uStrike * (1.0 - smoothstep(4.0, 14.0, da)) * (1.0 - vis);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

// glyphRenderer.ts FS(다크)와 같은 규칙. uAlphaMul = 종자자 크로스페이드용.
const FS = /* glsl */ `
precision highp float;
in vec2 vUv; in float vGate; in float vVerm; in float vAlpha; in float vHit;
uniform sampler2D uAtlas; uniform vec3 uInk; uniform vec3 uVerm; uniform vec2 uBand; uniform float uEdge; uniform float uAlphaMul; uniform float uLight;
out vec4 o;
void main() {
  vec2 t = texture(uAtlas, vUv).rg;
  float d = t.r; float dens = t.g;
  float w = clamp(fwidth(d) * 0.75, 0.002, 0.25);
  float paper = smoothstep(vGate * 0.5, vGate, dens);
  float a = smoothstep(uEdge - w, uEdge + w, d) * paper;
  vec3 rgb; float aa = a;
  if (vVerm > 0.5) { rgb = uVerm * 1.20 * (0.70 + dens * 0.30); if (uLight > 0.5) aa *= (0.72 + dens * 0.28); }
  else if (uLight > 0.5) { rgb = uInk; aa *= (0.72 + dens * 0.28); }
  else rgb = uInk * mix(uBand.x, uBand.y, clamp(dens, 0.0, 1.0));
  aa *= vAlpha * uAlphaMul;
  // 스트라이크: 먹이 순간 반전(주서로) — 이케다식 하드 플래시
  rgb = mix(rgb, uVerm * 1.2, vHit);
  aa = min(1.0, aa * (1.0 + vHit * 0.8));
  o = vec4(rgb * aa, aa);
}`;

function glyphMaterial(atlas: THREE.Texture, pal: (typeof PALETTE)[Theme3D]): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VS,
    fragmentShader: FS,
    uniforms: {
      uAtlas: { value: atlas },
      uInk: { value: new THREE.Vector3(...pal.ink) },
      uLight: { value: pal.uLight },
      uVerm: { value: new THREE.Vector3(...VERM) },
      uBand: { value: new THREE.Vector2(INK_BAND[0], INK_BAND[1]) },
      uEdge: { value: SDF_EDGE },
      uAlphaMul: { value: 1 },
      uDepth: { value: 0 },
      uStrikeAng: { value: 0 },
      uStrike: { value: 0 },
      uGrid: { value: 0 },
      uSpec: { value: 0 },
      uScan: { value: 1 },
      uStag: { value: STAGGER },
      uFieldHalf: { value: new THREE.Vector2(800, 460) },
      uWheelR: { value: 460 },
      uPart: { value: 1 },
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

// ── 도달 상태(輪) 상수 — 〈이물〉 R03 상단 「輪(원통 축 시점 = 휠)」 ──
//   시계 글자는 360 남짓이라 그것만으로는 밀집 통이 되지 않는다. 시계 상태에서 면적 0·
//   알파 0 으로 접혀 있다가 휠에서만 펴지는 입자를 덧댄다(드로콜은 그대로 1).
const FIELD_EXTRA = 2400;
const FIELD_EXTRA_MOBILE = 1300;
const WHEEL_RINGS = 17;          // 덱 실측: 링 17
const WHEEL_R0 = 0.2;            // 안쪽 링 반지름(정규화)
const WHEEL_R1 = 0.99;           // 바깥 링
const SPEC_COLS = 48;
/** 결정적 난수 — 배치에 임의값을 두지 않는다(같은 판이 어디서나 같게 선다). */
const h1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

/** 링 슬롯 표 — 링마다 둘레에 비례해 자리를 나눈다(바깥 링이 자리가 많다). 총수마다 한 번만 짠다. */
let wheelCache: { list: { r: number; a: number; ring: number; slot: number; n: number }[]; total: number } | null = null;
function wheelSlots(total: number) {
  if (wheelCache && wheelCache.total === total) return wheelCache.list;
  const rs: number[] = [];
  let sum = 0;
  for (let i = 0; i < WHEEL_RINGS; i++) {
    const r = WHEEL_R0 + (i / (WHEEL_RINGS - 1)) * (WHEEL_R1 - WHEEL_R0);
    rs.push(r);
    sum += r;
  }
  const list: { r: number; a: number; ring: number; slot: number; n: number }[] = [];
  for (let i = 0; i < WHEEL_RINGS; i++) {
    const n = Math.max(12, Math.round((rs[i] / sum) * total));
    // 링마다 반 칸씩 어긋내 자리가 바큇살처럼 줄서지 않게(정간이 아니라 봉안이다)
    const off = (i % 2) * (Math.PI / n);
    for (let j = 0; j < n; j++) list.push({ r: rs[i], a: (j / n) * Math.PI * 2 + off, ring: i, slot: j, n });
  }
  wheelCache = { list, total };
  return list;
}

/**
 * 조각 하나의 도달 좌표. 輪 = 원통을 축에서 본 동심 링 휠(R03 상단).
 *   정규화 [-1,1] — 원이 타원으로 눌리지 않게 VS 에서 **한 스칼라 반지름**(uWheelR)을 곱한다.
 */
function fieldTarget(k: number, total: number, verm: boolean) {
  const list = wheelSlots(total);
  const s = list[k % list.length];
  // 입자 크기 — 개별로는 거의 점, 모여야 문자 결로 읽힌다(사용자 "아주 작게 파티클처럼")
  const gs = 0.26 + h1(k * 1.7) * 0.2;
  const rr = s.r + (h1(k * 4.9) - 0.5) * 0.014;   // 링 안에서 미세하게 흔들린다
  const aa = s.a + (h1(k * 6.1) - 0.5) * (Math.PI / s.n) * 0.5;
  let gx = Math.cos(aa) * rr;
  let gy = Math.sin(aa) * rr;
  if (verm) {
    // 주서는 흩지 않는다 — 두 링의 짧은 호(弧)에만 군집으로 앉는다(D18 「적색 ≤ 2.83%」)
    const c = k % 2;
    const n = Math.floor(k / 2);
    const ring = c ? 5 : 11;
    const r2 = WHEEL_R0 + (ring / (WHEEL_RINGS - 1)) * (WHEEL_R1 - WHEEL_R0);
    const a2 = (c ? 0.62 : 2.71) + (n % 26) * 0.021;
    gx = Math.cos(a2) * r2;
    gy = Math.sin(a2) * r2;
  }
  // 스캔 질감(R07) — 조각 전부가 사건이 되면 흰 덩어리가 된다. 셋으로 나눈다:
  //   ① 베드 12% = 저역 가로 그레인 띠 · ② 사건 획 34% = 광대역 수직선 · ③ 나머지는
  //   모양 그대로 지나간다(1.0 배율 = 변형 없음). 근흑이 지배해야 선이 선으로 읽힌다.
  const roll = h1(k * 2.7);
  const bed = verm || roll < 0.12;
  const event = !bed && roll < 0.46;
  let sx: number, sy: number, sScaleY: number, sScaleX: number;
  if (bed) {
    sx = -1 + h1(k * 9.1) * 2;
    sy = 0.62 + (h1(k * 4.4) - 0.5) * 0.18;
    sScaleY = 0.7 + h1(k * 6.2) * 0.5;
    sScaleX = 0.8 + h1(k * 8.8) * 0.6;
  } else if (event) {
    // 열(列) 밀도를 고르지 않게 — 어떤 사건은 두껍고 어떤 것은 한 획뿐이다
    const c = Math.floor(h1(k * 1.31) * SPEC_COLS);
    sx = -0.97 + ((c + 0.5) / SPEC_COLS) * 1.94 + (h1(k * 11.3) - 0.5) * 0.006;
    sy = -0.72 + h1(k * 3.7) * 1.24;
    sScaleY = 2.2 + h1(k * 5.9) * 3.4;
    sScaleX = 0.13;
  } else {
    // 쓸려 가되 몸은 그대로 — 제 격자 자리로 곧장 앉는다
    sx = gx;
    sy = gy;
    sScaleY = 1;
    sScaleX = 1;
  }
  // 국소 대비 — 대부분 어둡고 몇몇만 밝다(R03 「어둠 73%, 그 위에 빛」).
  // 게다가 링은 통째로 밝지 않다: 호(弧) 단위로 봉인(어둠)·개봉(빛)이 갈린다.
  const openArc = 0.5 + 0.5 * Math.sin(Math.atan2(gy, gx) * 3 + s.ring * 1.7);
  const fa = (0.2 + Math.pow(h1(k * 5.77), 1.5) * 0.95) * (0.22 + 0.95 * Math.pow(openArc, 1.5));
  // 스캔 전선이 이 조각을 지나는 시각 = 격자에서의 가로 자리(왼→오). 흩뿌린 지터로 선이
  // 자로 그은 듯 반듯해지지 않게 한다.
  const delay = Math.max(0, Math.min(1, (gx + 1) / 2 + (h1(k * 13.7) - 0.5) * 0.06));
  return { gx, gy, gs, sx, sy, sScaleY, sScaleX, fa, delay };
}

/** 고리 글자 전부를 한 지오메트리로. 접선 방향으로 서고, 하반부는 반전해 항상 읽힌다(2D 규칙). */
function buildGlyphGeometry(
  slots: Slot[],
  extraGroups: GlyphGroup[] = [],
  extraCount = FIELD_EXTRA,
): { geo: THREE.BufferGeometry; redact: THREE.BufferGeometry } {
  const pos: number[] = [], uv: number[] = [], gate: number[] = [], verm: number[] = [], alpha: number[] = [], idx: number[] = [], ring: number[] = [], ang: number[] = [];
  const corner: number[] = [], tg: number[] = [], ts: number[] = [], base: number[] = [], fieldA: number[] = [], delay: number[] = [];
  const rpos: number[] = [], ridx: number[] = [];
  let v = 0, rv = 0;
  // 필드 좌표는 「몇 번째 조각인가」로만 정해진다 — 고리 글자 + 덧댄 조각을 한 줄로 센다.
  const totalQuads = slots.filter((s) => !s.red && s.group).length + (extraGroups.length ? extraCount : 0);
  let k = 0;
  const pushField = (isVerm: boolean, hw: number, hh: number) => {
    const f = fieldTarget(k, totalQuads, isVerm);
    const cs: [number, number][] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    cs.forEach(([x, y]) => {
      corner.push(x, y);
      tg.push(f.gx, f.gy, f.gs);
      ts.push(f.sx, f.sy, f.sScaleY, f.sScaleX);
      fieldA.push(f.fa);
      delay.push(f.delay);
    });
    k += 1;
  };
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
    corners.forEach(([x, y], ci) => {
      pos.push(cx + x * c - y * sn, cy + x * sn + y * c, z);
      uv.push(uvs[ci][0], uvs[ci][1]);
      gate.push(g.densGate);
      verm.push(g.vermilion ? 1 : 0);
      // 뒤 고리일수록 아주 조금 옅게(깊이감) — 임의 장식이 아니라 대기 원근
      alpha.push(1 - s.ri * 0.06);
      ring.push(s.ri);
      ang.push(s.a);
      base.push(1);
    });
    pushField(!!g.vermilion, hw, hh);
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    v += 4;
  });
  // 덧댄 조각 — 시계 상태에서는 한 점으로 접혀 있고(면적 0·알파 0) 필드에서만 펴진다.
  if (extraGroups.length) {
    for (let e = 0; e < extraCount; e++) {
      const g = extraGroups[(e * 13 + 5) % extraGroups.length];
      const hh = 15 + h1(e * 2.3) * 13;
      const hw = hh * g.aspect;
      const [u0, v0, u1, v1] = g.uv;
      const uvs: [number, number][] = [[u0, 1 - v1], [u1, 1 - v1], [u1, 1 - v0], [u0, 1 - v0]];
      for (let ci = 0; ci < 4; ci++) {
        pos.push(0, 0, 0);
        uv.push(uvs[ci][0], uvs[ci][1]);
        gate.push(g.densGate);
        verm.push(g.vermilion ? 1 : 0);
        alpha.push(0);
        ring.push(0);
        ang.push(-999);
        base.push(0);
      }
      pushField(!!g.vermilion, hw, hh);
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      v += 4;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aGate', new THREE.Float32BufferAttribute(gate, 1));
  geo.setAttribute('aVerm', new THREE.Float32BufferAttribute(verm, 1));
  geo.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alpha, 1));
  geo.setAttribute('aRing', new THREE.Float32BufferAttribute(ring, 1));
  geo.setAttribute('aAng', new THREE.Float32BufferAttribute(ang, 1));
  geo.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2));
  geo.setAttribute('aG', new THREE.Float32BufferAttribute(tg, 3));
  geo.setAttribute('aS', new THREE.Float32BufferAttribute(ts, 4));
  geo.setAttribute('aBase', new THREE.Float32BufferAttribute(base, 1));
  geo.setAttribute('aFieldA', new THREE.Float32BufferAttribute(fieldA, 1));
  geo.setAttribute('aDelay', new THREE.Float32BufferAttribute(delay, 1));
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
  geo.setAttribute('aRing', new THREE.Float32BufferAttribute([0, 0, 0, 0], 1));
  geo.setAttribute('aAng', new THREE.Float32BufferAttribute([-999, -999, -999, -999], 1));
  // 종자자는 시계 상태의 것이다 — 필드로 갈 때 제자리에서 사라진다(aFieldA = 0).
  // ⚠ 이 속성들이 없으면 WebGL 기본값 0 이 들어와 aBase=0 → 중심 글자가 통째로 사라진다.
  geo.setAttribute('aCorner', new THREE.Float32BufferAttribute([-w / 2, -h / 2, w / 2, -h / 2, w / 2, h / 2, -w / 2, h / 2], 2));
  geo.setAttribute('aG', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geo.setAttribute('aS', new THREE.Float32BufferAttribute([0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1], 4));
  geo.setAttribute('aBase', new THREE.Float32BufferAttribute([1, 1, 1, 1], 1));
  geo.setAttribute('aFieldA', new THREE.Float32BufferAttribute([0, 0, 0, 0], 1));
  geo.setAttribute('aDelay', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0.5], 1));
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

export function ringLine(r: number, z: number, n = 256): THREE.BufferGeometry {
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
  theme?: Theme3D;
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

const DharaniClock3D: React.FC<DharaniClock3DProps> = ({ theme = 'light', now, onFallback }) => {
  const pal = PALETTE[theme];
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
    renderer.setClearColor(pal.bg, 1);
    const scene = new THREE.Scene();
    // fov 14 = 망원. 원근이 크면 기울인 원의 투영 타원 중심이 허브에서 벗어난다(1440 실측 −32px) → 거의 정사영에 가깝게.
    const camera = new THREE.PerspectiveCamera(9, 1, 10, 40000);
    // 원반은 다섯 깊이 층(0 … −4×RING_DEPTH)의 **중간 깊이**가 원점에 오게 놓는다 —
    // 기울였을 때 보이는 덩어리의 중심이 뷰포트 중앙에 서고, 앞·뒤 고리가 위아래로 대칭으로 밀린다.
    const disc = new THREE.Group();
    const pivot = new THREE.Group();
    disc.position.z = RING_DEPTH * 2;
    pivot.add(disc);
    scene.add(pivot);

    const stat = { frames: 0, ms: 0, last: 0, draws: 0, tris: 0 };
    // 이케다식 이벤트: strike(박마다 120 ms) · burst(무작위 7±3박 또는 클릭/탭: 층이 3D 로 터졌다 돌아온다, 하드컷) · sweep(헤어라인)
    // phase = 상태 천이 위상 강제(검증용). null 이면 실제 시각(서울 자정 기준 초)을 따른다.
    const ev: {
      burstT0: number; burstDur: number; nextBurstBeat: number; strikeT0: number;
      sweepT0: number; spinJump: number; tiltJump: number; phase: number | null; fieldNow: number; spec: number;
    } = { burstT0: -1e9, burstDur: 1100, nextBurstBeat: -1, strikeT0: -1e9, sweepT0: -1e9, spinJump: 0, tiltJump: 0, phase: null, fieldNow: 0, spec: 0 };
    const state = { theta: 0, tilt: -0.34, px: 0, py: 0, tx: 0, ty: 0, readDeg: 0, readFrom: 0, readT0: 0, gakDeg: 0, gakFrom: 0, gakT0: 0, seedCur: 0, seedPrev: 0, seedT0: 0, lastIndex: -1 };
    let raf = 0;
    // 필드 판 반크기(월드 단위) — fit() 이 갱신하고 셰이더가 읽는다.
    const fieldHalf = new THREE.Vector2(800, 460);
    let wheelR = 460;
    let partScale = 1;
    let fieldMode = 'clock';
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
      // 필드 상태(R03·R07)의 판 크기 — 보이는 넓이에 맞추되 16:9 안쪽으로 묶는다.
      // 세로로 긴 모바일에서 격자가 위아래로 늘어져 성기어지는 것을 막는다.
      const halfH2 = camera.position.z * Math.tan(vFov / 2);
      const halfW2 = halfH2 * camera.aspect;
      // 가로는 16:9 안쪽으로 묶고(넓은 화면에서 획이 옆으로 흩어지지 않게),
      // 세로는 화면을 채우되 폭 대비 1.8 배까지만(세로로 긴 모바일에서 판이 가운데
      // 손바닥만 하게 접히던 것을 편다 — 행간이 넓어질 뿐 글자 크기는 그대로다).
      fieldHalf.set(
        Math.min(halfW2, halfH2 * 1.72) * 0.96,
        Math.min(halfH2 * 0.92, halfW2 / 0.55) * 0.96,
      );
      // 輪의 반지름 — 원은 원이어야 한다(가로세로 중 짧은 쪽에 맞춘다).
      wheelR = Math.min(fieldHalf.x, fieldHalf.y) * 0.98;
      // 같은 판을 CSS 계측선도 알아야 한다 — 월드 단위를 화면 px 로 환산해 변수로 넘긴다.
      const pxPerUnit = h / 2 / halfH2;
      host.style.setProperty('--fw', `${(fieldHalf.x * 2 * pxPerUnit).toFixed(1)}px`);
      host.style.setProperty('--fh', `${(fieldHalf.y * 2 * pxPerUnit).toFixed(1)}px`);
      host.style.setProperty('--wd', `${(wheelR * 2 * pxPerUnit).toFixed(1)}px`);
      // 링 간격 = 반지름 × (바깥−안쪽)/(링수−1) — CSS 동심원이 실제 링 위에 겹치게
      host.style.setProperty('--wstep', `${((wheelR * (WHEEL_R1 - WHEEL_R0)) / (WHEEL_RINGS - 1) * pxPerUnit).toFixed(2)}px`);
      host.style.setProperty('--wr0', `${(wheelR * WHEEL_R0 * pxPerUnit).toFixed(2)}px`);
      // 입자가 어느 화면에서나 같은 크기로 보이게(모바일에서 점이 사라지지 않게)
      partScale = Math.max(1, Math.min(2.8, 0.9 / pxPerUnit));
    };
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    fit();

    // 눈금·고리선(먹, 옅게)
    const tickMat = new THREE.LineBasicMaterial({ color: pal.line, transparent: true, opacity: pal.tickA });
    const ticks = new THREE.LineSegments(tickGeometry(), tickMat);
    disc.add(ticks);
    disposables.push(ticks.geometry, tickMat);
    // 고리 안내선·중심 지(紙) 원은 두지 않는다(사용자 "배경에 도형 같은 게 있어 이상해") — 글자·눈금·바늘만 남긴다.
    // 바늘
    const readNeedle = needle(418, 2.2, 0xbe3c28, 6);
    const gakNeedle = needle(300, 1.4, pal.gakNeedle, 5);
    disc.add(readNeedle, gakNeedle);
    disposables.push(readNeedle.geometry, readNeedle.material as THREE.Material, gakNeedle.geometry, gakNeedle.material as THREE.Material);
    const pin = new THREE.Mesh(new THREE.CircleGeometry(4, 24), new THREE.MeshBasicMaterial({ color: 0xbe3c28, transparent: true, depthWrite: false }));
    pin.position.z = 7;
    disc.add(pin);
    disposables.push(pin.geometry, pin.material as THREE.Material);
    // 헤어라인 스윕(화면 공간·카메라 자식) — 이벤트 때 3단 하드컷으로 가로지른다
    const sweepMat = new THREE.MeshBasicMaterial({ color: pal.line, transparent: true, opacity: 0, depthTest: false });
    const sweep = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4000), sweepMat);
    sweep.renderOrder = 10;
    scene.add(sweep);
    disposables.push(sweep.geometry, sweepMat);
    let glyphMat: THREE.ShaderMaterial | null = null;
    const trigger = (t = performance.now()) => {
      ev.burstT0 = t;
      ev.spinJump = (Math.floor(Math.random() * 7) - 3) * (Math.PI / 12); // ±45° 를 15° 단위로
      ev.tiltJump = (Math.floor(Math.random() * 5) - 2) * 0.08;
      ev.sweepT0 = t;
    };
    const onTap = () => trigger();
    host.addEventListener('pointerdown', onTap);

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
      // 덧댈 조각은 **먹(무채)만** 고른다 — 필드에서 주서 면적이 불어나지 않게(D18 적색 ≤ 2.83%).
      const inkGroups = (Object.values(s.rings).flat() as number[])
        .map((id) => s.groups[id])
        .filter((g) => g && !g.vermilion);
      // 모바일은 입자 수를 줄인다(드로콜은 어차피 1이지만 정점·필레이트를 아낀다).
      const { geo, redact } = buildGlyphGeometry(slots, inkGroups, mobile ? FIELD_EXTRA_MOBILE : FIELD_EXTRA);
      const mat = glyphMaterial(tex, pal);
      const glyphs = new THREE.Mesh(geo, mat);
      glyphMat = mat;
      disc.add(glyphs);
      disposables.push(geo, mat);
      // 가림(REDACTED) 칸은 빈 자리로 둔다 — 사각을 그리면 도형으로 읽힌다(결측은 침묵으로).
      redact.dispose();
      // 종자자 두 장(크로스페이드)
      seedIds = s.rings.seed || [];
      seedMat = glyphMaterial(tex, pal);
      seedPrevMat = glyphMaterial(tex, pal);
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
          ev.strikeT0 = t;
          if (ev.nextBurstBeat < 0) ev.nextBurstBeat = b.index + 4 + Math.floor(Math.random() * 6);
          if (!reduced && b.index >= ev.nextBurstBeat) {
            trigger(t);
            ev.nextBurstBeat = b.index + 4 + Math.floor(Math.random() * 6);
          }
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
      // ── 이벤트 값(하드컷 양자화 — 부드럽게 굴리지 않는다)
      const kb = (t - ev.burstT0) / ev.burstDur;           // 0…1 동안 버스트
      const q = (x: number, n: number) => Math.floor(Math.max(0, Math.min(1, x)) * n) / n;
      const burst = kb >= 0 && kb < 1 ? (kb < 0.5 ? q(kb * 2, 4) : q((1 - kb) * 2, 4)) : 0; // 0→1→0 을 4단으로
      const depth = burst * 170 * (ev.fieldNow > 0.02 ? 0 : 1); // 필드에서는 층 폭발을 재우다
      if (glyphMat) glyphMat.uniforms.uDepth.value = depth;
      const ks = (t - ev.strikeT0) / 120;
      const strike = ks >= 0 && ks < 1 ? 1 : 0;
      if (glyphMat) {
        glyphMat.uniforms.uStrike.value = reduced ? 0 : strike;
        glyphMat.uniforms.uStrikeAng.value = state.readDeg;
      }
      // 헤어라인 스윕: 300 ms 안에 3칸으로 건너뛴다
      const kw = (t - ev.sweepT0) / 300;
      if (kw >= 0 && kw < 1) {
        sweepMat.opacity = 0.9;
        const lane = q(kw, 3) * 2 - 1; // −1, −1/3, +1/3
        sweep.position.set(lane * camera.position.z * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect * 0.8, 0, camera.position.z - 400);
        sweep.quaternion.copy(camera.quaternion);
      } else sweepMat.opacity = 0;
      const jump = burst > 0 ? { spin: ev.spinJump * burst, tilt: ev.tiltJump * burst } : { spin: 0, tilt: 0 };
      // 원반: 느린 자전(한 각에 1주) + 기울기 호흡(±12°) + 시차 (+ 이벤트 점프)
      const sec = b.sec;
      // ── 상태 천이 A(시계) → B(글리프 필드·R03) → A → C(스펙트로그램·R07) → A ──
      //   서울 자정 기준 초로만 정한다 — 새로고침해도 자리가 이어지고, 시계는 멈추지 않는다.
      //   reduced-motion 은 시계 상태 그대로(천이 없음).
      const ph = reduced ? 0 : ((ev.phase ?? sec) % FIELD_CYCLE + FIELD_CYCLE) % FIELD_CYCLE;
      // 0…40 시계 · 40…50 스캔이 훑으며 격자로 · 50…70 필드 · 70…82 스캔이 되훑으며 시계로
      const wGrid = ramp(ph, 40, 50) * (1 - ramp(ph, 70, 82));
      const wSpec = ev.spec; // 정지 스펙트로그램은 검수 때만(사이클에서는 0)
      const field = Math.max(wGrid, wSpec);
      // 스캔 중인가 — 전선이 판을 건너는 동안(양 끝 0·1 은 정지 상태)
      const scanning = wGrid > 0.002 && wGrid < 0.998;
      ev.fieldNow = field;
      // 상태가 바뀔 때만 DOM 을 건드린다(프레임마다 쓰면 스타일 재계산이 매 프레임 붙는다).
      const mode = scanning ? 'scan' : wGrid > 0.5 ? 'grid' : wSpec > 0.5 ? 'spec' : 'clock';
      if (mode !== fieldMode) {
        fieldMode = mode;
        host.dataset.field = mode;
      }
      for (const m of [glyphMat, seedMat, seedPrevMat]) {
        if (!m) continue;
        m.uniforms.uGrid.value = wGrid;
        m.uniforms.uSpec.value = wSpec;
        m.uniforms.uScan.value = reduced ? 0 : 1;
        m.uniforms.uFieldHalf.value.copy(fieldHalf);
        m.uniforms.uWheelR.value = wheelR;
        m.uniforms.uPart.value = partScale;
      }
      // 스캔 전선 — 이 선이 지나간 자리의 획이 흩어져 격자에 앉는다. 되돌아올 때는 반대로 훑는다.
      // 자리는 **입자와 같은 자(尺)**로 잰다: 조각의 도착 좌표 aG 는 셰이더에서 uWheelR 이 곱해지고
      // 도착 시각 aDelay 도 그 좌표에서 나오므로, 전선도 wheelR 스케일이라야 한다.
      // (fieldHalf.x 로 놓으면 1440 에서 1.9 배 앞서 나가 輪 바깥 빈 자리를 지난다 — 2026-08-31 검수)
      // 실제 배치는 원반의 자세가 정해진 뒤(자전·기울기·중심보정) 아래에서 한다.
      const scanFrontX = scanning
        ? (Math.min(1, Math.max(0, (wGrid - 0.5 * (1 - STAGGER)) / STAGGER)) * 2 - 1) * wheelR
        : null;
      if (scanning) sweepMat.opacity = 0.5;
      // 계기(눈금·바늘)는 필드가 서면 물러난다 — 판이 펴지는 동안 계측은 레티클(CSS)만 남는다.
      tickMat.opacity = pal.tickA * (1 - field);
      (readNeedle.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - field);
      (gakNeedle.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - field);
      (pin.material as THREE.MeshBasicMaterial).opacity = 1 - field;
      // 輪은 계속 돈다(봉안된 것이 돈다) — 기울기만 눕혀 축에서 바라본 원통이 되게 한다.
      // 자전(z)은 상태와 무관하게 이어진다: 정지하는 것은 계측 레티클(CSS)뿐이다.
      const still = 1 - field;
      const spin = (reduced ? 0 : ((sec % ROT_SEC) / ROT_SEC) * Math.PI * 2) + jump.spin * still;
      const breathe = (reduced ? 0 : Math.sin(sec / 23) * (12 * Math.PI) / 180) + jump.tilt;
      state.px += (state.tx - state.px) * 0.04;
      state.py += (state.ty - state.py) * 0.04;
      pivot.rotation.set(
        (state.tilt + breathe * 0.6 + state.py * 0.05) * still,
        (state.px * 0.05 + breathe * 0.35) * still,
        spin,
      );
      camera.position.x = state.px * camera.position.z * 0.02;
      camera.position.y = -state.py * camera.position.z * 0.015;
      camera.lookAt(0, 0, 0);
      // ── 시각 중심 고정: 기울기·자전·시차가 바뀌어도 **투영된 원반의 경계상자 중심**이 뷰포트 중앙에 서게
      //    매 프레임 보정한다(사용자 "계속 벗어난다" 2026-08-30). 원점이 아니라 보이는 덩어리를 맞춘다.
      pivot.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      let minX = 1, maxX = -1, minY = 1, maxY = -1;
      for (const [rr, zz] of SAMPLE_RINGS) {
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2;
          tmpV.set(Math.sin(a) * rr, Math.cos(a) * rr, zz).applyMatrix4(disc.matrixWorld).project(camera);
          if (tmpV.x < minX) minX = tmpV.x; if (tmpV.x > maxX) maxX = tmpV.x;
          if (tmpV.y < minY) minY = tmpV.y; if (tmpV.y > maxY) maxY = tmpV.y;
        }
      }
      // 잠금 기준 = 타원(바깥 고리) 중심과 허브(바늘 축)의 중간 — 둘 다 뷰포트 중앙에서 같은 거리 안에 둔다
      tmpV.set(0, 0, 6).applyMatrix4(disc.matrixWorld).project(camera);
      const cx = ((minX + maxX) / 2 + tmpV.x) / 2, cy = ((minY + maxY) / 2 + tmpV.y) / 2;
      // NDC 오프셋 → 원점 깊이에서의 월드 거리(카메라 거리 × tan(fov/2))
      const halfH = camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
      // 필드 상태에서는 보정을 끄고 원점으로 되돌린다 — 잠금 기준이 「원반의 타원」이라
      // 판이 격자로 펴진 동안 계속 밀면 격자가 화면 밖으로 걸어 나간다.
      pivot.position.x -= cx * halfH * camera.aspect * still;
      pivot.position.y -= cy * halfH * still;
      if (field > 0.001) {
        pivot.position.x *= 1 - field * 0.25;
        pivot.position.y *= 1 - field * 0.25;
      }
      // 전선 헤어라인 배치 — 원반 로컬 x = scanFrontX 인 등(等)x선. 로컬 좌표를 세계로 옮기고,
      // 화면에서는 그 선의 방향(로컬 y 축의 투영)만큼 굴려(roll) 카메라를 향한 얇은 선으로 눕힌다.
      // 그래야 자전한 판 위에서도 전선과 같은 자리를 같은 기울기로 지난다.
      if (scanFrontX !== null) {
        pivot.updateMatrixWorld(true);
        sweep.position.set(scanFrontX, 0, 0).applyMatrix4(disc.matrixWorld);
        tmpV.set(0, 1, 0).transformDirection(disc.matrixWorld).applyQuaternion(tmpQ.copy(camera.quaternion).invert());
        sweep.quaternion.copy(camera.quaternion);
        sweep.rotateZ(Math.atan2(-tmpV.x, tmpV.y));
      }
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
      (window as any).__ntHero = { renderer, scene, camera, disc, pivot, stat, state, ev, trigger, frameOnce: () => frame(performance.now()) };
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(raf);
      ro.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerdown', onTap);
      disposables.forEach((d) => d.dispose());
      if (seedMesh) seedMesh.geometry.dispose();
      if (seedPrevMesh) seedPrevMesh.geometry.dispose();
      renderer.dispose();
      if (process.env.NODE_ENV !== 'production') (window as any).__ntHero = null;
    };
  }, [onFallback, pal]);

  return (
    <div className={`dclock3d dclock3d--${theme}${ready ? ' is-ready' : ''}`} ref={hostRef} aria-label="陀羅尼 時計 — 3차원 봉안 원반" role="img">
      <canvas ref={canvasRef} className="dclock3d__gl" />
      {/* 계측 레티클 — D04 「봉안된 기도가 계측 레티클 아래에서 돈다」.
          원반(캔버스)은 돌고, 이 층은 화면에 못박혀 정지한다. 순수 CSS(그리기 비용 0·GPU 합성)라
          three 쪽 포스트프로세싱을 늘리지 않는다. 십자선·모서리 괄호·점선 호·중심 사각. */}
      <div className="dclock3d__reticle" aria-hidden>
        <i className="r-cross" />
        <i className="r-arc" />
        <i className="r-core" />
        {/* 정간보 계선 — 글리프 필드(R03)일 때만 든다. 칸 = 조각 하나의 자리. */}
        <i className="r-grid" />
      </div>
      <div className="dclock3d__grain" aria-hidden />
      <div className="dclock3d__lab" aria-hidden>
        陀羅尼 時計 · 奉安 · <span>WEBGL2 · 5 RINGS · Z −{RING_DEPTH * 4} · {theme.toUpperCase()}</span>
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
