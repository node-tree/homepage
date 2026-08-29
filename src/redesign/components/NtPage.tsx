import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import SeoHead from '../../components/SeoHead';
import { ToastFromNav, ToastProvider } from '../edit';
import { useReveal } from '../useReveal';
import Footer from './Footer';
import Header from './Header';
import '../nt.css';
// 편집 모드 판식 — v5 청크에서만 실린다(레거시 라우트는 이 CSS 를 받지 않는다).
import '../editor.css';

// ════════════════════════════════════════════════════════════════════════
// NtPage — v5 공통 판식(헤더 · 본문 · 보행로 계선 · 푸터).
//   nt.css 는 여기서만 import 한다 → 레거시 라우트는 이 CSS 를 받지 않는다
//   (라우트 컴포넌트가 lazy 라 청크와 함께 늦게 실린다).
//   삼베 대리 신체는 라우트마다 언마운트되면 안 되므로 App 루트(Routes 바깥)에 있다.
// ════════════════════════════════════════════════════════════════════════

const BASE = 'https://nodetree.kr';
// v5 공용 OG 카드 — 히어로 포스터(_workspace/02_hero/hero-poster.png)에서 뜬 1200x630.
// 페이지가 따로 지정하지 않으면 5종 전부 이 카드를 쓴다.
// 치수 메타(og:image:width/height)는 public/index.html 에 1벌만 둔다.
const OG_IMAGE = '/redesign/og.jpg';

export interface NtPageProps {
  path: string;
  title: string;
  description: string;
  keywords?: string;
  /** 공용 OG 카드 대신 쓸 이미지 경로(선택) */
  image?: string;
  /** 헤더 바로 아래, main 바깥에 놓이는 영역(홈 다라니 시계 히어로) */
  hero?: React.ReactNode;
  /** 색인 제외 — 편집 화면(/work/new 등)처럼 읽을 것이 아닌 라우트 */
  noindex?: boolean;
  children: React.ReactNode;
}

const NtPage: React.FC<NtPageProps> = ({ path, title, description, keywords, image, hero, noindex, children }) => {
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
      <SeoHead
        title={title}
        description={description}
        url={`${BASE}${path === '/' ? '/' : path}`}
        keywords={keywords}
        image={`${BASE}${image ?? OG_IMAGE}`}
        noindex={noindex}
      />
      {/* 알림 제공자는 `.nt` 안에 둔다 — 토스트·대화상자가 v5 토큰(--ink 등)을 상속받아야 한다.
          편집 모드 제공자는 App(라우터 바로 안)에 있다 — 페이지 컴포넌트 자신이
          useEditMode() 를 부르므로 NtPage 보다 **위**에 있어야 한다. */}
      <ToastProvider>
        <ToastFromNav />
        <Header />
        {hero}
        <main className={`reveal${reveal ? ' in' : ''}`}>{children}</main>
        {/* 보행로 계선 — 삼베가 걷는 자리(캐릭터 자체는 전역 fixed 레이어) */}
        <div className="rail" />
        <Footer />
      </ToastProvider>
    </div>
  );
};

export default NtPage;
