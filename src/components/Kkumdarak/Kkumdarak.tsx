import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import './kkumdarak.css';
import { SECTIONS, ANNOUNCE, MOTION } from './data';
import MainHero from './MainHero';
import { KkumdarakAuthProvider, useKkumdarakAuth } from './KkumdarakAuthContext';
import { villageDiaryAPI } from '../../services/api';
import { useFlipbookFrames } from './useDeferredFrames';
import { flipbookSrcSet, flipbookFit, FLIPBOOK_VARIANTS } from './flipbookVariants';

// ── 코드 스플리팅 ────────────────────────────────────────────────
// 초기 진입(메인 히어로)에 필요 없는 섹션은 청크 분리해 초기 번들 축소.
// 특히 admin/BusinessAdmin 은 로그인 게이트 + 무거운 폼/장부/이미지 처리(imageToPng·PhotoUpload)를
// 포함하므로 공개 방문자 번들에서 반드시 분리한다(정적 import 시 히어로와 같은 청크에 동봉됨).
const Intro = lazy(() => import('./Intro'));
const Programs = lazy(() => import('./Programs'));
const Schedule = lazy(() => import('./Schedule'));
const VillageDiary = lazy(() => import('./VillageDiary'));
const VillageNews = lazy(() => import('./news/VillageNews'));
const Results = lazy(() => import('./Results'));
const Directions = lazy(() => import('./Directions'));
const BusinessAdmin = lazy(() => import('./admin/BusinessAdmin'));
// 마을의 신호 웹지도 — 전용 풀스크린 화면(#signal-map). 캔버스 엔진 포함이라 반드시 청크 분리.
const SignalMap = lazy(() => import('./signalmap/SignalMap'));
const SignalMap3D = lazy(() => import('./signalmap/3d/SignalMap3D'));

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
  // 마을의 신호 웹지도 — SECTIONS(공개 nav) 밖의 전용 화면. 딥링크 #signal-map/<id> 포함.
  if (section === 'signal-map-3d') return 'signal-map-3d';
  if (section === 'signal-map' || section.startsWith('signal-map/')) return 'signal-map';
  return SECTIONS.some((item) => item.id === section) ? section : 'main';
};

// Google Fonts 로드: Figma 디자인 파일의 Jua / Gothic A1 / Fredoka 조합.
//
// [perf] 원래는 4종(Fredoka·Gothic A1·Jua·Noto Sans KR)을 한 요청으로 받았다.
//   실측(fonts.googleapis.com, Chrome UA): 4종 합본 css = 122.7KB(gzip) / 356~463ms.
//   그중 **Noto Sans KR 만 70.0KB** — 전체의 57% 다. 그런데 kkumdarak.css 의 모든
//   font-family 선언에서 Noto Sans KR 은 Gothic A1 **뒤의 폴백**이라, Gothic A1 이
//   커버하는 글자에서는 절대 렌더에 쓰이지 않는다(=초기 렌더 경로에 붙을 이유가 없다).
//   → 실제로 그려지는 3종만 즉시 로드(52.7KB)하고, 희귀 글리프 보완용 Noto Sans KR 은
//     load 이벤트 이후(유휴)로 미룬다. 커버리지는 그대로, 임계 경로만 70KB 가벼워진다.
const KD_FONTS_PRIMARY =
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@700&family=Gothic+A1:wght@400;700;800&family=Jua&display=swap';
const KD_FONTS_DEFERRED =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;800&display=swap';

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
    link.href = KD_FONTS_PRIMARY;
    document.head.appendChild(pre1);
    document.head.appendChild(pre2);
    document.head.appendChild(link);

    // ── 폴백 한글 폰트는 첫 화면이 끝난 뒤에 ────────────────────────
    let idleId: number | undefined;
    let timerId: number | undefined;
    const deferredId = 'kkumdarak-fonts-fallback';
    const loadDeferred = () => {
      if (document.getElementById(deferredId)) return;
      const l = document.createElement('link');
      l.id = deferredId;
      l.rel = 'stylesheet';
      l.href = KD_FONTS_DEFERRED;
      document.head.appendChild(l);
    };
    const schedule = () => {
      const ric = (window as any).requestIdleCallback;
      if (typeof ric === 'function') idleId = ric(loadDeferred, { timeout: 3000 });
      else timerId = window.setTimeout(loadDeferred, 1200);
    };
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });

    return () => {
      window.removeEventListener('load', schedule);
      const cic = (window as any).cancelIdleCallback;
      if (idleId !== undefined && typeof cic === 'function') cic(idleId);
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
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

/**
 * 워커의 <img> 실제 표시 폭 — 컨테이너는 52px(데스크톱)·44px(모바일, NAV_WALKER_MOBILE_CSS)이고
 * 프레임 박스는 복원 계수 fx 만큼 더 넓다(kkumdarak.css .kd-loop-frame). sizes 는 후자여야 한다.
 */
const NAV_WALKER_FX = FLIPBOOK_VARIANTS['chars-v2/character-12']
  ? FLIPBOOK_VARIANTS['chars-v2/character-12'].fx
  : 1;
const NAV_WALKER_SIZES = `(max-width: 900px) ${Math.round(44 * NAV_WALKER_FX)}px, ${Math.round(52 * NAV_WALKER_FX)}px`;

function NavWalker() {
  // [perf] 헤더 워커도 6프레임 플립북이다 — 프레임 2~6 은 첫 화면 이후로 미룬다.
  //   표시 폭은 CSS 로 확정돼 있다: 데스크톱 52px, 모바일(≤900px) 44px(NAV_WALKER_MOBILE_CSS).
  //   그 값을 sizes 로 그대로 알려 줘야 브라우저가 0.5배본을 고를 수 있다.
  const frames = useFlipbookFrames(
    [1, 2, 3, 4, 5, 6].map((i) => `/kkumdarak/chars-v2/character-12/frame-0${i}.webp`),
    [1, 2, 3, 4, 5, 6].map((i) => flipbookSrcSet('chars-v2/character-12', i)),
    NAV_WALKER_SIZES,
  );
  return (
    <div className="kd-nav-walker">
      <style>{NAV_WALKER_MOBILE_CSS}</style>
      {/* [복원] 정규화로 줄어든 표시 배율을 지배 캔버스 기준으로 되돌리는 계수(박스 52/44px 는 불변). */}
      <div className="kd-nav-walker-char" style={flipbookFit('chars-v2/character-12')}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <img
            key={i}
            // [perf] base64 PNG 래퍼 .svg → WebP. scripts/svg-base64-to-webp.js → 캔버스 정규화 → q88.
            src={frames[i - 1].src}
            srcSet={frames[i - 1].srcSet}
            sizes={frames[i - 1].srcSet ? NAV_WALKER_SIZES : undefined}
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

// ── nav 인스타그램 바로가기 (헤더/모바일 메뉴 공용) ────────────────────
//   이소異素 공식 인스타그램(@iso.art.lab)으로 새 탭 이동. 페이지 진입 즉시
//   보이는 상단 헤더(데스크톱) / 풀스크린 메뉴(모바일)에 노출한다.
//   디자인 토큰(알약·외곽선·accent)·새 탭(rel)·접근성(aria-label)을 유지.
const NavInstagram: React.FC<{ variant?: 'desktop' | 'mobile' }> = ({ variant = 'desktop' }) => (
  <a
    className={`kd-nav-ig kd-nav-ig--${variant}`}
    href="https://www.instagram.com/iso.art.lab"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="이소異素 인스타그램 (새 탭)"
    title="이소異素 인스타그램 @iso.art.lab"
  >
    <svg
      className="kd-nav-ig-icon"
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
    <span className="kd-nav-ig-label">@iso.art.lab</span>
  </a>
);

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

  // 마을의 신호 웹지도: 일반 레이아웃(공지 띠·헤더) 없이 풀스크린 단독 렌더
  // ⚠️ 전용 화면도 KkumdarakAuthProvider 안에서 렌더해야 한다 —
  //    지도 카드의 편집 기능이 useKkumdarakAuth(authed)로 로그인 상태를 읽는다.
  if (section === 'signal-map') {
    return (
      <KkumdarakAuthProvider>
        <Suspense fallback={<SectionFallback />}>
          <SignalMap onBack={() => go('main')} />
        </Suspense>
      </KkumdarakAuthProvider>
    );
  }

  // 3D 먹선 도시(작은 부여) — 2D판과 병존
  if (section === 'signal-map-3d') {
    return (
      <KkumdarakAuthProvider>
        <Suspense fallback={<SectionFallback />}>
          <SignalMap3D onBack={() => go('main')} />
        </Suspense>
      </KkumdarakAuthProvider>
    );
  }

  const renderSection = () => {
    switch (section) {
      case 'intro': return <Intro />;
      case 'programs': return <Programs />;
      case 'schedule': return <Schedule />;
      case 'diary': return <VillageDiary />;
      case 'news': return <VillageNews />;
      case 'results': return <Results />;
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
            {/* [perf] 헤더 로고는 38px(모바일 34px)로 그려지는데 파비콘 원본(256px·68.4KB)을
                그대로 받고 있었다 → 128px 무손실 WebP(14.2KB, DPR 3.3배 여유)로 교체.
                파비콘 자체(/iso-favicon.png)는 그대로 둔다(브라우저 탭 아이콘 용도). */}
            <img
              className="kd-logo-mark"
              src="/iso-logo-128.webp"
              alt=""
              aria-hidden="true"
              width={38}
              height={38}
              decoding="async"
            />
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
            {/* 이소異素 인스타그램 바로가기 (데스크톱 헤더) */}
            <NavInstagram variant="desktop" />
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
              {/* 이소異素 인스타그램 바로가기 (모바일 메뉴) */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (SECTIONS.length + 2) * 0.05, duration: MOTION.durBase, ease: MOTION.ease }}
              >
                <NavInstagram variant="mobile" />
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
