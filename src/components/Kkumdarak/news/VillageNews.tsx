import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import './villageNews.css';
import {
  MASTHEAD,
  COLOPHON_LINES,
  resolveIssueStatus,
  mergeIssues,
  isStaticIssue,
  suggestNextNo,
  type NewsIssue,
  type NewsStatus,
  type NewsStatusMap,
  type SerializedNewsIssue,
} from './newsData';
import { NewsBlockView, OwlCut, FireflyCut } from './NewsBlocks';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import {
  kkumdarakNewsStatusAPI,
  villageNewsAPI,
} from '../../../services/api';

// 편집국 책상(에디터)은 공개 방문자 번들에서 분리 — authed 가 진입할 때만 청크 로드.
const NewsEditor = lazy(() => import('./NewsEditor'));

// ═══════════════════════════════════════════════════════════════
// 「마을소식」 — 이소(異素)의 웹 신문 (꿈다락 /iso#news)
//
//   뷰 상태(list | read | edit) — 해시는 #news 유지, 서브뷰는 내부 state.
//     · list : 신문 가판대 — 호 카드 목록(랜딩). 비로그인=published 만.
//     · read : 기존 신문 렌더(한 호 전체). 상단 「← 소식지 목록」 복귀.
//     · edit : 편집국 책상(NewsEditor, 편집자 전용, lazy).
//
//   데이터:
//     · 유효 호 = 정적 NEWS_ISSUES + 백엔드 villageNews.issues 병합(같은 id 백엔드 우선).
//     · 공개 상태(published/draft)는 기존 settings.newsStatus 버킷 + issue.status 폴백.
//     · 콜드스타트: 백엔드 미도착 동안 정적 호로 낙관 렌더.
//
//   디자인: 뉴스프린트 미색 종이 + 먹(순흑 회피) + 신호 빨강 1도(반딧불이).
//   ※ default export 필수 — Kkumdarak.tsx 가 lazy(() => import(...)) 로 청크 분리.
// ═══════════════════════════════════════════════════════════════

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
  }, []);
}

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

const NewsprintNoise: React.FC = () => (
  <svg className="kdn-noise" aria-hidden="true" focusable="false" preserveAspectRatio="none">
    <filter id="kdn-grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#kdn-grain)" />
  </svg>
);

const PLACEHOLDER_THEME: NewsIssue['theme'] = {
  paper: '#ffffff',          // 배경 흰색(사용자 요청, 일단) — 가판대/플레이스홀더 프레임
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

// 호 카드의 "리드 한 줄" — 첫 topStory/article 의 deck/lead/headline 에서 뽑는다.
function issueLead(issue: NewsIssue): string {
  for (const b of issue.blocks) {
    if (b.kind === 'topStory') return b.deck || b.lead || b.headline;
    if (b.kind === 'article') return b.deck || b.headline;
  }
  for (const b of issue.blocks) {
    if (b.kind === 'noticeBox') return b.body;
  }
  return issue.title;
}
// 호 카드의 헤드라인 — 첫 톱/기사 헤드라인.
function issueHeadline(issue: NewsIssue): string {
  for (const b of issue.blocks) {
    if (b.kind === 'topStory' || b.kind === 'article') return b.headline;
  }
  return issue.title;
}

type View = 'list' | 'read' | 'edit';

const VillageNews: React.FC = () => {
  useNewsFonts();
  const reduced = useReducedMotion();
  const { authed, logout, requestLogin } = useKkumdarakAuth();

  // ── 호 상태 override (서버 newsStatus 버킷) — 콜드스타트 동안 undefined ──
  const [override, setOverride] = useState<NewsStatusMap | undefined>(undefined);
  const overrideRef = useRef<NewsStatusMap>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // ── 백엔드 편집 사본(issues) — 콜드스타트 동안 undefined, 도착 시 {} 또는 맵 ──
  const [backendIssues, setBackendIssues] = useState<Record<string, SerializedNewsIssue> | undefined>(undefined);

  // ── 뷰 상태 머신 ──
  const [view, setView] = useState<View>('list');
  const [issueId, setIssueId] = useState<string>(''); // read/edit 대상
  const [editTarget, setEditTarget] = useState<SerializedNewsIssue | null>(null);
  const [editIsNew, setEditIsNew] = useState(false);

  // 마운트 시 호 상태 맵 + 백엔드 편집 사본 동시 로드(둘 다 실패해도 정적으로 동작).
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
        overrideRef.current = {};
        setOverride({});
      });

    villageNewsAPI
      .get()
      .then((data) => {
        if (!alive) return;
        setBackendIssues(data && data.issues ? data.issues : {});
      })
      .catch(() => {
        if (!alive) return;
        setBackendIssues({}); // 폴백: 정적 호만.
      });

    return () => {
      alive = false;
    };
  }, []);

  // 정적 + 백엔드 병합한 전체 호(no 내림차순).
  const allIssues = useMemo(() => mergeIssues(backendIssues), [backendIssues]);

  const statusOf = useCallback(
    (issue: NewsIssue): NewsStatus => resolveIssueStatus(issue, override),
    [override],
  );

  // 비로그인은 published 만, 편집자는 전체.
  const visibleIssues = useMemo(
    () => (authed ? allIssues : allIssues.filter((it) => statusOf(it) === 'published')),
    [authed, allIssues, statusOf],
  );

  // read 대상 호(가시 목록에서). 비로그인 draft 직접진입 차단.
  const readIssue = useMemo(
    () => visibleIssues.find((it) => it.id === issueId) ?? null,
    [visibleIssues, issueId],
  );

  // read 뷰인데 대상이 더는 보이지 않으면(로그아웃 등) 리스트로.
  useEffect(() => {
    if (view === 'read' && !readIssue) setView('list');
  }, [view, readIssue]);

  // ── 상태 토글 (read 뷰 편집자 도구) — read-merge-write, 낙관 갱신/롤백 ──
  const toggleStatus = useCallback(
    async (target: NewsIssue) => {
      if (!authed || busyId) return;
      const current = statusOf(target);
      const next: NewsStatus = current === 'published' ? 'draft' : 'published';
      setBusyId(target.id);
      setToggleError(null);
      const optimistic: NewsStatusMap = { ...overrideRef.current, [target.id]: next };
      overrideRef.current = optimistic;
      setOverride(optimistic);
      try {
        const savedNs = await kkumdarakNewsStatusAPI.setIssueStatus(target.id, next);
        const safe = savedNs && typeof savedNs === 'object' ? savedNs : optimistic;
        overrideRef.current = safe;
        setOverride(safe);
      } catch (err: any) {
        const rolledBack: NewsStatusMap = { ...overrideRef.current, [target.id]: current };
        overrideRef.current = rolledBack;
        setOverride(rolledBack);
        if (err && err.code === 'KKUM_AUTH_EXPIRED') {
          logout();
          if (typeof window !== 'undefined') window.alert('꿈다락 편집 인증이 만료되었습니다. 다시 로그인해주세요.');
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

  // ── 내비게이션 헬퍼 ──
  const openRead = useCallback((id: string) => {
    setIssueId(id);
    setView('read');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);
  const backToList = useCallback(() => {
    setView('list');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // 호를 직렬화 사본으로(에디터 입력). 정적 호도 사본으로 복제 — 원본 불변.
  const toSerialized = useCallback((issue: NewsIssue): SerializedNewsIssue => {
    const blocks = issue.blocks.filter((b) => b.kind !== 'custom') as SerializedNewsIssue['blocks'];
    return JSON.parse(JSON.stringify({
      id: issue.id,
      no: issue.no,
      title: issue.title,
      dateline: issue.dateline,
      status: statusOf(issue),
      theme: issue.theme,
      blocks,
    }));
  }, [statusOf]);

  const openEditExisting = useCallback((issue: NewsIssue) => {
    setEditTarget(toSerialized(issue));
    setEditIsNew(false);
    setView('edit');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }, [toSerialized]);

  const openCreate = useCallback(() => {
    const nextNo = suggestNextNo(allIssues);
    setEditTarget({
      id: `issue-${Date.now().toString(36)}`,
      no: nextNo,
      title: `제${nextNo}호`,
      dateline: `제${nextNo}호 · 충남 부여군 장암면  |  펴낸곳 꿈다락 문화예술학교 이소(異素)`,
      status: 'draft',
      theme: { paper: '#ffffff', ink: '#251b13', spot: '#f02e1f', spot2: '#0f7a38', texture: 'newsprint' },
      blocks: [],
    });
    setEditIsNew(true);
    setView('edit');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }, [allIssues]);

  // ── 에디터 저장: read-merge-write(다른 호 보존) + newsStatus 동기화 ──
  const handleEditorSave = useCallback(
    async (edited: SerializedNewsIssue, status: NewsStatus) => {
      // ① 최신 백엔드 issues 베이스 GET(다른 호 보존).
      const base = await villageNewsAPI.get();
      const baseIssues = base && base.issues ? base.issues : {};
      const nextIssues = { ...baseIssues, [edited.id]: { ...edited, status } };
      // ② 저장.
      const saved = await villageNewsAPI.save({ issues: nextIssues });
      const savedIssues = saved && saved.issues ? saved.issues : nextIssues;
      setBackendIssues(savedIssues);

      // ③ 공개 상태(newsStatus 버킷)도 동기화 — read 뷰 토글/가시성과 정합.
      try {
        const savedNs = await kkumdarakNewsStatusAPI.setIssueStatus(edited.id, status);
        const safe = savedNs && typeof savedNs === 'object' ? savedNs : { ...overrideRef.current, [edited.id]: status };
        overrideRef.current = safe;
        setOverride(safe);
      } catch (err: any) {
        if (err && err.code === 'KKUM_AUTH_EXPIRED') throw err; // 에디터가 인증 만료 피드백.
        // 그 외 newsStatus 실패는 치명적 아님 — issue.status 폴백으로 동작.
        const local: NewsStatusMap = { ...overrideRef.current, [edited.id]: status };
        overrideRef.current = local;
        setOverride(local);
      }
    },
    [],
  );

  // ── 에디터 삭제/되돌리기: 백엔드 사본 제거(다른 호 보존) ──
  const handleEditorDelete = useCallback(
    async (target: SerializedNewsIssue) => {
      const base = await villageNewsAPI.get();
      const baseIssues = base && base.issues ? base.issues : {};
      const nextIssues = { ...baseIssues };
      delete nextIssues[target.id];
      const saved = await villageNewsAPI.save({ issues: nextIssues });
      const savedIssues = saved && saved.issues ? saved.issues : nextIssues;
      setBackendIssues(savedIssues);
      // 성공 → 리스트로 복귀.
      setView('list');
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
    },
    [],
  );

  // ════════════════════════════════════════════════════════════
  // EDIT 뷰 — 편집국 책상(lazy)
  // ════════════════════════════════════════════════════════════
  if (view === 'edit' && authed && editTarget) {
    return (
      <section className={`kd-news kd-news--editor${reduced ? ' kdn-reduced' : ''}`} style={placeholderVars()}>
        <div className="kd-section-rule kd-section-rule--s6" />
        <Suspense fallback={<div className="kdne-loading">편집국을 여는 중…</div>}>
          <NewsEditor
            initialIssue={editTarget}
            isNew={editIsNew}
            isStatic={isStaticIssue(editTarget.id)}
            nextNoSuggestion={suggestNextNo(allIssues)}
            onSave={handleEditorSave}
            onDelete={editIsNew ? undefined : handleEditorDelete}
            onCancel={backToList}
          />
        </Suspense>
      </section>
    );
  }

  // ════════════════════════════════════════════════════════════
  // READ 뷰 — 한 호 신문 렌더(기존 디자인 유지)
  // ════════════════════════════════════════════════════════════
  if (view === 'read' && readIssue) {
    const issue = readIssue;
    const hasTexture = issue.theme.texture !== 'none';
    const currentStatus = statusOf(issue);
    const isDraft = currentStatus === 'draft';
    return (
      <section
        className={`kd-news${reduced ? ' kdn-reduced' : ''}${isDraft ? ' kd-news--draft' : ''}`}
        style={themeVars(issue)}
        aria-labelledby="kdn-masthead-title"
      >
        <div className="kd-section-rule kd-section-rule--s6" />
        {hasTexture && <NewsprintNoise />}
        <div className="kd-news-sheet">
          {/* 목록 복귀 */}
          <div className="kdn-read-top">
            <button type="button" className="kdn-back-to-list" onClick={backToList}>← 소식지 목록</button>
          </div>

          <header className="kdn-masthead">
            <span className="kdn-masthead-cut kdn-masthead-cut--owl" aria-hidden="true"><OwlCut className="kdn-cut-svg" /></span>
            <div className="kdn-masthead-center">
              <h1 id="kdn-masthead-title" className="kdn-masthead-title">{MASTHEAD.title}</h1>
              <p className="kdn-masthead-motto">{MASTHEAD.motto}</p>
            </div>
            <span className="kdn-masthead-cut kdn-masthead-cut--firefly" aria-hidden="true"><FireflyCut className="kdn-cut-svg" /></span>
          </header>

          <div className="kdn-folio">
            <p className="kdn-folio-line">{issue.dateline}</p>
            <span className="kdn-folio-archive-label kdn-folio-only">
              제{issue.no}호{isDraft && <span className="kdn-folio-draft-tag">준비중</span>}
            </span>
          </div>

          {/* 편집자 도구막대 — 발행 토글 + 편집 진입 */}
          {authed && (
            <div className={`kdn-editbar${isDraft ? ' is-draft' : ''}`} role="group" aria-label="호 도구">
              <div className="kdn-editbar-status">
                <span className={`kdn-stamp${isDraft ? ' is-draft' : ' is-published'}`}>{isDraft ? '교정쇄' : '발행됨'}</span>
                <span className="kdn-editbar-desc">
                  {isDraft ? '이 호는 공개 전 준비 중입니다 — 비로그인 방문자에겐 보이지 않습니다.' : '이 호는 발행되어 모두에게 공개되고 있습니다.'}
                </span>
              </div>
              <div className="kdn-editbar-actions">
                <button type="button" className="kdn-edit-enter" onClick={() => openEditExisting(issue)}>편집</button>
                <button
                  type="button"
                  className={`kdn-toggle-btn${isDraft ? ' to-publish' : ' to-draft'}`}
                  disabled={busyId === issue.id}
                  onClick={() => toggleStatus(issue)}
                >
                  {busyId === issue.id ? '저장 중…' : isDraft ? '공개하기' : '준비중으로'}
                </button>
              </div>
              {toggleError && <p className="kdn-editbar-error" role="alert">{toggleError}</p>}
            </div>
          )}

          {authed && isDraft && (
            <div className="kdn-proof-banner" aria-hidden="true">
              <span className="kdn-proof-banner-text">공개 전 준비 중 · 교정쇄 · PROOF</span>
            </div>
          )}

          <div className="kdn-grid">
            {issue.blocks.map((block, i) => (
              <NewsBlockView key={i} block={block} />
            ))}
          </div>

          <footer className="kdn-colophon">
            <span className="kdn-colophon-mark" aria-hidden="true">異素</span>
            <ul className="kdn-colophon-lines">
              {COLOPHON_LINES.map((line, i) => (<li key={i}>{line}</li>))}
            </ul>
          </footer>
        </div>
      </section>
    );
  }

  // ════════════════════════════════════════════════════════════
  // LIST 뷰 — 신문 가판대(랜딩)
  // ════════════════════════════════════════════════════════════
  const publishedCount = visibleIssues.filter((it) => statusOf(it) === 'published').length;
  // 비로그인 + 발행 0개 → 사고(社告)풍 플레이스홀더(단, 「+ 새 소식지」 버튼은 편집자에게 항상).
  const showPlaceholder = !authed && publishedCount === 0;

  return (
    <section
      className={`kd-news kd-news--list${reduced ? ' kdn-reduced' : ''}`}
      style={placeholderVars()}
      aria-labelledby="kdn-masthead-title"
    >
      <div className="kd-section-rule kd-section-rule--s6" />
      <NewsprintNoise />
      <div className="kd-news-sheet">
        {/* 제호 — 가판대에서도 매체 정체성은 선다 */}
        <header className="kdn-masthead">
          <span className="kdn-masthead-cut kdn-masthead-cut--owl" aria-hidden="true"><OwlCut className="kdn-cut-svg" /></span>
          <div className="kdn-masthead-center">
            <h1 id="kdn-masthead-title" className="kdn-masthead-title">{MASTHEAD.title}</h1>
            <p className="kdn-masthead-motto">{MASTHEAD.motto}</p>
          </div>
          <span className="kdn-masthead-cut kdn-masthead-cut--firefly" aria-hidden="true"><FireflyCut className="kdn-cut-svg" /></span>
        </header>

        <div className="kdn-folio">
          <p className="kdn-folio-line">충남 부여군 장암면 · 꿈다락 문화예술학교 이소(異素) · 소식지 보관함</p>
          {authed && (
            <button type="button" className="kdn-new-issue" onClick={openCreate}>+ 새 소식지</button>
          )}
        </div>

        {/* 편집자 안내(비로그인엔 없음) */}
        {authed && (
          <p className="kdn-list-editor-note">
            편집자 모드 — 「준비중」 배지가 붙은 호는 비로그인 방문자에게 보이지 않습니다. 카드의 「편집」으로 자유롭게 지면을 짜세요.
          </p>
        )}

        {showPlaceholder ? (
          // ── 발행 0개 + 비로그인 — 사고(社告)풍 빈 상태 ──
          <div className="kdn-coming" role="status">
            <div className="kdn-coming-cuts" aria-hidden="true">
              <OwlCut className="kdn-coming-cut" />
              <FireflyCut className="kdn-coming-cut" />
            </div>
            <p className="kdn-coming-label">사고(社告)</p>
            <p className="kdn-coming-headline">창간호를 준비하고 있어요</p>
            <p className="kdn-coming-body">
              부엉이가 마을의 소리를 듣고, 반딧불이가 빛을 내어 발화할 채비를 하고 있습니다.<br />
              곧 첫 호로 찾아뵙겠습니다.
            </p>
          </div>
        ) : (
          // ── 가판대: 호 카드 + 다음 호 예고 사고 카드 ──
          <ul className="kdn-rack" aria-label="소식지 목록">
            {visibleIssues.map((issue) => {
              const draft = statusOf(issue) === 'draft';
              return (
                <li key={issue.id} className={`kdn-rack-card${draft ? ' is-draft' : ''}`}>
                  <button type="button" className="kdn-rack-open" onClick={() => openRead(issue.id)} aria-label={`제${issue.no}호 열람`}>
                    <div className="kdn-rack-fold" aria-hidden="true">
                      <span className="kdn-rack-mini-masthead">{MASTHEAD.title}</span>
                      <span className="kdn-rack-mini-rule" />
                    </div>
                    <div className="kdn-rack-meta">
                      <span className="kdn-rack-no">제{issue.no}호</span>
                      {draft && <span className="kdn-rack-badge">준비중</span>}
                      <span className="kdn-rack-title">{issue.title}</span>
                    </div>
                    <h3 className="kdn-rack-headline">{issueHeadline(issue)}</h3>
                    <p className="kdn-rack-lead">{issueLead(issue)}</p>
                    <p className="kdn-rack-dateline">{issue.dateline.split('|')[0].trim()}</p>
                  </button>
                  {authed && (
                    <div className="kdn-rack-tools">
                      <button type="button" className="kdn-rack-edit" onClick={() => openEditExisting(issue)}>편집</button>
                    </div>
                  )}
                </li>
              );
            })}

            {/* 다음 호 예고 사고(社告) 카드 — 가판대가 썰렁하지 않게 */}
            <li className="kdn-rack-card kdn-rack-card--sago" aria-hidden={!authed}>
              <div className="kdn-rack-sago">
                <span className="kdn-rack-sago-label">사고(社告)</span>
                <p className="kdn-rack-sago-head">다음 호를 준비하고 있어요</p>
                <p className="kdn-rack-sago-body">
                  부엉이가 듣고, 반딧불이가 발화합니다. 마을의 다음 소식이 곧 이 자리에 놓입니다.
                </p>
                {authed && (
                  <button type="button" className="kdn-rack-sago-new" onClick={openCreate}>+ 새 소식지 등록</button>
                )}
              </div>
            </li>
          </ul>
        )}

        <footer className="kdn-colophon">
          <span className="kdn-colophon-mark" aria-hidden="true">異素</span>
          <ul className="kdn-colophon-lines">
            {COLOPHON_LINES.map((line, i) => (<li key={i}>{line}</li>))}
          </ul>
        </footer>
      </div>
    </section>
  );
};

export default VillageNews;
