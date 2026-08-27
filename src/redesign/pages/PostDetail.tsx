import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AdminLine, State } from '../components/bits';
import MiniClock from '../components/MiniClock';
import NtPage from '../components/NtPage';
import PlateImage from '../components/PlateImage';
import RichHtml from '../components/RichHtml';
import VerticalMeta from '../components/VerticalMeta';
import { DbPost, Kind, monoDate, usePosts, useResearchSynced, yearOf } from '../db';

// ════════════════════════════════════════════════════════════════════════
// 글 상세(/work/:id · /commons/:id) — 내용은 DB, 판식만 v5.
//   목업 정본: _workspace/03_mock/v5/work.html
//     좌 3정간 = 세로쓰기 메타(DB 에 있는 것만: 연도·기록일·도판 수. 매체·장소는 자리만)
//     본문 12정간 = DB HTML(DOMPurify 살균 그대로 유지, 옛 인라인 판식만 제거)
//     도판·영상 = 도판 창 · PDF 도록 = 인덱스 행 · 하단 = 이전/다음 작품
// ════════════════════════════════════════════════════════════════════════

/** 글에 딸린 PDF — 레거시(Work.tsx · Commons.tsx)의 매핑을 그대로 옮겼다. 판식만 인덱스 행. */
interface Attachment {
  label: string;
  meta: string;
  href: string;
  /** 내려받기 파일명(있으면 Download 행도 낸다) */
  download?: string;
  /** 페이지 안 인라인 미리보기(레거시 Commons 워크북과 동일) */
  inline?: boolean;
}

/** 글 id 기준(불변 식별자) — Commons 워크북. */
const BY_ID: Record<string, Attachment[]> = {
  '6858a45ca793089c746ee8cb': [
    { label: '워크북 보기', meta: 'PDF · 54p', href: '/pdf/sound-orchestra-workbook.pdf', inline: true },
  ],
};

/** 제목 기준 — 레거시 Work.tsx 의 조건(에디아포닉 · 남미농장)을 그대로 유지. */
function byTitle(title: string): Attachment[] {
  if (title.includes('유기적공명') || title.includes('에디아포닉')) {
    return [
      {
        label: '유기적공명 : 에디아포닉 웹 도록',
        meta: 'PDF · 8.5MB · Exhibition Catalog',
        href: '/pdf/웹도록.pdf',
        download: '유기적공명_에디아포닉_웹도록.pdf',
      },
    ];
  }
  if (title.includes('남미농장')) {
    return [
      {
        label: '위성악보시리즈 : 남미농장 웹 도록',
        meta: 'PDF · 11.6MB · Exhibition Catalog',
        href: '/pdf/남미농장.pdf',
        download: '위성악보시리즈_남미농장_웹도록.pdf',
      },
    ];
  }
  return [];
}

function download(href: string, name: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

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
  const { data: posts, error, loading, reload } = usePosts(kind);
  const researchSynced = useResearchSynced(kind === 'work' ? id : undefined);

  const list: DbPost[] = posts ?? [];
  const i = list.findIndex((p) => p.id === id);
  const post = i >= 0 ? list[i] : null;

  if (posts && !post) return <Navigate to={base} replace />;

  const prev = i > 0 ? list[i - 1] : null;
  const next = i >= 0 && i < list.length - 1 ? list[i + 1] : null;
  const files = post ? [...(BY_ID[post.id] ?? []), ...byTitle(post.title)] : [];
  const guestbook = !!post && (post.title.includes('Reconnect') || post.title.includes('낙원식당'));

  return (
    <NtPage
      path={`${base}/${id}`}
      title={post ? `NODE TREE | ${post.title}` : 'NODE TREE'}
      description={post ? `${post.title} — ${label} · ${post.date}` : 'NODE TREE'}
      keywords={post ? `NODE TREE, ${post.title}, 이화영, 정강현` : undefined}
    >
      {loading && <State text="LOADING · 기록을 불러오는 중…" />}
      {error && <State text={`ERROR · ${error}`} onRetry={reload} />}

      {post && (
        <>
          <section className="detail">
            <MiniClock />
            <div className="meta">
              <VerticalMeta
                rows={[
                  { k: '年 YEAR', v: yearOf(post.date) ?? '—' },
                  { k: '記錄 RECORD', v: monoDate(post.date) || '—' },
                  { k: '圖版 PLATE', v: post.images && post.images.length ? `${post.images.length}점` : '—' },
                  { k: '媒體 MEDIUM', v: '—' },
                  { k: '場所 VENUE', v: '—' },
                ]}
              />
            </div>

            <div className="txt">
              <h1 className="title">{post.title}</h1>
              <div className="sub">
                {label} · {monoDate(post.date)} · {String(i + 1).padStart(2, '0')} / {String(list.length).padStart(2, '0')}
              </div>

              <RichHtml html={post.content} className="rich" />

              {/* COMMONS 는 본문과 별개로 이미지 배열을 실었다(레거시 ImageGallery) — 도판 창으로 옮긴다 */}
              {kind === 'filed' && post.images && post.images.length > 0 && (
                <>
                  {post.images.map((src, k) => (
                    <div className="fw" key={`${src}-${k}`}>
                      <PlateImage src={src} alt={`${post.title} 도판 ${k + 1}`} ratio="3/2" w={1600} />
                      <div className="fcap">도판 {k + 1} · 봉인 상태. 호버 시 개봉.</div>
                    </div>
                  ))}
                </>
              )}

              {(files.length > 0 || guestbook || researchSynced) && (
                <div className="plist">
                  <div className="grp">첨부 ATTACHMENT</div>
                  {files.map((f) => (
                    <React.Fragment key={f.href}>
                      <a className="prow-l" href={f.href} target="_blank" rel="noopener noreferrer">
                        <span className="t">{f.label}</span>
                        <span className="md">{f.meta}</span>
                        <span className="go">VIEW ↗</span>
                      </a>
                      {f.download && (
                        <button className="prow-l" type="button" onClick={() => download(f.href, f.download as string)}>
                          <span className="t">내려받기</span>
                          <span className="md">{f.label}</span>
                          <span className="go">DOWNLOAD ↓</span>
                        </button>
                      )}
                      {f.inline && (
                        <object className="pdfview" data={f.href} type="application/pdf" aria-label={f.label}>
                          <div className="pdffall">브라우저에서 미리보기를 지원하지 않습니다. 위의 VIEW 로 여십시오.</div>
                        </object>
                      )}
                    </React.Fragment>
                  ))}

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

              <div className="src" style={{ marginTop: 36 }}>
                출처 · nodetree.kr DB {kind === 'work' ? '/api/work' : '/api/filed'} · {post.id}
              </div>
              {isAuthenticated && <AdminLine />}
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
