import React from 'react';
import { NavLink } from 'react-router-dom';
import { BEATS, pad4 } from '../../components/DharaniClock/beat';
import { useBeat } from '../useBeat';

/**
 * Header — 내비 4항목(설계 §1.1) + 독송 카운터(§2.3).
 *   position:fixed · z-index 50. 상단 절대배치 요소는 이 헤더 뒤로 숨는다
 *   (reference_nodetreehome_fixed_header) — 새 오버레이는 흐름배치나 헤더 클리어런스 필수.
 */
const NAV: { to: string; label: string; end?: boolean; external?: boolean }[] = [
  { to: '/', label: 'HOME', end: true },
  { to: '/about', label: 'NODE TREE' },
  { to: 'https://saengsanso.com', label: 'ART SPACE', external: true },
  { to: '/work', label: 'ART WORK' },
  { to: '/commons', label: 'COMMONS' },
  { to: '/cv', label: 'CV' },
  { to: '/contact', label: 'CONTACT' },
];

const Header: React.FC = () => {
  const beat = useBeat();
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
    </header>
  );
};

export default Header;
