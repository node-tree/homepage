import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BEATS, pad4 } from '../../components/DharaniClock/beat';
import { useAuth } from '../../contexts/AuthContext';
import { useBeat } from '../useBeat';
import { useEditMode } from '../edit/EditModeContext';

/** Shared desktop navigation and mobile modal panel. */
const NAV: { to: string; label: string; end?: boolean; external?: boolean }[] = [
  { to: '/', label: 'HOME', end: true },
  { to: '/about', label: 'ABOUT' },
  { to: 'https://saengsanso.com', label: 'ART SPACE', external: true },
  { to: '/work', label: 'ART WORK' },
  { to: '/commons', label: 'COMMONS' },
  { to: '/cv', label: 'CV' },
  { to: '/contact', label: 'CONTACT' },
];

/** 지금 보고 있는 v5 페이지 → 같은 내용을 고치는 레거시 편집 화면(AdminLine 과 같은 규칙). */
export function legacyEditPath(pathname: string): string {
  const seg = pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  if (seg === 'about' || seg === 'work' || seg === 'commons' || seg === 'cv' || seg === 'contact') {
    return `/legacy/${seg}`;
  }
  return '/legacy';
}

// Lazy routes can mount their next Header after the closing frame.
let returnFocusToMenu = false;

const Header: React.FC = () => {
  const beat = useBeat();
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => { setMobile(media.matches); setOpen(false); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { setOpen(false); }, [location.key]);

  useLayoutEffect(() => {
    panelRef.current?.toggleAttribute('inert', mobile && !open);
    if (mobile && !open && returnFocusToMenu) {
      headerRef.current?.querySelector<HTMLButtonElement>('.menu-button')?.focus({ preventScroll: true });
      returnFocusToMenu = false;
    }
    if (!mobile || !open || !headerRef.current || !panelRef.current) return;
    const panel = panelRef.current;
    const scrollY = window.scrollY;
    const body = document.body;
    const saved = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
    Object.assign(body.style, { position: 'fixed', top: `-${scrollY}px`, width: '100%', overflow: 'hidden' });
    // Exclude the content behind the panel from keyboard and assistive navigation.
    const background = Array.from(headerRef.current.parentElement?.children || [])
      .filter(el => el !== headerRef.current && !el.hasAttribute('inert'));
    const brand = headerRef.current.querySelector('.brand');
    if (brand && !brand.hasAttribute('inert')) background.push(brand);
    background.forEach(el => el.setAttribute('inert', ''));
    // Wait for the visibility transition to make the panel focusable.
    const focusFrame = requestAnimationFrame(() => panel.querySelector<HTMLButtonElement>('.menu-close')?.focus());
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'))
      .filter(el => el.getClientRects().length > 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      if (event.key !== 'Tab') return;
      const nodes = focusable();
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    };
    const focusin = (event: FocusEvent) => {
      if (!panel.contains(event.target as Node)) focusable()[0]?.focus();
    };
    document.addEventListener('keydown', keydown);
    document.addEventListener('focusin', focusin);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', keydown);
      document.removeEventListener('focusin', focusin);
      background.forEach(el => el.removeAttribute('inert'));
      Object.assign(body.style, saved);
      window.scrollTo(0, scrollY);
      // A route change can replace Header; focus its new trigger after mounting.
      returnFocusToMenu = true;
      requestAnimationFrame(() => {
        const trigger = document.querySelector<HTMLButtonElement>('.menu-button');
        trigger?.focus({ preventScroll: true });
        if (document.activeElement === trigger) returnFocusToMenu = false;
      });
    };
  }, [mobile, open]);
  const { pathname, search } = location;
  const { isAuthenticated, isLoading, logout } = useAuth();
  const edit = useEditMode();
  // 로그인 후에는 보던 자리로 돌려보낸다(Login 은 같은 출처 절대경로만 허용).
  const next = encodeURIComponent(`${pathname}${search}`);

  return (
    <header ref={headerRef} className="menu-wrap" data-menu-open={mobile && open}>
      <div className="brand">
        <NavLink to={'/'}>
          NODE TREE<span>노드 트리</span>
        </NavLink>
      </div>
      <button className="menu-button" type="button" aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
        aria-expanded={mobile && open} aria-controls="nt-menu-panel" onClick={() => setOpen(value => !value)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>
      <div className="menu-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />
      <div ref={panelRef} id="nt-menu-panel" className="menu-panel"
        role={mobile ? 'dialog' : undefined} aria-modal={mobile && open ? true : undefined}
        aria-label={mobile ? '주 메뉴' : undefined} aria-hidden={mobile ? !open : undefined}>
        <button className="menu-close" type="button" aria-label="메뉴 닫기" onClick={() => setOpen(false)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg>
        </button>
        <nav onClick={event => { if ((event.target as Element).closest('a')) setOpen(false); }} id="nt-navigation" className="nav" aria-label="주 메뉴">
          {NAV.map((n) =>
            n.external ? (
              <a key={n.to} href={n.to} target="_blank" rel="noopener noreferrer">
                {n.label}
              </a>
            ) : (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : undefined)}>
                {n.label}
              </NavLink>
            ),
          )}
        </nav>
        <div className="clock" title={pathname === '/' ? `讀誦 ${pad4(beat.index)} / ${BEATS} · 1박 9.508 s · 8시간 순환 · 하루 세 번` : `讀誦 ${pad4(beat.index)} / ${BEATS} · 1명 = 1박 · 9.508 s`}>
          <i />
          <span>讀誦</span>
          <b>{pad4(beat.index)}</b>
          <span>/ {BEATS}</span>
        </div>
        {/* 인증 영역 — 토큰 복원 중(isLoading)에는 비워 둔다(로그인/로그아웃 깜빡임 방지). */}
        <div className="auth" onClick={event => { if ((event.target as Element).closest('a, button')) setOpen(false); }}>
          {isLoading ? null : !isAuthenticated ? (
            <a href={`/login?next=${next}`}>LOGIN</a>
          ) : (
            <>
              {/* EDIT = v5 안의 편집 모드 토글(레거시로 나가지 않는다). 켜진 상태는 DONE 으로 표시. */}
              <button type="button" onClick={edit.toggle} aria-pressed={edit.editing} className={edit.editing ? "on" : undefined}>
                {edit.editing ? "DONE" : "EDIT"}
              </button>
              <a className="wide" href="/admin/media">
                MEDIA
              </a>
              <a className="wide" href="/monitor">
                MONITOR
              </a>
              <a className="wide" href="/buyeo/1">
                BUYEO
              </a>
              <button type="button" onClick={logout}>
                LOGOUT
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
