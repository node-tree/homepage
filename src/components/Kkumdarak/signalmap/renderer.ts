// ═══════════════════════════════════════════════════════════════════════
// renderer.ts — 살아 있는 도시 엔진 (Canvas 2D, 설계 06)
//   캔버스 2장 스택: 지형(10fps 보일) + 액터(60fps rAF).
//   보일링: 모든 손선을 시드만 바꿔 3벌 미리 굽고 100ms마다 순환 — 잉크가 숨 쉰다.
//   모든 모션은 transform/alpha만. 색은 신호 주황 하나(흑백 판식).
// ═══════════════════════════════════════════════════════════════════════
import { mulberry32, wobPath, wobBlob, buildTrack, trackAt, PathTrack, Pt } from './wobble';
import { STROKES, ACTORS, Stroke, Actor, SCENE_W, SCENE_H } from './scene';

export const INK = '#1f1e1c';
export const GRAY = '#8c8a82';
export const PAPER = '#fcfbf9';
export const ORANGE = '#fe5000';

const BOIL_MS = 100;      // 10fps 잉크 보일
const VARIANTS = 3;       // 보일 프레임 수(전통 손그림 애니의 3프레임 순환)

export interface Camera { x: number; y: number; k: number; }

interface Built { paths: Path2D[]; s: Stroke; }
interface Glyphs { car: Path2D[]; wheelL: Path2D[]; wheelR: Path2D[]; tree: Path2D[]; trunk: Path2D[]; flag: Path2D[]; person: Path2D[]; }

const buildStroke = (s: Stroke): Path2D[] =>
  Array.from({ length: VARIANTS }, (_, v) => {
    const rnd = mulberry32(STROKES.indexOf(s) * 101 + v * 7 + 1);
    return s.blob
      ? wobBlob(s.blob.cx, s.blob.cy, s.blob.rx, s.blob.ry, rnd, s.blob.irr ?? 0.07)
      : wobPath(s.pts as Pt[], rnd, s.amp ?? 2.2);
  });

// 액터 글리프(로컬 좌표) — 역시 3벌 보일
const buildGlyphs = (): Glyphs => {
  const mk = (fn: (rnd: () => number) => Path2D, base: number) =>
    Array.from({ length: VARIANTS }, (_, v) => fn(mulberry32(base + v)));
  return {
    car: mk(r => wobPath([[-26, 12], [-24, -6], [-14, -12], [14, -12], [24, -6], [26, 12]], r, 1.2), 500),
    wheelL: mk(r => wobBlob(-13, 14, 5.5, 5.5, r, 0.15), 510),
    wheelR: mk(r => wobBlob(14, 14, 5.5, 5.5, r, 0.15), 520),
    tree: mk(r => wobBlob(0, -26, 16, 18, r, 0.12), 530),
    trunk: mk(r => wobPath([[0, -10], [0, 8]], r, 0.8), 540),
    flag: mk(r => wobPath([[0, 0], [20, 5], [0, 11]], r, 1), 550),
    person: mk(r => {
      const p = wobBlob(0, -16, 4, 4, r, 0.15);
      p.addPath(wobPath([[0, -12], [-1, 0], [-3, 8]], r, 0.8));
      return p;
    }, 560),
  };
};

export class SignalMapRenderer {
  private built: Built[];
  private glyphs: Glyphs;
  private tracks = new Map<Actor, PathTrack>();
  private raf = 0;
  private lastBoil = -1;
  private camDirty = true;
  private running = false;
  private t0 = performance.now();
  cam: Camera = { x: 0, y: 0, k: 1 };
  onCamera?: (c: Camera) => void;   // 신호 버튼 레이어 CSS 동기용

  constructor(
    private terrain: HTMLCanvasElement,
    private actorsC: HTMLCanvasElement,
    private reduced: boolean,
  ) {
    this.built = STROKES.map(s => ({ paths: buildStroke(s), s }));
    this.glyphs = buildGlyphs();
    ACTORS.forEach(a => {
      if (a.type === 'drive' || a.type === 'walk' || a.type === 'pulse') this.tracks.set(a, buildTrack(a.path));
    });
  }

  resize(w: number, h: number, dpr: number) {
    for (const c of [this.terrain, this.actorsC]) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      c.style.width = `${w}px`; c.style.height = `${h}px`;
    }
    this.dpr = dpr; this.camDirty = true;
    if (!this.running) this.renderOnce();
  }
  private dpr = 1;

  setCamera(cam: Camera) {
    this.cam = cam; this.camDirty = true;
    this.onCamera?.(cam);
    if (!this.running) this.renderOnce();
  }

  /** 컨테이너 크기에 지도를 맞추는 초기 카메라 */
  fitCamera(w: number, h: number): Camera {
    const k = Math.max(w / SCENE_W, h / SCENE_H);
    return { k, x: (w - SCENE_W * k) / 2, y: (h - SCENE_H * k) / 2 };
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = (now: number) => {
      if (!this.running) return;
      const boil = Math.floor(now / BOIL_MS) % VARIANTS;
      if (boil !== this.lastBoil || this.camDirty) { this.drawTerrain(boil); this.lastBoil = boil; this.camDirty = false; }
      this.drawActors(now - this.t0, boil);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  /** reduced-motion·비활성: 정지 1프레임 */
  renderOnce() { this.drawTerrain(0); this.drawActors(0, 0); }

  private setT(ctx: CanvasRenderingContext2D) {
    const { x, y, k } = this.cam;
    ctx.setTransform(this.dpr * k, 0, 0, this.dpr * k, this.dpr * x, this.dpr * y);
  }

  private drawTerrain(boil: number) {
    const ctx = this.terrain.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, this.terrain.width, this.terrain.height);
    this.setT(ctx);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const { paths, s } of this.built) {
      const p = paths[boil];
      if (s.fill) {
        ctx.fillStyle = s.fill === 'ink' ? INK : '#ffffff';
        ctx.fill(p);
        if (!s.w) continue;
      }
      ctx.strokeStyle = s.color === 'gray' ? GRAY : INK;
      ctx.lineWidth = s.w ?? 1.8;
      ctx.setLineDash(s.dash ?? []);
      ctx.stroke(p);
    }
    ctx.setLineDash([]);
  }

  private drawActors(t: number, boil: number) {
    const ctx = this.actorsC.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.actorsC.width, this.actorsC.height);
    this.setT(ctx);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const g = this.glyphs;
    for (const a of ACTORS) {
      const ph = ((t + (('phase' in a && a.phase) || 0)) % a.period) / a.period; // 0..1
      ctx.save();
      switch (a.type) {
        case 'drive': {
          const tr = this.tracks.get(a)!;
          const { x, y } = trackAt(tr, ph * tr.total);
          ctx.translate(x, y);
          ctx.strokeStyle = INK; ctx.lineWidth = 1.9;
          ctx.stroke(g.car[boil]);
          ctx.lineWidth = 1.5;
          ctx.stroke(g.wheelL[boil]); ctx.stroke(g.wheelR[boil]);
          break;
        }
        case 'walk': {
          const tr = this.tracks.get(a)!;
          const back = ph > 0.5;                                  // 왕복
          const d = (back ? 1 - (ph - 0.5) * 2 : ph * 2) * tr.total;
          const { x, y } = trackAt(tr, d);
          ctx.translate(x, y + Math.sin(t / 180) * 1.2);          // bob
          ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
          ctx.stroke(g.person[boil]);
          break;
        }
        case 'spin': {
          ctx.translate(a.c[0], a.c[1]);
          ctx.rotate(ph * Math.PI * 2);
          ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(a.r, 0);
          ctx.moveTo(0, 0); ctx.lineTo(-a.r * 0.55, a.r * 0.55);
          ctx.stroke();
          break;
        }
        case 'sway': {
          ctx.translate(a.at[0], a.at[1]);
          ctx.rotate(Math.sin(ph * Math.PI * 2) * (4 * Math.PI / 180));
          ctx.strokeStyle = INK;
          if (a.kind === 'tree') {
            ctx.lineWidth = 1.8; ctx.stroke(g.tree[boil]); ctx.stroke(g.trunk[boil]);
          } else {
            ctx.lineWidth = 1.5; ctx.stroke(g.flag[boil]);
          }
          break;
        }
        case 'smoke': {
          for (let i = 0; i < 3; i++) {
            const pp = (ph + i / 3) % 1;
            ctx.save();
            ctx.translate(a.at[0] + Math.sin((pp * 3 + i) * Math.PI) * 4, a.at[1] - pp * 34);
            ctx.globalAlpha = (1 - pp) * 0.55;
            ctx.strokeStyle = GRAY; ctx.lineWidth = 1.1;
            const r = 3 + pp * 5;
            ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.7, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
          }
          break;
        }
        case 'ripple': {
          for (let i = 0; i < 2; i++) {
            const pp = (ph + i * 0.5) % 1;
            ctx.save();
            ctx.translate(a.c[0], a.c[1]);
            ctx.globalAlpha = (1 - pp) * 0.5;
            ctx.strokeStyle = GRAY; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.ellipse(0, 0, a.rx * (0.4 + pp * 0.9), a.ry * (0.4 + pp * 0.9), 0, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
          }
          break;
        }
        case 'arc': {
          if (ph < 0.45) {                                        // 타구 후 잠깐 쉼
            const u = ph / 0.45;
            const x = (1 - u) * (1 - u) * a.from[0] + 2 * (1 - u) * u * a.ctrl[0] + u * u * a.to[0];
            const y = (1 - u) * (1 - u) * a.from[1] + 2 * (1 - u) * u * a.ctrl[1] + u * u * a.to[1];
            ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.stroke();
          }
          break;
        }
        case 'pulse': {
          const tr = this.tracks.get(a)!;
          const { x, y } = trackAt(tr, ph * tr.total);
          ctx.fillStyle = ORANGE;
          ctx.beginPath(); ctx.arc(x, y, 3.6, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'blink': {
          const on = Math.sin((t / a.period + ph) * Math.PI * 2) * 0.5 + 0.5;
          ctx.globalAlpha = 0.35 + on * 0.65;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(a.at[0], a.at[1], a.r, 0, Math.PI * 2); ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
  }
}
