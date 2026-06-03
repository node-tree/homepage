import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import './kkumdarak.css';
import { SECTIONS, ANNOUNCE, MOTION } from './data';
import MainHero from './MainHero';
import { KkumdarakAuthProvider, useKkumdarakAuth } from './KkumdarakAuthContext';

// ── 코드 스플리팅 ────────────────────────────────────────────────
// 초기 진입(메인 히어로)에 필요 없는 섹션은 청크 분리해 초기 번들 축소.
// 특히 admin/BusinessAdmin 은 로그인 게이트 + 무거운 폼/장부/이미지 처리(imageToPng·PhotoUpload)를
// 포함하므로 공개 방문자 번들에서 반드시 분리한다(정적 import 시 히어로와 같은 청크에 동봉됨).
const Intro = lazy(() => import('./Intro'));
const Programs = lazy(() => import('./Programs'));
const Schedule = lazy(() => import('./Schedule'));
const VillageDiary = lazy(() => import('./VillageDiary'));
const Directions = lazy(() => import('./Directions'));
const BusinessAdmin = lazy(() => import('./admin/BusinessAdmin'));

// 섹션 청크 로딩 폴백 — 화면 점프 없이 최소 높이만 확보.
const SectionFallback: React.FC = () => (
  <div className="kd-section-loading" aria-busy="true" aria-live="polite">
    <span className="kd-section-loading-dot" />
    <span className="kd-section-loading-dot" />
    <span className="kd-section-loading-dot" />
  </div>
);

// ═══════════════════════════════════════════════════════════════
// 꿈다락 문화예술학교 마이크로사이트 — /kkumdarak 독립 라우트
// 디자인: 크림 종이 위 굵은 라인, 페스티벌 쉐이프, 정리된 파이프 히어로
// ═══════════════════════════════════════════════════════════════

// 사업관리 섹션 id — SECTIONS(공개 nav)에는 넣지 않는다(로그인 전용·DOM 미노출).
const ADMIN_SECTION = 'admin';

const getInitialKkumdarakSection = () => {
  if (typeof window === 'undefined') return 'main';
  const section = window.location.hash.replace('#', '');
  return SECTIONS.some((item) => item.id === section) ? section : 'main';
};

// Google Fonts 로드: Figma 디자인 파일의 Jua / Gothic A1 / Fredoka 조합.
function useKkumdarakFonts() {
  useEffect(() => {
    const id = 'kkumdarak-fonts';
    if (document.getElementById(id)) return;
    const pre1 = document.createElement('link');
    pre1.rel = 'preconnect';
    pre1.href = 'https://fonts.googleapis.com';
    const pre2 = document.createElement('link');
    pre2.rel = 'preconnect';
    pre2.href = 'https://fonts.gstatic.com';
    pre2.crossOrigin = 'anonymous';
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Fredoka:wght@700&family=Gothic+A1:wght@400;700;800&family=Jua&family=Noto+Sans+KR:wght@400;700;800&display=swap';
    document.head.appendChild(pre1);
    document.head.appendChild(pre2);
    document.head.appendChild(link);
  }, []);
}

// ── 네비 워킹 캐릭터 ─────────────────────────────────────────
// 모바일(≤900px)에서도 헤더 로고~햄버거 사이 여백에서 로밍하도록 활성화.
// kkumdarak.css 의 `@media(max-width:900px){.kd-nav-walker{display:none}}` 를
// 헤더(항상 마운트되는 컴포넌트) 내 스코프 스타일로 덮어쓴다(데스크톱 무영향).
// 모바일 헤더(66px)에 맞춰 캐릭터 44px로 축소(로고·햄버거와 겹침/클리핑 방지).
const NAV_WALKER_MOBILE_CSS = `
@media (max-width: 900px) {
  .kkumdarak .kd-nav-walker { display: flex !important; }
  .kkumdarak .kd-nav-walker-char {
    width: 44px !important;
    height: 44px !important;
    margin-top: -22px !important;
  }
  /* 로밍 정지점도 44px 폭에 맞춰(우측 끝에서 햄버거와 안 겹치게) */
  @keyframes kd-nav-walk-pos-m {
    0%   { left: 0; }
    50%  { left: calc(100% - 44px); }
    100% { left: 0; }
  }
  .kkumdarak .kd-nav-walker-char {
    animation:
      kd-nav-walk-pos-m 14s ease-in-out infinite,
      kd-nav-walk-flip  14s steps(1, end) infinite !important;
  }
}
`;

function NavWalker() {
  return (
    <div className="kd-nav-walker">
      <style>{NAV_WALKER_MOBILE_CSS}</style>
      <div className="kd-nav-walker-char">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <img
            key={i}
            src={`/kkumdarak/chars-v2/character-12/frame-0${i}.svg`}
            alt=""
            className="kd-loop-frame"
            decoding="async"
          />
        ))}
      </div>
    </div>
  );
}

// ── nav 도형 로그인 버튼 ("오시는 길" 옆) ─────────────────────────
//   진입점: 꿈다락 편집 인증. 컨텍스트(useKkumdarakAuth)를 소비하므로
//   반드시 KkumdarakAuthProvider 내부에서 렌더되는 별도 컴포넌트여야 한다
//   (Kkumdarak 본문에서 직접 훅 호출 시 Provider 상위라 default 값을 읽음).
//   · 비인증: 외곽선 다이아몬드 → 클릭 시 requestLogin()(모달 오픈)
//   · 인증됨: 채워진 accent 다이아몬드(편집 세션 활성) → 클릭 시 logout()
const NavAuthButton: React.FC<{
  variant?: 'desktop' | 'mobile';
  onAfterAction?: () => void;
}> = ({ variant = 'desktop', onAfterAction }) => {
  const { authed, requestLogin, logout } = useKkumdarakAuth();
  return (
    <button
      type="button"
      className={`kd-nav-auth${authed ? ' is-authed' : ''} kd-nav-auth--${variant}`}
      aria-label={authed ? '관리자 로그아웃' : '관리자 로그인'}
      title={authed ? '꿈다락 관리자 로그아웃' : '꿈다락 관리자 로그인'}
      aria-pressed={authed}
      onClick={() => {
        if (authed) logout();
        else requestLogin();
        onAfterAction?.();
      }}
    >
      <span className="kd-nav-auth-shape" aria-hidden="true" />
    </button>
  );
};

// ── nav 「사업관리」 링크 (로그인 시에만 노출) ─────────────────────
//   NavAuthButton 과 동일한 이유로 별도 컴포넌트로 분리한다:
//   Kkumdarak 본문에서 useKkumdarakAuth() 를 직접 읽으면 Provider 상위라
//   default(authed:false)만 읽혀 로그인해도 메뉴가 영영 안 보인다.
//   비로그인 시 null 반환 → DOM 미노출.
const NavAdminLink: React.FC<{
  active: boolean;
  variant?: 'desktop' | 'mobile';
  onNavigate: () => void;
}> = ({ active, variant = 'desktop', onNavigate }) => {
  const { authed } = useKkumdarakAuth();
  if (!authed) return null;
  return (
    <button
      type="button"
      className={`kd-pill kd-pill-admin${active ? ' active' : ''} kd-pill-admin--${variant}`}
      onClick={onNavigate}
    >
      사업관리
    </button>
  );
};

const Kkumdarak: React.FC = () => {
  useKkumdarakFonts();
  const reduced = useReducedMotion();
  const [section, setSection] = useState<string>(getInitialKkumdarakSection);
  const [menuOpen, setMenuOpen] = useState(false);

  const go = useCallback((id: string) => {
    setSection(id);
    setMenuOpen(false);
    window.history.replaceState(null, '', id === 'main' ? window.location.pathname : `#${id}`);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const onHashChange = () => setSection(getInitialKkumdarakSection());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const renderSection = () => {
    switch (section) {
      case 'intro': return <Intro />;
      case 'programs': return <Programs />;
      case 'schedule': return <Schedule />;
      case 'diary': return <VillageDiary />;
      case 'directions': return <Directions />;
      // 사업관리 — 로그인 게이트는 BusinessAdmin 내부(authed)에서 처리.
      case ADMIN_SECTION: return <BusinessAdmin />;
      case 'main':
      default: return <MainHero />;
    }
  };

  return (
    <KkumdarakAuthProvider>
      <div className="kkumdarak">
        <div className="kd-announce" aria-hidden="true">
          <div
            className="kd-announce-track"
            style={reduced ? undefined : { animation: 'kd-marquee 26s linear infinite' }}
          >
            <span>{ANNOUNCE}</span>
            <span>{ANNOUNCE}</span>
          </div>
        </div>

        <header className="kd-header">
          <div className="kd-logo" onClick={() => go('main')} role="button" tabIndex={0}>
            이소異素
          </div>

          <NavWalker />

          <nav className="kd-nav-desktop">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`kd-pill${section === s.id ? ' active' : ''}`}
                onClick={() => go(s.id)}
              >
                {s.label}
              </button>
            ))}
            {/* 로그인 시에만 노출되는 「사업관리」 (데스크톱) */}
            <NavAdminLink
              active={section === ADMIN_SECTION}
              variant="desktop"
              onNavigate={() => go(ADMIN_SECTION)}
            />
            {/* "오시는 길" 옆 — 꿈다락 편집 로그인 도형 버튼 */}
            <NavAuthButton variant="desktop" />
          </nav>

          {/* 모바일 햄버거 */}
          <button className="kd-hamburger" onClick={() => setMenuOpen(true)} aria-label="메뉴 열기">
            <span /><span /><span />
          </button>
        </header>

        {/* ── 모바일 풀스크린 메뉴 ── */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              className="kd-mobile-menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: MOTION.durBase }}
            >
              <button className="kd-mobile-close" onClick={() => setMenuOpen(false)} aria-label="메뉴 닫기">✕</button>
              {SECTIONS.map((s, i) => (
                <motion.button
                  key={s.id}
                  className={`kd-pill${section === s.id ? ' active' : ''}`}
                  onClick={() => go(s.id)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: MOTION.durBase, ease: MOTION.ease }}
                >
                  {s.label}
                </motion.button>
              ))}
              {/* 로그인 시에만 노출되는 「사업관리」 (모바일). 누르면 메뉴 닫기. */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: SECTIONS.length * 0.05, duration: MOTION.durBase, ease: MOTION.ease }}
              >
                <NavAdminLink
                  active={section === ADMIN_SECTION}
                  variant="mobile"
                  onNavigate={() => go(ADMIN_SECTION)}
                />
              </motion.div>
              {/* "오시는 길" 옆 — 꿈다락 편집 로그인 도형 버튼 (모바일). 누르면 메뉴 닫기. */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (SECTIONS.length + 1) * 0.05, duration: MOTION.durBase, ease: MOTION.ease }}
              >
                <NavAuthButton variant="mobile" onAfterAction={() => setMenuOpen(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 콘텐츠 ── */}
        <AnimatePresence mode="wait">
          <motion.main
            key={section}
            initial={{ opacity: 0, y: 36, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.98 }}
            transition={{ duration: 0.28, ease: MOTION.easeOutBack }}
          >
            {/* 레이지 섹션 청크 로딩 경계 — main(MainHero)은 정적이라 폴백 없이 즉시 표시 */}
            <Suspense fallback={<SectionFallback />}>
              {renderSection()}
            </Suspense>

            <footer className="kd-footer">
              <div className="kd-footer-logo">꿈다락</div>
              <div>꿈다락 문화예술학교 · 2026 생활거점형 · 충남 부여군 장암면</div>
              <div>
                주최 문화체육관광부 · 주관 한국문화예술교육진흥원
                <span className="kd-footer-sep"> · </span>
                <span className="kd-footer-line-operator">운영 노드트리 × 장암면 주민자치회</span>
              </div>
            </footer>
          </motion.main>
        </AnimatePresence>
      </div>
    </KkumdarakAuthProvider>
  );
};

export default Kkumdarak;
