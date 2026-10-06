import { ClockGlyphSet } from '../../components/DharaniClock/atlas';
import { Palette, Tile } from './scene';

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const luminance = (c: number[]) => c.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
const rearColors = new Map<string, number[]>();
function rearColor(pal: Palette) {
  const key = `${pal.bg}:${pal.residual}`;
  if (!rearColors.has(key)) {
    const bg = rgb(pal.bg), residual = rgb(pal.residual), l = luminance(bg);
    let low = 0, high = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2, m = luminance(mix(bg, residual, mid));
      if ((Math.max(l, m) + .05) / (Math.min(l, m) + .05) < 1.3) low = mid; else high = mid;
    }
    rearColors.set(key, mix(bg, residual, (low + high) / 2));
  }
  return rearColors.get(key)!;
}
const tileColor = (tile: Tile, pal: Palette) => {
  if (tile.color) return rgb(tile.color);
  if (tile.cover) return rgb(pal.bg);
  if (tile.tone) {
    if (tile.tone === 'rear') return rearColor(pal);
    const trace = tile.g.vermilion ? mix(rgb(pal.mark), rgb(pal.bg), .6) : rgb(pal.residual);
    return tile.tone === 'active' ? mix(trace, rgb(pal.mark), tile.inkMix ?? 1) : trace;
  }
  if (tile.g.vermilion) return rgb('#BE3C28');
  const a = tile.front ? tile.inkMix ?? 1 : 0, front = rgb(pal.ink), back = rgb(pal.residual);
  return back.map((v, i) => v + (front[i] - v) * a);
};
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1e-6))); return t * t * (3 - 2 * t); };
export interface PlateRenderer { mode: string; draw(tiles: Tile[], w: number, h: number): void; dispose(): void }

function raster(canvas: HTMLCanvasElement, set: ClockGlyphSet, pal: Palette): PlateRenderer {
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
      if (tile.cover) {
        ctx.globalAlpha = tile.alpha; ctx.fillStyle = pal.bg;
        ctx.fillRect(tile.x - tile.h * g.aspect / 2, tile.y - tile.h / 2, tile.h * g.aspect, tile.h);
        ctx.globalAlpha = 1; continue;
      }
      const col = tileColor(tile, pal);
      const color = col.join(',');
      const scale = tile.front ? 4 : 1;
      const solid = tile.tone === 'active';
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

export function createPlateRenderer(canvas: HTMLCanvasElement, set: ClockGlyphSet, pal: Palette, forceRaster: boolean): PlateRenderer {
  const gl = !forceRaster && canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) return raster(canvas, set, pal);
  const compile = (type: number, text: string) => {
    const s = gl.createShader(type)!; gl.shaderSource(s, text); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('SDF shader compile failed'); return s;
  };
  const vs = compile(gl.VERTEX_SHADER, `#version 300 es
    in vec2 pos; in vec2 uv; in vec4 color; in float gate; in float solid;
    out vec2 vUv; out vec4 vColor; out float vGate; out float vSolid;
    void main(){ gl_Position=vec4(pos,0.,1.); vUv=uv; vColor=color; vGate=gate; vSolid=solid; }`);
  const fs = compile(gl.FRAGMENT_SHADER, `#version 300 es
    precision highp float; uniform sampler2D atlas;
    in vec2 vUv; in vec4 vColor; in float vGate; in float vSolid; out vec4 frag;
    void main(){ vec2 t=texture(atlas,vUv).rg; float w=clamp(fwidth(t.r)*.75,.002,.25);
      float a=vGate<0. ? vColor.a : smoothstep(128./255.-w,128./255.+w,t.r)*smoothstep(vGate*.5,vGate,t.g)*mix(.72+t.g*.28,1.,vSolid)*vColor.a;
      frag=vec4(vColor.rgb*a,a); }`);
  const program = gl.createProgram()!; gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('SDF shader link failed');
  gl.useProgram(program);
  const buffer = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  let offset = 0;
  for (const [name, size] of [['pos', 2], ['uv', 2], ['color', 4], ['gate', 1], ['solid', 1]] as [string, number][]) {
    const loc = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 40, offset * 4); offset += size;
  }
  const texture = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, set.image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return { mode: 'webgl2', draw(tiles, w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const values: number[] = [];
    tiles.forEach(t => {
      const col = tileColor(t, pal);
      const c = Math.cos(t.angle), s = Math.sin(t.angle), [u0, v0, u1, v1] = t.g.uv;
      for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [0, 1], [1, 0], [1, 1]]) {
        const x = (cx - .5) * t.h * t.g.aspect, y = (cy - .5) * t.h;
        values.push((t.x + x * c - y * s) / w * 2 - 1, 1 - (t.y + x * s + y * c) / h * 2,
          u0 + cx * (u1 - u0), v0 + cy * (v1 - v0), ...col, t.alpha, t.cover ? -1 : t.g.densGate, t.tone === 'active' ? 1 : 0);
      }
    });
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES, 0, values.length / 10);
  }, dispose() { gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs); } };
}
