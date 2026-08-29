import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { BEAT_SEC } from '../../components/DharaniClock/beat';
import { emitArrive } from '../walkerBus';
import './SambeWalker.css';

// ════════════════════════════════════════════════════════════════════════
// SambeWalker — 삼베 대리 신체(설계 §4)
//   · 전역 fixed 레이어. z-index 40 = 고정 헤더(50) **아래**
//     (reference_nodetreehome_fixed_header — 상단 오버레이가 헤더를 가리지 않게).
//   · 이동은 rAF + transform:translate3d 만. top/left 애니 금지. React 렌더 사이클 밖.
//   · 속도 1정간 / 9.508 s(= 1박). 절대 뛰지 않는다. 커서를 따라가지 않는다.
//   · 라우트가 바뀌어도 언마운트되지 않도록 <Routes> **바깥**에 둔다.
//     (설계 §4.3 은 "BrowserRouter 바깥"이라 적었지만 그러면 useLocation 을 못 쓴다.
//      Router 안 · Routes 밖이면 라우트 전환에도 이 컴포넌트는 유지된다 — 같은 목적.)
//   · prefers-reduced-motion = 정면 정지 · 320px 이하 비표시(CSS).
// ════════════════════════════════════════════════════════════════════════

const SPRITE_URL = '/redesign/sambe-sprite.svg';
const ROUTES_URL = '/redesign/walker-routes.json';
const WALK_FRAMES = ['walk-01', 'walk-02', 'walk-03', 'walk-04', 'walk-05', 'walk-06', 'walk-07', 'walk-08'];
const CYCLE_MS = 1200;             // 8프레임 보행 사이클
const STORAGE_KEY = 'nt.sambe.v1';
/** 라우트 진입 보행 = 1정간을 박/16(≈594 ms)에. 그 이상은 걸어서 못 가므로 한 정간만 들어간다.
 *  (평소 산책은 1정간/1박 = 9.508 s — 절대 뛰지 않는다는 규칙은 그대로.) */
const ENTER_SEC = 0.594;

interface RouteSpec { entry: number; patrol: [number, number]; bottom: number }
interface RoutesFile { routes: Record<string, RouteSpec>; default: RouteSpec }

/** v5 리디자인 라우트에서만 걷는다(레거시 홈·/iso·/ocean 에는 나타나지 않는다). */
export function isRedesignPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '/index' || pathname === '/about') return true;
  if (pathname === '/work') return true;
  return /^\/work\/(?!research\/)[^/]+$/.test(pathname);
}

/** 라우트 패턴 선택 — /work/:slug 는 파라미터 자리를 하나로 본다. */
function specFor(file: RoutesFile | null, pathname: string): RouteSpec {
  const fallback: RouteSpec = { entry: 7, patrol: [2, 18], bottom: 28 };
  if (!file) return fallback;
  const key =
    file.routes[pathname] ? pathname : /^\/work\/[^/]+$/.test(pathname) ? '/work/:slug' : pathname;
  return file.routes[key] ?? file.default ?? fallback;
}

const SambeWalker: React.FC = () => {
  const { pathname } = useLocation();
  const hostRef = useRef<HTMLDivElement>(null);
  const figRef = useRef<HTMLDivElement>(null);
  const routesRef = useRef<RoutesFile | null>(null);
  const loadedRef = useRef(false);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  // rAF 루프가 읽고 쓰는 가변 상태 — 리렌더를 유발하지 않는다.
  const st = useRef({
    x: -1,            // px, 화면 좌표
    dir: 1 as 1 | -1, // 1 = 오른쪽
    target: null as number | null,
    goal: 0,          // 순찰 목표(px)
    arrived: true,
    lastFrame: '',
    lastSave: 0,
  });

  // ── 스프라이트 1회 로드 + 마지막 위치 복원 (v5 라우트에 처음 들어올 때만)
  //   ⚠ StrictMode(dev)는 effect 를 즉시 두 번 돌린다. `let alive` 로 비동기 결과를 버리면
  //     첫 실행의 응답이 cleanup 에 막히고 두 번째 실행은 loadedRef 때문에 건너뛰어
  //     스프라이트가 영영 안 붙는다(실측). 그래서 취소 플래그 대신 **ref 존재**로만 가른다.
  useEffect(() => {
    if (!isRedesignPath(pathname) || loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      try {
        const [svg, routes] = await Promise.all([
          fetch(SPRITE_URL).then((r) => r.text()),
          fetch(ROUTES_URL).then((r) => r.json() as Promise<RoutesFile>),
        ]);
        if (!figRef.current) {
          loadedRef.current = false;                 // 다음 진입에서 다시 시도
          return;
        }
        figRef.current.innerHTML = svg;
        routesRef.current = routes;
        try {
          const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
          if (saved && typeof saved.x === 'number') {
            st.current.x = saved.x;
            st.current.dir = saved.dir === -1 ? -1 : 1;
          }
        } catch {
          /* 세션 저장은 없어도 그만 */
        }
      } catch {
        /* 스프라이트를 못 받으면 삼베는 나타나지 않는다 — 페이지는 그대로 동작 */
        loadedRef.current = false;
      }
    })();
  }, [pathname]);

  // ── 라우트 전환: 새 페이지 진입점으로 걸어간다
  useEffect(() => {
    if (!isRedesignPath(pathname)) return;
    const jeong = (window.innerWidth <= 767 ? window.innerWidth / 10 : window.innerWidth / 20);
    const spec = specFor(routesRef.current, pathname);
    const entry = spec.entry * jeong;
    if (st.current.x < 0) st.current.x = entry;       // 첫 방문 = 이미 도착해 기다리고 있다
    // 진입 보행은 한 정간까지만 — 나머지 거리는 도착 후 평소 걸음으로 좁힌다.
    const target = Math.max(st.current.x - jeong, Math.min(st.current.x + jeong, entry));
    st.current.target = target;
    st.current.arrived = false;
    // 높이는 CSS 단일 규칙(헤더 계선 아래 top) — 페이지별 bottom(walker-routes.json)은 더 쓰지 않는다.
  }, [pathname]);

  // ── rAF 루프
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const setFrame = (id: string) => {
      if (st.current.lastFrame === id || !figRef.current) return;
      const prev = figRef.current.querySelector('g.on');
      if (prev) prev.classList.remove('on');
      const next = figRef.current.querySelector(`#${id}`);
      if (next) next.classList.add('on');
      st.current.lastFrame = id;
    };

    if (reduced) {
      // 정면 정지 포즈로 고정 — 걷지 않는다.
      const id = window.setTimeout(() => {
        setFrame('stand-front');
        const jeong = window.innerWidth <= 767 ? window.innerWidth / 10 : window.innerWidth / 20;
        const spec = specFor(routesRef.current, pathRef.current);
        st.current.x = spec.entry * jeong;
        if (hostRef.current) hostRef.current.style.transform = `translate3d(${st.current.x}px,0,0)`;
        emitArrive(pathRef.current);
      }, 120);
      return () => window.clearTimeout(id);
    }

    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - prev) / 1000, 0.1);
      prev = now;
      const host = hostRef.current;
      if (!host || !routesRef.current) return;

      const jeong = window.innerWidth <= 767 ? window.innerWidth / 10 : window.innerWidth / 20;
      const spec = specFor(routesRef.current, pathRef.current);
      const s = st.current;
      if (s.x < 0) s.x = spec.entry * jeong;
      const speed = s.target !== null ? jeong / ENTER_SEC : jeong / BEAT_SEC;

      // 목표: 라우트 진입점 → 도착하면 순찰
      let goal: number;
      if (s.target !== null) {
        goal = s.target;
      } else {
        const [a, b] = spec.patrol;
        goal = (s.dir === 1 ? Math.max(a, b) : Math.min(a, b)) * jeong;
      }

      const d = goal - s.x;
      if (Math.abs(d) < 1.2) {
        if (s.target !== null) {
          s.target = null;
          if (!s.arrived) {
            s.arrived = true;
            emitArrive(pathRef.current);
          }
        } else {
          s.dir = s.dir === 1 ? -1 : 1;                 // 끝에서 돌아선다
          setFrame('turn-02');
        }
      } else {
        s.dir = d > 0 ? 1 : -1;
        s.x += Math.sign(d) * speed * dt;
        setFrame(WALK_FRAMES[Math.floor((now / (CYCLE_MS / WALK_FRAMES.length)) % WALK_FRAMES.length)]);
      }

      host.style.transform = `translate3d(${s.x.toFixed(2)}px,0,0) scaleX(${s.dir})`;

      if (now - s.lastSave > 1000) {
        s.lastSave = now;
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ x: s.x, dir: s.dir }));
        } catch {
          /* 무시 */
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`ntwalker${isRedesignPath(pathname) ? '' : ' ntwalker--off'}`} ref={hostRef} aria-hidden="true">
      <div className="ntwalker__fig" ref={figRef} />
    </div>
  );
};

export default React.memo(SambeWalker);
