import React, { Suspense, lazy, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AdminLine, Note, State } from '../components/bits';
import NtPage from '../components/NtPage';
import VerticalSeal from '../components/VerticalSeal';
import PlateImage from '../components/PlateImage';
import { DbHeader, DbPost, monoDate, usePosts, useHeader, yearOf } from '../db';
import { useEditMode } from '../edit';

// 편집 가설물은 편집 모드에서만 내려받는다(dnd-kit 을 읽기 전용 방문자에게 지우지 않는다).
const PostAdminList = lazy(() => import('../edit/PostAdminList'));

// ════════════════════════════════════════════════════════════════════════
// ART WORK 목록(/work) — 내용은 DB(/api/work), 판식만 v5.
//   목업 정본: _workspace/03_mock/v5/works.html
//     상단 = 도판 흐름(정간 어긋남 i1~i8, 봉인 72% → 호버 100%. 원형 썸네일 금지)
//     하단 = 텍스트 인덱스 행(제목 · 매체 · 연도 · 장소)
//   DB 에 매체·장소 필드가 없으므로 그 칸은 **absent** — 자리는 남고 값이 없다(설계 §2.2).
//   확신도 선질: 도판이 있는 글 measured(2px) · 도판 없는 글 stated(1px).
//   구 URL /work?post=<id> 는 /work/<id> 로 넘긴다(발행 링크 보존).
// ════════════════════════════════════════════════════════════════════════

/** 도판 흐름 8칸의 창 비율 — 목업 works.html 의 어긋남을 그대로 옮겼다. */
const RATIOS = ['16/9', '3/2', '4/5', '16/9', '1/1', '3/2', '16/9', '4/5'];

const Work: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { editing } = useEditMode();
  const [params] = useSearchParams();
  const legacyPost = params.get('post');
  const year = params.get('yr') ?? 'all';
  const { data: posts, error, loading, reload } = usePosts('work');
  const dbHeader = useHeader('work');
  // 표제를 방금 고쳤다면 재적재 없이 그 값을 보여 준다(헤더 API 는 캐시가 5분이다).
  const [headOverride, setHeadOverride] = useState<DbHeader | null>(null);
  const header = headOverride ?? dbHeader;

  // 구 상세 URL(/work?post=id) → 새 상세 라우트로. hooks 뒤에 둬야 훅 순서가 흔들리지 않는다.
  if (legacyPost) return <Navigate to={`/work/${legacyPost}`} replace />;

  const list = posts ?? [];
  const years = Array.from(new Set(list.map((p) => yearOf(p.date) ?? '·')));
  const shown = year === 'all' ? list : list.filter((p) => (yearOf(p.date) ?? '·') === year);
  const features = list.slice(0, 8);

  // 인덱스는 연도 묶음(역순). 도판 흐름은 DB 순서(sortOrder)를 그대로 따른다.
  const byYear = new Map<string, DbPost[]>();
  shown.forEach((p) => {
    const y = yearOf(p.date) ?? '·';
    if (!byYear.has(y)) byYear.set(y, []);
    (byYear.get(y) as DbPost[]).push(p);
  });
  const groups = Array.from(byYear.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, rows]) => ({ year, rows }));

  return (
    <NtPage
      path="/work"
      title="NODE TREE | Work — 작품"
      description="NODE TREE의 사운드, 영상, 설치 작품 목록. 위성악보, 에디아포닉, 낙원식당 등."
      keywords="NODE TREE 작품, 위성악보, 에디아포닉, 낙원식당, 사운드 설치"
    >
      <section className="pagehead">
        <VerticalSeal place="head" mark="作品" roman="WORK" />
        <div className="lab">
          {header.title} · {list.length || '—'}
        </div>
        <h1>{header.title}</h1>
        <Note text={header.subtitle} />
      </section>
      <div className="hair" />

      {editing && posts && (
        <Suspense fallback={<State text="LOADING · 편집기를 불러오는 중…" />}>
          <PostAdminList
            kind="work"
            base="/work"
            label="ART WORK"
            posts={posts}
            header={header}
            onChanged={reload}
            onHeaderSaved={setHeadOverride}
          />
        </Suspense>
      )}

      {loading && <State text="LOADING · 기록을 불러오는 중…" />}
      {error && <State text={`ERROR · ${error}`} onRetry={reload} />}
      {!loading && !error && list.length === 0 && <State text="ABSENT · 아직 기록된 작품이 없습니다." />}

      {features.length > 0 && (
        <section className="feed">
          {features.map((p, i) => (
            <article key={p.id} className={`item i${i + 1}`}>
              <div className="fig">
                <Link to={`/work/${p.id}`}>
                  <PlateImage
                    src={p.thumbnail}
                    alt={p.title}
                    ratio={RATIOS[i % RATIOS.length]}
                    note="ABSENT · 도판 미기재"
                  />
                </Link>
                <div className="cap">
                  <p>
                    <Link to={`/work/${p.id}`}>
                      <span className="h">{p.title}</span>
                    </Link>
                  </p>
                  <div className="m">
                    <span>{yearOf(p.date) ?? '—'}</span>
                    <span className="t">{monoDate(p.date)}</span>
                    <span className="t">
                      {p.images && p.images.length ? `도판 ${p.images.length}` : '도판 —'}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {list.length > 0 && (
        <>
          <div className="hair dae" style={{ marginTop: 64 }} />
          <section className="index">
            <div className="rows">
              {groups.map((g, gi) => (
                <React.Fragment key={`${g.year}-${gi}`}>
                  <div className="grp">
                    {g.year} · {g.rows.length}
                  </div>
                  {g.rows.map((p) => (
                    <div className="row" key={p.id}>
                      <Link to={`/work/${p.id}`}>
                        <span className={`t ${p.thumbnail || (p.images && p.images.length) ? 'measured' : 'stated'}`}>
                          {p.title}
                        </span>
                        <span className="md absent">—</span>
                        <span className="yr">{yearOf(p.date) ?? '—'}</span>
                        <span className="pl absent">—</span>
                      </Link>
                    </div>
                  ))}
                </React.Fragment>
              ))}
              <div className="src">
                출처 · nodetree.kr DB /api/work — {list.length}건. 매체·장소는 DB 에 기재된 값이 없어 자리만 둔다.
              </div>
              {isAuthenticated && <AdminLine page="work" />}
            </div>

            <div className="filt">
              <b>연도 YEAR</b>
              <Link to="/work" className={year === 'all' ? 'on' : undefined}>
                ALL {list.length}
              </Link>
              <br />
              {years.map((y) => (
                <React.Fragment key={y}>
                  <Link to={`/work?yr=${y}`} className={year === y ? 'on' : undefined}>
                    {y}
                  </Link>
                  <br />
                </React.Fragment>
              ))}
              <div className="key">
                <b>확신도 CONFIDENCE</b>
                measured · 도판 있음
                <br />
                stated · 본문만
                <br />
                absent · DB 미기재
              </div>
            </div>
          </section>
        </>
      )}
    </NtPage>
  );
};

export default Work;
