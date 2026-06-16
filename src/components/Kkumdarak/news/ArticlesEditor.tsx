import React, { useCallback, useEffect, useState } from 'react';
import './villageNews.css';
import './newsEditor.css';
import {
  isValidArticleUrl,
  type NewsArticle,
} from './newsData';
import ImageKitPicker from '../../editor/ImageKitPicker';
import { ikUrl } from '../../../utils/ikUrl';

// ═══════════════════════════════════════════════════════════════
// 「마을소식」 보도 기사 관리 — 외부 링크 카드 등록/수정/삭제(편집자 전용, lazy 청크)
//   · 기사 = { id, title(제목), outlet(언론사), date(게재일), url(원문), thumb?(대표 이미지) }.
//   · 가판대에서는 카드로 보이되 클릭 시 원문 사이트로 새 탭 이동만 한다(내부 read 뷰 없음).
//   · 추가/순서이동/삭제는 NewsEditor 이미지 항목 로직 패턴 그대로.
//   · 썸네일은 NewsEditor 와 동일하게 ImageKitPicker(단일 선택) 재사용.
//   · 저장은 호출측(VillageNews)이 read-merge-write(호 보존)로 처리 — articles 배열만 통째 교체.
//   · 톤은 kkumdarak — 흰 배경 · Gothic · 둥근 두꺼운 테두리 · pill 버튼(newsEditor.css 공유).
//   ※ default export — VillageNews 가 lazy(() => import('./ArticlesEditor')) 로 분리.
// ═══════════════════════════════════════════════════════════════

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

interface ArticlesEditorProps {
  initialArticles: NewsArticle[];
  // 저장: 전체 articles 배열(순서 = 표시 순서). 호출측이 read-merge-write(호 보존).
  onSave: (articles: NewsArticle[]) => Promise<void>;
  onCancel: () => void;
}

const ArticlesEditor: React.FC<ArticlesEditorProps> = ({
  initialArticles,
  onSave,
  onCancel,
}) => {
  const [articles, setArticles] = useState<NewsArticle[]>(() => clone(initialArticles));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  // 썸네일 피커 — 대상 기사 인덱스를 기억(단일 선택).
  const [pickerForIdx, setPickerForIdx] = useState<number | null>(null);

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

  const patchArticle = useCallback((idx: number, patch: Partial<NewsArticle>) => {
    setArticles((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
    setDirty(true);
    setFeedback(null);
  }, []);

  const addArticle = useCallback(() => {
    setArticles((prev) => [
      ...prev,
      { id: `article-${Date.now().toString(36)}`, title: '', outlet: '', date: '', url: '' },
    ]);
    setDirty(true);
    setFeedback(null);
  }, []);

  const moveArticle = useCallback((idx: number, dir: -1 | 1) => {
    setArticles((prev) => {
      const next = prev.slice();
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
    setDirty(true);
  }, []);

  const delArticle = useCallback((idx: number) => {
    if (typeof window !== 'undefined' && !window.confirm('이 기사를 삭제할까요?')) return;
    setArticles((prev) => prev.filter((_, k) => k !== idx));
    setDirty(true);
    setFeedback(null);
  }, []);

  const setThumb = useCallback((idx: number, url: string) => {
    setArticles((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], thumb: { src: url, alt: '' } };
      return next;
    });
    setDirty(true);
    setFeedback(null);
  }, []);

  const clearThumb = useCallback((idx: number) => {
    setArticles((prev) => {
      const next = prev.slice();
      const { thumb, ...rest } = next[idx];
      void thumb;
      next[idx] = rest as NewsArticle;
      return next;
    });
    setDirty(true);
  }, []);

  // ── 저장 ──────────────────────────────────────────────────────
  const doSave = useCallback(async () => {
    if (saving) return;
    // 최소 검증: 제목 비었거나 URL 형식이 잘못된 기사가 있으면 막는다.
    for (let i = 0; i < articles.length; i += 1) {
      const a = articles[i];
      if (!a.title.trim()) {
        setFeedback({ kind: 'err', msg: `${i + 1}번 기사의 제목을 입력해주세요.` });
        return;
      }
      if (!isValidArticleUrl(a.url)) {
        setFeedback({ kind: 'err', msg: `${i + 1}번 기사의 원문 URL 형식이 올바르지 않습니다. (http:// 또는 https://)` });
        return;
      }
    }
    setSaving(true);
    setFeedback(null);
    try {
      const toSave: NewsArticle[] = articles.map((a) => ({
        ...a,
        title: a.title.trim(),
        outlet: a.outlet.trim(),
        date: a.date.trim(),
        url: a.url.trim(),
      }));
      await onSave(toSave);
      setArticles(toSave);
      setDirty(false);
      setFeedback({ kind: 'ok', msg: '보도 기사가 저장되었습니다.' });
    } catch (err: any) {
      if (err && err.code === 'KKUM_AUTH_EXPIRED') {
        setFeedback({ kind: 'err', msg: '인증이 만료되었습니다. 다시 로그인 후 저장해주세요.' });
      } else {
        setFeedback({ kind: 'err', msg: err?.message || '저장에 실패했습니다. 잠시 후 다시 시도해주세요.' });
      }
    } finally {
      setSaving(false);
    }
  }, [saving, articles, onSave]);

  const cancel = useCallback(() => {
    if (dirty && typeof window !== 'undefined') {
      if (!window.confirm('저장하지 않은 변경이 있습니다. 정말 나갈까요?')) return;
    }
    onCancel();
  }, [dirty, onCancel]);

  return (
    <div className="kdne">
      {/* ── 상단 액션바 ── */}
      <div className="kdne-bar">
        <div className="kdne-bar-left">
          <button type="button" className="kdn-back" onClick={cancel}>← 소식지 목록</button>
          <span className="kdne-bar-title">보도 기사 관리 ({articles.length})</span>
          {dirty && <span className="kdne-dirty">● 미저장</span>}
        </div>
        <div className="kdne-bar-actions">
          <button type="button" className="kdn-pill kdn-pill--ghost kdn-pill--sm" disabled={saving} onClick={addArticle}>+ 기사 추가</button>
          <button type="button" className="kdn-pill kdn-pill--solid" disabled={saving} onClick={doSave}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`kdne-feedback ${feedback.kind === 'ok' ? 'is-ok' : 'is-err'}`} role={feedback.kind === 'err' ? 'alert' : 'status'}>
          {feedback.msg}
        </div>
      )}

      <div className="kdne-body">
        <section className="kdne-card">
          <div className="kdne-card-head">
            <h3 className="kdne-card-title">보도 기사 (외부 링크 카드)</h3>
            <button type="button" className="kdn-pill kdn-pill--solid kdn-pill--sm" onClick={addArticle}>+ 기사 추가</button>
          </div>

          {articles.length === 0 ? (
            <p className="kdne-empty">
              아직 등록한 기사가 없습니다. 「+ 기사 추가」로 언론 보도 링크를 등록하세요.
              카드를 클릭하면 원문 사이트가 새 탭으로 열립니다.
            </p>
          ) : (
            <ol className="kdne-artlist">
              {articles.map((a, i) => {
                const urlOk = isValidArticleUrl(a.url);
                return (
                  <li key={a.id} className="kdne-artrow">
                    <div className="kdne-art-head">
                      <span className="kdne-imgidx" aria-hidden="true">{i + 1}</span>
                      <div className="kdne-art-tools">
                        <button type="button" title="위로" disabled={i === 0} onClick={() => moveArticle(i, -1)}>↑</button>
                        <button type="button" title="아래로" disabled={i === articles.length - 1} onClick={() => moveArticle(i, 1)}>↓</button>
                        <button type="button" className="kdne-img-del" title="삭제" onClick={() => delArticle(i)}>삭제</button>
                      </div>
                    </div>

                    <div className="kdne-art-grid">
                      {/* 썸네일 */}
                      <div className="kdne-art-thumb">
                        {a.thumb && a.thumb.src ? (
                          <img src={ikUrl(a.thumb.src, { w: 240 })} alt={a.thumb.alt || a.title} />
                        ) : (
                          <span className="kdne-art-thumb-empty" aria-hidden="true">대표 이미지 없음</span>
                        )}
                        <div className="kdne-art-thumb-tools">
                          <button type="button" className="kdn-pill kdn-pill--ghost kdn-pill--sm" onClick={() => setPickerForIdx(i)}>
                            {a.thumb && a.thumb.src ? '이미지 변경' : '이미지 선택'}
                          </button>
                          {a.thumb && a.thumb.src && (
                            <button type="button" className="kdn-pill kdn-pill--ghost kdn-pill--sm" onClick={() => clearThumb(i)}>제거</button>
                          )}
                        </div>
                      </div>

                      {/* 필드 */}
                      <div className="kdne-art-fields">
                        <label className="kdne-field">
                          <span className="kdne-field-label">기사 제목</span>
                          <input value={a.title} placeholder="기사 제목" onChange={(e) => patchArticle(i, { title: e.target.value })} />
                        </label>
                        <div className="kdne-art-row2">
                          <label className="kdne-field">
                            <span className="kdne-field-label">언론사</span>
                            <input value={a.outlet} placeholder="예: 충청일보" onChange={(e) => patchArticle(i, { outlet: e.target.value })} />
                          </label>
                          <label className="kdne-field">
                            <span className="kdne-field-label">게재일</span>
                            <input value={a.date} placeholder="예: 2026.6.1" onChange={(e) => patchArticle(i, { date: e.target.value })} />
                          </label>
                        </div>
                        <label className="kdne-field">
                          <span className="kdne-field-label">원문 URL</span>
                          <input
                            className={a.url && !urlOk ? 'kdne-input-bad' : ''}
                            value={a.url}
                            placeholder="https://…"
                            inputMode="url"
                            onChange={(e) => patchArticle(i, { url: e.target.value })}
                          />
                          {a.url && !urlOk && (
                            <span className="kdne-field-hint kdne-field-hint--bad">http:// 또는 https:// 로 시작하는 주소를 입력하세요.</span>
                          )}
                          {urlOk && (
                            <a className="kdne-field-hint" href={a.url} target="_blank" rel="noopener noreferrer">원문 열기 ↗</a>
                          )}
                        </label>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <ImageKitPicker
        open={pickerForIdx !== null}
        title="기사 대표 이미지 선택"
        onClose={() => setPickerForIdx(null)}
        onSelect={(urls) => {
          if (pickerForIdx !== null && urls && urls.length) {
            setThumb(pickerForIdx, urls[0]);
          }
          setPickerForIdx(null);
        }}
      />
    </div>
  );
};

export default ArticlesEditor;
