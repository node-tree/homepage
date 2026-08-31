import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
// App.css 는 이제 로그인 화면(.login-*·.form-*)·생산소 반응형(.sso-*)·
// 레거시 본문 HTML 의 갤러리 훅(.bk-*)만 남긴 잔여 전역 판식이다.
// (2026-08-31 레거시 판식 제거 — 구 홈·내비·편집기 스타일 5,000여 줄을 걷어냈다)
import './App.css';
import { AuthProvider } from './contexts/AuthContext';
import PageLoader from './components/PageLoader';
import NtBoot from './redesign/components/NtBoot';
// v5 내장 편집 모드 — 라우터 바로 안에 둔다(페이지 컴포넌트 자신이 useEditMode() 를 부른다).
// DOM 을 그리지 않는 제공자다.
import { EditModeProvider } from './redesign/edit/EditModeContext';

// [code-split] 페이지/스탠드얼론 라우트 컴포넌트는 React.lazy로 분리.
// 무거운 의존성(three.js·p5·mermaid)을 메인 번들에서 떼어내 라우트 진입 시점에만 로드한다.
const Login = lazy(() => import('./components/Login'));
const SaengsansoApp = lazy(() => import('./components/Saengsanso'));
const OceanData = lazy(() => import('./components/OceanData'));
const ClaudeMonitor = lazy(() => import('./components/ClaudeMonitor'));
const Guestbook = lazy(() => import('./components/Guestbook'));
const WorkResearch = lazy(() => import('./components/WorkResearch'));
const TeamEvent = lazy(() => import('./components/TeamEvent'));
const Team = lazy(() => import('./components/Team'));
const Kkumdarak = lazy(() => import('./components/Kkumdarak/Kkumdarak'));
const Buyeo = lazy(() => import('./components/Buyeo'));
const MediaAdmin = lazy(() => import('./components/MediaAdmin'));
// [임시] 다라니 시계 검수 라우트 — 홈 히어로 편입 전까지만 유지한다
const DharaniClockPage = lazy(() => import('./components/DharaniClockPage'));

// [v5 판식] 판식 페이지 — nt.css 를 자기 청크로 들고 온다.
// 2026-08-31: 구 판식(/legacy · 상태 기반 페이지 전환 홈 · 원형 노드 내비)은 전부 제거했다.
//   미등록 경로는 이제 레거시 홈이 아니라 v5 404(NtNotFound)로 떨어진다.
const NtHome = lazy(() => import('./redesign/pages/Home'));
const NtWork = lazy(() => import('./redesign/pages/Work'));
const NtWorkDetail = lazy(() => import('./redesign/pages/WorkDetail'));
const NtAbout = lazy(() => import('./redesign/pages/About'));
const NtCommons = lazy(() => import('./redesign/pages/Commons'));
const NtCommonsDetail = lazy(() => import('./redesign/pages/CommonsDetail'));
const NtCV = lazy(() => import('./redesign/pages/CV'));
const NtContact = lazy(() => import('./redesign/pages/Contact'));
const NtNotFound = lazy(() => import('./redesign/pages/NotFound'));
// v5 내장 편집 — 글 작성/수정 풀페이지(/work/new · /work/:id/edit · /commons/…).
// 로그인하지 않았으면 컴포넌트 안에서 /login?next= 로 돌린다.
const NtPostForm = lazy(() => import('./redesign/edit/PostForm'));
// 삼베 대리 신체는 라우트 전환에도 언마운트되면 안 되므로 <Routes> 바깥에 둔다(설계 §4.3).
const SambeWalker = lazy(() => import('./redesign/components/SambeWalker'));
// v5 전용 로딩 자리(웹폰트 요청 0). 인라인 스타일만 쓰므로 메인 번들에 nt.css 를 끌어오지 않는다.
const ntBoot = (el: React.ReactNode, stage = false) => <Suspense fallback={<NtBoot stage={stage} />}>{el}</Suspense>;

// /kkumdarak 리다이렉트 별칭 — hash(#admin/#intro 등)과 query를 보존한 채 /iso로 리다이렉트.
// Kkumdarak가 window.location.hash를 직접 읽으므로 hash 유지가 필수(기존 발행 URL nodetree.kr/kkumdarak#intro 보존).
function KkumdarakRedirect() {
  const { hash, search } = useLocation();
  return <Navigate to={`/iso${search}${hash}`} replace />;
}

// 도메인 감지 (localhost에서는 ?saengsanso 쿼리로 테스트 가능)
const isSaengsanso = typeof window !== 'undefined' && (
  window.location.hostname === 'saengsanso.com' ||
  window.location.hostname === 'www.saengsanso.com' ||
  new URLSearchParams(window.location.search).has('saengsanso')
);

// isoartlab.com 도메인이면 루트(/)에서 곧장 /iso(꿈다락·異素) 화면을 띄운다.
//   · 리다이렉트가 아니라 같은 SPA에서 Kkumdarak을 루트에 렌더 → 주소창에 isoartlab.com 유지.
//   · Kkumdarak은 pathname을 쓰지 않고 window.location.hash로만 섹션을 전환하므로
//     isoartlab.com/#intro · #admin 등 해시 섹션 이동이 그대로 동작한다.
//   · localhost에서는 ?isoartlab 쿼리로 테스트 가능.
const isIsoArtLab = typeof window !== 'undefined' && (
  window.location.hostname === 'isoartlab.com' ||
  window.location.hostname === 'www.isoartlab.com' ||
  new URLSearchParams(window.location.search).has('isoartlab')
);

// nodetree.kr 통합 — 기존 발행 URL nodetree.kr/iso · /kkumdarak 방문자를 isoartlab.com 루트로 모은다.
//   · 호스트가 nodetree.kr / www.nodetree.kr 일 때만 발동 → isoartlab.com 에서는 절대 안 터짐(루프 차단).
//   · 경로 /iso · /kkumdarak (+선택적 슬래시)만 대상. 메인 홈(/) · /ocean 등 타 경로엔 영향 없음.
//   · 해시(#intro 등) · 쿼리(?x=1) 보존: isoartlab.com/<search><hash> 로 그대로 이전.
//   · 렌더(BrowserRouter) 전, 모듈 평가 시점에 location.replace → /iso 중간 경유·이중 점프·깜빡임 없음.
//   · 로컬 테스트: ?nodetreeIso 쿼리를 붙이면 산출 대상 URL 을 콘솔에 로그만 남긴다(실제 점프 X).
//     실제 location.replace 는 안전을 위해 nodetree.kr / www.nodetree.kr 호스트에서만 수행한다.
const ISO_REDIRECT_PATHS = /^\/(iso|kkumdarak)\/?$/i;

function maybeRedirectNodeTreeIsoToIsoArtLab(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname, pathname, search, hash } = window.location;
  const isNodeTreeHost = hostname === 'nodetree.kr' || hostname === 'www.nodetree.kr';
  // 로컬 시뮬레이션 플래그(실제 점프 없이 흐름만 확인하고 싶을 때 콘솔에서 산출값 검증용).
  const simulate = new URLSearchParams(search).has('nodetreeIso');
  if (!isNodeTreeHost && !simulate) return false;
  if (!ISO_REDIRECT_PATHS.test(pathname)) return false;
  // 쿼리에서 테스트 플래그는 제거하고 나머지는 보존.
  const params = new URLSearchParams(search);
  params.delete('nodetreeIso');
  const cleanSearch = params.toString() ? `?${params.toString()}` : '';
  const target = `https://isoartlab.com/${cleanSearch}${hash}`;
  // 시뮬레이션 모드에서는 실제 점프 대신 로그만(루프·환경오염 방지).
  if (!isNodeTreeHost && simulate) {
    // eslint-disable-next-line no-console
    console.log('[nodetreeIso simulate] would redirect to:', target);
    return false;
  }
  window.location.replace(target);
  return true;
}

// 모듈 평가 시점(최대한 이른 시점)에 1회 실행 — App() 렌더 전에 점프시켜 깜빡임 최소화.
const didRedirectToIsoArtLab = maybeRedirectNodeTreeIsoToIsoArtLab();

// App 컴포넌트
function App() {
  // nodetree.kr/iso · /kkumdarak → isoartlab.com 리다이렉트가 모듈 평가 시점에 발동했다면,
  // 브라우저가 이미 isoartlab.com 으로 이동 중이므로 아무것도 렌더하지 않는다(깜빡임 방지).
  if (didRedirectToIsoArtLab) {
    return null;
  }

  // saengsanso.com 도메인이면 생산소 독립 페이지 렌더링
  if (isSaengsanso) {
    return (
      <HelmetProvider>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <SaengsansoApp />
          </Suspense>
        </AuthProvider>
      </HelmetProvider>
    );
  }

  // isoartlab.com 도메인이면 루트에서 곧장 꿈다락(異素) 페이지를 렌더(주소창 isoartlab.com 유지).
  if (isIsoArtLab) {
    return (
      <HelmetProvider>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Kkumdarak />
          </Suspense>
        </AuthProvider>
      </HelmetProvider>
    );
  }

  return (
    <HelmetProvider>
      <AuthProvider>
        <BrowserRouter>
          <EditModeProvider>
          {/* [code-split] 모든 스탠드얼론 라우트를 단일 Suspense 경계로 감싼다.
              각 라우트 컴포넌트가 lazy이므로 진입 시점에만 청크를 로드한다. */}
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/guestbook" element={<Guestbook />} />
              <Route path="/team-event" element={<TeamEvent />} />
              <Route path="/NODETREECorpus" element={<Team />} />
              <Route path="/ocean" element={<OceanData />} />
              <Route path="/iso" element={<Kkumdarak />} />
              {/* /kkumdarak — 구 발행 URL 호환 별칭. hash 보존해 /iso로 리다이렉트 */}
              <Route path="/kkumdarak" element={<KkumdarakRedirect />} />
              <Route path="/buyeo/:stop" element={<Buyeo />} />
              <Route path="/monitor" element={<ClaudeMonitor />} />
              <Route path="/admin/media" element={<MediaAdmin />} />
              {/* [임시] 다라니 시계 검수 — /clock */}
              <Route path="/clock" element={<DharaniClockPage />} />
              <Route path="/work/research/:postId" element={<WorkResearch />} />

              {/* ── v5 판식 5종 (설계 §1.2 URL 유지) ──
                  각자 Suspense 경계를 따로 두는 이유: 공용 PageLoader 의 「불러오는 중…」이
                  body 의 S-CoreDream(168 KB)을 깨워 새 페이지에서 쓰지도 않는 폰트를 받는다(실측). */}
              {/* 홈만 근흑 무대(〈이물〉 D18) — 로딩 자리도 같은 지(紙)로 둔다 */}
              <Route path="/" element={ntBoot(<NtHome />, true)} />
              <Route path="/about" element={ntBoot(<NtAbout />)} />
              {/* /work?post=<id> (구 상세 URL) 은 목록 컴포넌트가 /work/<id> 로 넘긴다 */}
              <Route path="/work" element={ntBoot(<NtWork />)} />
              {/* 정적 구간(new)이 :id 보다 먼저 매칭된다(v6 랭킹) — 순서와 무관하게 안전 */}
              <Route path="/work/new" element={ntBoot(<NtPostForm kind="work" base="/work" label="ART WORK" />)} />
              <Route path="/work/:id" element={ntBoot(<NtWorkDetail />)} />
              <Route path="/work/:id/edit" element={ntBoot(<NtPostForm kind="work" base="/work" label="ART WORK" />)} />
              <Route path="/commons" element={ntBoot(<NtCommons />)} />
              <Route path="/commons/new" element={ntBoot(<NtPostForm kind="filed" base="/commons" label="COMMONS" />)} />
              <Route path="/commons/:id" element={ntBoot(<NtCommonsDetail />)} />
              <Route
                path="/commons/:id/edit"
                element={ntBoot(<NtPostForm kind="filed" base="/commons" label="COMMONS" />)}
              />
              <Route path="/cv" element={ntBoot(<NtCV />)} />
              <Route path="/contact" element={ntBoot(<NtContact />)} />
              {/* ── 구 URL 보존 리다이렉트 ──
                  /works-v5 · /about-v5 · /index 는 v5 정적 시안이었고, /legacy(/…) 는
                  2026-08-31 걷어낸 구 판식이다. 색인·외부 링크·북마크가 남아 있으므로
                  404 로 떨구지 않고 대응하는 정식 페이지로 넘긴다(replace). */}
              <Route path="/works-v5" element={<Navigate to="/work" replace />} />
              <Route path="/about-v5" element={<Navigate to="/about" replace />} />
              <Route path="/index" element={<Navigate to="/cv" replace />} />
              <Route path="/legacy" element={<Navigate to="/" replace />} />
              <Route path="/legacy/about" element={<Navigate to="/about" replace />} />
              <Route path="/legacy/work" element={<Navigate to="/work" replace />} />
              <Route path="/legacy/commons" element={<Navigate to="/commons" replace />} />
              <Route path="/legacy/cv" element={<Navigate to="/cv" replace />} />
              <Route path="/legacy/contact" element={<Navigate to="/contact" replace />} />
              <Route path="/legacy/*" element={<Navigate to="/" replace />} />

              {/* 미등록 경로 — v5 판식 404(색인 제외). 예전에는 레거시 홈이 떴다. */}
              <Route path="*" element={ntBoot(<NtNotFound />)} />
            </Routes>
          </Suspense>
          {/* 삼베 대리 신체 — Routes 밖이라 라우트가 바뀌어도 유지된다(v5 라우트에서만 보인다) */}
          <Suspense fallback={null}>
            <SambeWalker />
          </Suspense>
          </EditModeProvider>
        </BrowserRouter>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;
