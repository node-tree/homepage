import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import SeoHead from '../../components/SeoHead';
import { useReveal } from '../useReveal';
import Footer from './Footer';
import Header from './Header';
import '../nt.css';

// ════════════════════════════════════════════════════════════════════════
// NtPage — v5 공통 판식(헤더 · 본문 · 보행로 계선 · 푸터).
//   nt.css 는 여기서만 import 한다 → 레거시 라우트는 이 CSS 를 받지 않는다
//   (라우트 컴포넌트가 lazy 라 청크와 함께 늦게 실린다).
//   삼베 대리 신체는 라우트마다 언마운트되면 안 되므로 App 루트(Routes 바깥)에 있다.
// ════════════════════════════════════════════════════════════════════════

const BASE = 'https://nodetree.kr';

export interface NtPageProps {
  path: string;
  title: string;
  description: string;
  keywords?: string;
  /** 헤더 바로 아래, main 바깥에 놓이는 영역(홈 다라니 시계 히어로) */
  hero?: React.ReactNode;
  children: React.ReactNode;
}

const NtPage: React.FC<NtPageProps> = ({ path, title, description, keywords, hero, children }) => {
  const reveal = useReveal();
  const { hash, pathname } = useLocation();

  // 라우트 전환 시 최상단으로. 해시가 있으면 고정 헤더(56px) 아래로 맞춰 스크롤한다.
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="nt">
      <SeoHead title={title} description={description} url={`${BASE}${path === '/' ? '' : path}`} keywords={keywords} />
      <Header />
      {hero}
      <main className={`reveal${reveal ? ' in' : ''}`}>{children}</main>
      {/* 보행로 계선 — 삼베가 걷는 자리(캐릭터 자체는 전역 fixed 레이어) */}
      <div className="rail" />
      <Footer />
    </div>
  );
};

export default NtPage;
