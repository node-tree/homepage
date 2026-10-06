import { ClockGlyphSet, GlyphGroup } from '../../components/DharaniClock/atlas';
import { BEAT_SEC } from '../../components/DharaniClock/beat';

export const palettes = {
  celadon: { bg: '#172925', ink: '#E1E5DA', residual: '#71847A', mark: '#E18C77', text: '#D6DED4' },
  paper: { bg: '#EAE7DF', ink: '#343B38', residual: '#8B9288', mark: '#9F4938', text: '#424A45' },
  mineral: { bg: '#E3E8E5', ink: '#243D3A', residual: '#798D87', mark: '#8E3F31', text: '#304B46' },
};
export type Palette = typeof palettes.paper;
export type Hero = 'a' | 'b';
export interface Tile { color?: string; g: GlyphGroup; x: number; y: number; h: number; angle: number; alpha: number; front?: boolean; inkMix?: number; column?: number; tone?: 'plate' | 'rear' | 'active'; cover?: boolean }
export function plateGeometry(w: number) {
  const mobile = w < 768, cols = mobile ? 7 : 15;
  const step = w * (mobile ? .76 / cols : .04);
  // 38% keeps the original fifteen columns and leaves roughly a third empty.
  const center = w * (mobile ? .5 : .38);
  return { cols, step, left: center - (cols - 1) * step / 2 };
}
export function homeSelection(params: URLSearchParams) {
  const hero = params.get('hero') === 'current' ? 'current' : params.get('hero') === 'a' ? 'a' : params.get('hero') === 'b' ? 'b' : 'c';
  const fallback = hero === 'a' ? 'celadon' : 'mineral';
  const candidate = params.get('pal') || fallback;
  const pal = Object.prototype.hasOwnProperty.call(palettes, candidate) ? candidate as keyof typeof palettes : fallback;
  return { hero, pal } as const;
}
export const ease = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
export function envelope(index: number, t: number) {
  if (index % 4 === 3) return { amount: .16 * (1 - ease(t / .8)), moving: t < .8, next: BEAT_SEC };
  if (t < .8) return { amount: ease(t / .8), moving: true, next: .8 };
  if (t < 6.6) return { amount: 1, moving: false, next: 6.6 };
  const floor = index % 4 === 2 ? .16 : 0;
  if (t < 7.5) return { amount: floor + (1 - floor) * (1 - ease((t - 6.6) / .9)), moving: true, next: 7.5 };
  return { amount: floor, moving: false, next: BEAT_SEC };
}
export function layout(set: ClockGlyphSet, hero: Hero, w: number, h: number): Tile[] {
  const groups = set.groups.filter(g => g.ring !== 'seed');
  const tiles: Tile[] = [];
  const mobile = w < 768;
  if (hero === 'a') {
    const r = Math.min(w * (mobile ? .455 : .265), h * .40);
    const cx = w * (mobile ? .5 : .43), cy = h * (mobile ? .45 : .49);
    // No synthetic ticks: the actual fragments alone establish the plate.
    for (let ring = 0; ring < 12; ring++) {
      const rr = r * (.38 + ring * .056);
      const gh = r * (.021 + (ring % 3) * .005);
      const count = Math.floor(2 * Math.PI * rr / (gh * 1.15));
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        const g = groups[(i * 7 + ring * 31) % groups.length];
        tiles.push({ g, x: cx + Math.sin(angle) * rr, y: cy - Math.cos(angle) * rr, h: Math.min(gh, gh * 1.6 / g.aspect), angle, alpha: ring % 3 === 0 ? .94 : .6 });
      }
    }
  } else {
    const { cols, left, step } = plateGeometry(w), rows = mobile ? 13 : 16;
    const height = Math.min(h * .63, w * (mobile ? 1.5 : .43));
    const top = h * (mobile ? .13 : .12);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows - (c % 4 === 1 ? 3 : 0); r++) {
        const g = groups[(c * 41 + r * 7) % groups.length];
        const gh = Math.min(height / rows * .84, step * .7 / g.aspect);
        tiles.push({ g, x: left + c * step, y: top + r * height / rows + gh / 2, h: gh, angle: 0, alpha: c % 4 === 1 ? .55 : .92, column: c, tone: 'plate' });
      }
    }
  }
  return tiles;
}
export function scene(base: Tile[], hero: Hero, w: number, h: number, index: number, amount: number, still: boolean): Tile[] {
  const effective = index % 4 === 3 ? index - 1 : index;
  const active = ((effective % base.length) + base.length) % base.length;
  const a = still ? 1 : amount;
  if (a === 0) return base;
  if (hero === 'a') {
    const tile = base[active];
    const mobile = w < 768;
    const gh = Math.min(h * .20, (mobile ? w * .27 : w * .16) / tile.g.aspect);
    const out = base.map((s, i) => i === active ? { ...s, alpha: s.alpha * (1 - a) } : s);
    // A rear fragment remains in place when the selected fragment leaves it.
    out.push({ ...tile, g: base[(active + 1) % base.length].g, alpha: a * .40 });
    out.push({ ...tile, x: tile.x + ((mobile ? w * .5 : w * .79) - tile.x) * a,
      y: tile.y + (h * (mobile ? .45 : .49) - tile.y) * a,
      h: tile.h + (gh - tile.h) * a, angle: tile.angle * (1 - a), alpha: tile.alpha + (1 - tile.alpha) * a, front: true, inkMix: a });
    return out;
  }
  const { cols, step } = plateGeometry(w), column = effective % cols;
  const shift = step * a;
  const out = base.filter(s => s.column !== column);
  const selected = base.filter(s => s.column === column);
  selected.forEach((s, i) => {
    const g = base[(active + i + 17) % base.length].g;
    // Keep the rear inside its original column, even for wide source fragments.
    const gh = Math.min(s.h, step * .7 / g.aspect);
    out.push({ ...s, g, y: s.y - s.h / 2 + gh / 2, h: gh, alpha: a, tone: 'rear' });
  });
  // A displaced plate covers the next column instead of superimposing two texts.
  // The source tiles remain intact underneath this background-colored face.
  const top = Math.min(...base.map(s => s.y - s.h / 2)), bottom = Math.max(...base.map(s => s.y + s.h / 2));
  const coverHeight = bottom - top + 2;
  out.push({ ...selected[0], g: { ...selected[0].g, aspect: step * .74 / coverHeight }, x: selected[0].x + shift,
    y: (top + bottom) / 2, h: coverHeight, alpha: a, cover: true });
  selected.forEach(s => out.push({ ...s, x: s.x + shift, alpha: s.alpha + (1 - s.alpha) * a, front: true, inkMix: a, tone: 'active' }));
  return out;
}
