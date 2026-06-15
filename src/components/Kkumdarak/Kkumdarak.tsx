import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import './kkumdarak.css';
import { SECTIONS, ANNOUNCE, MOTION } from './data';
import MainHero from './MainHero';
import { KkumdarakAuthProvider, useKkumdarakAuth } from './KkumdarakAuthContext';
import { villageDiaryAPI } from '../../services/api';

// ── 코드 스플리팅 ────────────────────────────────────────────────
// 초기 진입(메인 히어로)에 필요 없는 섹션은 청크 분리해 초기 번들 축소.
// 특히 admin/BusinessAdmin 은 로그인 게이트 + 무거운 폼/장부/이미지 처리(imageToPng·PhotoUpload)를
// 포함하므로 공개 방문자 번들에서 반드시 분리한다(정적 import 시 히어로와 같은 청크에 동봉됨).
const Intro = lazy(() => import('./Intro'));
const Programs = lazy(() => import('./Programs'));
const Schedule = lazy(() => import('./Schedule'));
const VillageDiary = lazy(() => import('./VillageDiary'));
const VillageNews = lazy(() => import('./news/VillageNews'));
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

// isoartlab.com 브랜딩 — iso(꿈다락) 페이지의 탭 제목·파비콘을 마스코트/이소로 교체.
//   · 이 페이지는 isoartlab.com 루트에서만 렌더되고 nodetree.kr/iso 는 isoartlab.com 으로
//     리다이렉트되므로 기본적으로 iso 컨텍스트 = isoartlab. 그래도 안전을 위해 호스트로 한 번 더
//     가드한다(로컬 ?isoartlab 테스트도 허용). nodetree.kr 메인의 title/favicon 은 절대 안 건드림.
//   · 언마운트 시 원래 title/favicon href 로 복원(스코프 격리 — saengsanso favicon 스왑과 동일 패턴).
const ISO_TAB_TITLE = '문화예술학교 이소異素';
const ISO_FAVICON_HREF = '/iso-favicon.png';
const ISO_OG_DESC =
  '서로 다른 빛이 모여 마을을 밝히는 문화예술학교 이소(異素). ' +
  '작은 변화와 이야기를 기록하고 사람과 사람을 잇습니다.';
const ISO_OG_IMAGE = 'https://isoartlab.com/iso-og.png';
const ISO_OG_URL = 'https://isoartlab.com/';
const ISO_SITE_NAME = '문화예술학교 이소異素';

// head 의 meta 를 (selector 로 찾아) upsert. 없으면 만들어 붙이고, 원복용 정보를 반환한다.
//   · created=true → 클린업에서 제거. created=false → prevContent 로 복원.
type MetaRestore = { el: HTMLMetaElement; created: boolean; prevContent: string | null };
function upsertMeta(
  attr: 'name' | 'property',
  key: string,
  content: string,
  head: HTMLHeadElement,
): MetaRestore {
  let el = head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (el) {
    const prevContent = el.getAttribute('content');
    el.setAttribute('content', content);
    return { el, created: false, prevContent };
  }
  el = document.createElement('meta');
  el.setAttribute(attr, key);
  el.setAttribute('content', content);
  head.appendChild(el);
  return { el, created: true, prevContent: null };
}

function useIsoArtLabBranding() {
  useEffect(() => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isIsoArtLabHost =
      host === 'isoartlab.com' ||
      host === 'www.isoartlab.com' ||
      (typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).has('isoartlab'));
    // isoartlab 컨텍스트가 아니면(예: 가설적 직접 진입) 손대지 않는다 → nodetree.kr 무영향.
    if (!isIsoArtLabHost) return;

    const prevTitle = document.title;
    document.title = ISO_TAB_TITLE;

    // 기존 icon link 들의 href 를 마스코트로 교체하고, 원복용으로 이전 값을 기억.
    const iconLinks = Array.from(
      document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']"),
    ) as HTMLLinkElement[];
    const restore: Array<{ link: HTMLLinkElement; href: string; type: string }> = [];
    iconLinks.forEach((link) => {
      restore.push({ link, href: link.href, type: link.type });
      link.type = 'image/png';
      link.href = ISO_FAVICON_HREF;
    });
    // icon link 가 하나도 없으면(이론상) 새로 만들어 붙인다.
    let created: HTMLLinkElement | null = null;
    if (iconLinks.length === 0) {
      created = document.createElement('link');
      created.rel = 'icon';
      created.type = 'image/png';
      created.href = ISO_FAVICON_HREF;
      document.head.appendChild(created);
    }
    // apple-touch-icon 도 함께(홈 화면 추가 시).
    const appleLinks = Array.from(
      document.querySelectorAll("link[rel='apple-touch-icon']"),
    ) as HTMLLinkElement[];
    const appleRestore: Array<{ link: HTMLLinkElement; href: string }> = [];
    appleLinks.forEach((link) => {
      appleRestore.push({ link, href: link.href });
      link.href = ISO_FAVICON_HREF;
    });

    // ── OG / 메타 태그 (isoartlab 전용 동적 주입) ───────────────────────
    //   기존 nodetree.kr SeoHead 가 심은 og:* 가 있으면 그 content 만 덮어쓰고(원복 기억),
    //   없으면 새로 만들어 붙인다(클린업에서 제거). nodetree.kr 메인엔 위 호스트 가드로 미적용.
    const head = document.head;
    const metaRestores: MetaRestore[] = [
      upsertMeta('name', 'description', ISO_OG_DESC, head),
      upsertMeta('property', 'og:title', ISO_TAB_TITLE, head),
      upsertMeta('property', 'og:description', ISO_OG_DESC, head),
      upsertMeta('property', 'og:image', ISO_OG_IMAGE, head),
      upsertMeta('property', 'og:image:width', '1200', head),
      upsertMeta('property', 'og:image:height', '630', head),
      upsertMeta('property', 'og:url', ISO_OG_URL, head),
      upsertMeta('property', 'og:type', 'website', head),
      upsertMeta('property', 'og:site_name', ISO_SITE_NAME, head),
      upsertMeta('name', 'twitter:card', 'summary_large_image', head),
      upsertMeta('name', 'twitter:title', ISO_TAB_TITLE, head),
      upsertMeta('name', 'twitter:description', ISO_OG_DESC, head),
      upsertMeta('name', 'twitter:image', ISO_OG_IMAGE, head),
    ];

    return () => {
      document.title = prevTitle;
      restore.forEach(({ link, href, type }) => {
        link.href = href;
        link.type = type;
      });
      appleRestore.forEach(({ link, href }) => {
        link.href = href;
      });
      if (created && created.parentNode) created.parentNode.removeChild(created);
      // 메타 원복: 새로 만든 것은 제거, 기존 것은 이전 content 로 복원.
      metaRestores.forEach(({ el, created: wasCreated, prevContent }) => {
        if (wasCreated) {
          if (el.parentNode) el.parentNode.removeChild(el);
        } else if (prevContent !== null) {
          el.setAttribute('content', prevContent);
        }
      });
    };
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
  useIsoArtLabBranding();
  const reduced = useReducedMotion();
  const [section, setSection] = useState<string>(getInitialKkumdarakSection);
  const [menuOpen, setMenuOpen] = useState(false);

  // ── 백엔드 콜드스타트 선제 워밍업 (마운트 1회) ───────────────────────
  //   Render 가 idle 로 잠들면 첫 요청이 15~20초 지연된다. 특히 토큰이 살아있는
  //   재방문 관리자는 로그인 POST 없이 곧장 '사업관리'를 눌러 그 지연을 그대로 맞는다.
  //   여기서 인증 불필요한 공개 GET(/api/village-diary)을 fire-and-forget 으로 1회
  //   쏴 두면, 콜드스타트가 사용자가 페이지를 읽고 로그인하는 동안 소진된다.
  //   에러는 조용히 무시(워밍업 자체가 목적이라 응답 데이터는 쓰지 않는다).
  const warmedUpRef = useRef(false);
  useEffect(() => {
    if (warmedUpRef.current) return; // StrictMode 이중 마운트 등 중복 발사 방지
    warmedUpRef.current = true;
    villageDiaryAPI.get().catch(() => {});
  }, []);

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
      case 'news': return <VillageNews />;
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
            <img className="kd-logo-mark" src="/iso-favicon.png" alt="" aria-hidden="true" />
            <span className="kd-logo-word">이소異素</span>
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
              <div className="kd-footer-social">
                <a
                  className="kd-footer-ig"
                  href="https://www.instagram.com/iso.art.lab"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="이소異素 인스타그램 (새 탭)"
                >
                  <svg
                    className="kd-footer-ig-icon"
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <rect x="2.5" y="2.5" width="19" height="19" rx="5.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="17.4" cy="6.6" r="1.25" fill="currentColor" />
                  </svg>
                  <span className="kd-footer-ig-label">@iso.art.lab</span>
                </a>
              </div>
            </footer>
          </motion.main>
        </AnimatePresence>
      </div>
    </KkumdarakAuthProvider>
  );
};

export default Kkumdarak;
