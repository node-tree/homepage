// ═══════════════════════════════════════════════════════════════════════
// SignalMap.tsx — 마을의 신호: 살아 움직이는 마을지도 (설계 정본: 피그마 「웹지도 설계」)
//   진입: /iso#signal-map (딥링크 #signal-map/<id>)
//   구조: 캔버스 2장(지형 보일 + 액터) + 신호 DOM 버튼 + 카드(React)
//   콘텐츠 후입력: draft 신호는 이름만 — story·audio·photos가 scene.ts에 채워지면 나타난다.
// ═══════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { SignalMapRenderer, Camera } from './renderer';
import { SIGNALS, SCENE_W, SCENE_H, Signal } from './scene';
import { signalMapAPI } from '../../../services/api';
import './signalmap.css';

const OPEN_ZOOM = 1.7;
const hashSignalId = () => {
  const m = window.location.hash.match(/^#signal-map\/(.+)$/);
  return m ? m[1] : null;
};

const SignalMap: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const terrainRef = useRef<HTMLCanvasElement>(null);
  const actorsRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<SignalMapRenderer | null>(null);
  const camRef = useRef<Camera>({ x: 0, y: 0, k: 1 });
  const tweenRef = useRef(0);
  const reduced = useReducedMotion();
  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, k: 1 });
  const [openId, setOpenId] = useState<string | null>(hashSignalId);
  const [overrides, setOverrides] = useState<Record<string, Partial<Signal>>>({});
  useEffect(() => { signalMapAPI.get().then(setOverrides); }, []);
  const open = useMemo(() => {
    const base = SIGNALS.find(s => s.id === openId);
    return base ? { ...base, ...(overrides[base.id] || {}) } : null;
  }, [openId, overrides]);

  const applyCam = useCallback((c: Camera) => {
    camRef.current = c;
    rendererRef.current?.setCamera(c);
    setCam(c);
  }, []);

  /** 신호 중심으로 카메라 트윈 */
  const tweenTo = useCallback((target: Camera, ms = 600) => {
    cancelAnimationFrame(tweenRef.current);
    const from = { ...camRef.current };
    const t0 = performance.now();
    const ease = (u: number) => 1 - Math.pow(1 - u, 3);
    const step = (now: number) => {
      const u = Math.min(1, (now - t0) / ms);
      const e = reduced ? 1 : ease(u);
      applyCam({
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        k: from.k + (target.k - from.k) * e,
      });
      if (u < 1) tweenRef.current = requestAnimationFrame(step);
    };
    tweenRef.current = requestAnimationFrame(step);
  }, [applyCam, reduced]);

  const camForSignal = useCallback((sig: Signal): Camera => {
    const el = wrapRef.current;
    if (!el) return camRef.current;
    const { clientWidth: w, clientHeight: h } = el;
    const k = Math.max(OPEN_ZOOM, Math.max(w / SCENE_W, h / SCENE_H));
    // 데스크톱은 카드(우측 480px)를 피해 좌측 중심, 모바일은 상반부 중심
    const cx = w > 760 ? (w - 480) / 2 : w / 2;
    const cy = w > 760 ? h / 2 : h * 0.32;
    return { k, x: cx - sig.pos[0] * k, y: cy - sig.pos[1] * k };
  }, []);

  const openSignal = useCallback((sig: Signal) => {
    setOpenId(sig.id);
    window.history.pushState(null, '', `#signal-map/${sig.id}`); // 뒤로가기 = 닫기
    tweenTo(camForSignal(sig));
  }, [camForSignal, tweenTo]);

  const closeSignal = useCallback((viaHistory = false) => {
    setOpenId(null);
    if (!viaHistory) window.history.pushState(null, '', '#signal-map');
    const el = wrapRef.current;
    const r = rendererRef.current;
    if (el && r) tweenTo(r.fitCamera(el.clientWidth, el.clientHeight));
  }, [tweenTo]);

  // ── 마운트: 렌더러·리사이즈·해시 ──────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    const terrain = terrainRef.current;
    const actors = actorsRef.current;
    if (!el || !terrain || !actors) return;
    const r = new SignalMapRenderer(terrain, actors, !!reduced);
    rendererRef.current = r;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1); // DPR 상한 2 (설계 06)
      r.resize(el.clientWidth, el.clientHeight, dpr);
      const id = hashSignalId();
      const sig = SIGNALS.find(s => s.id === id);
      applyCam(sig ? camForSignal(sig) : r.fitCamera(el.clientWidth, el.clientHeight));
    };
    fit();
    if (!reduced) r.start(); else r.renderOnce();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const onVis = () => { if (reduced) return; document.hidden ? r.stop() : r.start(); };
    document.addEventListener('visibilitychange', onVis);
    const onHash = () => {
      const id = hashSignalId();
      if (!id) closeSignal(true);
      else {
        const sig = SIGNALS.find(s => s.id === id);
        if (sig) { setOpenId(sig.id); tweenTo(camForSignal(sig)); }
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      r.stop(); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('hashchange', onHash);
      cancelAnimationFrame(tweenRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  // ── 팬(드래그) + 줌(휠·핀치) — 포인터 이벤트 직접 (설계 06) ─────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ptrs = new Map<number, { x: number; y: number }>();
    let pinch0 = 0; let k0 = 1;
    const clamp = (c: Camera): Camera => {
      const { clientWidth: w, clientHeight: h } = el;
      const kMin = Math.max(w / SCENE_W, h / SCENE_H) * 0.9;
      const k = Math.max(kMin, Math.min(3.2, c.k));
      const x = Math.max(w - SCENE_W * k - 60, Math.min(60, c.x));
      const y = Math.max(h - SCENE_H * k - 60, Math.min(60, c.y));
      return { x, y, k };
    };
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.smap-card, .smap-btn, .smap-back')) return;
      el.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y); k0 = camRef.current.k;
      }
    };
    const move = (e: PointerEvent) => {
      const prev = ptrs.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      if (ptrs.size === 1) {
        applyCam(clamp({ ...camRef.current, x: camRef.current.x + cur.x - prev.x, y: camRef.current.y + cur.y - prev.y }));
      }
      ptrs.set(e.pointerId, cur);
      if (ptrs.size === 2 && pinch0) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const k = k0 * (d / pinch0);
        const c = camRef.current;
        const sx = (mid.x - c.x) / c.k; const sy = (mid.y - c.y) / c.k;
        applyCam(clamp({ k, x: mid.x - sx * k, y: mid.y - sy * k }));
      }
    };
    const up = (e: PointerEvent) => { ptrs.delete(e.pointerId); pinch0 = 0; };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = camRef.current;
      const k = c.k * Math.exp(-e.deltaY * 0.0015);
      const sx = (e.clientX - c.x) / c.k; const sy = (e.clientY - c.y) / c.k;
      applyCam(clamp({ k, x: e.clientX - sx * k, y: e.clientY - sy * k }));
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [applyCam]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && openId) closeSignal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId, closeSignal]);

  return (
    <div className="smap" ref={wrapRef}>
      <canvas ref={terrainRef} className="smap-canvas" aria-hidden="true" />
      <canvas ref={actorsRef} className="smap-canvas" aria-hidden="true" />

      {/* 신호 버튼 레이어 — 카메라 행렬 CSS 동기 (설계 06 L3) */}
      <div
        className="smap-signals"
        style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})` }}
      >
        {SIGNALS.filter(sig => !(overrides[sig.id] as any)?.hidden).map(sig => (
          <button
            key={sig.id}
            className={`smap-btn${openId === sig.id ? ' is-open' : ''}`}
            style={{
              left: sig.pos[0], top: sig.pos[1],
              transform: `translate(-50%,-50%) scale(${1 / cam.k})`,
              ['--on' as string]: `${sig.blink[0]}ms`,
              ['--off' as string]: `${sig.blink[1]}ms`,
            }}
            onClick={() => (openId === sig.id ? closeSignal() : openSignal(sig))}
            aria-label={`신호: ${sig.name}`}
          >
            <span className="smap-dot" />
            <span className="smap-name">{sig.name}</span>
          </button>
        ))}
      </div>

      <header className="smap-head">
        <h1>마을의 신호</h1>
        <p>LIVING VILLAGE MAP · JANGAM</p>
      </header>
      <button className="smap-back" onClick={onBack}>← 이소 홈으로</button>
      <footer className="smap-legend">
        <span className="smap-legend-dot" /> 신호 — 누르면 소개와 소리가 나옵니다
        <em>이 지도는 멈추지 않습니다</em>
      </footer>

      {open && (
        <aside className="smap-card" role="dialog" aria-label={`${open.name} 소개`}>
          <button className="smap-card-close" onClick={() => closeSignal()} aria-label="닫기">✕</button>
          <span className="smap-card-tag">SIGNAL · {open.id.toUpperCase()}</span>
          <h2>{open.name}</h2>
          {open.photos?.length ? <img src={open.photos[0]} alt={`${open.name} 실물 작품`} /> : null}
          {open.makers && <p className="smap-card-makers">만든 사람 · {open.makers}</p>}
          {open.story
            ? <p className="smap-card-story">{open.story}</p>
            : <p className="smap-card-draft">이 신호의 이야기와 소리는 프로그램이 끝나는 대로 채워집니다.</p>}
          {open.audio && (
            <audio className="smap-card-audio" controls preload="none" src={open.audio}>
              <track kind="captions" />
            </audio>
          )}
        </aside>
      )}
    </div>
  );
};

export default SignalMap;
