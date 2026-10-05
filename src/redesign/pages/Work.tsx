import React, { Suspense, lazy, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AdminLine, State } from '../components/bits';
import NtPage from '../components/NtPage';
import { CollectionHead, YearFilter } from '../components/CollectionHead';
import JustifiedFeed, { FeedEntry } from '../components/JustifiedFeed';
import { DbHeader, usePosts, useHeader, postYear, yearLabel } from '../db';
import { useEditMode } from '../edit';

// 편집 가설물은 편집 모드에서만 내려받는다(dnd-kit 을 읽기 전용 방문자에게 지우지 않는다).
const PostAdminList = lazy(() => import('../edit/PostAdminList'));

// ════════════════════════════════════════════════════════════════════════
// ART WORK 목록(/work) — 내용은 DB(/api/work), 판식만 v5.
//   목업 정본: _workspace/03_mock/v5/works.html
//   2026-08-30 개정 — 도판 격자가 전 글을 수록하게 되면서 하단 텍스트 인덱스가 같은 목록을
//     한 번 더 되풀이했다. **인덱스를 걷어내고 격자 하나만 둔다**(사용자 결정).
//     연도 필터는 격자 위로 올려 COMMONS 의 분류 필터와 같은 자리에 앉힌다.
//   구 URL /work?post=<id> 는 /work/<id> 로 넘긴다(발행 링크 보존).
// ════════════════════════════════════════════════════════════════════════


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
  const shown = year === 'all' ? list : list.filter((p) => (postYear(p) || 'unknown') === year);
  // 도판 흐름 = 필터된 전 글(연도 필터를 같이 탄다). 원본 비율 · 글줄 정렬.
  const entries: FeedEntry[] = shown.map((p) => ({
    id: p.id,
    href: `/work/${p.id}`,
    src: p.thumbnail,
    title: p.title,
    summary: p.summary,
    meta: yearLabel(p) ? [{ text: yearLabel(p) }] : [],
  }));

  return (
    <NtPage
      path="/work"
      title="NODE TREE | Work — 작품"
      description="NODE TREE의 사운드, 영상, 설치 작품 목록. 위성악보, 에디아포닉, 낙원식당 등."
      keywords="NODE TREE 작품, 위성악보, 에디아포닉, 낙원식당, 사운드 설치"
    >
      <CollectionHead header={header} count={list.length} />

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

      {list.length > 0 && <YearFilter posts={list} year={year} base="/work" />}

      {loading && <State text="LOADING · 기록을 불러오는 중…" />}
      {error && <State text={`ERROR · ${error}`} onRetry={reload} />}
      {!loading && !error && list.length === 0 && <State text="ABSENT · 아직 기록된 작품이 없습니다." />}
      {!loading && !error && list.length > 0 && shown.length === 0 && (
        <State text={`ABSENT · ${year} 년에 해당하는 작품이 없습니다.`} />
      )}

      {shown.length > 0 && <div className="collection-results"><JustifiedFeed entries={entries} /></div>}

      {list.length > 0 && (
        <>
          <div className="hair dae" style={{ marginTop: 64 }} />
          <section className="index">
            <div className="rows">
              {isAuthenticated && <AdminLine page="work" />}
            </div>
          </section>
        </>
      )}
    </NtPage>
  );
};

export default Work;
