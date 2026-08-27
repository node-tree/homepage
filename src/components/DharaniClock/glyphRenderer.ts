// ════════════════════════════════════════════════════════════════════════
// glyphRenderer.ts — 먹 조각 렌더러
//   1순위: **WebGL2 SDF 셰이더** — `~/공생직조-lab/webgpu/wg-018-retypeset/src/volume.ts`
//          (it.3, 조각 재질 블록)의 규칙을 그대로 이식한다.
//            · AA 폭  w = clamp(fwidth(d) × 0.75, 0.002, 0.25)   ← **화면 화소 도함수**
//            · 종이   paper = smoothstep(gate × 0.5, gate, 농도)  ← 갈필의 마른 줄은 종이다
//            · 알파   a = smoothstep(edge − w, edge + w, d) × paper
//            · 먹색   테마색 × 루마밴드(농도가 밴드 안에서 획의 결을 낸다)
//            · 주서   반전하지 않는다 — 원색 (190,60,40) × (0.70 + 농도 × 0.30)
//   폴백:  WebGL2 불가 → 3× 래스터 스프라이트(같은 문턱·같은 색 규칙, canvas 2D).
// ════════════════════════════════════════════════════════════════════════
import { ClockGlyphSet, GlyphGroup, Slot } from './atlas';

export const SDF_EDGE = 128 / 255;
/** 랩 INK_LUMA_OPENED_SPEC — 히어로 도판 창은 '개봉' 상태다 */
export const INK_BAND: [number, number] = [190 / 255, 230 / 255];
export const CREAM: [number, number, number] = [220 / 255, 221 / 255, 211 / 255];
export const VERM: [number, number, number] = [190 / 255, 60 / 255, 40 / 255];
export const INK_DARKROOM: [number, number, number] = [15 / 255, 15 / 255, 26 / 255];

export type Theme = 'dark' | 'light';

export interface CenterSeed {
  group: GlyphGroup;
  /** 표시 높이(뷰박스 단위) */
  h: number;
  alpha: number;
}

export interface ClockRenderer {
  readonly mode: 'webgl2' | 'raster';
  resize(cssSize: number, dpr: number): void;
  /** 고리는 정지 — 한 번만 올린다 */
  setSlots(slots: Slot[]): void;
  draw(seeds: CenterSeed[]): void;
  dispose(): void;
}

const HALF = 470; // viewBox −470 … 470

// ── WebGL2 ──────────────────────────────────────────────────────────────
const VS = `#version 300 es
layout(location=0) in vec2 aCorner;   // [-0.5, 0.5]^2
layout(location=1) in vec4 aGeom;     // 각(rad) · 반지름 · 폭 · 높이
layout(location=2) in vec4 aUv;       // u0 v0 u1 v1
layout(location=3) in vec3 aStyle;    // 주서 · 종이문턱 · 알파
uniform float uHalf;
out vec2 vUv;
out float vGate;
out float vVerm;
out float vAlpha;
void main() {
  float c = cos(aGeom.x), s = sin(aGeom.x);
  // 목업과 같은 배치: 글자를 12시(0, -r)에 놓고 SVG rotate(θ) 로 돌린다
  vec2 loc = vec2(aCorner.x * aGeom.z, -aGeom.y + aCorner.y * aGeom.w);
  vec2 p = vec2(loc.x * c - loc.y * s, loc.x * s + loc.y * c);
  vUv = mix(aUv.xy, aUv.zw, aCorner + 0.5);
  vGate = aStyle.y; vVerm = aStyle.x; vAlpha = aStyle.z;
  gl_Position = vec4(p.x / uHalf, -p.y / uHalf, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
in float vGate;
in float vVerm;
in float vAlpha;
uniform sampler2D uAtlas;
uniform vec3 uInk;
uniform vec3 uVerm;
uniform vec2 uBand;
uniform float uLight;   // 0 = 다크(루마 밴드) · 1 = 라이트(농담 → 불투명도)
uniform float uEdge;
out vec4 o;
void main() {
  vec2 t = texture(uAtlas, vUv).rg;
  float d = t.r;          // R = 부호 거리 (128 = 획의 가장자리)
  float dens = t.g;       // G = 먹 농도 (조각 안의 농담)
  // 가장자리 폭은 화면 도함수로 — 배율이 무엇이든 한 화소로 선다
  float w = clamp(fwidth(d) * 0.75, 0.002, 0.25);
  // 세그멘테이션이 종이와 먹을 가른 문턱을 그대로 쓴다(임의값 0)
  float paper = smoothstep(vGate * 0.5, vGate, dens);
  float a = smoothstep(uEdge - w, uEdge + w, d) * paper;
  vec3 rgb;
  float aa = a;
  if (vVerm > 0.5) {
    // 주서는 반전하지 않는다 — 원색. 1.20 = 랩의 '개봉' 밝기 계수(vermS)
    rgb = uVerm * 1.20 * (0.70 + dens * 0.30);
    if (uLight > 0.5) aa *= (0.72 + dens * 0.28);
  } else if (uLight > 0.5) {
    rgb = uInk;
    aa *= (0.72 + dens * 0.28);
  } else {
    rgb = uInk * mix(uBand.x, uBand.y, clamp(dens, 0.0, 1.0));
  }
  aa *= vAlpha;
  o = vec4(rgb * aa, aa);   // 프리멀티플라이드
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('shader compile: ' + log);
  }
  return sh;
}

const STRIDE = 11; // geom4 + uv4 + style3

class GLRenderer implements ClockRenderer {
  readonly mode = 'webgl2' as const;
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private inst: WebGLBuffer;
  private tex: WebGLTexture;
  private uni: Record<string, WebGLUniformLocation | null> = {};
  private data = new Float32Array(0);
  private ringCount = 0;
  private count = 0;
  private side = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private set: ClockGlyphSet,
    private theme: Theme
  ) {
    const gl = canvas.getContext('webgl2', {
      alpha: true, antialias: false, premultipliedAlpha: true, depth: false, stencil: false,
    });
    if (!gl) throw new Error('WebGL2 없음');
    this.gl = gl;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('program link: ' + gl.getProgramInfoLog(prog));
    }
    this.prog = prog;
    for (const n of ['uHalf', 'uAtlas', 'uInk', 'uVerm', 'uBand', 'uLight', 'uEdge']) {
      this.uni[n] = gl.getUniformLocation(prog, n);
    }

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const inst = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    const B = STRIDE * 4;
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, B, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, B, 16); gl.vertexAttribDivisor(2, 1);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, B, 32); gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);
    this.vao = vao; this.inst = inst;

    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, set.image);
    // ⚠ SDF·농도 둘 다 **선형 보간** — Nearest 면 거리장이 계단이 되어 SDF 를 쓰는 이유가 없다
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.tex = tex;

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // 프리멀티플라이드
  }

  resize(cssSize: number, dpr: number) {
    const side = Math.max(1, Math.round(cssSize * dpr));
    if (side === this.side) return;
    this.side = side;
    this.canvas.width = side;
    this.canvas.height = side;
  }

  setSlots(slots: Slot[]) {
    const live = slots.filter((s) => s.group);
    const SEEDS = 2; // 중심 종자자 크로스페이드 두 장
    const data = new Float32Array((live.length + SEEDS) * STRIDE);
    live.forEach((s, k) => {
      const g = s.group!;
      const o = k * STRIDE;
      data[o] = (s.a * Math.PI) / 180;
      data[o + 1] = s.r;
      data[o + 2] = s.w;
      data[o + 3] = s.h;
      data[o + 4] = g.uv[0]; data[o + 5] = g.uv[1];
      data[o + 6] = g.uv[2]; data[o + 7] = g.uv[3];
      data[o + 8] = g.vermilion ? 1 : 0;
      data[o + 9] = g.densGate;
      data[o + 10] = 1;
    });
    this.data = data;
    this.ringCount = live.length;
    this.count = live.length + SEEDS;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  }

  draw(seeds: CenterSeed[]) {
    const gl = this.gl;
    if (!this.count || !this.side) return;
    for (let k = 0; k < 2; k++) {
      const o = (this.ringCount + k) * STRIDE;
      const s = seeds[k];
      if (!s || s.alpha <= 0.001) { this.data[o + 10] = 0; continue; }
      const g = s.group;
      this.data[o] = 0;
      this.data[o + 1] = 0;
      this.data[o + 2] = s.h * g.aspect;
      this.data[o + 3] = s.h;
      this.data[o + 4] = g.uv[0]; this.data[o + 5] = g.uv[1];
      this.data[o + 6] = g.uv[2]; this.data[o + 7] = g.uv[3];
      this.data[o + 8] = g.vermilion ? 1 : 0;
      this.data[o + 9] = g.densGate;
      this.data[o + 10] = s.alpha;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data);

    gl.viewport(0, 0, this.side, this.side);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.uni.uAtlas!, 0);
    gl.uniform1f(this.uni.uHalf!, HALF);
    gl.uniform1f(this.uni.uEdge!, SDF_EDGE);
    const light = this.theme === 'light';
    gl.uniform1f(this.uni.uLight!, light ? 1 : 0);
    gl.uniform3fv(this.uni.uInk!, light ? INK_DARKROOM : CREAM);
    gl.uniform3fv(this.uni.uVerm!, VERM);
    gl.uniform2fv(this.uni.uBand!, INK_BAND);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteTexture(this.tex);
    gl.deleteBuffer(this.inst);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.prog);
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }
}

// ── 폴백: 3× 래스터 스프라이트 (canvas 2D) ───────────────────────────────
class RasterRenderer implements ClockRenderer {
  readonly mode = 'raster' as const;
  private ctx: CanvasRenderingContext2D;
  private atlasData: ImageData;
  private sprites = new Map<string, HTMLCanvasElement>();
  /** 고리는 정지 — 한 번 구워 두고 프레임마다 한 장으로 얹는다 */
  private ringsLayer: HTMLCanvasElement | null = null;
  private slots: Slot[] = [];
  private side = 0;
  private dpr = 1;

  constructor(
    private canvas: HTMLCanvasElement,
    private set: ClockGlyphSet,
    private theme: Theme
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d 없음');
    this.ctx = ctx;
    const c = document.createElement('canvas');
    c.width = set.atlasSize[0];
    c.height = set.atlasSize[1];
    const cc = c.getContext('2d', { willReadFrequently: true })!;
    cc.drawImage(set.image, 0, 0);
    this.atlasData = cc.getImageData(0, 0, c.width, c.height);
  }

  /** 표시 높이의 3배로 굽는다 — 문턱·색 규칙은 셰이더와 같다 */
  private sprite(g: GlyphGroup, hPx: number): HTMLCanvasElement {
    const H = Math.max(6, Math.round(hPx * 3));
    const W = Math.max(6, Math.round(H * g.aspect));
    const key = `${g.id}:${W}x${H}:${this.theme}`;
    const hit = this.sprites.get(key);
    if (hit) return hit;
    const [ax, ay, aw, ah] = g.atlas;
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const octx = out.getContext('2d')!;
    const img = octx.createImageData(W, H);
    const A = this.atlasData;
    const light = this.theme === 'light';
    const ink = light ? INK_DARKROOM : CREAM;
    for (let y = 0; y < H; y++) {
      const sy = ay + ((y + 0.5) / H) * ah - 0.5;
      const y0 = Math.max(ay, Math.min(ay + ah - 1, Math.floor(sy)));
      const y1 = Math.min(ay + ah - 1, y0 + 1);
      const fy = Math.min(1, Math.max(0, sy - y0));
      for (let x = 0; x < W; x++) {
        const sx = ax + ((x + 0.5) / W) * aw - 0.5;
        const x0 = Math.max(ax, Math.min(ax + aw - 1, Math.floor(sx)));
        const x1 = Math.min(ax + aw - 1, x0 + 1);
        const fx = Math.min(1, Math.max(0, sx - x0));
        let d = 0, dens = 0;
        for (const [px, wx] of [[x0, 1 - fx], [x1, fx]] as [number, number][]) {
          for (const [py, wy] of [[y0, 1 - fy], [y1, fy]] as [number, number][]) {
            const i = (py * A.width + px) * 4;
            d += (A.data[i] / 255) * wx * wy;
            dens += (A.data[i + 1] / 255) * wx * wy;
          }
        }
        // 스프라이트는 3× 라서 한 화소가 표시의 1/3 — AA 폭을 그만큼으로 고정한다
        const wEdge = 0.06;
        const paper = smooth(g.densGate * 0.5, g.densGate, dens);
        const a = smooth(SDF_EDGE - wEdge, SDF_EDGE + wEdge, d) * paper;
        let r: number, gg: number, b: number, aa = a;
        if (g.vermilion) {
          const k = 1.2 * (0.7 + dens * 0.3);
          r = Math.min(1, VERM[0] * k); gg = VERM[1] * k; b = VERM[2] * k;
          if (light) aa *= 0.72 + dens * 0.28;
        } else if (light) {
          r = ink[0]; gg = ink[1]; b = ink[2];
          aa *= 0.72 + dens * 0.28;
        } else {
          const L = INK_BAND[0] + (INK_BAND[1] - INK_BAND[0]) * Math.min(1, dens);
          r = ink[0] * L; gg = ink[1] * L; b = ink[2] * L;
        }
        const o = (y * W + x) * 4;
        img.data[o] = r * 255; img.data[o + 1] = gg * 255; img.data[o + 2] = b * 255;
        img.data[o + 3] = aa * 255;
      }
    }
    octx.putImageData(img, 0, 0);
    this.sprites.set(key, out);
    return out;
  }

  resize(cssSize: number, dpr: number) {
    const side = Math.max(1, Math.round(cssSize * dpr));
    if (side === this.side) return;
    this.side = side; this.dpr = dpr;
    this.canvas.width = side; this.canvas.height = side;
    this.sprites.clear();
    this.ringsLayer = null;
  }

  setSlots(slots: Slot[]) {
    this.slots = slots.filter((s) => s.group);
    this.ringsLayer = null;
  }

  private bakeRings(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.side; cv.height = this.side;
    const ctx = cv.getContext('2d')!;
    const k = this.side / (HALF * 2);
    ctx.setTransform(k, 0, 0, k, this.side / 2, this.side / 2);
    for (const s of this.slots) {
      const g = s.group!;
      const sp = this.sprite(g, s.h * k);
      ctx.save();
      ctx.rotate((s.a * Math.PI) / 180);
      ctx.drawImage(sp, -s.w / 2, -s.r - s.h / 2, s.w, s.h);
      ctx.restore();
    }
    return cv;
  }

  draw(seeds: CenterSeed[]) {
    if (!this.side) return;
    const ctx = this.ctx;
    const k = this.side / (HALF * 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.side, this.side);
    if (!this.ringsLayer) this.ringsLayer = this.bakeRings();
    ctx.drawImage(this.ringsLayer, 0, 0);
    ctx.setTransform(k, 0, 0, k, this.side / 2, this.side / 2);
    for (const sd of seeds) {
      if (!sd || sd.alpha <= 0.001) continue;
      const sp = this.sprite(sd.group, sd.h * k);
      const w = sd.h * sd.group.aspect;
      ctx.globalAlpha = sd.alpha;
      ctx.drawImage(sp, -w / 2, -sd.h / 2, w, sd.h);
      ctx.globalAlpha = 1;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  dispose() { this.sprites.clear(); this.ringsLayer = null; }
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1e-6)));
  return t * t * (3 - 2 * t);
}

export function createRenderer(
  canvas: HTMLCanvasElement,
  set: ClockGlyphSet,
  theme: Theme
): ClockRenderer {
  try {
    return new GLRenderer(canvas, set, theme);
  } catch (e) {
    // WebGL2 불가 → 3× 래스터 스프라이트
    // eslint-disable-next-line no-console
    console.warn('[DharaniClock] WebGL2 사용 불가 — 래스터 폴백:', (e as Error).message);
    return new RasterRenderer(canvas, set, theme);
  }
}
