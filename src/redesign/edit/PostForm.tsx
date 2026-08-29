import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Editor2 from '../editor2/Editor2';
import ImageKitPicker from '../../components/editor/ImageKitPicker';
import { ikUrl } from '../../utils/ikUrl';
import NtPage from '../components/NtPage';
import { State } from '../components/bits';
import { DbPost, Kind, usePosts } from '../db';
import ConfirmDialog from './ui/ConfirmDialog';
import EditBar from './ui/EditBar';
import PromptDialog from './ui/PromptDialog';
import { Select, TextInput } from './ui/fields';
import { useToast } from './ui/Toast';
import { usePostAdmin } from './usePostAdmin';

// ════════════════════════════════════════════════════════════════════════
// PostForm — 글 작성/수정 풀페이지(/work/new · /work/:id/edit · /commons/…).
//   v5 헤더 아래 같은 판식으로 연다. 레거시 편집기(/legacy)로 튕기지 않는다.
//   본문 엔진은 기존 BlockEditor 를 그대로 재사용한다(블록·드래그·undo/redo·AI).
//   window.prompt(링크 URL)만 PromptDialog 콜백으로 갈아 끼웠다.
//   ※ 알림·대화상자 제공자는 NtPage 안에 있다 → 실제 폼은 자식(Inner)으로 둔다.
// ════════════════════════════════════════════════════════════════════════

const CATEGORIES = [
  { value: '문화예술교육', label: '문화예술교육' },
  { value: '커뮤니티', label: '커뮤니티' },
];

/** 텍스트도 미디어도 없으면 빈 본문(레거시 WritePost 와 같은 판정). */
function isEmptyBody(html: string): boolean {
  const text = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  return !text && !/<(img|iframe|video|hr)/i.test(html);
}

export interface PostFormProps {
  kind: Kind;
  /** 목록 경로 — /work · /commons */
  base: string;
  /** Mono 표찰 — ART WORK · COMMONS */
  label: string;
}

const PostFormInner: React.FC<PostFormProps & { id?: string }> = ({ kind, base, label, id }) => {
  const isEdit = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const admin = usePostAdmin(kind);

  // 수정 대상은 목록에서 찾는다(v5 는 목록 하나로 다 읽는다).
  const { data: posts, error, loading } = usePosts(kind);
  const post: DbPost | null = useMemo(
    () => (isEdit && posts ? posts.find((p) => p.id === id) ?? null : null),
    [isEdit, posts, id],
  );

  const [title, setTitle] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [category, setCategory] = useState('문화예술교육');
  const [body, setBody] = useState('');
  const [err, setErr] = useState<{ title?: string; body?: string }>({});
  const [dirty, setDirty] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [linkAsk, setLinkAsk] = useState(false);
  const [leaveAsk, setLeaveAsk] = useState(false);
  const linkCb = useRef<((url: string) => void) | null>(null);
  const dirtyRef = useRef(false);
  const loadedFor = useRef<string | null>(null);

  const touch = useCallback(() => {
    dirtyRef.current = true;
    setDirty(true);
  }, []);

  // 편집 대상이 도착하면 1회만 채운다(입력 중 재적재로 덮어쓰지 않게).
  useEffect(() => {
    if (!isEdit || !post || loadedFor.current === post.id) return;
    loadedFor.current = post.id;
    setTitle(post.title || '');
    setThumbnail(post.thumbnail || '');
    setCategory(post.category || '문화예술교육');
    setBody(post.content || '');
    dirtyRef.current = false;
    setDirty(false);
  }, [isEdit, post]);

  // 저장 전 이탈 경고(브라우저 기본 — 앱 안 이동은 아래 ConfirmDialog 가 받는다).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // BlockEditor 의 링크 단추 → window.prompt 대신 이 콜백
  const requestLink = useCallback((cb: (url: string) => void) => {
    linkCb.current = cb;
    setLinkAsk(true);
  }, []);

  const leave = () => navigate(isEdit && id ? `${base}/${id}` : base);

  const submit = async () => {
    const nextErr: { title?: string; body?: string } = {};
    if (!title.trim()) nextErr.title = '제목을 입력하십시오.';
    if (isEmptyBody(body)) nextErr.body = '본문을 입력하십시오(글 또는 도판).';
    setErr(nextErr);
    if (nextErr.title || nextErr.body) {
      toast.err('빈 칸이 있습니다.');
      return;
    }
    const payload = {
      title: title.trim(),
      content: body.trim(),
      thumbnail: thumbnail.trim() || undefined,
      ...(kind === 'filed' ? { category } : {}),
    };
    try {
      const saved = isEdit && id ? await admin.update(id, payload) : await admin.create(payload);
      dirtyRef.current = false;
      setDirty(false);
      navigate(`${base}/${saved.id || id || ''}`, {
        state: { ntToast: isEdit ? `수정했습니다 · ${saved.title}` : `등록했습니다 · ${saved.title}` },
      });
    } catch (e) {
      toast.err(e instanceof Error ? e.message : '저장에 실패했습니다.');
    }
  };

  return (
    <>
      {isEdit && loading && <State text="LOADING · 글을 불러오는 중…" />}
      {isEdit && error && <State text={`ERROR · ${error}`} />}
      {isEdit && !loading && !error && posts && !post && (
        <State text="ABSENT · 그런 글이 없습니다(이미 삭제되었을 수 있습니다)." />
      )}

      {(!isEdit || post) && (
        <section className="nte-form">
          <div className="nte-in">
            <TextInput
              label="제목 TITLE"
              value={title}
              error={err.title}
              placeholder="제목"
              onChange={(e) => {
                setTitle(e.target.value);
                touch();
              }}
            />

            {kind === 'filed' && (
              <Select
                label="분류 CATEGORY"
                value={category}
                options={CATEGORIES}
                onChange={(e) => {
                  setCategory(e.target.value);
                  touch();
                }}
              />
            )}

            <div className="nte-field">
              <div className="nte-label">대표 도판 THUMBNAIL</div>
              <div className="nte-thumb">
                <div className="nte-thumbview">
                  {thumbnail ? (
                    <img src={ikUrl(thumbnail, { w: 640 })} alt="대표 도판 미리보기" />
                  ) : (
                    <div className="nte-thumbnone">ABSENT · 도판 미기재</div>
                  )}
                </div>
                <div>
                  <input
                    className="nte-input"
                    type="text"
                    value={thumbnail}
                    aria-label="대표 도판 주소"
                    placeholder="https://ik.imagekit.io/…"
                    onChange={(e) => {
                      setThumbnail(e.target.value);
                      touch();
                    }}
                  />
                  <div className="nte-acts" style={{ marginTop: 12 }}>
                    <button type="button" className="nte-btn" onClick={() => setPickerOpen(true)}>
                      이미지 고르기
                    </button>
                    {thumbnail && (
                      <button
                        type="button"
                        className="nte-btn"
                        onClick={() => {
                          setThumbnail('');
                          touch();
                        }}
                      >
                        비우기
                      </button>
                    )}
                  </div>
                  <div className="nte-hint">ImageKit 라이브러리에서 고르거나 주소를 직접 붙여 넣는다.</div>
                </div>
              </div>
            </div>

            <div className="nte-field">
              <div className="nte-label">본문 BODY</div>
              <div className="nte-blockeditor">
                <Editor2
                  value={body}
                  onChange={(html) => {
                    setBody(html);
                    touch();
                  }}
                  placeholder="본문을 입력하십시오"
                  onRequestLink={requestLink}
                />
              </div>
              {err.body ? <div className="nte-err">{err.body}</div> : null}
            </div>
          </div>
        </section>
      )}

      <EditBar
        label={`${label} · ${isEdit ? '수정' : '새 글'}`}
        busy={admin.busy}
        dirty={dirty}
        saveLabel={isEdit ? '수정 저장' : '등록'}
        onSave={submit}
        onCancel={() => (dirtyRef.current ? setLeaveAsk(true) : leave())}
      />

      <ImageKitPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="대표 도판 고르기"
        onSelect={(urls) => {
          if (urls[0]) {
            setThumbnail(urls[0]);
            touch();
          }
          setPickerOpen(false);
        }}
      />

      <PromptDialog
        open={linkAsk}
        title="링크 걸기"
        label="링크 URL"
        placeholder="https://…"
        hint="선택한 글자에 링크를 건다."
        onCancel={() => {
          linkCb.current = null;
          setLinkAsk(false);
        }}
        onSubmit={(url) => {
          linkCb.current?.(url);
          linkCb.current = null;
          setLinkAsk(false);
        }}
      />

      <ConfirmDialog
        open={leaveAsk}
        title="저장하지 않고 나갑니다"
        message="저장하지 않은 변경 사항이 있습니다. 그대로 나가시겠습니까?"
        confirmLabel="나가기"
        cancelLabel="계속 편집"
        onCancel={() => setLeaveAsk(false)}
        onConfirm={() => {
          dirtyRef.current = false;
          setDirty(false);
          setLeaveAsk(false);
          leave();
        }}
      />
    </>
  );
};

const PostForm: React.FC<PostFormProps> = ({ kind, base, label }) => {
  const { id } = useParams();
  const { pathname, search } = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  // 비로그인은 편집 화면을 열지 않는다 — 로그인 후 이 자리로 돌아온다.
  if (!isLoading && !isAuthenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent(`${pathname}${search}`)}`} replace />;
  }

  const heading = id ? '글 수정' : '새 글';

  return (
    <NtPage path={pathname} title={`NODE TREE | ${label} — ${heading}`} description="NODE TREE 편집 화면" noindex>
      <section className="pagehead">
        <div className="lab">
          편집 EDIT · {label} · {id ? 'UPDATE' : 'NEW'}
        </div>
        <h1>{heading}</h1>
      </section>
      <div className="hair dae" />
      {isLoading ? <State text="LOADING · 인증 확인 중…" /> : <PostFormInner kind={kind} base={base} label={label} id={id} />}
    </NtPage>
  );
};

export default PostForm;
