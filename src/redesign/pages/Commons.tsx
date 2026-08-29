import React, { Suspense, lazy, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AdminLine, Note, State } from '../components/bits';
import NtPage from '../components/NtPage';
import VerticalSeal from '../components/VerticalSeal';
import PlateImage from '../components/PlateImage';
import { DbHeader, monoDate, usePosts, useHeader, yearOf } from '../db';
import { useEditMode } from '../edit';

// 편집 가설물은 편집 모드에서만 내려받는다(읽기 전용 방문자에겐 dnd-kit 을 지우지 않는다).
const PostAdminList = lazy(() => import('../edit/PostAdminList'));

// ════════════════════════════════════════════════════════════════════════
// COMMONS 목록(/commons) — 내용은 DB(/api/filed), 판식만 v5.
//   목업 정본: _workspace/03_mock/v5/index.html <section class="feed"> (피드 행)
//     도판 창(정간 어긋남 i1~i8 순환) + 캡션(제목) + Mono 메타(분류 · 날짜)
//   카테고리 탭(전체 · 문화예술교육 · 커뮤니티)은 알약 버튼 대신 **URL 로 되는 궤적 필터**로 옮겼다.
//   꿈다락(異素) 배너는 「바깥」이므로 점선 계선(매개 블록 선질)으로 둔다.
//   구 URL /commons?post=<id> 는 /commons/<id> 로 넘긴다.
// ════════════════════════════════════════════════════════════════════════

const CATEGORIES = ['전체', '문화예술교육', '커뮤니티'] as const;

const Commons: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { editing } = useEditMode();
  const [params] = useSearchParams();
  const legacyPost = params.get('post');
  const cat = params.get('cat') ?? '전체';
  const { data: posts, error, loading, reload } = usePosts('filed');
  const dbHeader = useHeader('filed');
  const [headOverride, setHeadOverride] = useState<DbHeader | null>(null);
  const header = headOverride ?? dbHeader;

  if (legacyPost) return <Navigate to={`/commons/${legacyPost}`} replace />;

  const list = posts ?? [];
  const shown = cat === '전체' ? list : list.filter((p) => p.category === cat);
  const count = (c: string) => (c === '전체' ? list.length : list.filter((p) => p.category === c).length);

  // 인덱스는 연도 묶음(역순). 도판 흐름은 DB 순서(sortOrder)를 그대로 따른다.
  const byYear = new Map<string, typeof shown>();
  shown.forEach((p) => {
    const y = yearOf(p.date) ?? '·';
    if (!byYear.has(y)) byYear.set(y, []);
    (byYear.get(y) as typeof shown).push(p);
  });
  const groups = Array.from(byYear.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, rows]) => ({ year, rows }));

  return (
    <NtPage
      path="/commons"
      title="NODE TREE | Commons — 공유지"
      description="NODE TREE의 공유 자료 및 리소스. 마을 주민·농부·청소년이 함께 만든 창작 커먼즈의 기록."
      keywords="NODE TREE 커먼즈, 문화예술교육, 커뮤니티, 생산소"
    >
      <section className="pagehead">
        <VerticalSeal place="head" mark="共有地" roman="COMMONS" />
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
            kind="filed"
            base="/commons"
            label="COMMONS"
            posts={posts}
            header={header}
            onChanged={reload}
            onHeaderSaved={setHeadOverride}
          />
        </Suspense>
      )}

      <section className="index" style={{ paddingTop: 40 }}>
        <div className="rows">
          <div className="grp">매개 MEDIATION — 본체는 각자의 도메인에 있다</div>
          <a className="prow-l out" href="/iso" target="_blank" rel="noopener noreferrer">
            <span className="t">이소 異素</span>
            <span className="md">꿈다락 토요문화학교 · 지역 어린이·청소년 예술교육 프로그램</span>
            <span className="go">바로가기 →</span>
          </a>
        </div>

        <div className="filt">
          <b>분류 CATEGORY</b>
          {CATEGORIES.map((c) => (
            <React.Fragment key={c}>
              <Link to={c === '전체' ? '/commons' : `/commons?cat=${encodeURIComponent(c)}`} className={cat === c ? 'on' : undefined}>
                {c} {count(c)}
              </Link>
              <br />
            </React.Fragment>
          ))}
        </div>
      </section>

      {loading && <State text="LOADING · 기록을 불러오는 중…" />}
      {error && <State text={`ERROR · ${error}`} onRetry={reload} />}
      {!loading && !error && list.length === 0 && <State text="ABSENT · 아직 기록된 내용이 없습니다." />}
      {!loading && !error && list.length > 0 && shown.length === 0 && (
        <State text={`ABSENT · '${cat}' 분류에 해당하는 글이 없습니다.`} />
      )}

      {shown.length > 0 && (
        <section className="feed">
          {/* 도판 흐름은 최근 8건 — 나머지는 아래 텍스트 인덱스에 전부 실린다(누락 없음) */}
          {shown.slice(0, 8).map((p, i) => (
            <article key={p.id} className={`item i${(i % 8) + 1}`}>
              <div className="fig">
                <Link to={`/commons/${p.id}`}>
                  <PlateImage
                    src={p.thumbnail}
                    alt={p.title}
                    ratio={i % 3 === 0 ? '16/9' : i % 3 === 1 ? '3/2' : '4/5'}
                    note="ABSENT · 도판 미기재"
                  />
                </Link>
                <div className="cap">
                  <p>
                    <Link to={`/commons/${p.id}`}>
                      <span className="h">{p.title}</span>
                    </Link>
                  </p>
                  <div className="m">
                    {p.category ? <span>{p.category}</span> : <span className="t">분류 —</span>}
                    <span>{yearOf(p.date) ?? '—'}</span>
                    <span className="t">{monoDate(p.date)}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {shown.length > 0 && (
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
                      <Link to={`/commons/${p.id}`}>
                        <span className={`t ${p.thumbnail ? 'measured' : 'stated'}`}>{p.title}</span>
                        <span className={`md${p.category ? '' : ' absent'}`}>{p.category ?? '—'}</span>
                        <span className="yr">{yearOf(p.date) ?? '—'}</span>
                        <span className="pl">{monoDate(p.date) || '—'}</span>
                      </Link>
                    </div>
                  ))}
                </React.Fragment>
              ))}
              <div className="src">
                출처 · nodetree.kr DB /api/filed — {list.length}건{cat === '전체' ? '' : ` · 분류 ${cat} ${shown.length}건`}.
                도판 흐름은 최근 8건, 인덱스는 전량.
              </div>
              {isAuthenticated && <AdminLine page="commons" />}
            </div>
          </section>
        </>
      )}
    </NtPage>
  );
};

export default Commons;
