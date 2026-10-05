import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { BEAT_SEC } from '../../components/DharaniClock/beat';
import { emitArrive } from '../walkerBus';
import './SambeWalker.css';

const SPRITE_URL = '/redesign/sambe-sprite.svg';
const ROUTES_URL = '/redesign/walker-routes.json';
const WALK_FRAMES = ['walk-01', 'walk-02', 'walk-03', 'walk-04', 'walk-05', 'walk-06', 'walk-07', 'walk-08'];
const CYCLE_MS = 1200;
const STORAGE_KEY = 'nt.sambe.v1';
const ENTER_SEC = 0.594;
interface RouteSpec { entry: number; patrol: [number, number]; bottom: number }
interface RoutesFile { routes: Record<string, RouteSpec>; default: RouteSpec }
interface Lane { min: number; max: number; top: number; width: number; height: number; placement: string }

export function isRedesignPath(pathname: string): boolean {
  if (['/', '/index', '/about', '/cv', '/contact', '/work', '/commons'].includes(pathname)) return true;
  if (/^\/work\/research\//.test(pathname)) return false;
  return /^\/(work|commons)\/[^/]+(\/edit)?$/.test(pathname);
}

function specFor(file: RoutesFile | null, pathname: string): RouteSpec {
  const fallback: RouteSpec = { entry: 7, patrol: [2, 18], bottom: 28 };
  if (!file) return fallback;
  const key = file.routes[pathname] ? pathname
    : /^\/work\/[^/]+/.test(pathname) ? '/work/:slug'
    : /^\/commons\/[^/]+/.test(pathname) ? '/commons/:slug' : pathname;
  return file.routes[key] ?? file.default ?? fallback;
}
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** Subtract occupied rectangles before allowing a whole sprite to enter a lane.
 *  Coordinates are sprite centres, so turning cannot cross a lane boundary. */
function freeLane(left: number, right: number, top: number, width: number, height: number,
  obstacles: DOMRect[], preferred: number, placement: string): Lane | null {
  let gaps = [[left, right]];
  for (const r of obstacles) {
    if (!r.width || !r.height || r.bottom <= top || r.top >= top + height) continue;
    gaps = gaps.flatMap(([a, b]) => r.right + 6 <= a || r.left - 6 >= b ? [[a, b]]
      : [[a, Math.min(b, r.left - 6)], [Math.max(a, r.right + 6), b]].filter(([x, y]) => y > x));
  }
  const lanes = gaps.filter(([a, b]) => b - a >= width).map(([a, b]) => ({
    min: a + width / 2, max: b - width / 2, top, width, height, placement,
  }));
  // Prefer a useful walking span, then the nearest safe segment. Never traverse menu text.
  lanes.sort((a, b) => {
    const usefulA = a.max - a.min >= 12, usefulB = b.max - b.min >= 12;
    return Number(usefulB) - Number(usefulA)
      || Math.abs(clamp(preferred, a.min, a.max) - preferred) - Math.abs(clamp(preferred, b.min, b.max) - preferred);
  });
  return lanes[0] || null;
}

function measureLane(header: HTMLElement, preferred: number): Lane | null {
  const mobile = window.innerWidth <= 767;
  const height = mobile ? 30 : 40;
  const width = height * 180 / 320;
  const bottom = header.getBoundingClientRect().bottom;
  const obstacles = Array.from(header.querySelectorAll<HTMLElement>('.brand a, .nav a, .clock > *, .auth a, .auth button, .menu-button, .menu-close'))
    .filter(el => getComputedStyle(el).visibility !== 'hidden')
    .map(el => el.getBoundingClientRect());
  return freeLane(8, window.innerWidth - 8, bottom - height - 1, width, height, obstacles, preferred, 'ruler');
}

/** Persistent across routes; rAF writes transforms outside React's render cycle.
 *  The ruler uses measured header gaps. */
const SambeWalker: React.FC = () => {
  const { pathname } = useLocation();
  const hostRef = useRef<HTMLDivElement>(null);
  const figRef = useRef<HTMLDivElement>(null);
  const routesRef = useRef<RoutesFile | null>(null);
  const loadedRef = useRef(false);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const st = useRef({ x: -1, dir: 1 as 1 | -1, target: null as number | null,
    arrived: false, pending: true, lastFrame: '', lastSave: 0 });

  useEffect(() => {
    if (!isRedesignPath(pathname) || loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      try {
        const [svg, routes] = await Promise.all([
          fetch(SPRITE_URL).then(r => { if (!r.ok) throw Error('sprite'); return r.text(); }),
          fetch(ROUTES_URL).then(r => { if (!r.ok) throw Error('routes'); return r.json() as Promise<RoutesFile>; }),
        ]);
        if (!figRef.current) { loadedRef.current = false; return; }
        figRef.current.innerHTML = svg;
        routesRef.current = routes;
        st.current.lastFrame = '';
        try {
          const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
          if (saved && Number.isFinite(saved.x)) {
            st.current.x = saved.x;
            st.current.dir = saved.dir === -1 ? -1 : 1;
          }
        } catch { /* session storage is optional */ }
      } catch { loadedRef.current = false; /* useReveal retains its 594ms cap */ }
    })();
  }, [pathname]);

  useEffect(() => {
    st.current.pending = true;
    st.current.arrived = false;
  }, [pathname]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let dirty = true, header: HTMLElement | null = null, lane: Lane | null = null;
    const invalidate = () => { dirty = true; };
    const resize = new ResizeObserver(invalidate);
    const mutations = new MutationObserver(invalidate);
    window.addEventListener('resize', invalidate);
    window.addEventListener('scroll', invalidate, { passive: true });
    media.addEventListener('change', invalidate);
    document.fonts.addEventListener('loadingdone', invalidate);
    const setFrame = (id: string) => {
      if (st.current.lastFrame === id || !figRef.current) return;
      const next = figRef.current.querySelector(`#${id}`);
      if (!next) return;
      figRef.current.querySelector('g.on')?.classList.remove('on');
      next.classList.add('on'); st.current.lastFrame = id;
    };
    const arrive = () => {
      st.current.target = null;
      if (!st.current.arrived) {
        st.current.arrived = true;
        emitArrive(pathRef.current);
      }
    };
    let raf = 0, prev = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - prev) / 1000, 0.1); prev = now;
      const host = hostRef.current;
      if (!host || !routesRef.current || !isRedesignPath(pathRef.current)) return;
      const nextHeader = document.querySelector<HTMLElement>('.nt header');
      if (header !== nextHeader) {
        resize.disconnect(); mutations.disconnect(); header = nextHeader; dirty = true;
        if (header) {
          resize.observe(header);
          header.querySelectorAll('.brand, .nav, .clock, .auth').forEach(el => resize.observe(el));
          mutations.observe(header, { subtree: true, childList: true, attributes: true, characterData: true });
        }
      }
      const mobile = window.innerWidth <= 767;
      const jeong = window.innerWidth / (mobile ? 10 : 20);
      const spec = specFor(routesRef.current, pathRef.current);
      // Routes are authored on a 20-cell score.
      const unit = window.innerWidth / 20;
      const s = st.current;
      if (dirty || s.pending) {
        const preferred = s.x < 0 ? spec.entry * unit : s.x;
        lane = header ? measureLane(header, preferred) : null;
        dirty = false;
        if (lane) {
          host.style.width = `${lane.width}px`; host.style.height = `${lane.height}px`;
          host.style.top = `${lane.top}px`;
          host.dataset.placement = lane.placement;
          host.dataset.laneMin = String(lane.min); host.dataset.laneMax = String(lane.max);
        }
      }
      host.style.visibility = lane ? 'visible' : 'hidden';
      if (!lane) { arrive(); return; }
      s.x = s.x < 0 ? clamp(spec.entry * unit, lane.min, lane.max) : clamp(s.x, lane.min, lane.max);
      if (s.target !== null) s.target = clamp(s.target, lane.min, lane.max);
      if (s.pending) {
        const entry = clamp(spec.entry * unit, lane.min, lane.max);
        if (s.x < 0) s.x = entry;
        s.target = clamp(entry, s.x - jeong, s.x + jeong);
        s.pending = false;
      }
      if (media.matches || window.innerWidth <= 320) {
        if (s.target !== null) s.x = s.target;
        s.dir = 1; setFrame('stand-front'); arrive();

      } else {
        const min = lane.min;
        const max = lane.max;
        const goal = s.target ?? (s.dir === 1 ? max : min);
        const d = goal - s.x;
        const step = (s.target !== null ? jeong / ENTER_SEC : jeong / BEAT_SEC) * dt;
        if (Math.abs(d) <= Math.max(0.01, step)) {
          s.x = goal;
          if (s.target !== null) arrive();
          else s.dir = s.dir === 1 ? -1 : 1;
          setFrame(max - min < 1 ? 'stand-front' : 'turn-02');
        } else {
          s.dir = d > 0 ? 1 : -1;
          s.x += Math.sign(d) * step;
          setFrame(WALK_FRAMES[Math.floor(now / (CYCLE_MS / WALK_FRAMES.length)) % WALK_FRAMES.length]);
        }
      }
      // Safe lanes use the sprite centre.
      const x = s.x - lane.width / 2;
      host.style.transform = `translate3d(${x.toFixed(3)}px,0,0) scaleX(${s.dir})`;
      host.dataset.arrived = String(s.arrived);
      if (now - s.lastSave > 1000) {
        s.lastSave = now;
        try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ x: s.x, dir: s.dir })); } catch { /* optional */ }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf); resize.disconnect(); mutations.disconnect();
      window.removeEventListener('resize', invalidate); window.removeEventListener('scroll', invalidate);
      media.removeEventListener('change', invalidate); document.fonts.removeEventListener('loadingdone', invalidate);
    };
  }, []);

  return <div className={`ntwalker ntwalker--ruler${isRedesignPath(pathname) ? '' : ' ntwalker--off'}`}
    data-mode="ruler" ref={hostRef} aria-hidden="true"><div className="ntwalker__fig" ref={figRef} /></div>;
};
export default React.memo(SambeWalker);
