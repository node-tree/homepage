import React, { useCallback, useEffect, useState } from 'react';
import './news/villageNews.css';
import './news/newsEditor.css';
import './introEditor.css';
import { COLORS } from './data';
import { ikUrl } from '../../utils/ikUrl';
import ImageKitPicker from '../editor/ImageKitPicker';
import {
  toIntroOverride,
  type IntroContent,
  type IntroOverride,
} from './introData';
import { kkumdarakIntroAPI } from '../../services/api';

// ═══════════════════════════════════════════════════════════════
// 「소개」(Intro) 인라인 편집 — 편집자 전용 (lazy 청크)
//   · 모토·장소·「이소」 글 블록 3개(제목+본문)·멤버 5인(이름/역할/소개/캐릭터) 편집.
//   · 멤버 캐릭터 이미지 = ImageKitPicker 재사용(마을소식 NewsEditor 와 동일 흐름) →
//     반환 ikUrl 을 member.character 에 저장 → 표시.
//   · 저장은 kkumdarakIntroAPI.save(read-merge-write) — kkumdarak-settings.intro 버킷.
//   · 톤은 kkumdarak — 흰 배경 · Gothic · 둥근 두꺼운 테두리 · pill 버튼(NewsEditor 와 통일).
//   ※ default export — Intro 가 lazy(() => import('./IntroEditor')) 로 분리.
// ═══════════════════════════════════════════════════════════════

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

interface IntroEditorProps {
  initialContent: IntroContent;
  // 저장 성공 시 새 override 를 부모(Intro)로 전달 → 목록 화면 즉시 갱신 + 캐시 동기화.
  onSaved: (override: IntroOverride) => void;
  onClose: () => void;
}

const IntroEditor: React.FC<IntroEditorProps> = ({ initialContent, onSaved, onClose }) => {
  const [content, setContent] = useState<IntroContent>(() => clone(initialContent));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  // 캐릭터 업로드 대상 멤버 id(피커 오픈 시 지정). null 이면 피커 닫힘.
  const [pickerForMember, setPickerForMember] = useState<string | null>(null);

  // 미저장 이탈 경고(NewsEditor 와 동일).
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

  const patch = useCallback((p: Partial<IntroContent>) => {
    setContent((prev) => ({ ...prev, ...p }));
    setDirty(true);
    setFeedback(null);
  }, []);

  const patchBlock = useCallback(
    (
      key: 'isoMeaning' | 'isoOwlFirefly' | 'isoGenerations',
      field: 'title' | 'body',
      value: string,
    ) => {
      setContent((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
      setDirty(true);
      setFeedback(null);
    },
    [],
  );

  const patchMember = useCallback(
    (id: string, field: 'name' | 'role' | 'desc' | 'character', value: string) => {
      setContent((prev) => ({
        ...prev,
        members: prev.members.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
      }));
      setDirty(true);
      setFeedback(null);
    },
    [],
  );

  // ── 저장 ──────────────────────────────────────────────────────────
  const doSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const override = toIntroOverride(content);
      const saved = await kkumdarakIntroAPI.save(override);
      onSaved(saved && typeof saved === 'object' ? saved : override);
      setDirty(false);
      setFeedback({ kind: 'ok', msg: '저장되었습니다.' });
    } catch (err: any) {
      if (err && err.code === 'KKUM_AUTH_EXPIRED') {
        setFeedback({ kind: 'err', msg: '인증이 만료되었습니다. 다시 로그인 후 저장해주세요.' });
      } else {
        setFeedback({ kind: 'err', msg: err?.message || '저장에 실패했습니다. 잠시 후 다시 시도해주세요.' });
      }
    } finally {
      setSaving(false);
    }
  }, [saving, content, onSaved]);

  const cancel = useCallback(() => {
    if (dirty && typeof window !== 'undefined') {
      if (!window.confirm('저장하지 않은 변경이 있습니다. 정말 나갈까요?')) return;
    }
    onClose();
  }, [dirty, onClose]);

  return (
    <div className="kdie">
      {/* ── 상단 액션바 ── */}
      <div className="kdne-bar">
        <div className="kdne-bar-left">
          <button type="button" className="kdn-back" onClick={cancel}>← 소개로 돌아가기</button>
          <span className="kdne-bar-title">소개 편집</span>
          {dirty && <span className="kdne-dirty">● 미저장</span>}
        </div>
        <div className="kdne-bar-actions">
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
        {/* ── 히어로 텍스트 ── */}
        <section className="kdne-card">
          <h3 className="kdne-card-title">히어로 — 모토 · 장소</h3>
          <label className="kdie-field">
            <span className="kdie-field-label">모토</span>
            <textarea
              className="kdie-textarea"
              rows={4}
              value={content.motto}
              onChange={(e) => patch({ motto: e.target.value })}
            />
          </label>
          <label className="kdie-field">
            <span className="kdie-field-label">장소 · 기간</span>
            <input
              className="kdie-input"
              value={content.place}
              onChange={(e) => patch({ place: e.target.value })}
            />
          </label>
        </section>

        {/* ── 「이소」 글 블록 3개 ── */}
        <section className="kdne-card">
          <h3 className="kdne-card-title">「이소」 소개 글</h3>

          {([
            ['isoMeaning', '블록 A — 「이소」란'],
            ['isoOwlFirefly', '블록 B — 듣고, 빛내며'],
            ['isoGenerations', '블록 C — 다섯 세대'],
          ] as const).map(([key, label]) => (
            <div className="kdie-block" key={key}>
              <p className="kdie-block-label">{label}</p>
              <label className="kdie-field">
                <span className="kdie-field-label">제목</span>
                <input
                  className="kdie-input"
                  value={content[key].title}
                  onChange={(e) => patchBlock(key, 'title', e.target.value)}
                />
              </label>
              <label className="kdie-field">
                <span className="kdie-field-label">본문</span>
                <textarea
                  className="kdie-textarea"
                  rows={4}
                  value={content[key].body}
                  onChange={(e) => patchBlock(key, 'body', e.target.value)}
                />
              </label>
            </div>
          ))}
        </section>

        {/* ── 멤버 ── */}
        <section className="kdne-card">
          <h3 className="kdne-card-title">멤버 소개 ({content.members.length})</h3>
          <div className="kdie-members">
            {content.members.map((m) => (
              <div
                className="kdie-member"
                key={m.id}
                style={{ '--accent': COLORS[m.color] } as React.CSSProperties}
              >
                {/* 캐릭터 이미지 슬롯 + 업로드 */}
                <div className="kdie-member-media">
                  <div className="kdie-member-slot">
                    {m.character ? (
                      <img src={ikUrl(m.character, { w: 300 })} alt="" />
                    ) : (
                      <span className="kdie-member-slot-label">캐릭터 자리</span>
                    )}
                  </div>
                  <div className="kdie-member-media-tools">
                    <button
                      type="button"
                      className="kdn-pill kdn-pill--solid kdn-pill--sm"
                      onClick={() => setPickerForMember(m.id)}
                    >
                      {m.character ? '캐릭터 변경' : '캐릭터 업로드'}
                    </button>
                    {m.character && (
                      <button
                        type="button"
                        className="kdie-img-del"
                        onClick={() => patchMember(m.id, 'character', '')}
                      >
                        제거
                      </button>
                    )}
                  </div>
                </div>

                {/* 텍스트 필드 */}
                <div className="kdie-member-fields">
                  <label className="kdie-field">
                    <span className="kdie-field-label">이름</span>
                    <input
                      className="kdie-input"
                      value={m.name}
                      onChange={(e) => patchMember(m.id, 'name', e.target.value)}
                    />
                  </label>
                  <label className="kdie-field">
                    <span className="kdie-field-label">역할</span>
                    <input
                      className="kdie-input"
                      value={m.role}
                      onChange={(e) => patchMember(m.id, 'role', e.target.value)}
                    />
                  </label>
                  <label className="kdie-field">
                    <span className="kdie-field-label">소개글</span>
                    <textarea
                      className="kdie-textarea"
                      rows={3}
                      value={m.desc}
                      onChange={(e) => patchMember(m.id, 'desc', e.target.value)}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 멤버 캐릭터 이미지 선택(ImageKit) — 단일 선택. 마을소식과 동일 컴포넌트 재사용. */}
      <ImageKitPicker
        open={pickerForMember !== null}
        title="멤버 캐릭터 이미지 선택"
        onClose={() => setPickerForMember(null)}
        onSelect={(urls) => {
          const url = urls[0];
          if (url && pickerForMember) {
            patchMember(pickerForMember, 'character', url);
          }
          setPickerForMember(null);
        }}
      />
    </div>
  );
};

export default IntroEditor;
