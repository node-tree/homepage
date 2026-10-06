import React, { Suspense, lazy, useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AdminLine, State } from '../components/bits';
import MiniClock from '../components/MiniClock';
import NtPage from '../components/NtPage';
import PhotoEssay from '../components/PhotoEssay';
import PdfAttachments from '../components/PdfAttachment';
import RichHtml from '../components/RichHtml';
import { DetailVideo, orderDetail } from '../components/detailOrder';
import attachments from '../pdfAttachments.json';
import VerticalMeta from '../components/VerticalMeta';
import { DbPost, Kind, usePosts, useResearchSynced, yearLabel } from '../db';
import { useEditMode } from '../edit';

// 상세의 편집 문 — 편집 모드에서만 내려받는다.
const PostDetailAdmin = lazy(() => import('../edit/PostDetailAdmin'));

// ════════════════════════════════════════════════════════════════════════
// 글 상세(/work/:id · /commons/:id) — 내용은 DB, 판식만 v5.
//   목업 정본: _workspace/03_mock/v5/work.html
//     좌 3정간 = 세로쓰기 메타(DB 에 있는 것만: 연도·기록일·도판 수. 매체·장소는 자리만)
//     본문 12정간 = DB HTML(DOMPurify 살균 그대로 유지, 옛 인라인 판식만 제거)
//     도판·영상 = 도판 창 · PDF 도록 = 공통 카드·지면 뷰어 · 하단 = 이전/다음 작품
// ════════════════════════════════════════════════════════════════════════

export interface PostDetailProps {
  kind: Kind;
  /** 목록 경로 — /work · /commons */
  base: string;
  /** Mono 표찰 — ART WORK · COMMONS */
  label: string;
}

const PostDetail: React.FC<PostDetailProps> = ({ kind, base, label }) => {
  const { id = '' } = useParams();
  const { isAuthenticated } = useAuth();
  const { editing } = useEditMode();
  const { data: posts, error, loading, reload } = usePosts(kind);
  const researchSynced = useResearchSynced(kind === 'work' ? id : undefined);

  const list: DbPost[] = posts ?? [];
  const i = list.findIndex((p) => p.id === id);
  const post = i >= 0 ? list[i] : null;

  const media = useMemo(() => orderDetail(post), [post]);
  const pdfs = attachments.filter(item => item.postId === post?.id);
  const video = (item: DetailVideo, index: number) => <div className="detail-video" key={index}>
    <RichHtml html={item.html} />
    {item.title && <h3>{item.title}</h3>}
  </div>;

  if (posts && !post) return <Navigate to={base} replace />;

  const prev = i > 0 ? list[i - 1] : null;
  const next = i >= 0 && i < list.length - 1 ? list[i + 1] : null;
  const guestbook = !!post && (post.title.includes('Reconnect') || post.title.includes('낙원식당'));

  return (
    <NtPage
      path={`${base}/${id}`}
      title={post ? `NODE TREE | ${post.title}` : 'NODE TREE'}
      description={post ? `${post.title} — ${label} · ${yearLabel(post)}` : 'NODE TREE'}
      keywords={post ? `NODE TREE, ${post.title}, 이화영, 정강현` : undefined}
    >
      {loading && <State text="LOADING · 기록을 불러오는 중…" />}
      {error && <State text={`ERROR · ${error}`} onRetry={reload} />}

      {post && (
        <>
          <section className="detail">
            <MiniClock />
            <div className="detail-heading">
              <h1 className="title">{post.title}</h1>
              <div className="sub">
                {[label, yearLabel(post)].filter(Boolean).join(' · ')}
              </div>
              {(media.photoCount > 0 || media.videoCount > 0 || pdfs.length > 0) && <nav className="detail-jumps" aria-label="콘텐츠 바로가기">
                {media.photoCount > 0 && <a href="#detail-photos">사진 {media.photoCount}</a>}
                {media.videoCount > 0 && <a href="#detail-videos">영상 {media.videoCount}</a>}
                {pdfs.length > 0 && <a href="#detail-publications">{pdfs.every(item => item.kind === '워크북') ? '워크북' : '도록'}</a>}
              </nav>}
            </div>
            <div className="meta">
              <VerticalMeta
                rows={[
                  { k: '年 YEAR', v: yearLabel(post) },
                  { k: '媒體 MEDIUM', v: post.medium || '' },
                  { k: '場所 VENUE', v: [post.venue, post.city].filter(Boolean).join(' · ') },
                ]}
              />
            </div>

            <div className="txt">
              {media.firstVideo && <section id="detail-videos" className="detail-videos lead-video" aria-label="영상">
                {video(media.firstVideo, 0)}
              </section>}
              <PhotoEssay key={post.id} hero={media.hero} title={post.title}
                lede={post.lede} body={media.body} photoHtml={media.photos} imageLayout={post.imageLayout}>
                {post.artistNote?.text && <section className="post-note reading-text" aria-label="작가의 말">
                  <h2>작가의 말</h2><p>{post.artistNote.text}</p>
                  {post.artistNote.by && <div className="post-attribution">{post.artistNote.by}</div>}
                </section>}
                {post.quote?.text && <figure className="post-quote reading-text">
                  <blockquote>{post.quote.text}</blockquote>
                  <figcaption className="post-attribution">
                    {[post.quote.author, post.quote.title && `〈${post.quote.title}〉`, post.quote.source, post.quote.year].filter(Boolean).join(' · ')}
                    {post.quote.excerpt ? ' (발췌)' : ''}
                  </figcaption>
                </figure>}
              </PhotoEssay>
              {media.videos.length > 0 && <section id={media.firstVideo ? 'detail-more-videos' : 'detail-videos'} className="detail-videos" aria-label="영상">
                <h2>영상</h2>
                <div className={`detail-video-list${media.videoCount >= 3 ? ' is-multiple' : ''}${media.firstVideo ? ' has-lead' : ''}`}>
                  {media.videos.map(video)}
                </div>
              </section>}

              {(guestbook || researchSynced) && (
                <div className="plist">
                  <div className="grp">첨부 ATTACHMENT</div>
                  {researchSynced && (
                    <Link className="prow-l out" to={`/work/research/${post.id}`}>
                      <span className="t">리서치 아카이브</span>
                      <span className="md">옵시디안 동기화 기록</span>
                      <span className="go">OPEN →</span>
                    </Link>
                  )}

                  {guestbook && (
                    <Link className="prow-l out" to="/guestbook">
                      <span className="t">방명록</span>
                      <span className="md">낙원식당에 남긴 말</span>
                      <span className="go">GUESTBOOK →</span>
                    </Link>
                  )}
                </div>
              )}

              {pdfs.length > 0 && <div id="detail-publications"><PdfAttachments key={post.id} postId={post.id} /></div>}
              {(post.credits?.some((c) => c.v) || post.audience || post.partners?.some((p) => p.name)) && <section className="post-credits" aria-label="크레딧">
                <h2>크레딧</h2>
                <dl>
                  {post.audience && <div><dt>참여 대상</dt><dd>{post.audience}</dd></div>}
                  {post.partners?.filter((p) => p.name).map((p, k) => <div key={`partner-${k}`}><dt>{p.role || '협력'}</dt><dd>{p.name}</dd></div>)}
                  {post.credits?.filter((c) => c.v).map((c, k) => <div key={k}><dt>{c.k}</dt><dd>{c.v}</dd></div>)}
                </dl>
              </section>}

              {editing && (
                <Suspense fallback={null}>
                  <PostDetailAdmin kind={kind} base={base} id={post.id} title={post.title} />
                </Suspense>
              )}
              {isAuthenticated && <AdminLine page={kind === 'work' ? 'work' : 'commons'} />}
            </div>
          </section>

          <div className="nextwork pair">
            {prev ? (
              <Link to={`${base}/${prev.id}`}>
                <span>이전 — {prev.title}</span>
                <span className="k">← PREV</span>
              </Link>
            ) : (
              <span className="off">
                <span>이전 글 없음</span>
              </span>
            )}
            {next ? (
              <Link to={`${base}/${next.id}`}>
                <span>다음 — {next.title}</span>
                <span className="k">NEXT →</span>
              </Link>
            ) : (
              <span className="off">
                <span>다음 글 없음</span>
              </span>
            )}
            <Link to={base}>
              <span>목록으로</span>
              <span className="k">{label} INDEX</span>
            </Link>
          </div>
        </>
      )}
    </NtPage>
  );
};

export default PostDetail;
