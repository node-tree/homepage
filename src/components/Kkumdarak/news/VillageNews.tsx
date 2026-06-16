import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import './villageNews.css';
import {
  NEWS_KICKER,
  NEWS_TITLE,
  NEWS_SUBTITLE,
  resolveIssueStatus,
  mergeIssues,
  isStaticIssue,
  suggestNextNo,
  normalizeArticles,
  type NewsIssue,
  type NewsArticle,
  type NewsStatus,
  type NewsStatusMap,
} from './newsData';
import { ikUrl } from '../../../utils/ikUrl';
import { lsGet, lsSet } from '../../../utils/lsCache';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import {
  kkumdarakNewsStatusAPI,
  villageNewsAPI,
} from '../../../services/api';

// 편집국(에디터)은 공개 방문자 번들에서 분리 — authed 가 진입할 때만 청크 로드.
const NewsEditor = lazy(() => import('./NewsEditor'));
const ArticlesEditor = lazy(() => import('./ArticlesEditor'));

// ── 캐시 우선 시드(이전 내용 플래시 제거) ─────────────────────────────
//   재방문 시 호 공개상태(newsStatus)·편집 사본(issues)을 첫 페인트부터 즉시 반영해
//   draft 호/숨김이 잠깐 보였다 사라지는 일을 막는다. 민감정보 없음(상태·텍스트만).
const NEWS_STATUS_LS_KEY = 'kkumdarakNewsStatus_v1';
const NEWS_ISSUES_LS_KEY = 'kkumdarakNewsIssues_v1';
const NEWS_ARTICLES_LS_KEY = 'kkumdarakNewsArticles_v1';

// ═══════════════════════════════════════════════════════════════
// 「마을소식」 — 이미지 기반 소식지 + 보도 기사 외부 링크 카드 (꿈다락 /iso#news)
//
//   뷰 상태(list | read | edit | articles) — 해시는 #news 유지, 서브뷰는 내부 state.
//     · list     : 가판대 — 호 카드 + 보도 기사 카드 목록(랜딩). 비로그인=published 만.
//     · read     : 한 호의 이미지를 세로로 쌓아 전체폭 표시. 상단 「← 소식지 목록」 복귀.
//     · edit     : 편집국(NewsEditor, 편집자 전용, lazy) — 한 호.
//     · articles : 보도 기사 관리(ArticlesEditor, 편집자 전용, lazy) — 외부 링크 카드.
//
//   데이터:
//     · 유효 호 = 정적 NEWS_ISSUES(빈 배열) + 백엔드 villageNews.issues 병합(같은 id 백엔드 우선).
//     · 보도 기사 = 백엔드 villageNews.articles 배열(순서 = 표시 순서). 항상 공개(상태 없음).
//     · 공개 상태(published/draft)는 settings.newsStatus 버킷 + issue.status 폴백.
//     · 콜드스타트: 백엔드 미도착 동안 정적 호/캐시로 낙관 렌더.
//
//   톤: 다른 꿈다락 섹션과 통일 — 흰 배경 · Gothic/Jua h1 · 둥근 두꺼운 테두리 카드 · kd 팔레트.
//   ※ default export 필수 — Kkumdarak.tsx 가 lazy(() => import(...)) 로 청크 분리.
// ═══════════════════════════════════════════════════════════════

type View = 'list' | 'read' | 'edit' | 'articles';

const VillageNews: React.FC = () => {
  const reduced = useReducedMotion();
  const { authed, logout, requestLogin } = useKkumdarakAuth();

  // ── 호 상태 override (서버 newsStatus 버킷) — 캐시 우선 시드(없으면 undefined) ──
  const cachedNewsStatus = lsGet<NewsStatusMap>(NEWS_STATUS_LS_KEY) ?? undefined;
  const cachedNewsIssues = lsGet<Record<string, NewsIssue>>(NEWS_ISSUES_LS_KEY) ?? undefined;
  const cachedNewsArticles = lsGet<NewsArticle[]>(NEWS_ARTICLES_LS_KEY) ?? undefined;
  const [override, setOverride] = useState<NewsStatusMap | undefined>(cachedNewsStatus);
  const overrideRef = useRef<NewsStatusMap>(cachedNewsStatus ?? {});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // ── 백엔드 편집 사본(issues + articles) — 캐시 우선 시드(없으면 undefined) ──
  const [backendIssues, setBackendIssues] = useState<Record<string, NewsIssue> | undefined>(cachedNewsIssues);
  const [articles, setArticles] = useState<NewsArticle[]>(
    cachedNewsArticles ? normalizeArticles(cachedNewsArticles) : [],
  );

  // ── 뷰 상태 머신 ──
  const [view, setView] = useState<View>('list');
  const [issueId, setIssueId] = useState<string>(''); // read/edit 대상
  const [editTarget, setEditTarget] = useState<NewsIssue | null>(null);
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
        lsSet(NEWS_STATUS_LS_KEY, safe);   // 캐시 갱신
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
        const issues = data && data.issues ? (data.issues as Record<string, NewsIssue>) : {};
        const arts = normalizeArticles(data && (data as any).articles);
        setBackendIssues(issues);
        setArticles(arts);
        lsSet(NEWS_ISSUES_LS_KEY, issues);     // 캐시 갱신
        lsSet(NEWS_ARTICLES_LS_KEY, arts);     // 캐시 갱신
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

  // 편집/기사 관리 뷰인데 로그아웃되면 리스트로.
  useEffect(() => {
    if ((view === 'edit' || view === 'articles') && !authed) setView('list');
  }, [view, authed]);

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

  // 호를 편집 사본으로 복제(에디터 입력) — 원본 불변.
  const toEditable = useCallback((issue: NewsIssue): NewsIssue => {
    return JSON.parse(JSON.stringify({
      id: issue.id,
      no: issue.no,
      title: issue.title,
      date: issue.date,
      status: statusOf(issue),
      images: issue.images || [],
    }));
  }, [statusOf]);

  const openEditExisting = useCallback((issue: NewsIssue) => {
    setEditTarget(toEditable(issue));
    setEditIsNew(false);
    setView('edit');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }, [toEditable]);

  const openCreate = useCallback(() => {
    const nextNo = suggestNextNo(allIssues);
    const now = new Date();
    setEditTarget({
      id: `issue-${Date.now().toString(36)}`,
      no: nextNo,
      title: `제${nextNo}호`,
      date: `${now.getFullYear()}.${now.getMonth() + 1}`,
      status: 'draft',
      images: [],
    });
    setEditIsNew(true);
    setView('edit');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }, [allIssues]);

  const openArticles = useCallback(() => {
    setView('articles');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // ── 에디터 저장: read-merge-write(다른 호 보존) + newsStatus 동기화 ──
  const handleEditorSave = useCallback(
    async (edited: NewsIssue, status: NewsStatus) => {
      const base = await villageNewsAPI.get();
      const baseIssues = base && base.issues ? base.issues : {};
      const baseArticles = normalizeArticles(base && (base as any).articles);
      const nextIssues = { ...baseIssues, [edited.id]: { ...edited, status } };
      const saved = await villageNewsAPI.save({ issues: nextIssues, articles: baseArticles });
      const savedIssues = (saved && saved.issues ? saved.issues : nextIssues) as Record<string, NewsIssue>;
      setBackendIssues(savedIssues);
      const savedArts = normalizeArticles(saved && (saved as any).articles);
      setArticles(savedArts);
      lsSet(NEWS_ISSUES_LS_KEY, savedIssues);
      lsSet(NEWS_ARTICLES_LS_KEY, savedArts);

      // 공개 상태(newsStatus 버킷)도 동기화 — read 뷰 토글/가시성과 정합.
      try {
        const savedNs = await kkumdarakNewsStatusAPI.setIssueStatus(edited.id, status);
        const safe = savedNs && typeof savedNs === 'object' ? savedNs : { ...overrideRef.current, [edited.id]: status };
        overrideRef.current = safe;
        setOverride(safe);
      } catch (err: any) {
        if (err && err.code === 'KKUM_AUTH_EXPIRED') throw err; // 에디터가 인증 만료 피드백.
        const local: NewsStatusMap = { ...overrideRef.current, [edited.id]: status };
        overrideRef.current = local;
        setOverride(local);
      }
    },
    [],
  );

  // ── 에디터 삭제: 백엔드 사본 제거(다른 호 보존) ──
  const handleEditorDelete = useCallback(
    async (target: NewsIssue) => {
      const base = await villageNewsAPI.get();
      const baseIssues = base && base.issues ? base.issues : {};
      const baseArticles = normalizeArticles(base && (base as any).articles);
      const nextIssues: Record<string, NewsIssue> = { ...(baseIssues as Record<string, NewsIssue>) };
      delete nextIssues[target.id];
      const saved = await villageNewsAPI.save({ issues: nextIssues, articles: baseArticles });
      const savedIssues = (saved && saved.issues ? saved.issues : nextIssues) as Record<string, NewsIssue>;
      setBackendIssues(savedIssues);
      const savedArts = normalizeArticles(saved && (saved as any).articles);
      setArticles(savedArts);
      lsSet(NEWS_ISSUES_LS_KEY, savedIssues);
      lsSet(NEWS_ARTICLES_LS_KEY, savedArts);
      setView('list');
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' });
    },
    [],
  );

  // ── 보도 기사 저장: read-merge-write(호 보존) — articles 배열만 통째 교체 ──
  const handleArticlesSave = useCallback(
    async (nextArticles: NewsArticle[]) => {
      const base = await villageNewsAPI.get();
      const baseIssues = base && base.issues ? base.issues : {};
      const saved = await villageNewsAPI.save({ issues: baseIssues, articles: nextArticles });
      const savedArts = normalizeArticles(saved && (saved as any).articles);
      const savedIssues = (saved && saved.issues ? saved.issues : baseIssues) as Record<string, NewsIssue>;
      setArticles(savedArts);
      setBackendIssues(savedIssues);
      lsSet(NEWS_ARTICLES_LS_KEY, savedArts);
      lsSet(NEWS_ISSUES_LS_KEY, savedIssues);
    },
    [],
  );

  const reducedCls = reduced ? ' kdn-reduced' : '';

  // ════════════════════════════════════════════════════════════
  // ARTICLES 뷰 — 보도 기사 관리(lazy)
  // ════════════════════════════════════════════════════════════
  if (view === 'articles' && authed) {
    return (
      <section className={`kd-news kd-news--editor${reducedCls}`}>
        <div className="kd-section-rule kd-section-rule--s6" />
        <Suspense fallback={<div className="kdne-loading">보도 기사 관리를 여는 중…</div>}>
          <ArticlesEditor
            initialArticles={articles}
            onSave={handleArticlesSave}
            onCancel={backToList}
          />
        </Suspense>
      </section>
    );
  }

  // ════════════════════════════════════════════════════════════
  // EDIT 뷰 — 편집국(lazy)
  // ════════════════════════════════════════════════════════════
  if (view === 'edit' && authed && editTarget) {
    return (
      <section className={`kd-news kd-news--editor${reducedCls}`}>
        <div className="kd-section-rule kd-section-rule--s6" />
        <Suspense fallback={<div className="kdne-loading">편집국을 여는 중…</div>}>
          <NewsEditor
            initialIssue={editTarget}
            isNew={editIsNew}
            isStatic={isStaticIssue(editTarget.id)}
            onSave={handleEditorSave}
            onDelete={editIsNew ? undefined : handleEditorDelete}
            onCancel={backToList}
          />
        </Suspense>
      </section>
    );
  }

  // ════════════════════════════════════════════════════════════
  // READ 뷰 — 한 호 이미지 스택(전체폭)
  // ════════════════════════════════════════════════════════════
  if (view === 'read' && readIssue) {
    const issue = readIssue;
    const isDraft = statusOf(issue) === 'draft';
    return (
      <section className={`kd-news kd-news--read${reducedCls}`} aria-labelledby="kdn-read-title">
        <div className="kd-section-rule kd-section-rule--s6" />
        <div className="kdn-wrap">
          <div className="kdn-read-top">
            <button type="button" className="kdn-back" onClick={backToList}>← 소식지 목록</button>
          </div>

          <header className="kdn-read-head">
            <span className="kdn-read-no">제{issue.no}호</span>
            <h1 id="kdn-read-title" className="kdn-read-title">{issue.title}</h1>
            <p className="kdn-read-date">
              {issue.date}
              {isDraft && <span className="kdn-badge kdn-badge--read">준비중</span>}
            </p>
          </header>

          {/* 편집자 도구막대 — 발행 토글 + 편집 진입 */}
          {authed && (
            <div className={`kdn-editbar${isDraft ? ' is-draft' : ''}`} role="group" aria-label="호 도구">
              <span className={`kdn-stamp${isDraft ? ' is-draft' : ' is-published'}`}>
                {isDraft ? '준비중' : '발행됨'}
              </span>
              <div className="kdn-editbar-actions">
                <button type="button" className="kdn-pill kdn-pill--ghost" onClick={() => openEditExisting(issue)}>편집</button>
                <button
                  type="button"
                  className={`kdn-pill${isDraft ? ' kdn-pill--solid' : ' kdn-pill--ghost'}`}
                  disabled={busyId === issue.id}
                  onClick={() => toggleStatus(issue)}
                >
                  {busyId === issue.id ? '저장 중…' : isDraft ? '공개하기' : '준비중으로'}
                </button>
              </div>
              {toggleError && <p className="kdn-editbar-error" role="alert">{toggleError}</p>}
            </div>
          )}

          {issue.images.length === 0 ? (
            <p className="kdn-read-empty">아직 등록된 이미지가 없는 호입니다.</p>
          ) : (
            <div className="kdn-read-stack">
              {issue.images.map((img, i) => (
                <img
                  key={i}
                  className="kdn-read-img"
                  src={ikUrl(img.src, { w: 1400 })}
                  alt={img.alt || `제${issue.no}호 ${i + 1}`}
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
              ))}
            </div>
          )}

          <div className="kdn-read-foot">
            <button type="button" className="kdn-back" onClick={backToList}>← 소식지 목록</button>
          </div>
        </div>
      </section>
    );
  }

  // ════════════════════════════════════════════════════════════
  // LIST 뷰 — 가판대(랜딩)
  // ════════════════════════════════════════════════════════════
  const publishedCount = visibleIssues.filter((it) => statusOf(it) === 'published').length;
  // 비로그인 + 발행 0개 + 기사 0개 → 톤 placeholder.
  const showPlaceholder = !authed && publishedCount === 0 && articles.length === 0;

  return (
    <section className={`kd-news kd-news--list${reducedCls}`} aria-labelledby="kdn-list-title">
      <div className="kd-section-rule kd-section-rule--s6" />
      <div className="kdn-wrap">
        <header className="kdn-head">
          <p className="kdn-kicker">{NEWS_KICKER}</p>
          <h1 id="kdn-list-title" className="kdn-title">{NEWS_TITLE}</h1>
          <p className="kdn-subtitle">{NEWS_SUBTITLE}</p>
        </header>

        {authed && (
          <div className="kdn-toolbar">
            <button type="button" className="kdn-pill kdn-pill--solid" onClick={openCreate}>+ 새 소식지</button>
            <button type="button" className="kdn-pill kdn-pill--ghost" onClick={openArticles}>보도 기사 관리</button>
            <p className="kdn-editor-note">
              편집자 모드 — 「준비중」 배지가 붙은 호는 비로그인 방문자에게 보이지 않습니다.
            </p>
          </div>
        )}

        {showPlaceholder ? (
          <div className="kdn-coming" role="status">
            <div className="kdn-coming-card">
              <p className="kdn-coming-kicker">소식지</p>
              <p className="kdn-coming-headline">소식지를 준비하고 있어요</p>
              <p className="kdn-coming-body">
                장암면의 다음 소식을 곧 이 자리에 펼쳐 보일게요.<br />
                조금만 기다려 주세요.
              </p>
            </div>
          </div>
        ) : (
          <>
            <ul className="kdn-rack" aria-label="소식지 목록">
              {visibleIssues.map((issue) => {
                const draft = statusOf(issue) === 'draft';
                const cover = issue.images[0];
                return (
                  <li key={issue.id} className={`kdn-card${draft ? ' is-draft' : ''}`}>
                    <button
                      type="button"
                      className="kdn-card-open"
                      onClick={() => openRead(issue.id)}
                      aria-label={`제${issue.no}호 ${issue.title} 열람`}
                    >
                      <div className="kdn-card-thumb">
                        {cover ? (
                          <img src={ikUrl(cover.src, { w: 600 })} alt={cover.alt || issue.title} loading="lazy" />
                        ) : (
                          <span className="kdn-card-noimg" aria-hidden="true">마을소식</span>
                        )}
                      </div>
                      <div className="kdn-card-body">
                        <div className="kdn-card-meta">
                          <span className="kdn-card-no">제{issue.no}호</span>
                          {draft && <span className="kdn-badge">준비중</span>}
                        </div>
                        <h3 className="kdn-card-title">{issue.title}</h3>
                        <p className="kdn-card-date">{issue.date}</p>
                      </div>
                    </button>
                    {authed && (
                      <div className="kdn-card-tools">
                        <button type="button" className="kdn-pill kdn-pill--ghost kdn-pill--sm" onClick={() => openEditExisting(issue)}>편집</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* ── 보도 기사(외부 링크 카드) — 가로형 리스트 행, 클릭 시 원문 새 탭 ── */}
            {articles.length > 0 && (
              <div className="kdn-press">
                <h2 className="kdn-press-title">언론 속 마을소식</h2>
                <ul className="kdn-arts" aria-label="보도 기사 목록">
                  {articles.map((article) => (
                    <li key={article.id} className={`kdn-art${authed ? ' is-authed' : ''}`}>
                      <a
                        className="kdn-art-link"
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${article.outlet ? article.outlet + ' — ' : ''}${article.title || '보도 기사'} (새 탭으로 원문 열기)`}
                      >
                        <div className="kdn-art-thumb">
                          {article.thumb && article.thumb.src ? (
                            <img src={ikUrl(article.thumb.src, { w: 320 })} alt={article.thumb.alt || article.title} loading="lazy" />
                          ) : (
                            <span className="kdn-art-noimg" aria-hidden="true">보도</span>
                          )}
                        </div>
                        <div className="kdn-art-body">
                          <div className="kdn-art-top">
                            <span className="kdn-tag-press">기사</span>
                            <h3 className="kdn-art-title">{article.title || '제목 없음'}</h3>
                          </div>
                          <div className="kdn-art-meta">
                            {article.outlet && <span className="kdn-art-outlet">{article.outlet}</span>}
                            {article.outlet && article.date && <span className="kdn-art-dot" aria-hidden="true">·</span>}
                            {article.date && <span className="kdn-art-date">{article.date}</span>}
                          </div>
                        </div>
                        <span className="kdn-art-ext" aria-hidden="true">↗</span>
                      </a>
                      {authed && (
                        <div className="kdn-art-tools">
                          <button type="button" className="kdn-pill kdn-pill--ghost kdn-pill--sm" onClick={openArticles}>기사 관리</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default VillageNews;
