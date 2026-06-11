import React, { useCallback, useEffect, useState } from 'react';
import './villageNews.css';
import './newsEditor.css';
import {
  type NewsImage,
  type NewsIssue,
  type NewsStatus,
} from './newsData';
import ImageKitPicker from '../../editor/ImageKitPicker';
import { ikUrl } from '../../../utils/ikUrl';

// ═══════════════════════════════════════════════════════════════
// 「마을소식」 소식지 등록·편집 — 이미지 업로드만(편집자 전용, lazy 청크)
//   · 호 메타(호수·제목·날짜·발행상태) + 소식지 이미지 업로드/순서/삭제.
//   · 블록·테마·세로쓰기·콜라주 등 신문 편집 기능은 전부 없음.
//   · 저장은 호출측(VillageNews)이 read-merge-write 로 처리(이 컴포넌트는 한 호만 편집).
//   · 톤은 kkumdarak — 흰 배경 · Gothic · 둥근 두꺼운 테두리 · pill 버튼.
//   ※ default export — VillageNews 가 lazy(() => import('./NewsEditor')) 로 분리.
// ═══════════════════════════════════════════════════════════════

// 깊은 복제(편집 격리).
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

interface NewsEditorProps {
  initialIssue: NewsIssue;
  isNew: boolean;
  // 정적 코드 내장 호인지(현재 항상 false — 인터페이스만 유지).
  isStatic: boolean;
  // 저장: draft/published 중 어느 상태로 저장할지. 호출측이 read-merge-write + newsStatus 동기화.
  onSave: (issue: NewsIssue, status: NewsStatus) => Promise<void>;
  // 삭제: 백엔드 사본 제거.
  onDelete?: (issue: NewsIssue) => Promise<void>;
  onCancel: () => void;
}

const NewsEditor: React.FC<NewsEditorProps> = ({
  initialIssue,
  isNew,
  isStatic,
  onSave,
  onDelete,
  onCancel,
}) => {
  const [issue, setIssue] = useState<NewsIssue>(() => clone(initialIssue));
  const [dirty, setDirty] = useState<boolean>(isNew);
  const [saving, setSaving] = useState<null | 'draft' | 'published'>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // 미저장 이탈 경고.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const patchIssue = useCallback((patch: Partial<NewsIssue>) => {
    setIssue((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    setFeedback(null);
  }, []);

  // ── 이미지 조작 ──────────────────────────────────────────────
  const addImages = useCallback((urls: string[]) => {
    if (!urls.length) return;
    setIssue((prev) => ({
      ...prev,
      images: [...prev.images, ...urls.map((u): NewsImage => ({ src: u, alt: '' }))],
    }));
    setDirty(true);
    setFeedback(null);
  }, []);

  const patchImageAlt = useCallback((idx: number, alt: string) => {
    setIssue((prev) => {
      const images = prev.images.slice();
      images[idx] = { ...images[idx], alt };
      return { ...prev, images };
    });
    setDirty(true);
  }, []);

  const moveImage = useCallback((idx: number, dir: -1 | 1) => {
    setIssue((prev) => {
      const images = prev.images.slice();
      const j = idx + dir;
      if (j < 0 || j >= images.length) return prev;
      [images[idx], images[j]] = [images[j], images[idx]];
      return { ...prev, images };
    });
    setDirty(true);
  }, []);

  const delImage = useCallback((idx: number) => {
    setIssue((prev) => ({ ...prev, images: prev.images.filter((_, k) => k !== idx) }));
    setDirty(true);
  }, []);

  // ── 저장 ──────────────────────────────────────────────────────
  const doSave = useCallback(
    async (status: NewsStatus) => {
      if (saving) return;
      if (!issue.title.trim()) {
        setFeedback({ kind: 'err', msg: '호 제목을 입력해주세요.' });
        return;
      }
      if (!Number.isFinite(issue.no) || issue.no <= 0) {
        setFeedback({ kind: 'err', msg: '호수는 1 이상의 숫자여야 합니다.' });
        return;
      }
      setSaving(status);
      setFeedback(null);
      try {
        const toSave: NewsIssue = { ...clone(issue), status };
        await onSave(toSave, status);
        setIssue(toSave);
        setDirty(false);
        setFeedback({ kind: 'ok', msg: status === 'published' ? '발행되었습니다.' : '준비중으로 저장되었습니다.' });
      } catch (err: any) {
        if (err && err.code === 'KKUM_AUTH_EXPIRED') {
          setFeedback({ kind: 'err', msg: '인증이 만료되었습니다. 다시 로그인 후 저장해주세요.' });
        } else {
          setFeedback({ kind: 'err', msg: err?.message || '저장에 실패했습니다. 잠시 후 다시 시도해주세요.' });
        }
      } finally {
        setSaving(null);
      }
    },
    [saving, issue, onSave],
  );

  // ── 삭제 ─────────────────────────────────────────────────────
  const doDelete = useCallback(async () => {
    if (!onDelete || deleting) return;
    if (typeof window !== 'undefined' && !window.confirm('이 호를 삭제할까요? 되돌릴 수 없습니다.')) return;
    setDeleting(true);
    setFeedback(null);
    try {
      await onDelete(issue);
    } catch (err: any) {
      if (err && err.code === 'KKUM_AUTH_EXPIRED') {
        setFeedback({ kind: 'err', msg: '인증이 만료되었습니다. 다시 로그인 후 시도해주세요.' });
      } else {
        setFeedback({ kind: 'err', msg: err?.message || '삭제에 실패했습니다.' });
      }
      setDeleting(false);
    }
  }, [onDelete, deleting, issue]);

  const cancel = useCallback(() => {
    if (dirty && typeof window !== 'undefined') {
      if (!window.confirm('저장하지 않은 변경이 있습니다. 정말 나갈까요?')) return;
    }
    onCancel();
  }, [dirty, onCancel]);

  const cover = issue.images[0];

  return (
    <div className="kdne">
      {/* ── 상단 액션바 ── */}
      <div className="kdne-bar">
        <div className="kdne-bar-left">
          <button type="button" className="kdn-back" onClick={cancel}>← 소식지 목록</button>
          <span className="kdne-bar-title">{isNew ? '새 소식지' : `제${issue.no}호 편집`}</span>
          {dirty && <span className="kdne-dirty">● 미저장</span>}
        </div>
        <div className="kdne-bar-actions">
          <button type="button" className="kdn-pill kdn-pill--ghost" disabled={!!saving} onClick={() => doSave('draft')}>
            {saving === 'draft' ? '저장 중…' : '준비중으로 저장'}
          </button>
          <button type="button" className="kdn-pill kdn-pill--solid" disabled={!!saving} onClick={() => doSave('published')}>
            {saving === 'published' ? '발행 중…' : '발행'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`kdne-feedback ${feedback.kind === 'ok' ? 'is-ok' : 'is-err'}`} role={feedback.kind === 'err' ? 'alert' : 'status'}>
          {feedback.msg}
        </div>
      )}

      <div className="kdne-body">
        {/* ── 호 메타 ── */}
        <section className="kdne-card">
          <h3 className="kdne-card-title">호(號) 정보</h3>
          <div className="kdne-meta-grid">
            <label className="kdne-field">
              <span className="kdne-field-label">호수</span>
              <input type="number" min={1} value={issue.no} onChange={(e) => patchIssue({ no: Number(e.target.value) })} />
            </label>
            <label className="kdne-field">
              <span className="kdne-field-label">제목</span>
              <input value={issue.title} onChange={(e) => patchIssue({ title: e.target.value })} />
            </label>
            <label className="kdne-field">
              <span className="kdne-field-label">날짜</span>
              <input placeholder="예: 2026.6" value={issue.date} onChange={(e) => patchIssue({ date: e.target.value })} />
            </label>
          </div>
        </section>

        {/* ── 이미지 업로드 ── */}
        <section className="kdne-card">
          <div className="kdne-card-head">
            <h3 className="kdne-card-title">소식지 이미지 ({issue.images.length})</h3>
            <button type="button" className="kdn-pill kdn-pill--solid kdn-pill--sm" onClick={() => setPickerOpen(true)}>+ 이미지 추가</button>
          </div>

          {issue.images.length === 0 ? (
            <p className="kdne-empty">아직 이미지가 없습니다. 「+ 이미지 추가」로 소식지를 업로드하세요. 위에서 아래 순서대로 표시됩니다.</p>
          ) : (
            <ol className="kdne-imglist">
              {issue.images.map((img, i) => (
                <li key={i} className="kdne-imgrow">
                  <span className="kdne-imgidx" aria-hidden="true">{i + 1}</span>
                  <img className="kdne-imgthumb" src={ikUrl(img.src, { w: 200 })} alt={img.alt || ''} />
                  <div className="kdne-imgmain">
                    <input
                      className="kdne-imgalt"
                      placeholder="설명(alt, 선택)"
                      value={img.alt || ''}
                      onChange={(e) => patchImageAlt(i, e.target.value)}
                    />
                    <div className="kdne-imgtools">
                      <button type="button" title="위로" disabled={i === 0} onClick={() => moveImage(i, -1)}>↑</button>
                      <button type="button" title="아래로" disabled={i === issue.images.length - 1} onClick={() => moveImage(i, 1)}>↓</button>
                      <button type="button" className="kdne-img-del" title="삭제" onClick={() => delImage(i)}>삭제</button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* ── 미리보기(호 카드 + 이미지 스택) ── */}
        <section className="kdne-card">
          <h3 className="kdne-card-title">미리보기</h3>
          <div className="kdne-preview">
            <div className="kdn-card kdne-preview-card">
              <div className="kdn-card-thumb">
                {cover ? (
                  <img src={ikUrl(cover.src, { w: 600 })} alt={cover.alt || issue.title} />
                ) : (
                  <span className="kdn-card-noimg" aria-hidden="true">마을소식</span>
                )}
              </div>
              <div className="kdn-card-body">
                <div className="kdn-card-meta">
                  <span className="kdn-card-no">제{issue.no}호</span>
                </div>
                <h3 className="kdn-card-title">{issue.title || '제목 없음'}</h3>
                <p className="kdn-card-date">{issue.date}</p>
              </div>
            </div>
            {issue.images.length > 0 && (
              <div className="kdne-preview-stack">
                {issue.images.map((img, i) => (
                  <img key={i} className="kdn-read-img" src={ikUrl(img.src, { w: 800 })} alt={img.alt || ''} loading="lazy" />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── 위험 구역: 삭제 ── */}
        {!isNew && onDelete && (
          <section className="kdne-card kdne-danger">
            <button type="button" className="kdne-delete" disabled={deleting} onClick={doDelete}>
              {deleting ? '처리 중…' : '이 호 삭제'}
            </button>
            <p className="kdne-danger-hint">이 호를 영구히 삭제합니다.</p>
          </section>
        )}
      </div>

      <ImageKitPicker
        open={pickerOpen}
        multiple
        title="소식지 이미지 선택"
        onClose={() => setPickerOpen(false)}
        onSelect={(urls) => {
          addImages(urls);
        }}
      />
    </div>
  );
};

export default NewsEditor;
