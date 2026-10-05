import React, { Suspense, lazy, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AdminLine, State } from '../components/bits';
import NtPage from '../components/NtPage';
import { CollectionHead, YearFilter } from '../components/CollectionHead';
import JustifiedFeed, { FeedEntry } from '../components/JustifiedFeed';
import { DbHeader, usePosts, useHeader, postYear, yearLabel } from '../db';
import { useEditMode } from '../edit';

// 편집 가설물은 편집 모드에서만 내려받는다(읽기 전용 방문자에겐 dnd-kit 을 지우지 않는다).
const PostAdminList = lazy(() => import('../edit/PostAdminList'));

// ════════════════════════════════════════════════════════════════════════
// COMMONS 목록(/commons) — 내용은 DB(/api/filed), 판식만 v5.
//   목업 정본: _workspace/03_mock/v5/index.html <section class="feed"> (피드 행)
//     도판 창(정간 어긋남 i1~i8 순환) + 캡션(제목) + Mono 메타(분류 · 날짜)
//   카테고리 탭(전체 · 문화예술교육 · 커뮤니티)은 알약 버튼 대신 **URL 로 되는 궤적 필터**로 옮겼다.
//   2026-08-30 개정 — 도판 격자가 전 글을 수록하게 되어 하단 텍스트 인덱스가 같은 목록을
//     되풀이했다. **인덱스를 걷어내고 격자 하나만 둔다**(사용자 결정).
//   이소(異素)는 본체가 다른 도메인에 있는 자리다 — 판머리 바로 아래 「매개의 문」으로 세운다.
//     「바깥」이므로 점선 계선을 쓴다(.out 관례와 같다).
//   구 URL /commons?post=<id> 는 /commons/<id> 로 넘긴다.
// ════════════════════════════════════════════════════════════════════════

const CATEGORIES = ['전체', '문화예술교육', '커뮤니티'] as const;

const Commons: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { editing } = useEditMode();
  const [params] = useSearchParams();
  const legacyPost = params.get('post');
  const year = params.get('yr') ?? 'all';
  const requestedCat = params.get('cat') ?? '전체';
  const { data: posts, error, loading, reload } = usePosts('filed');
  const dbHeader = useHeader('filed');
  const [headOverride, setHeadOverride] = useState<DbHeader | null>(null);
  const header = headOverride ?? dbHeader;

  if (legacyPost) return <Navigate to={`/commons/${legacyPost}`} replace />;

  const list = posts ?? [];
  const count = (c: string) => (c === '전체' ? list.length : list.filter((p) => p.category === c).length);
  const categories = CATEGORIES.filter((c) => c !== '전체' && count(c) > 0);
  const cat = categories.length > 1 && categories.some((c) => c === requestedCat) ? requestedCat : '전체';
  const categorized = cat === '전체' ? list : list.filter((p) => p.category === cat);
  const shown = year === 'all' ? categorized : categorized.filter((p) => (postYear(p) || 'unknown') === year);

  return (
    <NtPage
      path="/commons"
      title="NODE TREE | Commons — 공유지"
      description="NODE TREE의 공유 자료 및 리소스. 마을 주민·농부·청소년이 함께 만든 창작 커먼즈의 기록."
      keywords="NODE TREE 커먼즈, 문화예술교육, 커뮤니티, 생산소"
    >
      <CollectionHead header={header} count={list.length} commons />

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

      {list.length > 0 && <YearFilter posts={categorized} year={year} base="/commons" category={cat} />}
      {categories.length > 1 && <nav className="collection-filter collection-categories" aria-label="분류 필터">
        {['전체', ...categories].map((c) => {
          const query = new URLSearchParams();
          if (c !== '전체') query.set('cat', c);
          if (year !== 'all') query.set('yr', year);
          return <Link key={c} to={`/commons${query.toString() ? `?${query}` : ''}`}
            className={cat === c ? 'on' : undefined} aria-current={cat === c ? 'page' : undefined}>
            {c} {count(c)}
          </Link>;
        })}
      </nav>}

      {loading && <State text="LOADING · 기록을 불러오는 중…" />}
      {error && <State text={`ERROR · ${error}`} onRetry={reload} />}
      {!loading && !error && list.length === 0 && <State text="ABSENT · 아직 기록된 내용이 없습니다." />}
      {!loading && !error && list.length > 0 && shown.length === 0 && (
        <State text="ABSENT · 선택한 연도·분류에 해당하는 글이 없습니다." />
      )}

      {shown.length > 0 && <div className="collection-results"><JustifiedFeed
        entries={shown.map((p): FeedEntry => ({
          id: p.id, href: `/commons/${p.id}`, src: p.thumbnail, title: p.title, summary: p.summary,
          meta: [...(yearLabel(p) ? [{ text: yearLabel(p) }] : []), ...(p.category ? [{ text: p.category }] : [])],
        }))}
      /></div>}

      {shown.length > 0 && (
        <>
          <div className="hair dae" style={{ marginTop: 64 }} />
          <section className="index">
            <div className="rows">
              {isAuthenticated && <AdminLine page="commons" />}
            </div>
          </section>
        </>
      )}
    </NtPage>
  );
};

export default Commons;
