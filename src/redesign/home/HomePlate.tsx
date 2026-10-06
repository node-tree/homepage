import React, { useEffect, useRef, useState } from 'react';
import { loadClockGlyphs } from '../../components/DharaniClock/atlas';
import { BEAT_SEC, beatAt, pad4 } from '../../components/DharaniClock/beat';
import { createPlateRenderer, PlateRenderer } from './renderer';
import { envelope, Hero, layout, Palette, plateGeometry, scene } from './scene';

export default function HomePlate({ hero, palette }: { hero: Hero; palette: Palette }) {
  const host = useRef<HTMLDivElement>(null), count = useRef<HTMLSpanElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const el = host.current!;
    let stopped = false, timer = 0, raf = 0, renderer: PlateRenderer | undefined;
    let observer: ResizeObserver | undefined;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true'); el.prepend(canvas);
    const clear = () => { clearTimeout(timer); cancelAnimationFrame(raf); };
    let redraw = () => {};
    const visible = () => { clear(); if (!document.hidden) redraw(); };
    document.addEventListener('visibilitychange', visible);
    media.addEventListener('change', visible);
    loadClockGlyphs().then(set => {
      if (stopped) return;
      try { renderer = createPlateRenderer(canvas, set, palette, new URLSearchParams(window.location.search).get('render') === '2d'); }
      catch {
        // A failed GL context cannot be changed to 2D; replace its canvas.
        const replacement = document.createElement('canvas'); replacement.setAttribute('aria-hidden', 'true'); canvas.replaceWith(replacement);
        renderer = createPlateRenderer(replacement, set, palette, true);
      }
      let w = 0, h = 0, base = layout(set, hero, 1, 1), staticIndex = beatAt().index, renders = 0;
      redraw = () => {
        clear(); if (stopped || document.hidden) return;
        const rect = el.getBoundingClientRect();
        if (w !== rect.width || h !== rect.height) {
          w = rect.width; h = rect.height; base = layout(set, hero, w, h);
          if (hero === 'b') {
            const { left, step } = plateGeometry(w);
            el.style.setProperty('--plate-left', `${left - step * .35}px`);
          }
        }
        const beat = beatAt(), t = beat.frac * BEAT_SEC, env = envelope(beat.index, t);
        if (count.current) count.current.textContent = pad4(beat.index);
        el.dataset.index = String(beat.index); el.dataset.phase = media.matches ? 'still' : env.moving ? 'moving' : t < 6.6 && beat.index % 4 !== 3 ? 'hold' : 'rest';
        el.dataset.amount = String(env.amount); el.dataset.renderer = renderer!.mode;
        if (!media.matches || renders === 0 || el.dataset.size !== `${w}:${h}` || el.dataset.reduced !== 'true') {
          renderer!.draw(scene(base, hero, w, h, media.matches ? staticIndex : beat.index, env.amount, media.matches), w, h);
          el.dataset.renders = String(++renders);
          el.dataset.size = `${w}:${h}`;
        }
        el.dataset.reduced = String(media.matches);
        el.dataset.ready = 'true';
        if (!media.matches && env.moving) raf = requestAnimationFrame(redraw);
        else {
          const until = media.matches ? BEAT_SEC - t : env.next - t;
          timer = window.setTimeout(redraw, Math.max(8, until * 1000 + 2));
        }
      };
      observer = new ResizeObserver(redraw); observer.observe(el); redraw();
    }).catch(() => { if (!stopped) setError(true); });
    return () => { stopped = true; clear(); observer?.disconnect(); renderer?.dispose(); el.querySelector('canvas')?.remove(); document.removeEventListener('visibilitychange', visible); media.removeEventListener('change', visible); };
  }, [hero, palette]);
  return <div ref={host} className={`home-plate home-plate--${hero}`} role="group" aria-label={hero === 'a' ? '정지한 다라니 원형 판에서 한 조각이 열리고 머문 뒤 거두어진다.' : '원자료 조각을 세로로 배열한 판. 한 묶음이 비켜나 뒤층을 드러낸다. 원문 순서를 재현한 배열은 아니다.'}>
    {error && <p className="home-error" role="status">다라니 조각을 불러오지 못했습니다. 페이지를 새로고침해 주세요.</p>}
    <div className="home-data">{hero === 'a' && <i aria-hidden="true" />}<span>讀誦 <span ref={count}>{pad4(beatAt().index)}</span> / 3029 · 8시간 순환</span><span className="home-material">{hero === 'a' ? '다라니 조각' : '조각의 조형 배열'}</span></div>
  </div>;
}
