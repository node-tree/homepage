import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import './villageNews.css';
import {
  NEWS_ISSUES,
  MASTHEAD,
  COLOPHON_LINES,
  resolveIssueStatus,
  type NewsIssue,
  type NewsStatus,
  type NewsStatusMap,
} from './newsData';
import { NewsBlockView, OwlCut, FireflyCut } from './NewsBlocks';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakNewsStatusAPI } from '../../../services/api';

// ═══════════════════════════════════════════════════════════════
// 「마을소식」 — 이소(異素)의 웹 신문 (꿈다락 /iso#news)
//
//   고정 프레임 + 호별 가변:
//     · 제호(마스트헤드) · 날짜줄(Folio) · 콜로폰 = 모든 호 공통(이 파일)
//     · 본문 blocks[] = 호마다 통째로 교체(newsData.ts) → 템플릿 느낌 제거
//
//   공개 상태(스프린트 2 추가):
//     · 각 호는 published(발행) / draft(공개 전 준비중 — 교정쇄) 상태를 가진다.
//     · 정적 기본값(issue.status) 위에, kkumdarak-settings 의 newsStatus 버킷이
//       런타임 override 로 얹힌다(서버 단일 진실 소스, read-merge-write).
//     · 비로그인: published 호만 아카이브·렌더. published 0개면 신문 프레임을 유지한 채
//       사고(社告)풍 플레이스홀더("창간호를 준비하고 있어요").
//     · 편집자(꿈다락 로그인): draft 호도 「준비중」 라벨로 아카이브 노출 + 열람.
//       draft 호 상단에 「교정쇄」 배너 + 공개/준비중 토글(PUT 영속).
//     · settings 미도착(콜드스타트 15-20초) 구간엔 정적 status 로 낙관 렌더 → 도착 시 보정.
//
//   디자인: 뉴스프린트 미색 종이 + 먹(순흑 회피) + 신호 빨강 1도(반딧불이).
//   ※ default export 필수 — Kkumdarak.tsx 가 lazy(() => import(...)) 로 청크 분리.
// ═══════════════════════════════════════════════════════════════

// ── 뉴스 전용 폰트 로드 (Noto Serif KR 400·700·900) ──────────────
//   기존 useKkumdarakFonts(Jua/Gothic A1/Fredoka/Noto Sans KR)와 별개 link id.
//   display=swap 으로 폰트 미도착 시에도 본문이 즉시 보이게 한다.
function useNewsFonts() {
  useEffect(() => {
    const id = 'kkumdarak-news-fonts';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700;900&display=swap';
    document.head.appendChild(link);
    // 섹션을 떠나도 폰트는 캐시 유지가 이득이라 cleanup 으로 제거하지 않는다.
  }, []);
}

// ── 호 테마 → CSS 변수 ───────────────────────────────────────────
//   호별 아트디렉션을 --kd-news-* 변수로 주입. 이 변수를 villageNews.css 전반이 참조.
function themeVars(issue: NewsIssue): React.CSSProperties {
  const t = issue.theme;
  const vars: Record<string, string> = {
    '--kd-news-paper': t.paper,
    '--kd-news-ink': t.ink,
    '--kd-news-spot': t.spot,
    '--kd-news-spot2': t.spot2 || t.spot,
    '--kd-news-headline-font':
      t.headlineFont || "'Noto Serif KR', 'Nanum Myeongjo', serif",
  };
  return vars as React.CSSProperties;
}

// ── 종이결 노이즈 오버레이 (인라인 SVG, 초경량) ──────────────────
//   feTurbulence(fractalNoise)로 뉴스프린트 그레인. 고정·pointer-events:none.
//   reduced-motion 과 무관(정적). texture:'none' 인 호는 렌더하지 않는다.
const NewsprintNoise: React.FC = () => (
  <svg className="kdn-noise" aria-hidden="true" focusable="false" preserveAspectRatio="none">
    <filter id="kdn-grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#kdn-grain)" />
  </svg>
);

// 안전 테마(플레이스홀더 전용) — 발행 호가 0개일 때 신문 프레임에 줄 기본 무드(창간호 톤).
const PLACEHOLDER_THEME: NewsIssue['theme'] = {
  paper: '#f6f2e7',
  ink: '#251b13',
  spot: '#f02e1f',
  spot2: '#0f7a38',
  texture: 'newsprint',
};
function placeholderVars(): React.CSSProperties {
  const t = PLACEHOLDER_THEME;
  return {
    '--kd-news-paper': t.paper,
    '--kd-news-ink': t.ink,
    '--kd-news-spot': t.spot,
    '--kd-news-spot2': t.spot2 || t.spot,
    '--kd-news-headline-font': "'Noto Serif KR', 'Nanum Myeongjo', serif",
  } as React.CSSProperties;
}

const VillageNews: React.FC = () => {
  useNewsFonts();
  const reduced = useReducedMotion();

  // ── 꿈다락 편집 인증 — 최상위 공유 컨텍스트에서 소비(NavAdminLink 와 동일 패턴) ──
  //   case 'news' 는 KkumdarakAuthProvider 내부에서 렌더되므로 authed 가 정상 전달된다.
  const { authed, logout, requestLogin } = useKkumdarakAuth();

  // ── 호 상태 override (서버 newsStatus 버킷) ────────────────────────
  //   undefined = 아직 미도착(콜드스타트). 도착 시 {}(없음) 또는 { [id]: status }.
  //   정적 status 로 낙관 렌더하다가 도착하면 보정한다(블로킹 금지).
  const [override, setOverride] = useState<NewsStatusMap | undefined>(undefined);
  const overrideRef = useRef<NewsStatusMap>({}); // 토글 read-merge-write 의 메모리 베이스
  const [busyId, setBusyId] = useState<string | null>(null); // 토글 in-flight 호 id
  const [toggleError, setToggleError] = useState<string | null>(null);

  // 마운트 시 호 상태 맵 로드 — 실패해도 정적 status 로 동작(폴백).
  useEffect(() => {
    let alive = true;
    kkumdarakNewsStatusAPI
      .get()
      .then((map) => {
        if (!alive) return;
        const safe = map && typeof map === 'object' ? map : {};
        overrideRef.current = safe;
        setOverride(safe);
      })
      .catch(() => {
        if (!alive) return;
        // 폴백: override 없음 → 정적 status 기준 동작.
        overrideRef.current = {};
        setOverride({});
      });
    return () => {
      alive = false;
    };
  }, []);

  // ── 유효 상태 계산 ─────────────────────────────────────────────
  //   각 호의 유효 상태 = override[id] ?? issue.status ?? 'published'.
  const statusOf = useCallback(
    (issue: NewsIssue): NewsStatus => resolveIssueStatus(issue, override),
    [override],
  );

  // 비로그인은 published 만, 편집자는 전체(draft 포함) 열람 대상.
  const visibleIssues = useMemo(
    () => (authed ? NEWS_ISSUES : NEWS_ISSUES.filter((it) => statusOf(it) === 'published')),
    [authed, statusOf],
  );

  // 현재 펼친 호. 가시 목록의 첫 호로 초기화하되, 가시 목록이 바뀌면 보정한다.
  const [issueId, setIssueId] = useState<string>(NEWS_ISSUES[0]?.id ?? '');

  // 가시 목록이 변할 때(로그인/상태도착) 현재 선택이 더 이상 보이지 않으면 첫 가시 호로 이동.
  //   비로그인이 draft 직접 진입(상태 강제)하는 경로를 차단하는 안전장치도 겸한다.
  useEffect(() => {
    if (visibleIssues.length === 0) return; // 플레이스홀더 — 선택 보정 불필요
    if (!visibleIssues.some((it) => it.id === issueId)) {
      setIssueId(visibleIssues[0].id);
    }
  }, [visibleIssues, issueId]);

  const issue = useMemo(
    () => visibleIssues.find((it) => it.id === issueId) ?? visibleIssues[0],
    [visibleIssues, issueId],
  );

  // ── 상태 토글 (편집자 전용) ────────────────────────────────────
  //   read-merge-write: 최신 GET 베이스에 이 호 상태만 머지(타 버킷·타 호 상태 보존).
  //   낙관 갱신 후 PUT, 실패 시 롤백. KKUM_AUTH_EXPIRED → logout()+requestLogin().
  const toggleStatus = useCallback(
    async (target: NewsIssue) => {
      if (!authed || busyId) return;
      const current = statusOf(target);
      const next: NewsStatus = current === 'published' ? 'draft' : 'published';

      setBusyId(target.id);
      setToggleError(null);

      // 낙관적 반영(편집자 화면 즉시 전환).
      const optimistic: NewsStatusMap = { ...overrideRef.current, [target.id]: next };
      overrideRef.current = optimistic;
      setOverride(optimistic);

      try {
        // API 가 내부에서 최신 GET → newsStatus 머지 → 전체 PUT(타 버킷 보존)을 수행한다.
        const savedNs = await kkumdarakNewsStatusAPI.setIssueStatus(target.id, next);
        const safe = savedNs && typeof savedNs === 'object' ? savedNs : optimistic;
        overrideRef.current = safe;
        setOverride(safe);
      } catch (err: any) {
        // 롤백 — 저장 실패 시 직전 상태로 복원.
        const rolledBack: NewsStatusMap = { ...overrideRef.current, [target.id]: current };
        overrideRef.current = rolledBack;
        setOverride(rolledBack);

        if (err && err.code === 'KKUM_AUTH_EXPIRED') {
          logout();
          if (typeof window !== 'undefined') {
            window.alert('꿈다락 편집 인증이 만료되었습니다. 다시 로그인해주세요.');
          }
          requestLogin();
          return;
        }
        setToggleError(err?.message || '상태 저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
      } finally {
        setBusyId(null);
      }
    },
    [authed, busyId, statusOf, logout, requestLogin],
  );

  // ── 발행 호 0개 + 비로그인 → 사고(社告)풍 플레이스홀더 ──────────
  //   신문 프레임(제호·모토)을 유지한 채 빈 화면을 피한다.
  if (!issue) {
    return (
      <section
        className={`kd-news kd-news--placeholder${reduced ? ' kdn-reduced' : ''}`}
        style={placeholderVars()}
        aria-labelledby="kdn-masthead-title"
      >
        <div className="kd-section-rule kd-section-rule--s6" />
        <NewsprintNoise />
        <div className="kd-news-sheet">
          {/* 제호 — 발행 전에도 매체 정체성은 선다 */}
          <header className="kdn-masthead">
            <span className="kdn-masthead-cut kdn-masthead-cut--owl" aria-hidden="true">
              <OwlCut className="kdn-cut-svg" />
            </span>
            <div className="kdn-masthead-center">
              <h1 id="kdn-masthead-title" className="kdn-masthead-title">
                {MASTHEAD.title}
              </h1>
              <p className="kdn-masthead-motto">{MASTHEAD.motto}</p>
            </div>
            <span className="kdn-masthead-cut kdn-masthead-cut--firefly" aria-hidden="true">
              <FireflyCut className="kdn-cut-svg" />
            </span>
          </header>

          {/* 날짜줄 자리 — 준비중 안내 한 줄 */}
          <div className="kdn-folio">
            <p className="kdn-folio-line">충남 부여군 장암면 · 꿈다락 문화예술학교 이소(異素)</p>
            <span className="kdn-folio-archive-label kdn-folio-only">준비 중</span>
          </div>

          {/* 사고(社告)풍 빈 상태 — 부엉이·반딧불이 컷 동반, 신문 미학 유지 */}
          <div className="kdn-coming" role="status">
            <div className="kdn-coming-cuts" aria-hidden="true">
              <OwlCut className="kdn-coming-cut" />
              <FireflyCut className="kdn-coming-cut" />
            </div>
            <p className="kdn-coming-label">사고(社告)</p>
            <p className="kdn-coming-headline">창간호를 준비하고 있어요</p>
            <p className="kdn-coming-body">
              부엉이가 마을의 소리를 듣고, 반딧불이가 빛을 내어 발화할 채비를 하고 있습니다.
              <br />
              곧 첫 호로 찾아뵙겠습니다.
            </p>
          </div>

          {/* 콜로폰은 발행 전에도 매체 정체성으로 둔다 */}
          <footer className="kdn-colophon">
            <span className="kdn-colophon-mark" aria-hidden="true">異素</span>
            <ul className="kdn-colophon-lines">
              {COLOPHON_LINES.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </footer>
        </div>
      </section>
    );
  }

  const hasTexture = issue.theme.texture !== 'none';
  const currentStatus = statusOf(issue);
  const isDraft = currentStatus === 'draft';

  return (
    <section
      className={`kd-news${reduced ? ' kdn-reduced' : ''}${isDraft ? ' kd-news--draft' : ''}`}
      style={themeVars(issue)}
      aria-labelledby="kdn-masthead-title"
    >
      {/* 섹션 진행 괘선 — 기존 전 섹션 공통 규격(마을소식 = s6) */}
      <div className="kd-section-rule kd-section-rule--s6" />

      {hasTexture && <NewsprintNoise />}

      <div className="kd-news-sheet">
        {/* ── 제호(마스트헤드) ── 고정 프레임 ───────────────────── */}
        <header className="kdn-masthead">
          <span className="kdn-masthead-cut kdn-masthead-cut--owl" aria-hidden="true">
            <OwlCut className="kdn-cut-svg" />
          </span>
          <div className="kdn-masthead-center">
            <h1 id="kdn-masthead-title" className="kdn-masthead-title">
              {MASTHEAD.title}
            </h1>
            <p className="kdn-masthead-motto">{MASTHEAD.motto}</p>
          </div>
          <span className="kdn-masthead-cut kdn-masthead-cut--firefly" aria-hidden="true">
            <FireflyCut className="kdn-cut-svg" />
          </span>
        </header>

        {/* ── 날짜줄(Folio) ── 이중 괘선 사이 ────────────────────── */}
        <div className="kdn-folio">
          <p className="kdn-folio-line">{issue.dateline}</p>
          {/* 호 아카이브 — 가시 호가 둘 이상이면 선택 토글. 편집자에겐 draft 도 「준비중」 라벨로 노출. */}
          {visibleIssues.length > 1 ? (
            <nav className="kdn-folio-archive" aria-label="지난 호">
              <span className="kdn-folio-archive-label">지난 호</span>
              {visibleIssues.map((it) => {
                const draft = statusOf(it) === 'draft';
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={`kdn-folio-issue${it.id === issue.id ? ' is-active' : ''}${draft ? ' is-draft' : ''}`}
                    aria-pressed={it.id === issue.id}
                    onClick={() => setIssueId(it.id)}
                  >
                    제{it.no}호{draft && <span className="kdn-folio-draft-tag">준비중</span>}
                  </button>
                );
              })}
            </nav>
          ) : (
            <span className="kdn-folio-archive-label kdn-folio-only">
              제{issue.no}호
              {isDraft && <span className="kdn-folio-draft-tag">준비중</span>}
            </span>
          )}
        </div>

        {/* ── 편집자 도구막대 (꿈다락 로그인 시에만) ─────────────────
            교정쇄 배너 + 공개/준비중 토글. 비로그인에겐 렌더되지 않는다. */}
        {authed && (
          <div className={`kdn-editbar${isDraft ? ' is-draft' : ''}`} role="group" aria-label="호 공개 상태">
            <div className="kdn-editbar-status">
              <span className={`kdn-stamp${isDraft ? ' is-draft' : ' is-published'}`}>
                {isDraft ? '교정쇄' : '발행됨'}
              </span>
              <span className="kdn-editbar-desc">
                {isDraft
                  ? '이 호는 공개 전 준비 중입니다 — 비로그인 방문자에겐 보이지 않습니다.'
                  : '이 호는 발행되어 모두에게 공개되고 있습니다.'}
              </span>
            </div>
            <div className="kdn-editbar-actions">
              <button
                type="button"
                className={`kdn-toggle-btn${isDraft ? ' to-publish' : ' to-draft'}`}
                disabled={busyId === issue.id}
                onClick={() => toggleStatus(issue)}
              >
                {busyId === issue.id
                  ? '저장 중…'
                  : isDraft
                    ? '공개하기'
                    : '준비중으로'}
              </button>
            </div>
            {toggleError && <p className="kdn-editbar-error" role="alert">{toggleError}</p>}
          </div>
        )}

        {/* ── 교정쇄 배너 (draft 호 본문 상단, 편집자만 도달) ──────── */}
        {authed && isDraft && (
          <div className="kdn-proof-banner" aria-hidden="true">
            <span className="kdn-proof-banner-text">공개 전 준비 중 · 교정쇄 · PROOF</span>
          </div>
        )}

        {/* ── 본문: 6단 신문 그리드 위에 블록을 흘림 ─────────────── */}
        <div className="kdn-grid">
          {issue.blocks.map((block, i) => (
            <NewsBlockView key={i} block={block} />
          ))}
        </div>

        {/* ── 콜로폰(판권) ── 고정 프레임 ────────────────────────── */}
        <footer className="kdn-colophon">
          <span className="kdn-colophon-mark" aria-hidden="true">異素</span>
          <ul className="kdn-colophon-lines">
            {COLOPHON_LINES.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </footer>
      </div>
    </section>
  );
};

export default VillageNews;
