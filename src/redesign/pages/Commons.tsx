import React, { Suspense, lazy, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AdminLine, Note, State } from '../components/bits';
import NtPage from '../components/NtPage';
import VerticalSeal from '../components/VerticalSeal';
import JustifiedFeed, { FeedEntry } from '../components/JustifiedFeed';
import { DbHeader, monoDate, usePosts, useHeader, yearOf } from '../db';
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
  const cat = params.get('cat') ?? '전체';
  const { data: posts, error, loading, reload } = usePosts('filed');
  const dbHeader = useHeader('filed');
  const [headOverride, setHeadOverride] = useState<DbHeader | null>(null);
  const header = headOverride ?? dbHeader;

  if (legacyPost) return <Navigate to={`/commons/${legacyPost}`} replace />;

  const list = posts ?? [];
  const shown = cat === '전체' ? list : list.filter((p) => p.category === cat);
  const count = (c: string) => (c === '전체' ? list.length : list.filter((p) => p.category === c).length);

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

      <section className="gate">
        <a href="https://isoartlab.com" target="_blank" rel="noopener noreferrer">
          <div className="l">
            <div className="kick">매개 MEDIATION · 본체는 각자의 도메인에 있다</div>
            <div className="nm">
              이소 異素<span className="dom">isoartlab.com</span>
            </div>
            <p className="desc">
              노드트리가 충남 부여군 장암면에서 운영하는 꿈다락 토요문화학교입니다. 마을의 어린이·청소년과 주민이 함께
              공간과 도구를 만들고, 소리와 기록으로 채우고, 세대를 건너 나눕니다. 프로그램·일정·마을일기·마을소식은
              이소 홈페이지에 쌓입니다.
            </p>
            <div className="in">소개 · 프로그램 · 일정 · 마을일기 · 마을소식 · 오시는 길</div>
          </div>
          <span className="go">이소 홈페이지 →</span>
        </a>
      </section>

      <section className="index">
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
          <div className="key">
            <b>도판 PLATE</b>
            점선 칸 · 도판 미기재
          </div>
        </div>
      </section>

      {loading && <State text="LOADING · 기록을 불러오는 중…" />}
      {error && <State text={`ERROR · ${error}`} onRetry={reload} />}
      {!loading && !error && list.length === 0 && <State text="ABSENT · 아직 기록된 내용이 없습니다." />}
      {!loading && !error && list.length > 0 && shown.length === 0 && (
        <State text={`ABSENT · '${cat}' 분류에 해당하는 글이 없습니다.`} />
      )}

      {shown.length > 0 && (
        <JustifiedFeed
          entries={shown.map(
            (p): FeedEntry => ({
              id: p.id,
              href: `/commons/${p.id}`,
              src: p.thumbnail,
              title: p.title,
              meta: [
                { text: p.category ?? '분류 —', dim: !p.category },
                { text: yearOf(p.date) ?? '—' },
                { text: monoDate(p.date), dim: true },
              ],
            }),
          )}
        />
      )}

      {shown.length > 0 && (
        <>
          <div className="hair dae" style={{ marginTop: 64 }} />
          <section className="index">
            <div className="rows">
              <div className="src">
                출처 · nodetree.kr DB /api/filed — {list.length}건
                {cat === '전체' ? '' : ` · 분류 ${cat} ${shown.length}건`}. 도판 격자에 전량을 수록한다.
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
