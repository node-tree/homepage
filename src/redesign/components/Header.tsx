import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BEATS, pad4 } from '../../components/DharaniClock/beat';
import { useAuth } from '../../contexts/AuthContext';
import { useBeat } from '../useBeat';
import { useEditMode } from '../edit/EditModeContext';

/**
 * Header — 내비 4항목(설계 §1.1) + 독송 카운터(§2.3) + 관리자 문(§보조).
 *   position:fixed · z-index 50. 상단 절대배치 요소는 이 헤더 뒤로 숨는다
 *   (reference_nodetreehome_fixed_header) — 새 오버레이는 흐름배치나 헤더 클리어런스 필수.
 *
 *   우단은 두 줄이다: 위 = 독송 카운터, 아래 = 관리자 보조 링크(Mono 10px).
 *   보조 링크는 본 내비(sans 13px)보다 한 단 낮은 위계로만 있는다 — 아이콘·색 추가 없음.
 */
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

const Header: React.FC = () => {
  const beat = useBeat();
  const { pathname, search } = useLocation();
  const { isAuthenticated, isLoading, logout } = useAuth();
  const edit = useEditMode();

  // 로그인 후에는 보던 자리로 돌려보낸다(Login 은 같은 출처 절대경로만 허용).
  const next = encodeURIComponent(`${pathname}${search}`);

  return (
    <header>
      <div className="brand">
        <NavLink to="/">
          NODE TREE<span>노드 트리</span>
        </NavLink>
      </div>
      <nav className="nav">
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
      <div className="clock" title={`讀誦 ${pad4(beat.index)} / ${BEATS} · 1명 = 1박 · 9.508 s`}>
        <i />
        <span>讀誦</span>
        <b>{pad4(beat.index)}</b>
        <span>/ {BEATS}</span>
      </div>
      {/* 인증 영역 — 토큰 복원 중(isLoading)에는 비워 둔다(로그인/로그아웃 깜빡임 방지). */}
      <div className="auth">
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
    </header>
  );
};

export default Header;
