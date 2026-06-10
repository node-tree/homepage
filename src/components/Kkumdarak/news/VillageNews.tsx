import React, { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import './villageNews.css';
import { NEWS_ISSUES, MASTHEAD, COLOPHON_LINES, type NewsIssue } from './newsData';
import { NewsBlockView, OwlCut, FireflyCut } from './NewsBlocks';

// ═══════════════════════════════════════════════════════════════
// 「마을소식」 — 이소(異素)의 웹 신문 (꿈다락 /iso#news)
//
//   고정 프레임 + 호별 가변:
//     · 제호(마스트헤드) · 날짜줄(Folio) · 콜로폰 = 모든 호 공통(이 파일)
//     · 본문 blocks[] = 호마다 통째로 교체(newsData.ts) → 템플릿 느낌 제거
//
//   디자인: 뉴스프린트 미색 종이 + 먹(순흑 회피) + 신호 빨강 1도(반딧불이).
//   괘선으로 위계(박스 대신 괘선), 인라인 SVG 노이즈로 종이결(이미지 파일 0).
//   폰트는 섹션 마운트 시에만 Noto Serif KR 동적 로드(기존 폰트 로드 무간섭).
//
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

const VillageNews: React.FC = () => {
  useNewsFonts();
  const reduced = useReducedMotion();

  // 호 선택 state — 창간호 1개뿐이지만 아카이브 UI 골격을 잡아 둔다.
  const [issueId, setIssueId] = useState<string>(NEWS_ISSUES[0]?.id ?? '');
  const issue = useMemo(
    () => NEWS_ISSUES.find((it) => it.id === issueId) ?? NEWS_ISSUES[0],
    [issueId]
  );

  if (!issue) {
    // 빈 상태 — 호 데이터가 없을 때(이론상 도달 X) 신문 톤 유지한 안내.
    return (
      <section className="kd-news" aria-labelledby="kdn-masthead-title">
        <div className="kdn-empty">
          <p className="kdn-kicker">마을소식</p>
          <p>아직 발행된 호가 없습니다. 곧 창간호로 찾아뵙겠습니다.</p>
        </div>
      </section>
    );
  }

  const hasTexture = issue.theme.texture !== 'none';
  const olderIssues = NEWS_ISSUES.filter((it) => it.id !== issue.id);

  return (
    <section
      className={`kd-news${reduced ? ' kdn-reduced' : ''}`}
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
          {/* 호 아카이브 — 지난 호가 생기면 선택 토글로 확장(현재 창간호뿐). */}
          {olderIssues.length > 0 ? (
            <nav className="kdn-folio-archive" aria-label="지난 호">
              <span className="kdn-folio-archive-label">지난 호</span>
              {NEWS_ISSUES.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={`kdn-folio-issue${it.id === issue.id ? ' is-active' : ''}`}
                  aria-pressed={it.id === issue.id}
                  onClick={() => setIssueId(it.id)}
                >
                  제{it.no}호
                </button>
              ))}
            </nav>
          ) : (
            <span className="kdn-folio-archive-label kdn-folio-only">제{issue.no}호</span>
          )}
        </div>

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
