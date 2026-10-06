import { ClockGlyphSet, GlyphGroup } from '../../components/DharaniClock/atlas';

export interface Tile { color: string; g: GlyphGroup; x: number; y: number; h: number; angle: number; alpha: number; front?: boolean; inkMix?: number }
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1e-6))); return t * t * (3 - 2 * t); };
export interface PlateRenderer { mode: string; draw(tiles: Tile[], w: number, h: number): void; dispose(): void }

export function createRasterRenderer(canvas: HTMLCanvasElement, set: ClockGlyphSet): PlateRenderer {
  const ctx = canvas.getContext('2d')!;
  const atlas = document.createElement('canvas');
  atlas.width = set.atlasSize[0]; atlas.height = set.atlasSize[1];
  const ac = atlas.getContext('2d', { willReadFrequently: true })!;
  ac.drawImage(set.image, 0, 0);
  const data = ac.getImageData(0, 0, atlas.width, atlas.height).data;
  const cache = new Map<string, HTMLCanvasElement>();
  const colors = new Map<string, string>();
  return { mode: 'raster', draw(tiles, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    for (const tile of tiles) {
      const { g } = tile;
      const col = rgb(tile.color);
      const color = col.join(',');
      const scale = tile.front ? 4 : 1;
      const solid = false;
      const key = `${g.id}-${scale}-${solid}`;
      let sprite = cache.get(key);
      if (!sprite) {
        const [ax, ay, aw, ah] = g.atlas;
        sprite = document.createElement('canvas'); sprite.width = aw * scale; sprite.height = ah * scale;
        const sw = sprite.width, sh = sprite.height;
        const sc = sprite.getContext('2d')!, im = sc.createImageData(sw, sh);
        for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
          const sx = Math.max(0, (x + .5) / scale - .5), sy = Math.max(0, (y + .5) / scale - .5);
          const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
          let sdf = 0, dens = 0;
          for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) {
            const p = ((ay + Math.min(ah - 1, y0 + yy)) * atlas.width + ax + Math.min(aw - 1, x0 + xx)) * 4;
            const weight = (xx ? fx : 1 - fx) * (yy ? fy : 1 - fy);
            sdf += data[p] / 255 * weight; dens += data[p + 1] / 255 * weight;
          }
          const o = (y * sw + x) * 4;
          const edge = scale > 1 ? .016 : .04;
          const alpha = smooth(128 / 255 - edge, 128 / 255 + edge, sdf) * smooth(g.densGate * .5, g.densGate, dens) * (solid ? 1 : .72 + dens * .28);
          col.forEach((v, c) => { im.data[o + c] = v * 255; }); im.data[o + 3] = alpha * 255;
        }
        sc.putImageData(im, 0, 0); cache.set(key, sprite); colors.set(key, color);
      }
      if (colors.get(key) !== color) {
        const sc = sprite.getContext('2d')!; sc.globalCompositeOperation = 'source-in';
        sc.fillStyle = `rgb(${col.map(v => Math.round(v * 255)).join(',')})`;
        sc.fillRect(0, 0, sprite.width, sprite.height); sc.globalCompositeOperation = 'source-over'; colors.set(key, color);
      }
      ctx.save(); ctx.translate(tile.x, tile.y); ctx.rotate(tile.angle); ctx.globalAlpha = tile.alpha;
      ctx.drawImage(sprite, -tile.h * g.aspect / 2, -tile.h / 2, tile.h * g.aspect, tile.h); ctx.restore();
    }
  }, dispose() { cache.clear(); colors.clear(); atlas.width = 0; } };
}
