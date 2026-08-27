// ════════════════════════════════════════════════════════════════════════
// DharaniClock.tsx — 陀羅尼 時計
//   설계 정본: 리서치 「nodetree.kr 리디자인 설계 v1」 §0-e
//   시각 정본: _workspace/03_mock/v5/hero-dark.html (다크) · v5/index.html (라이트)
//   글리프 자산: WG-018 재조판 서브아틀라스(public/dharani/clock-glyphs.*)
//
//   층위 — 아래에서 위로
//     ① SVG(하)  고리선 8 · 눈금 200 · 가림 블록 · 중심 지(紙) 바탕
//     ② canvas   먹 조각(WebGL2 SDF · 폴백 3× 래스터)
//     ③ SVG(상)  부채꼴 · 바늘 2 · OCR 박스 · 중심 계기 글줄
//     ④ HTML     판독 블록 · 계기 라벨 · 캡션 · 그레인
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BEATS, BEATS_PER_GAK, BEAT_SEC, beatAt, gakAngle, pad2, pad4, readingAngle,
} from './beat';
import { buildSlots, ClockGlyphSet, loadClockGlyphs, Slot } from './atlas';
import { CenterSeed, ClockRenderer, createRenderer, Theme } from './glyphRenderer';
import './DharaniClock.css';

/** 박 / 32 ≈ 297ms — 사이트의 모든 전환이 쓰는 리듬(설계 §2.3) */
export const STEP_MS = 300;
const EMPTY_IDS: number[] = [];   // 참조 고정용 빈 배열
const SEED_H = 132;              // 중심 종자자 표시 높이(뷰박스 단위)
const SWEEP_DEG = 36;          // 독송 바늘 뒤 판독 부채꼴
const OCR_WINDOW = BEATS_PER_GAK; // 판독의 기억은 한 각

const DAE = [3, 5, 8, 11, 13, 16];   // 대강 경계
const OCR_KINDS = [
  'OK 91%', 'OK 88%', 'OK 96%', 'UNRESOLVED 42%', 'OK 90%',
  'OK 93%', 'OK 87%', 'UNRESOLVED 51%', 'OK 95%',
];

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const polar = (r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a) * r, -Math.cos(a) * r];
};

export interface DharaniClockProps {
  theme?: Theme;
  /** 검수용 — 박 번호를 고정한다(운영에서는 쓰지 않는다) */
  beatOverride?: number;
  /** 우하 캡션(현재 전시) — 없으면 기본 문구 */
  caption?: React.ReactNode;
  className?: string;
}

interface ReadSlot { slot: Slot; d: number; }

const DharaniClock: React.FC<DharaniClockProps> = ({ theme = 'dark', beatOverride, caption, className }) => {
  const readBeat = useCallback(
    () => (beatOverride == null ? beatAt() : beatAt(new Date(Date.UTC(2026, 0, 1, 15, 0, 0) + beatOverride * BEAT_SEC * 1000 + 1))),
    [beatOverride]
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readHandRef = useRef<SVGGElement>(null);
  const gakHandRef = useRef<SVGGElement>(null);
  const sweepRef = useRef<SVGGElement>(null);

  const rendererRef = useRef<ClockRenderer | null>(null);
  const seedRef = useRef<{ prev: number; cur: number; t0: number }>({ prev: 0, cur: 0, t0: 0 });
  const handRef = useRef({ readFrom: 0, readTo: 0, gakFrom: 0, gakTo: 0, t0: 0 });
  const lastIndex = useRef(-1);
  const rafRef = useRef(0);
  const dirtyRef = useRef(true);

  const [set, setSet] = useState<ClockGlyphSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [beat, setBeat] = useState(() => (beatOverride == null ? beatAt() : beatAt(new Date(Date.UTC(2026, 0, 1, 15, 0, 0) + beatOverride * BEAT_SEC * 1000 + 1))));
  const [mode, setMode] = useState<'webgl2' | 'raster' | null>(null);
  /** rAF 가 도는지 — 탭 비활성 중단을 밖에서 관찰할 수 있게 DOM 에 적는다 */
  const [rafOn, setRafOn] = useState(false);

  const reduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // ── 자산 ────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    loadClockGlyphs()
      .then((s) => { if (alive) setSet(s); })
      .catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, []);

  const slots = useMemo(() => (set ? buildSlots(set) : []), [set]);

  // ⚠ `set?.rings.seed ?? []` 로 두면 자산 로드 전 매 렌더 **새 배열**이 되어 seedsFor 가
  //   불안정해지고, 그것을 의존성으로 가진 rAF 효과가 렌더마다 다시 붙는다(박마다 setBeat 로
  //   리렌더하므로 실제로 물린다). 참조를 고정한다.
  const seedIds = useMemo<number[]>(() => set?.rings.seed ?? EMPTY_IDS, [set]);

  // ── 렌더러 ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!set || !canvasRef.current) return;
    let r: ClockRenderer;
    try {
      r = createRenderer(canvasRef.current, set, theme);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    rendererRef.current = r;
    setMode(r.mode);
    r.setSlots(slots);
    const wrap = wrapRef.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const apply = () => {
      const w = wrap.clientWidth;
      if (!w) return;
      r.resize(w, dpr);
      dirtyRef.current = true;
      drawNow();
    };
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    apply();
    return () => {
      ro.disconnect();
      r.dispose();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, slots, theme]);

  const seedsFor = useCallback(
    (now: number): CenterSeed[] => {
      if (!set || !seedIds.length) return [];
      const st = seedRef.current;
      const t = reduced ? 1 : Math.min(1, (now - st.t0) / STEP_MS);
      const e = easeOutCubic(t);
      const cur = { group: set.groups[seedIds[st.cur]], h: SEED_H, alpha: 1 };
      // 같은 자거나 전환이 끝났으면 **한 장만** — 같은 글자를 (1−e)·e 로 두 번 겹치면
      // 합성이 1 이 되지 않아 획이 옅어진다(래스터 경로에서 유령처럼 보였다).
      if (st.prev === st.cur || e >= 0.999) return [cur];
      return [
        { group: set.groups[seedIds[st.prev]], h: SEED_H, alpha: 1 - e },
        { ...cur, alpha: e },
      ];
    },
    [set, seedIds, reduced]
  );

  const drawNow = useCallback(() => {
    const r = rendererRef.current;
    if (r) r.draw(seedsFor(performance.now()));
  }, [seedsFor]);

  // ── 박 · 바늘 · 크로스페이드 ─────────────────────────────────────────
  useEffect(() => {
    if (!set) return;
    const applyBeat = (b: ReturnType<typeof beatAt>, snap: boolean) => {
      const now = performance.now();
      const h = handRef.current;
      let rTo = readingAngle(b.index);
      let gTo = gakAngle(b.index);
      // 한 바퀴를 넘길 때 반대로 되감기지 않게 풀어준다
      if (rTo - h.readTo > 180) rTo -= 360;
      if (h.readTo - rTo > 180) rTo += 360;
      if (gTo - h.gakTo > 180) gTo -= 360;
      if (h.gakTo - gTo > 180) gTo += 360;
      h.readFrom = snap ? rTo : h.readTo;
      h.gakFrom = snap ? gTo : h.gakTo;
      h.readTo = rTo; h.gakTo = gTo; h.t0 = now;
      const s = seedRef.current;
      s.prev = snap ? b.index % 9 : s.cur;
      s.cur = b.index % 9;
      s.t0 = now;
      lastIndex.current = b.index;
      setBeat(b);
    };

    const paint = (now: number) => {
      const h = handRef.current;
      // 고리는 정지 · 바늘과 크로스페이드만 움직인다 — 걸음이 끝난 뒤엔 아무것도 다시 그리지 않는다
      if (!dirtyRef.current && now - h.t0 > STEP_MS + 32) return;
      dirtyRef.current = false;
      const t = easeOutCubic(Math.min(1, (now - h.t0) / STEP_MS));
      const ra = h.readFrom + (h.readTo - h.readFrom) * t;
      const ga = h.gakFrom + (h.gakTo - h.gakFrom) * t;
      readHandRef.current?.setAttribute('transform', `rotate(${ra.toFixed(4)})`);
      sweepRef.current?.setAttribute('transform', `rotate(${ra.toFixed(4)})`);
      gakHandRef.current?.setAttribute('transform', `rotate(${ga.toFixed(4)})`);
      const r = rendererRef.current;
      if (r) r.draw(seedsFor(now));
    };

    applyBeat(readBeat(), true);

    if (reduced) {
      // 정지 프레임 — rAF 없음
      const id = window.setTimeout(() => paint(performance.now() + STEP_MS * 2), 0);
      return () => window.clearTimeout(id);
    }

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const b = readBeat();
      if (b.index !== lastIndex.current) applyBeat(b, false);
      paint(performance.now());
    };
    const start = () => {
      if (!rafRef.current) {
        applyBeat(readBeat(), true);
        rafRef.current = requestAnimationFrame(loop);
        setRafOn(true);
      }
    };
    const stop = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      setRafOn(false);
    };
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    if (!document.hidden) start();
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, reduced, seedsFor, readBeat]);

  // ── OCR 판독 창: 독송 바늘 뒤 부채꼴 안에서 가까운 순 20개 ──────────────
  const A = readingAngle(beat.index);
  const readSlots: ReadSlot[] = useMemo(() => {
    const out: ReadSlot[] = [];
    for (const s of slots) {
      const d = ((A - s.a) % 360 + 360) % 360;
      if (d > SWEEP_DEG) continue;
      out.push({ slot: s, d });
    }
    out.sort((p, q) => p.d - q.d);
    return out.slice(0, OCR_WINDOW);
  }, [slots, A]);

  // 각이 바뀌면 소거 → 박마다 하나씩 다시 쌓인다(판독의 기억은 한 각)
  const shown = readSlots.slice(0, beat.phase + 1);
  const current = shown.find((x) => x.slot.ri === 0) ?? shown[0];
  // 라벨은 고리마다 **바늘에 가장 가까운 한 칸**에만 — 20칸이 36° 안에 몰려 라벨이 겹친다
  const labelled = new Set<string>();
  for (const x of shown) {
    const key = String(x.slot.ri);
    if (!labelled.has(key)) labelled.add(key + ':' + x.slot.i);
    labelled.add(key);
  }
  const redactedN = shown.filter((x) => x.slot.red).length;
  const seedNo = beat.index % 9;

  // ── 정적 기하 ───────────────────────────────────────────────────────
  const ticks = useMemo(() => {
    const el: React.ReactElement[] = [];
    for (let i = 0; i < 200; i++) {
      const dae = DAE.includes(i % 20);
      const [x1, y1] = polar(450, (i / 200) * 360);
      const [x2, y2] = polar(dae ? 434 : 442, (i / 200) * 360);
      el.push(
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={dae ? 'tick k' : 'tick'} />
      );
    }
    return el;
  }, []);

  const sweepPath = useMemo(() => {
    // 도넛 부채꼴 — 중심 종자자를 씻지 않도록 안쪽 r=80 에서 시작한다
    const [ox, oy] = polar(450, -SWEEP_DEG);
    const [ix, iy] = polar(80, -SWEEP_DEG);
    return `M0 -80 L0 -450 A450 450 0 0 0 ${ox} ${oy} L${ix} ${iy} A80 80 0 0 1 0 -80 Z`;
  }, []);

  if (error) {
    return (
      <section className={`dclock dclock--${theme} dclock--error ${className || ''}`}>
        <div className="dclock__fallback">
          陀羅尼 時計 — 자산을 읽지 못했습니다<br />
          <span>{error}</span>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`dclock dclock--${theme}${reduced ? ' dclock--still' : ''} ${className || ''}`}
      data-mode={mode || 'loading'}
      data-beat={beat.index}
      data-raf={reduced ? 'reduced' : rafOn ? 'on' : 'off'}
    >
      <div className="dclock__disc" ref={wrapRef}>
        {/* ① 아래 층 — 고리선·눈금·가림 블록·중심 지 바탕 */}
        <svg className="dclock__svg dclock__svg--under" viewBox="-470 -470 940 940" aria-hidden="true">
          <circle className="ring k" r={450} />
          {[412, 348, 284, 222, 160].map((r) => (
            <circle key={r} className="ring" r={r} />
          ))}
          <circle className="ring k" r={112} />
          <circle className="ring k" r={80} />
          <g className="ticks">{ticks}</g>
          <g className="redacted">
            {slots
              .filter((s) => s.red)
              .map((s, k) => (
                <rect
                  key={k}
                  x={-s.w / 2}
                  y={-s.r - s.h / 2}
                  width={s.w}
                  height={s.h}
                  transform={`rotate(${s.a})`}
                />
              ))}
          </g>
          <circle className="dclock__core" r={78} />
        </svg>

        {/* ② 먹 조각 — WebGL2 SDF */}
        <canvas className="dclock__gl" ref={canvasRef} aria-hidden="true" />

        {/* ③ 위 층 — 부채꼴·바늘·OCR·중심 계기 글줄 */}
        <svg
          className="dclock__svg dclock__svg--over"
          viewBox="-470 -470 940 940"
          role="img"
          aria-label={`다라니 시계 — 독송 ${pad4(beat.index)} / ${BEATS}`}
        >
          <g ref={sweepRef}>
            <path className="sweep" d={sweepPath} />
          </g>
          <g ref={gakHandRef}>
            <line className="hand2" x1={0} y1={0} x2={0} y2={-330} />
          </g>
          <g ref={readHandRef}>
            <line className="hand" x1={0} y1={0} x2={0} y2={-448} />
          </g>
          <circle r={3} className="dclock__pivot" />

          <g className="ocr">
            {shown.map((x, k) => {
              const s = x.slot;
              const now = current && x === current;
              const label = s.red ? 'REDACTED' : OCR_KINDS[(s.ri * 7 + s.i) % OCR_KINDS.length];
              const cls = label.startsWith('UN') ? 'u' : s.red ? 'b' : '';
              return (
                <g key={`${s.ri}-${s.i}`} className={now ? 'ocr-g now' : 'ocr-g'} transform={`rotate(${s.a})`}>
                  <rect
                    x={-s.w / 2 - 2}
                    y={-s.r - s.h / 2 - 2}
                    width={s.w + 4}
                    height={s.h + 4}
                    className={cls}
                  />
                  {(now || labelled.has(s.ri + ':' + s.i)) && (
                    <text x={0} y={-s.r - s.h / 2 - 6} textAnchor="middle">
                      {now ? `讀 ${pad4(beat.index)} · 94%` : label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          <g className="dclock__meter">
            <text x={0} y={-96} textAnchor="middle">
              {`現 ${pad4(beat.index)} · 種字 ${pad2(seedNo + 1)} / 09 · 觀音願文`}
            </text>
            <text x={0} y={104} textAnchor="middle">1 名 = 1 拍 · {BEAT_SEC.toFixed(3)} S</text>
          </g>
        </svg>
      </div>

      {/* ④ 판독 블록 */}
      <div className="dclock__readbox">
        <div className="hd">判讀 · OCR L2</div>
        <div className="ln k">
          讀 {pad4(beat.index)} · 種字 · siddham · <span className="r">未判讀</span>
        </div>
        <div className="ln">品官 · 觀音願文 · 兩主 ‖ 單身</div>
        <div className="ln">
          現 {pad4(beat.index)} · 種字 {pad2(seedNo + 1)} / 09 · {current?.slot.ring === 'donor' ? '施主名單' : '觀音願文'}
        </div>
        <div className="ln">1 名 = 1 拍 · {BEAT_SEC.toFixed(3)} S</div>
        <div className="ln dim">L2 · stated · REDACTED {redactedN} · 角 {pad2(beat.gak % 100)}</div>
      </div>

      <div className="dclock__lab">
        <b>陀羅尼 時計</b>
        <br />
        {BEATS.toLocaleString('en-US')} 拍 / 日 · 1 角 = 20 井間
        <br />
        大綱 3 · 5 · 8 · 11 · 13 · 16
        <br />
        <span className="r">■</span> 讀誦 {pad4(beat.index)} / {BEATS} &nbsp;<b>—</b> 角{' '}
        {pad2(beat.gak % 100)} · OCR L2
      </div>

      <div className="dclock__cap">
        {caption ?? (
          <>
            <span className="h">공생직조 〈이물〉</span> — 1488년 발원문 3,029명을 하루에 한
            사람씩 판독한다. 읽히지 않는 자리는 검게 남는다.
            <br />
            <span className="m">UPCOMING · 2026.12.11 · BUSAN MoCA</span>
          </>
        )}
      </div>

      <div className="dclock__grain" aria-hidden="true" />
    </section>
  );
};

export default DharaniClock;
