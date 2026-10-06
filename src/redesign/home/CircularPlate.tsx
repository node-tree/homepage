import React, { useEffect, useRef, useState } from 'react';
import { loadClockGlyphs } from '../../components/DharaniClock/atlas';
import { BEAT_SEC, beatAt, pad4 } from '../../components/DharaniClock/beat';
import { circularFrame, circularModel, Material, Movement } from './circular';
import { createCircularRenderer } from './circularRenderer';

export default function CircularPlate({ mat, move }: { mat: Material; move: Movement }) {
  const host = useRef<HTMLDivElement>(null), count = useRef<HTMLSpanElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const el = host.current!, media = matchMedia('(prefers-reduced-motion: reduce)');
    let stopped = false, timer = 0, raf = 0, observer: ResizeObserver | undefined;
    let renderer: ReturnType<typeof createCircularRenderer> | undefined;
    let canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); el.prepend(canvas);
    const clear = () => { clearTimeout(timer); cancelAnimationFrame(raf); };
    let redraw = () => {};
    const visible = () => { clear(); if (!document.hidden) redraw(); };
    document.addEventListener('visibilitychange', visible); media.addEventListener('change', visible);
    loadClockGlyphs('home-r4/clock-glyphs').then(set => {
      if (stopped) return;
      const model = circularModel(set);
      const force2d = new URLSearchParams(window.location.search).get('render') === '2d';
      try { renderer = createCircularRenderer(canvas, set, model, mat, force2d); }
      catch {
        const replacement = document.createElement('canvas'); replacement.setAttribute('aria-hidden', 'true');
        canvas.replaceWith(replacement); canvas = replacement;
        renderer = createCircularRenderer(canvas, set, model, mat, true);
      }
      let renders = 0, size = '', lastKey = '', frozen = circularFrame(model, move);
      redraw = () => {
        clear(); if (stopped || document.hidden) return;
        const { width: w, height: h } = el.getBoundingClientRect();
        const live = circularFrame(model, move);
        const frame = media.matches ? { ...frozen, amount: 1, phase: 'still', moving: false } : live;
        if (!media.matches) frozen = live;
        const key = JSON.stringify([frame.index, frame.amount, frame.angles]);
        if (size !== `${w}:${h}` || key !== lastKey) {
          renderer!.draw(frame, w, h); renders++; size = `${w}:${h}`; lastKey = key;
        }
        if (count.current) count.current.textContent = pad4(live.index);
        Object.assign(el.dataset, { ready: 'true', material: mat, move, index: String(live.index), phase: frame.phase,
          amount: String(frame.amount), renders: String(renders), renderer: renderer!.mode,
          ringZ: '0,0,0,0,0', angles: frame.angles.join(','), active: String(frame.active.id),
          lift: '0', readScale: String(1 + frame.amount * .8), turningRing: String(frame.turningRing), reduced: String(media.matches) });
        if (!media.matches && live.moving) raf = requestAnimationFrame(redraw);
        else timer = window.setTimeout(redraw, Math.max(8, (media.matches ? (1 - beatAt().frac) * BEAT_SEC : live.until) * 1000 + 2));
      };
      observer = new ResizeObserver(redraw); observer.observe(el); redraw();
    }).catch(() => { if (!stopped) setError(true); });
    return () => { stopped = true; clear(); observer?.disconnect(); renderer?.dispose(); canvas.remove(); document.removeEventListener('visibilitychange', visible); media.removeEventListener('change', visible); };
  }, [mat, move]);
  return <div ref={host} className="home-plate home-plate--c" role="group" aria-label="다섯 고리의 다라니 원형 판. 12시 자리의 글자가 떠올라 머문 뒤 가라앉는다.">
    {error && <p className="home-error" role="status">다라니 조각을 불러오지 못했습니다. 페이지를 새로고침해 주세요.</p>}
    <div className="home-data"><span>讀誦 <span ref={count}>{pad4(beatAt().index)}</span> / 3029 · 8시간 순환</span><span className="home-material">다라니 조각</span></div>
  </div>;
}
