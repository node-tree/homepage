import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { saengsansoAPI as _ssoAPI, saengsansoAboutAPI, saengsansoMembersAPI } from '../services/api';
import Login from './Login';
import SeoHead from './SeoHead';
import { FALLBACK_EXHIBITIONS, FALLBACK_PROJECTS, FALLBACK_NEWS, FALLBACK_ARCHIVES, FALLBACK_SLIDES } from '../data/saengsansoFallback';

// API 타입 캐스팅
const saengsansoAPI = _ssoAPI as Record<string, any>;

// ─── 랜덤 테마 (접속 시 결정) ───
const THEME_COLORS = ['#C8D64A', '#DAAA20'] as const; // 샤르트뢰즈 그린, 골든 머스타드
const THEME_BG = THEME_COLORS[Math.floor(Math.random() * THEME_COLORS.length)];

const C = {
  accent: '#1A1A14',   // 블랙
  red: '#1A1A14',      // 블랙 (강조)
  cyan: '#1A1A14',     // 블랙
  black: '#1A1A14',    // 블랙
  dark: '#1A1A14',     // 블랙
  white: THEME_BG,     // 랜덤 테마 배경
  gray65: '#4A5030',   // 올리브 그레이
};

// 테마색 rgba 헬퍼
const TR = (() => {
  const hex = THEME_BG;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return (a: number) => `rgba(${r},${g},${b},${a})`;
})();

// 테마색 짙은 버전 (호버용)
const THEME_HOVER = (() => {
  const hex = THEME_BG;
  const r = Math.round(parseInt(hex.slice(1,3),16) * 0.82);
  const g = Math.round(parseInt(hex.slice(3,5),16) * 0.82);
  const b = Math.round(parseInt(hex.slice(5,7),16) * 0.82);
  return `rgb(${r},${g},${b})`;
})();

const TEXT_BASE: React.CSSProperties = {
  fontSize: '20px', fontWeight: 700,
  fontFamily: "Verdana, 'Noto Sans Korean', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif",
  lineHeight: '32px', color: C.black, margin: 0,
};
const TEXT_SM: React.CSSProperties = { ...TEXT_BASE, fontSize: '14px', lineHeight: '24px' };
const TEXT_XS: React.CSSProperties = { ...TEXT_BASE, fontSize: '12px', lineHeight: '20px' };

// ─── 이미지 압축 (canvas, max 2560px, JPEG 90%) ───
const compressImage = (file: File, maxWidth = 2560, quality = 0.9): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas error')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

// ─── 네비게이션 ───
interface SubMenuItem { label: string; page?: string }
interface MenuItem { label: string; page: string; sub?: SubMenuItem[]; href?: string }

const MENU_ITEMS: MenuItem[] = [
  { label: 'MAIN', page: 'MAIN' },
  { label: 'ABOUT', page: 'ABOUT' },
  { label: 'PROJECTS', page: 'PROJECTS' },
  { label: 'SHOP', page: 'SHOP' },
  {
    label: 'NEWS', page: 'NEWS',
    sub: [
      { label: '- 공지사항', page: 'NEWS_NOTICE' },
      { label: '- 언론보도', page: 'NEWS_PRESS' },
    ]
  },
  { label: 'ARCHIVE', page: 'ARCHIVE' },
  { label: 'NODE TREE', page: 'NODE_TREE', href: 'https://nodetree.kr' },
];

// ─── 공통 컴포넌트 ───
function RedLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ ...TEXT_BASE, background: C.red, color: C.white, padding: '0 4px', display: 'inline' }}>
      {children}
    </span>
  );
}

// ─── 관리 버튼 ───
const btnStyle: React.CSSProperties = {
  background: 'none', border: `1px solid ${C.dark}`, padding: '2px 8px',
  fontSize: '11px', cursor: 'pointer', fontWeight: 700, marginLeft: '6px',
};
const addBtnStyle: React.CSSProperties = {
  ...btnStyle, background: C.accent, color: C.white, border: 'none',
  padding: '4px 14px', fontSize: '12px', marginTop: '12px',
};

// ─── 인라인 폼 스타일 ───
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: '14px', fontFamily: 'inherit',
  border: `1px solid #1A1A14`, marginBottom: '6px', boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = { ...inputStyle, background: C.white };
const formBtnStyle: React.CSSProperties = {
  padding: '4px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
  border: 'none', marginRight: '6px',
};

// ─── 인라인 편집 폼 ───
function InlineForm({ fields, initial, onSave, onCancel }: {
  fields: { key: string; label: string; type?: 'text' | 'select' | 'textarea'; options?: string[] }[];
  initial: Record<string, string>;
  onSave: (data: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = { ...initial };
    fields.forEach(f => {
      if (f.type === 'select' && f.options?.length && !defaults[f.key]) {
        defaults[f.key] = f.options[0];
      }
    });
    return defaults;
  });

  return (
    <div style={{ background: '#B8D860', padding: '12px', margin: '8px 0', border: '1px solid #1A1A14' }}>
      {fields.map(f => (
        <div key={f.key} style={{ marginBottom: '4px' }}>
          <label style={{ ...TEXT_XS, display: 'block', marginBottom: '2px' }}>{f.label}</label>
          {f.type === 'select' ? (
            <select style={selectStyle} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}>
              {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea
              style={{ ...inputStyle, height: '120px', resize: 'vertical', fontFamily: 'inherit' }}
              value={form[f.key] || ''}
              onChange={e => setForm({ ...form, [f.key]: e.target.value })}
            />
          ) : (
            <input style={inputStyle} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
        <button style={{ ...formBtnStyle, background: C.accent, color: C.white }} onClick={() => onSave(form)}>저장</button>
        <button style={{ ...formBtnStyle, background: '#6A9020' }} onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}

// ─── 슬라이드 편집 모달 ───
function SlideEditModal({ slide, onSave, onClose }: {
  slide: any;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [caption, setCaption] = useState(slide?.caption || '');
  const [imagePreview, setImagePreview] = useState<string>(slide?.image || '');
  const [tab, setTab] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState(slide?.image?.startsWith('http') ? slide.image : '');
  const [isDragging, setIsDragging] = useState(false);
  const [imgError, setImgError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setImgError('');
    if (!file.type.startsWith('image/')) { setImgError('이미지 파일만 가능합니다.'); return; }
    if (file.size > 15 * 1024 * 1024) { setImgError('15MB 이하 파일만 가능합니다.'); return; }
    try { setImagePreview(await compressImage(file)); } catch { setImgError('이미지 처리 실패'); }
  };

  const handleUrlApply = () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!url.startsWith('http')) { setImgError('http 또는 https로 시작하는 URL을 입력하세요.'); return; }
    setImgError('');
    setImagePreview(url);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ caption, image: imagePreview, bg: slide?.bg || '' });
      onClose();
    } finally { setSaving(false); }
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', border: 'none',
    background: active ? C.dark : 'transparent', color: active ? C.white : C.dark,
    transition: 'all 0.15s',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(26,26,20,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
    }} onClick={onClose}>
      <div style={{
        background: C.white, padding: '28px', width: '90%', maxWidth: '480px',
        boxShadow: '0 12px 40px rgba(26,26,20,0.4)', borderRadius: '2px',
      }} onClick={e => e.stopPropagation()}>
        <p style={{ ...TEXT_BASE, marginBottom: '16px' }}>
          {slide?._id ? '슬라이드 편집' : '슬라이드 추가'}
        </p>

        {/* 이미지 미리보기 */}
        {imagePreview && (
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <img src={imagePreview} alt="" style={{
              width: '100%', height: '160px', objectFit: 'cover',
              display: 'block', border: '1px solid #1A1A14',
            }} />
            <button onClick={() => { setImagePreview(''); setUrlInput(''); }} style={{
              position: 'absolute', top: '6px', right: '6px',
              background: 'rgba(26,26,20,0.8)', color: C.white,
              border: 'none', borderRadius: '50%', width: '24px', height: '24px',
              cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
          </div>
        )}

        {/* 탭 전환 */}
        <div style={{ display: 'flex', marginBottom: '10px', border: `1px solid ${C.dark}` }}>
          <button style={tabStyle(tab === 'upload')} onClick={() => { setTab('upload'); setImgError(''); }}>파일 업로드</button>
          <button style={tabStyle(tab === 'url')} onClick={() => { setTab('url'); setImgError(''); }}>URL 링크</button>
        </div>

        {tab === 'upload' ? (
          <>
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? C.accent : '#1A1A14'}`,
                padding: '16px', textAlign: 'center', cursor: 'pointer',
                background: isDragging ? 'rgba(26,26,20,0.08)' : TR(0.5),
                marginBottom: '12px', transition: 'all 0.2s',
              }}
            >
              <p style={{ ...TEXT_SM, color: C.gray65, margin: 0 }}>이미지 클릭 또는 드래그</p>
              <p style={{ ...TEXT_XS, color: '#4A7010', margin: '4px 0 0' }}>JPG·PNG·WEBP · 15MB 이하 · 자동 압축</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </>
        ) : (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleUrlApply()}
                placeholder="https://example.com/image.jpg"
                style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
              />
              <button onClick={handleUrlApply}
                style={{ ...formBtnStyle, background: C.dark, color: C.white, whiteSpace: 'nowrap' }}>
                적용
              </button>
            </div>
          </div>
        )}
        {imgError && <p style={{ ...TEXT_XS, color: C.red, marginBottom: '8px' }}>{imgError}</p>}

        {/* 캡션 */}
        <label style={{ ...TEXT_XS, display: 'block', marginBottom: '4px', color: C.gray65 }}>캡션</label>
        <input value={caption} onChange={e => setCaption(e.target.value)}
          style={{ ...inputStyle, marginBottom: '20px' }} placeholder="슬라이드 설명 텍스트" />

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...formBtnStyle, background: '#6A9020' }}>취소</button>
          <button onClick={handleSave} disabled={saving}
            style={{ ...formBtnStyle, background: saving ? '#4A7010' : C.accent, color: C.white }}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 페이지: MAIN ───
function PageMain({ goToSlide, currentSlide, slides, isAdmin, onEditSlide, onAddSlide, onDeleteSlide }: {
  goToSlide: (i: number) => void;
  currentSlide: number;
  slides: any[];
  isAdmin: boolean;
  onEditSlide: (slide: any) => void;
  onAddSlide: () => void;
  onDeleteSlide: (id: string) => void;
}) {
  const slide = slides[currentSlide];
  if (!slide) return null;

  return (
    <div style={{ height: '68vh', position: 'relative', marginTop: '4px', overflow: 'hidden' }}>
      <AnimatePresence initial={false}>
        <motion.div
          key={currentSlide}
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
          style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
        >
          <div
            className="sso-slide-drift"
            style={{
              position: 'absolute', inset: '-4%',
              background: slide.bg || 'linear-gradient(135deg, #1A1A14, #2A2A1E)',
              backgroundSize: 'cover', backgroundPosition: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {/* 블러 배경 레이어 */}
            {slide.image && (
              <img src={slide.image} alt="" aria-hidden="true" style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'center', display: 'block',
                filter: 'blur(24px) brightness(0.55)',
                transform: 'scale(1.08)',
              }} />
            )}
            {/* 실제 이미지 — 균일 여백 */}
            {slide.image && (
              <div style={{ position: 'absolute', inset: '5%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={slide.image} alt="" loading="lazy" decoding="async" style={{
                  maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block',
                }} />
              </div>
            )}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.6 }}
              style={{ color: TR(0.5), fontSize: 'clamp(0.85rem, 1.5vw, 1.1rem)', fontWeight: 300, letterSpacing: '0.12em', textAlign: 'center', margin: 0, position: 'relative', zIndex: 1 }}>
              {slide.caption}
            </motion.p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* 도트 인디케이터 */}
      <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: 10 }}>
        {slides.map((_: any, i: number) => (
          <button key={i} onClick={() => goToSlide(i)} style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: i === currentSlide ? C.accent : TR(0.3),
            border: 'none', cursor: 'pointer', padding: 0, transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* 관리자 편집 컨트롤 */}
      {isAdmin && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px', zIndex: 20 }}>
          <button onClick={() => onEditSlide(slide)} style={{
            background: 'rgba(26,26,20,0.9)', color: C.white,
            border: 'none', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
          }}>이미지 편집</button>
          {slides.length > 1 && !String(slide._id).startsWith('f') && (
            <button onClick={() => onDeleteSlide(slide._id)} style={{
              background: 'rgba(26,26,20,0.9)', color: C.white,
              border: 'none', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            }}>삭제</button>
          )}
          <button onClick={onAddSlide} style={{
            background: 'rgba(26,26,20,0.85)', color: C.white,
            border: 'none', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
          }}>+ 추가</button>
        </div>
      )}
    </div>
  );
}

// ─── 페이지: ABOUT ───
const DEFAULT_ABOUT_DESC = '생산소는\n지역 리서치를 기반으로 활동하는 뉴미디어 아티스트 듀오 노드 트리의 작업 과정에서,\n적정한 규모의 도시에 대한 질문을 바탕으로\n마을에서 어떻게 관계를 맺고 어떤 태도로 실천되는지를 기록하는 공간입니다.\n마을에서 마음을 나누며, 감각과 이야기를 축적하고 있습니다';

interface MemberData { image: string; name: string; role: string; bio: string; }
const DEFAULT_MEMBERS: MemberData[] = Array.from({ length: 6 }, () => ({ image: '', name: '', role: '', bio: '' }));

function PageAbout({ isAdmin }: { isAdmin: boolean }) {
  const [description, setDescription] = useState(DEFAULT_ABOUT_DESC);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [aboutLoading, setAboutLoading] = useState(true);
  const [members, setMembers] = useState<MemberData[]>(DEFAULT_MEMBERS);
  const [isEditingMembers, setIsEditingMembers] = useState(false);
  const [editMembers, setEditMembers] = useState<MemberData[]>(DEFAULT_MEMBERS);
  const [membersSaving, setMembersSaving] = useState(false);

  useEffect(() => {
    saengsansoAboutAPI.get()
      .then(res => { if (res.success && res.data?.description) setDescription(res.data.description); })
      .catch(() => {})
      .finally(() => setAboutLoading(false));
    saengsansoMembersAPI.get()
      .then(res => { if (res.success && res.data) setMembers(res.data); })
      .catch(() => {});
  }, []);

  const handleMembersSave = async () => {
    setMembersSaving(true);
    try {
      const res = await saengsansoMembersAPI.update(editMembers);
      if (res.success) { setMembers(res.data); setIsEditingMembers(false); }
      else alert('저장에 실패했습니다.');
    } catch { alert('저장에 실패했습니다.'); }
    finally { setMembersSaving(false); }
  };

  const updateEditMember = (i: number, field: keyof MemberData, value: string) => {
    const next = editMembers.map((m, idx) => idx === i ? { ...m, [field]: value } : m);
    setEditMembers(next);
  };

  const handleEdit = () => { setEditText(description); setIsEditing(true); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saengsansoAboutAPI.update(editText);
      if (res.success) { setDescription(editText); setIsEditing(false); }
    } catch { alert('저장에 실패했습니다.'); }
    finally { setSaving(false); }
  };

  if (aboutLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '60px' }}>
        <p style={{ ...TEXT_SM, color: C.gray65, letterSpacing: '0.05em' }}>불러오는 중...</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
      <div style={{ display: 'flex', gap: '68px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 500px', minWidth: '300px' }}>
          <p style={TEXT_BASE}>생산소 省算所</p>
          <p style={TEXT_BASE}>SAENGSANSO</p>
          <p style={TEXT_BASE}>Alternative Art Space</p>
          <p style={TEXT_BASE}>Buyeo, Chungcheongnam-do</p>
          <br />

          {/* 편집 가능 설명 영역 */}
          {isEditing ? (
            <div style={{ marginBottom: '16px' }}>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                rows={8}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  lineHeight: '1.8',
                  fontSize: '16px',
                  fontFamily: 'inherit',
                  marginBottom: '10px',
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ ...formBtnStyle, background: saving ? '#4A7010' : C.accent, color: C.white }}>
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button onClick={() => setIsEditing(false)}
                  style={{ ...formBtnStyle, background: '#6A9020' }}>
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              {description.split('\n').map((line, i) => (
                <p key={i} style={{ ...TEXT_BASE, margin: '0 0 2px' }}>{line}</p>
              ))}
              {isAdmin && (
                <button onClick={handleEdit} style={{
                  ...btnStyle, marginLeft: 0, marginTop: '12px', display: 'block',
                  background: C.accent, color: C.white, border: 'none', padding: '4px 14px',
                }}>
                  텍스트 편집
                </button>
              )}
            </div>
          )}

        </div>

      </div>

      {/* 멤버 5인 소개 - 전체 너비 */}
      <div style={{ width: '100%', marginTop: '32px' }}>
        <p style={{ ...TEXT_BASE, marginBottom: '12px' }}>Operated by.</p>
        {isAdmin && isEditingMembers ? (
          <div style={{ marginBottom: '16px' }}>
            {editMembers.map((m, i) => (
              <div key={i} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: `1px solid ${TR(0.4)}` }}>
                <p style={{ ...TEXT_XS, color: C.gray65, margin: '0 0 6px', fontWeight: 700 }}>— {i + 1}번</p>
                <input
                  type="text" value={m.image}
                  onChange={e => updateEditMember(i, 'image', e.target.value)}
                  placeholder="이미지 URL"
                  style={{ ...inputStyle, width: '100%', fontSize: '13px', padding: '4px 8px', marginBottom: '6px', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                  <input
                    type="text" value={m.name}
                    onChange={e => updateEditMember(i, 'name', e.target.value)}
                    placeholder="이름"
                    style={{ ...inputStyle, flex: 1, fontSize: '13px', padding: '4px 8px' }}
                  />
                  <input
                    type="text" value={m.role}
                    onChange={e => updateEditMember(i, 'role', e.target.value)}
                    placeholder="역할"
                    style={{ ...inputStyle, flex: 1, fontSize: '13px', padding: '4px 8px' }}
                  />
                </div>
                <textarea
                  value={m.bio}
                  onChange={e => updateEditMember(i, 'bio', e.target.value)}
                  placeholder="소개글"
                  rows={2}
                  style={{ ...inputStyle, width: '100%', fontSize: '13px', padding: '4px 8px', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button onClick={handleMembersSave} disabled={membersSaving}
                style={{ ...formBtnStyle, background: membersSaving ? '#4A5030' : C.accent, color: C.white }}>
                {membersSaving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setIsEditingMembers(false)}
                style={{ ...formBtnStyle, background: '#6A9020' }}>취소</button>
            </div>
          </div>
        ) : (
          <>
            <div className="sso-members-grid" style={{ display: 'flex', gap: 0 }}>
              {members.map((m, i) => (
                <div key={i} className="sso-member-card" style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', background: TR(0.25), borderRight: i < 4 ? `1px solid ${C.dark}` : 'none' }}>
                    {m.image ? (
                      <img src={m.image} alt={m.name || `멤버 ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ ...TEXT_SM, color: C.gray65 }}>{i + 1}</span>
                      </div>
                    )}
                  </div>
                  {/* 검은 바 - 이름 */}
                  <div style={{ background: C.dark, padding: '4px 8px', borderRight: i < 4 ? `1px solid ${TR(0.3)}` : 'none' }}>
                    <p style={{ ...TEXT_XS, color: C.white, margin: 0, fontWeight: 700 }}>{m.name || `— ${i + 1}`}</p>
                  </div>
                  {/* 역할 + 소개글 */}
                  <div style={{ padding: '6px 4px 0' }}>
                    <p style={{ ...TEXT_XS, margin: '0 0 4px', color: C.gray65 }}>{m.role || '역할'}</p>
                    {m.bio ? (
                      <div>
                        {m.bio.split('\n').map((line, li) =>
                          line.startsWith('- ') ? (
                            <p key={li} style={{ ...TEXT_XS, margin: '0 0 1px', color: C.gray65, lineHeight: '18px', paddingLeft: '10px', textIndent: '-10px' }}>
                              · {line.slice(2)}
                            </p>
                          ) : (
                            <p key={li} style={{ ...TEXT_XS, margin: '0 0 1px', color: C.gray65, lineHeight: '18px' }}>{line}</p>
                          )
                        )}
                      </div>
                    ) : (
                      <p style={{ ...TEXT_XS, margin: 0, color: C.gray65, lineHeight: '18px' }}>소개글</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {isAdmin && (
              <button onClick={() => { const padded = [...members.map(m => ({ ...m }))]; while (padded.length < 6) padded.push({ image: '', name: '', role: '', bio: '' }); setEditMembers(padded); setIsEditingMembers(true); }}
                style={{ ...btnStyle, marginLeft: 0, marginTop: '8px', display: 'block', background: C.accent, color: C.white, border: 'none', padding: '4px 14px' }}>
                멤버 편집
              </button>
            )}
          </>
        )}
      </div>

      {/* 지도 + 연락처 */}
      <div className="sso-map-contact" style={{ width: '100%', marginTop: '48px', display: 'flex', gap: 0, border: `2px solid ${C.dark}` }}>
        <div className="sso-map-wrap" style={{ flex: '0 0 38%' }}>
          <iframe
            title="생산소 위치"
            src="https://maps.google.com/maps?q=충청남도+부여군+장암면+석동로+29번길+3&hl=ko&z=16&output=embed"
            width="100%"
            height="100%"
            style={{ display: 'block', border: 'none', borderRight: `2px solid ${C.dark}`, minHeight: '240px' }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
          <p style={TEXT_BASE}>saengsanso@gmail.com</p>
          <p style={TEXT_BASE}>
            Instagram @saengsanso{' '}
            <a
              href="https://instagram.com/saengsanso"
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...TEXT_SM, color: C.accent, textDecoration: 'none', fontWeight: 700 }}
            >
              ↗ 바로가기
            </a>
          </p>
          <p style={TEXT_BASE}>
            YouTube @SAENGSANSO{' '}
            <a
              href="https://www.youtube.com/@SAENGSANSO"
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...TEXT_SM, color: C.accent, textDecoration: 'none', fontWeight: 700 }}
            >
              ↗ 바로가기
            </a>
          </p>
          <br />
          <p style={TEXT_BASE}>충남 부여군 장암면 석동로 29번길 3</p>
          <p style={TEXT_BASE}>Buyeo-gun, Chungcheongnam-do, Korea</p>
          <br />
          <p style={TEXT_BASE}>Space Inquiry</p>
          <br />
          <button style={{ ...TEXT_XS, background: C.red, color: C.white, border: 'none', padding: '4px 16px', cursor: 'pointer', fontWeight: 700, alignSelf: 'flex-start' }}>문의하기</button>
          <br />
          <br />
          <p style={{ ...TEXT_SM, color: C.cyan }}>* 방문은 사전 연락 후 가능합니다</p>
          <br />
          <p style={{ ...TEXT_XS, color: C.gray65 }}>website by NODE TREE</p>
        </div>
      </div>
    </div>
  );
}

// ─── 페이지: SHOP (준비중) ───
function PageShop() {
  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: '0 0 196px', minWidth: '140px' }}>
          <p style={TEXT_BASE}>SHOP</p>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', paddingTop: '4px' }}>
          <p style={{ ...TEXT_BASE, color: C.gray65 }}>준비중입니다.</p>
        </div>
      </div>
    </div>
  );
}

// ─── 페이지: EXHIBITIONS (DB 연동) ───
function PageExhibitions({ exhibitions, isAdmin, onAdd, onEdit, onDelete }: {
  exhibitions: any[];
  isAdmin: boolean;
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
}) {
  // year별 그룹핑
  const grouped: Record<string, any[]> = {};
  exhibitions.forEach(ex => {
    const y = ex.year || 'N/A';
    if (!grouped[y]) grouped[y] = [];
    grouped[y].push(ex);
  });

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: '0 0 196px', minWidth: '140px' }}>
          <p style={TEXT_BASE}>ONSITE</p>
        </div>
        <div style={{ flex: 1 }}>
          {Object.entries(grouped)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([year, items]) => (
              <div key={year} style={{ marginBottom: '32px' }}>
                <p style={{ ...TEXT_BASE, marginBottom: '8px' }}><RedLabel>{year}</RedLabel></p>
                {items.map((item: any, i: number) => (
                  <p key={item._id || i} style={{ ...TEXT_BASE, cursor: 'pointer' }}>
                    {item.date} {item.title}{item.venue ? ` — ${item.venue}` : ''}
                    {item.note && <span style={{ ...TEXT_SM, color: C.cyan, display: 'block' }}>* {item.note}</span>}
                    {isAdmin && (
                      <>
                        <button style={btnStyle} onClick={() => onEdit(item)}>수정</button>
                        <button style={{ ...btnStyle, color: C.red }} onClick={() => onDelete(item._id)}>삭제</button>
                      </>
                    )}
                  </p>
                ))}
              </div>
            ))}
          {isAdmin && <button style={addBtnStyle} onClick={onAdd}>+ 전시 추가</button>}
        </div>
      </div>
    </div>
  );
}

// ─── 페이지: PROJECTS (DB 연동) ───
function PageProjects({ projects, isAdmin, onSave, onDelete }: {
  projects: any[];
  isAdmin: boolean;
  onSave: (data: Record<string, string>, id?: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [editItem, setEditItem] = useState<any>(null); // null=닫힘, {}=새항목, {_id,...}=수정중

  const PROJ_FIELDS = [
    { key: 'category', label: '카테고리', type: 'select' as const, options: ['SOUNDSCAPE', 'COLLABORATION', 'RESIDENCY', 'WORKSHOP & COMMUNITY', 'EXHIBITION'] },
    { key: 'date', label: '날짜' },
    { key: 'title', label: '제목' },
    { key: 'detail', label: '상세' },
  ];

  const categories = ['SOUNDSCAPE', 'COLLABORATION', 'RESIDENCY', 'WORKSHOP & COMMUNITY', 'EXHIBITION'];
  const grouped: Record<string, any[]> = {};
  categories.forEach(c => { grouped[c] = []; });
  projects.forEach(p => { if (grouped[p.category]) grouped[p.category].push(p); });
  // 각 카테고리 내 날짜 역순(최신순) 정렬
  categories.forEach(c => {
    grouped[c].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));
  });

  const handleSave = async (data: Record<string, string>) => {
    await onSave(data, editItem?._id);
    setEditItem(null);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
      <div className="sso-projects-layout" style={{ display: 'flex', gap: '12px' }}>
        <div className="sso-projects-label" style={{ flex: '0 0 196px', minWidth: '140px' }}><p style={TEXT_BASE}>PROGRAM</p></div>
        <div style={{ flex: 1 }}>
          {/* 새 항목 추가 폼 */}
          {isAdmin && editItem && !editItem._id && (
            <InlineForm fields={PROJ_FIELDS} initial={{}} onSave={handleSave} onCancel={() => setEditItem(null)} />
          )}
          {categories.map(cat => (
            <div key={cat} style={{ marginBottom: '32px' }}>
              <p style={{ ...TEXT_BASE, marginBottom: '8px' }}><RedLabel>{cat}</RedLabel></p>
              {grouped[cat].map((item: any, i: number) => (
                <div key={item._id || i} style={{ marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <p style={{ ...TEXT_BASE, margin: 0 }}>{item.date} {item.title}</p>
                    {isAdmin && (
                      <>
                        <button style={btnStyle} onClick={() => setEditItem(item)}>수정</button>
                        <button style={{ ...btnStyle, color: C.red }} onClick={() => onDelete(item._id)}>삭제</button>
                      </>
                    )}
                  </div>
                  <p style={{ ...TEXT_SM, color: C.gray65 }}>{item.detail}</p>
                  {/* 수정 폼: 해당 항목 바로 아래 */}
                  {isAdmin && editItem?._id === item._id && (
                    <InlineForm
                      fields={PROJ_FIELDS}
                      initial={{ category: item.category, date: item.date, title: item.title, detail: item.detail }}
                      onSave={handleSave}
                      onCancel={() => setEditItem(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
          {isAdmin && <button style={addBtnStyle} onClick={() => setEditItem({})}>+ 프로젝트 추가</button>}
        </div>
      </div>
    </div>
  );
}

// ─── 페이지: NEWS (DB 연동) ───
function PageNews({ filter, news, isAdmin, onSave, onDelete, onReorder }: {
  filter?: 'notice' | 'press';
  news: any[];
  isAdmin: boolean;
  onSave: (data: Record<string, string>, id?: string) => Promise<void>;
  onDelete: (id: string) => void;
  onReorder: (orders: { id: string; sortOrder: number }[]) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<'all' | 'notice' | 'press'>(
    filter === 'notice' ? 'notice' : filter === 'press' ? 'press' : 'all'
  );
  const [editItem, setEditItem] = useState<any>(null);
  const [selectedNotice, setSelectedNotice] = useState<any>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    if (filter === 'notice') setActiveTab('notice');
    else if (filter === 'press') setActiveTab('press');
  }, [filter]);

  // 탭 전환 시 패널 닫기
  useEffect(() => {
    setSelectedNotice(null);
  }, [activeTab]);

  const NEWS_FIELDS = [
    { key: 'date', label: '날짜' },
    { key: 'title', label: '제목' },
    { key: 'source', label: '출처' },
    { key: 'category', label: '분류', type: 'select' as const, options: ['notice', 'press'] },
    { key: 'url', label: 'URL' },
    { key: 'content', label: '본문', type: 'textarea' as const },
    { key: 'images', label: '이미지 URL (쉼표로 구분)', type: 'text' as const },
  ];

  const filteredNews = (activeTab === 'all' ? news : news.filter((n: any) => n.category === activeTab))
    .slice()
    .sort((a: any, b: any) => {
      if (reorderMode) {
        const aOrder = a.sortOrder ?? 9999;
        const bOrder = b.sortOrder ?? 9999;
        return aOrder !== bOrder ? aOrder - bOrder : b.date.localeCompare(a.date);
      }
      return b.date.localeCompare(a.date);
    });

  const moveItem = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= filteredNews.length || reordering) return;
    setReordering(true);
    try {
      const reordered = [...filteredNews];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      const orders = reordered.map((item, i) => ({ id: item._id, sortOrder: i }));
      await onReorder(orders);
    } finally {
      setReordering(false);
    }
  };
  const tabs: { key: 'all' | 'notice' | 'press'; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: 'notice', label: '공지사항' },
    { key: 'press', label: '언론보도' },
  ];

  const handleSave = async (data: Record<string, string>) => {
    await onSave(data, editItem?._id);
    setEditItem(null);
    setSelectedNotice(null);
  };

  const handleItemClick = (item: any) => {
    if (item.category === 'notice') {
      setSelectedNotice(selectedNotice?._id === item._id ? null : item);
    } else if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    }
  };

  const noticeImages = selectedNotice?.images
    ? selectedNotice.images.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* ─── 왼쪽: 목록 ─── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: '10px', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '0', marginBottom: '20px' }}>
          {tabs.map(tab => (
            <span key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              ...TEXT_BASE, fontSize: '17px', padding: '6px 16px', cursor: 'pointer',
              background: activeTab === tab.key ? C.red : 'transparent',
              color: activeTab === tab.key ? C.white : C.dark, transition: 'all 0.2s',
            }}>
              {tab.label}
            </span>
          ))}
        </div>
        {/* 새 항목 추가 폼 */}
        {isAdmin && editItem && !editItem._id && (
          <InlineForm fields={NEWS_FIELDS} initial={{}} onSave={handleSave} onCancel={() => setEditItem(null)} />
        )}
        {isAdmin && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button
              onClick={() => { setReorderMode(v => !v); setEditItem(null); setSelectedNotice(null); }}
              style={{
                ...btnStyle,
                background: reorderMode ? C.red : 'transparent',
                color: reorderMode ? C.white : C.dark,
                border: `1px solid ${reorderMode ? C.red : C.gray65}`,
                padding: '4px 12px',
              }}
            >
              {reorderMode ? '순서 저장 완료' : '순서 변경'}
            </button>
          </div>
        )}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.dark}`, paddingBottom: '8px', marginBottom: '4px' }}>
          <span style={{ ...TEXT_SM, flex: '0 0 100px' }}>날짜</span>
          <span style={{ ...TEXT_SM, flex: 1 }}>제목</span>
          <span style={{ ...TEXT_SM, flex: '0 0 80px', textAlign: 'right' }}>출처</span>
          {isAdmin && <span style={{ ...TEXT_SM, flex: '0 0 80px', textAlign: 'right' }}>관리</span>}
        </div>
        {filteredNews.map((item: any, i: number) => (
          <div key={item._id || i}>
            <div style={{
              display: 'flex', padding: '10px 0', borderBottom: '1px solid #6A9020',
              cursor: (!reorderMode && (item.category === 'notice' || item.url)) ? 'pointer' : reorderMode ? 'default' : 'default',
              transition: 'background 0.2s',
              background: selectedNotice?._id === item._id ? THEME_HOVER : 'transparent',
            }}
              onClick={() => { if (!reorderMode) handleItemClick(item); }}
              onMouseEnter={e => { if (!reorderMode && selectedNotice?._id !== item._id) e.currentTarget.style.background = THEME_HOVER; }}
              onMouseLeave={e => { if (selectedNotice?._id !== item._id) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ ...TEXT_SM, flex: '0 0 100px', color: C.gray65 }}>{item.date}</span>
              <span style={{ ...TEXT_BASE, flex: 1 }}>
                {item.title}
                {!reorderMode && item.category === 'notice' && <span style={{ ...TEXT_XS, color: C.gray65, marginLeft: '6px' }}>›</span>}
                {!reorderMode && item.category === 'press' && item.url && <span style={{ ...TEXT_XS, color: C.cyan, marginLeft: '6px' }}>↗</span>}
              </span>
              <span style={{ ...TEXT_XS, flex: '0 0 80px', textAlign: 'right', color: C.gray65, alignSelf: 'center' }}>{item.source}</span>
              {isAdmin && !reorderMode && (
                <span style={{ flex: '0 0 80px', textAlign: 'right', flexShrink: 0 }}>
                  <button style={btnStyle} onClick={e => { e.stopPropagation(); setEditItem(item); setSelectedNotice(null); }}>수정</button>
                  <button style={{ ...btnStyle, color: C.red }} onClick={e => { e.stopPropagation(); onDelete(item._id); }}>삭제</button>
                </span>
              )}
              {isAdmin && reorderMode && (
                <span style={{ flex: '0 0 56px', textAlign: 'right', flexShrink: 0, display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <button
                    disabled={i === 0 || reordering}
                    onClick={e => { e.stopPropagation(); moveItem(i, i - 1); }}
                    style={{ ...btnStyle, opacity: i === 0 ? 0.3 : 1, cursor: i === 0 ? 'default' : 'pointer', padding: '2px 7px' }}
                  >↑</button>
                  <button
                    disabled={i === filteredNews.length - 1 || reordering}
                    onClick={e => { e.stopPropagation(); moveItem(i, i + 1); }}
                    style={{ ...btnStyle, opacity: i === filteredNews.length - 1 ? 0.3 : 1, cursor: i === filteredNews.length - 1 ? 'default' : 'pointer', padding: '2px 7px' }}
                  >↓</button>
                </span>
              )}
            </div>
            {/* 수정 폼: 해당 항목 바로 아래 */}
            {isAdmin && !reorderMode && editItem?._id === item._id && (
              <InlineForm
                fields={NEWS_FIELDS}
                initial={{ date: item.date, title: item.title, source: item.source, category: item.category, url: item.url || '', content: item.content || '', images: item.images || '' }}
                onSave={handleSave}
                onCancel={() => setEditItem(null)}
              />
            )}
          </div>
        ))}
        {isAdmin && !reorderMode && <button style={addBtnStyle} onClick={() => setEditItem({})}>+ 뉴스 추가</button>}
      </div>

      {/* ─── 오른쪽: 공지사항 상세 슬라이드인 패널 ─── */}
      <div style={{
        width: selectedNotice ? '46%' : '0',
        flexShrink: 0,
        transition: 'width 0.3s ease',
        overflow: 'hidden',
      }}>
        {selectedNotice && (
          <div style={{
            width: '46vw', height: '100%', overflowY: 'auto',
            borderLeft: `1px solid ${C.dark}`, paddingLeft: '24px', paddingRight: '12px', paddingTop: '10px',
            boxSizing: 'border-box',
          }}>
            {/* 닫기 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button onClick={() => setSelectedNotice(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px',
                color: C.gray65, lineHeight: 1, padding: '0 4px',
              }}>✕</button>
            </div>
            {/* 메타 정보 */}
            <p style={{ ...TEXT_XS, color: C.gray65, margin: '0 0 4px' }}>{selectedNotice.date}</p>
            <h2 style={{ ...TEXT_BASE, fontSize: '18px', fontWeight: 700, margin: '0 0 8px', lineHeight: 1.4 }}>
              {selectedNotice.title}
            </h2>
            {selectedNotice.source && (
              <p style={{ ...TEXT_XS, color: C.gray65, margin: '0 0 20px' }}>{selectedNotice.source}</p>
            )}
            <div style={{ borderTop: `1px solid ${C.dark}`, marginBottom: '20px' }} />
            {/* 본문 */}
            {selectedNotice.content ? (
              <p style={{ ...TEXT_SM, lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: '0 0 24px' }}>
                {selectedNotice.content}
              </p>
            ) : (
              <p style={{ ...TEXT_SM, color: C.gray65, margin: '0 0 24px' }}>내용이 없습니다.</p>
            )}
            {/* 이미지 */}
            {noticeImages.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                {noticeImages.map((url: string, i: number) => (
                  <img key={i} src={url} alt={`첨부 이미지 ${i + 1}`}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                ))}
              </div>
            )}
            {/* 링크 */}
            {selectedNotice.url && (
              <a href={selectedNotice.url} target="_blank" rel="noopener noreferrer"
                style={{ ...TEXT_SM, color: C.cyan, textDecoration: 'underline' }}>
                관련 링크 →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 영상 URL 파싱 ───
function parseVideoUrl(url: string): { type: 'youtube' | 'vimeo' | 'direct' | 'gif'; embedUrl: string } | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${yt[1]}?autoplay=1&mute=1&loop=1&playlist=${yt[1]}&controls=0&playsinline=1` };
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vm[1]}?autoplay=1&muted=1&loop=1&background=1` };
  if (/\.gif(\?|$)/i.test(url)) return { type: 'gif', embedUrl: url };
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return { type: 'direct', embedUrl: url };
  return null;
}

// ─── 이미지에서 배경색 추출 ───
const PROXY_BASE = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api';

function useExtractedBg(imgSrc: string | null, fallback: string): string {
  const [bg, setBg] = useState<string>(fallback);
  useEffect(() => {
    if (!imgSrc) return;
    let cancelled = false;
    const proxyUrl = `${PROXY_BASE}/saengsanso/image-proxy?url=${encodeURIComponent(imgSrc)}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const S = 40;
        const canvas = document.createElement('canvas');
        canvas.width = S; canvas.height = S;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, S, S);
        const corners = [
          ctx.getImageData(0, 0, 3, 3).data,
          ctx.getImageData(S - 3, 0, 3, 3).data,
          ctx.getImageData(0, S - 3, 3, 3).data,
          ctx.getImageData(S - 3, S - 3, 3, 3).data,
        ];
        let r = 0, g = 0, b = 0, n = 0;
        corners.forEach(d => { for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; n++; } });
        if (!cancelled) setBg(`rgb(${Math.round(r/n)},${Math.round(g/n)},${Math.round(b/n)})`);
      } catch {}
    };
    img.src = proxyUrl;
    return () => { cancelled = true; };
  }, [imgSrc]);
  return bg;
}

// ─── 아카이브 카드 ───
function ArchiveCard({ item, isAdmin, onEdit, onDelete: onDel }: {
  item: any; isAdmin: boolean;
  onEdit: () => void; onDelete: () => void;
}) {
  const vid = parseVideoUrl(item.video || '');
  const imgSrc = vid?.type === 'gif' ? vid.embedUrl : (!item.video && item.image ? item.image : null);
  const bg = useExtractedBg(imgSrc, item.bg || 'linear-gradient(135deg, #1A1A14, #2A2A1E)');

  return (
    <div style={{
      background: bg,
      aspectRatio: '546 / 683', display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end', padding: '24px', cursor: 'pointer', transition: 'opacity 0.3s',
      position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
    >
      {vid ? (
        vid.type === 'gif' ? (
          <img src={vid.embedUrl} alt={item.title}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : vid.type === 'direct' ? (
          <video src={vid.embedUrl} autoPlay muted loop playsInline
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <iframe src={vid.embedUrl} title={item.title}
            allow="autoplay; fullscreen" frameBorder="0"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }} />
        )
      ) : item.image ? (
        <img src={item.image} alt={item.title}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : null}
      <p style={{ color: C.accent, fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', margin: '0 0 6px 0', position: 'relative', zIndex: 1 }}>
        {item.year}
      </p>
      <p style={{ color: C.white, fontSize: '16px', fontWeight: 700, margin: 0, lineHeight: '24px', position: 'relative', zIndex: 1 }}>
        {item.title}
      </p>
      {isAdmin && (
        <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 2 }}>
          <button style={{ ...btnStyle, background: TR(0.8) }} onClick={e => { e.stopPropagation(); onEdit(); }}>수정</button>
          <button style={{ ...btnStyle, background: TR(0.8), color: C.red }} onClick={e => { e.stopPropagation(); onDel(); }}>삭제</button>
        </div>
      )}
    </div>
  );
}

// ─── 페이지: ARCHIVE (DB 연동) ───
function PageArchive({ archives, isAdmin, onSave, onDelete, onReorder }: {
  archives: any[];
  isAdmin: boolean;
  onSave: (data: Record<string, string>, id?: string) => Promise<void>;
  onDelete: (id: string) => void;
  onReorder: (orders: { id: string; sortOrder: number }[]) => Promise<void>;
}) {
  const [editItem, setEditItem] = useState<any>(null);
  const [reordering, setReordering] = useState(false);

  const ARCHIVE_FIELDS = [
    { key: 'image', label: '이미지 URL' },
    { key: 'video', label: '영상 URL (YouTube/Vimeo/gif)' },
  ];

  const handleSave = async (data: Record<string, string>) => {
    await onSave(data, editItem?._id);
    setEditItem(null);
  };

  const moveItem = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= archives.length || reordering) return;
    setReordering(true);
    try {
      const reordered = [...archives];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      const orders = reordered.map((item, i) => ({ id: item._id, sortOrder: i }));
      await onReorder(orders);
    } finally {
      setReordering(false);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingTop: '10px' }}>
      {isAdmin && editItem && !editItem._id && (
        <InlineForm fields={ARCHIVE_FIELDS} initial={{}} onSave={handleSave} onCancel={() => setEditItem(null)} />
      )}
      <div className="sso-archive-grid" style={{ display: 'grid', gap: 0 }}>
        {archives.map((item: any, i: number) => (
          <div key={item._id || i} style={{ display: 'contents' }}>
            <div style={{ position: 'relative' }}>
              <ArchiveCard
                item={item}
                isAdmin={isAdmin}
                onEdit={() => setEditItem(item)}
                onDelete={() => onDelete(item._id)}
              />
              {isAdmin && (
                <div style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', gap: '4px', zIndex: 2 }}>
                  <button
                    disabled={i === 0 || reordering}
                    onClick={e => { e.stopPropagation(); moveItem(i, i - 1); }}
                    style={{
                      ...btnStyle, background: TR(0.8), fontSize: '14px', padding: '2px 8px',
                      opacity: i === 0 ? 0.3 : 1, cursor: i === 0 ? 'default' : 'pointer',
                    }}
                  >←</button>
                  <button
                    disabled={i === archives.length - 1 || reordering}
                    onClick={e => { e.stopPropagation(); moveItem(i, i + 1); }}
                    style={{
                      ...btnStyle, background: TR(0.8), fontSize: '14px', padding: '2px 8px',
                      opacity: i === archives.length - 1 ? 0.3 : 1, cursor: i === archives.length - 1 ? 'default' : 'pointer',
                    }}
                  >→</button>
                </div>
              )}
            </div>
            {isAdmin && editItem?._id === item._id && (
              <div style={{ gridColumn: '1 / -1', display: 'block' }}>
                <InlineForm
                  fields={ARCHIVE_FIELDS}
                  initial={{ image: item.image || '', video: item.video || '' }}
                  onSave={handleSave}
                  onCancel={() => setEditItem(null)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {isAdmin && <button style={addBtnStyle} onClick={() => setEditItem({})}>+ 아카이브 추가</button>}
    </div>
  );
}


// ═══════════════════════════════════════════
// ─── 메인 앱 ───
// ═══════════════════════════════════════════
function SaengsansoApp() {
  const { isAuthenticated, logout, user } = useAuth();
  const isAdmin = isAuthenticated;

  // 해시에서 초기 페이지 복원
  const getInitialPage = () => {
    const hash = window.location.hash.replace('#', '').toUpperCase();
    const valid = ['ABOUT', 'PROJECTS', 'SHOP', 'NEWS', 'NEWS_NOTICE', 'NEWS_PRESS', 'ARCHIVE'];
    return valid.includes(hash) ? hash : 'MAIN';
  };

  const [currentPage, setCurrentPage] = useState(getInitialPage);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [adminEditMode, setAdminEditMode] = useState(false); // 편집 버튼 눌러야 활성화

  // ─── 네브 페이드인 ───
  const [navVisible, setNavVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setNavVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  // DB 데이터 — FALLBACK으로 즉시 렌더링, DB 로드 후 교체
  const [loading, setLoading] = useState(false);
  const [exhibitions, setExhibitions] = useState<any[]>(FALLBACK_EXHIBITIONS);
  const [projects, setProjects] = useState<any[]>(FALLBACK_PROJECTS);
  const [news, setNews] = useState<any[]>(FALLBACK_NEWS);
  const [archives, setArchives] = useState<any[]>(FALLBACK_ARCHIVES);
  const [slides, setSlides] = useState<any[]>(FALLBACK_SLIDES);

  // 슬라이드 편집 모달
  const [slideEditTarget, setSlideEditTarget] = useState<any>(null); // null=닫힘, {}=추가, {_id,...}=편집

  // 데이터 로드 — 초기 로드는 통합 API, forceRefresh는 개별 API
  const loadData = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setLoading(true);
    try {
      if (forceRefresh) {
        // CRUD 후 갱신: 개별 API 호출
        const [exRes, prRes, nwRes, arRes, slRes] = await Promise.all([
          saengsansoAPI.exhibitions.getAll({ forceRefresh }).catch(() => null),
          saengsansoAPI.projects.getAll({ forceRefresh }).catch(() => null),
          saengsansoAPI.news.getAll({ forceRefresh }).catch(() => null),
          saengsansoAPI.archive.getAll({ forceRefresh }).catch(() => null),
          saengsansoAPI.slides.getAll({ forceRefresh }).catch(() => null),
        ]);
        setExhibitions(exRes?.success && exRes.data.length > 0 ? exRes.data : FALLBACK_EXHIBITIONS);
        setProjects(prRes?.success && prRes.data.length > 0 ? prRes.data : FALLBACK_PROJECTS);
        setNews(nwRes?.success && nwRes.data.length > 0 ? nwRes.data : FALLBACK_NEWS);
        setArchives(arRes?.success && arRes.data.length > 0 ? arRes.data : FALLBACK_ARCHIVES);
        setSlides(slRes?.success && slRes.data.length > 0 ? slRes.data : FALLBACK_SLIDES);
      } else {
        // 초기 로드: 통합 API 1회 호출
        const allData = await (saengsansoAPI as any).loadAll().catch(() => null);
        if (allData?.success) {
          const exRes = allData.exhibitions;
          const prRes = allData.projects;
          const nwRes = allData.news;
          const arRes = allData.archive;
          const slRes = allData.slides;
          setExhibitions(exRes?.success && exRes.data.length > 0 ? exRes.data : FALLBACK_EXHIBITIONS);
          setProjects(prRes?.success && prRes.data.length > 0 ? prRes.data : FALLBACK_PROJECTS);
          setNews(nwRes?.success && nwRes.data.length > 0 ? nwRes.data : FALLBACK_NEWS);
          setArchives(arRes?.success && arRes.data.length > 0 ? arRes.data : FALLBACK_ARCHIVES);
          setSlides(slRes?.success && slRes.data.length > 0 ? slRes.data : FALLBACK_SLIDES);
        } else {
          // 통합 API 실패 시 개별 호출 폴백
          const [exRes, prRes, nwRes, arRes, slRes] = await Promise.all([
            saengsansoAPI.exhibitions.getAll().catch(() => null),
            saengsansoAPI.projects.getAll().catch(() => null),
            saengsansoAPI.news.getAll().catch(() => null),
            saengsansoAPI.archive.getAll().catch(() => null),
            saengsansoAPI.slides.getAll().catch(() => null),
          ]);
          setExhibitions(exRes?.success && exRes.data.length > 0 ? exRes.data : FALLBACK_EXHIBITIONS);
          setProjects(prRes?.success && prRes.data.length > 0 ? prRes.data : FALLBACK_PROJECTS);
          setNews(nwRes?.success && nwRes.data.length > 0 ? nwRes.data : FALLBACK_NEWS);
          setArchives(arRes?.success && arRes.data.length > 0 ? arRes.data : FALLBACK_ARCHIVES);
          setSlides(slRes?.success && slRes.data.length > 0 ? slRes.data : FALLBACK_SLIDES);
        }
      }
    } catch {
      setExhibitions(FALLBACK_EXHIBITIONS);
      setProjects(FALLBACK_PROJECTS);
      setNews(FALLBACK_NEWS);
      setArchives(FALLBACK_ARCHIVES);
      setSlides(FALLBACK_SLIDES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = '생산소 SAENGSANSO';
    // favicon 교체 (canvas로 생성)
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    const prevHref = link?.href || '';
    if (link) {
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1A1A14';
        ctx.font = 'bold 26px serif';
        ctx.textAlign = 'center';
        ctx.fillText('省算', 32, 28);
        ctx.fillText('所', 32, 56);
        link.type = 'image/png';
        link.href = canvas.toDataURL('image/png');
      }
    }
    const style = document.createElement('style');
    style.textContent = `html, body { margin: 0; padding: 0; height: 100%; } * { box-sizing: border-box; }`;
    document.head.appendChild(style);
    loadData();
    return () => {
      if (link) link.href = prevHref;
      document.head.removeChild(style);
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [loadData]);

  useEffect(() => {
    document.documentElement.style.overflow = currentPage === 'MAIN' ? 'hidden' : 'auto';
    document.body.style.overflow = currentPage === 'MAIN' ? 'hidden' : 'auto';
  }, [currentPage]);

  useEffect(() => {
    if (currentPage !== 'MAIN') return;
    const timer = setInterval(() => setCurrentSlide(prev => (prev + 1) % slides.length), 5000);
    return () => clearInterval(timer);
  }, [currentPage, slides.length]);

  const goToSlide = useCallback((i: number) => setCurrentSlide(i), []);

  const handleNav = (page: string) => {
    if (page === 'LOGIN') { setShowLogin(true); return; }
    const item = MENU_ITEMS.find(m => m.page === page);
    if (item?.href) { window.open(item.href, '_blank', 'noopener,noreferrer'); return; }
    setCurrentPage(page);
    setMobileMenuOpen(false);
    setActiveDropdown(null);
    setAdminEditMode(false); // 페이지 이동 시 편집 모드 초기화
    window.location.hash = page === 'MAIN' ? '' : page.toLowerCase();
  };

  // ─── CRUD 핸들러 (각 페이지 컴포넌트에 주입) ───
  const makeSaveHandler = (type: string) => async (data: Record<string, string>, id?: string) => {
    const api = (saengsansoAPI as any)[type];
    if (id) {
      await api.update(id, data);
    } else {
      await api.create(data);
    }
    await loadData(true);
  };

  const makeDeleteHandler = (type: string) => async (id: string) => {
    if (!id || !window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      await (saengsansoAPI as any)[type].delete(id);
      await loadData(true);
    } catch (err: any) {
      console.error(`삭제 실패 (${type}):`, err);
      alert(`삭제에 실패했습니다: ${err?.message || '서버 오류'}`);
    }
  };

  const isMain = currentPage === 'MAIN';

  // 슬라이드 저장 핸들러
  const handleSaveSlide = async (data: any, id?: string) => {
    if (id && !String(id).startsWith('f')) {
      await saengsansoAPI.slides.update(id, data);
    } else {
      await saengsansoAPI.slides.create(data);
    }
    await loadData(true);
    // 슬라이드 추가 후 마지막 슬라이드로 이동
    if (!id) setCurrentSlide(slides.length);
  };

  const handleDeleteSlide = async (id: string) => {
    if (!window.confirm('슬라이드를 삭제하시겠습니까?')) return;
    await saengsansoAPI.slides.delete(id);
    setCurrentSlide(0);
    await loadData(true);
  };

  const loadingIndicator = (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '60px' }}>
      <p style={{ ...TEXT_SM, color: C.gray65, letterSpacing: '0.05em' }}>불러오는 중...</p>
    </div>
  );

  const renderPage = () => {
    switch (currentPage) {
      case 'MAIN': return (
        <PageMain
          goToSlide={goToSlide}
          currentSlide={currentSlide}
          slides={slides}
          isAdmin={isAdmin && adminEditMode}
          onEditSlide={(slide) => setSlideEditTarget(slide)}
          onAddSlide={() => setSlideEditTarget({})}
          onDeleteSlide={handleDeleteSlide}
        />
      );
      case 'ABOUT': return <PageAbout isAdmin={isAdmin && adminEditMode} />;
      case 'SHOP': return <PageShop />;
      case 'PROJECTS':
        if (loading) return loadingIndicator;
        return (
          <PageProjects
            projects={projects}
            isAdmin={isAdmin && adminEditMode}
            onSave={makeSaveHandler('projects')}
            onDelete={makeDeleteHandler('projects')}
          />
        );
      case 'NEWS':
      case 'NEWS_NOTICE':
      case 'NEWS_PRESS':
        if (loading) return loadingIndicator;
        return (
          <PageNews
            filter={currentPage === 'NEWS_NOTICE' ? 'notice' : currentPage === 'NEWS_PRESS' ? 'press' : undefined}
            news={news}
            isAdmin={isAdmin && adminEditMode}
            onSave={makeSaveHandler('news')}
            onDelete={makeDeleteHandler('news')}
            onReorder={async (orders) => {
              await saengsansoAPI.news.reorder(orders);
              await loadData(true);
            }}
          />
        );
      case 'ARCHIVE':
        if (loading) return loadingIndicator;
        return (
          <PageArchive
            archives={archives}
            isAdmin={isAdmin && adminEditMode}
            onSave={makeSaveHandler('archive')}
            onDelete={makeDeleteHandler('archive')}
            onReorder={async (orders) => {
              await saengsansoAPI.archive.reorder(orders);
              await loadData(true);
            }}
          />
        );
      default: return (
        <PageMain
          goToSlide={goToSlide}
          currentSlide={currentSlide}
          slides={slides}
          isAdmin={isAdmin && adminEditMode}
          onEditSlide={(slide) => setSlideEditTarget(slide)}
          onAddSlide={() => setSlideEditTarget({})}
          onDeleteSlide={handleDeleteSlide}
        />
      );
    }
  };

  // 로그인 페이지
  if (showLogin) {
    return <Login onClose={() => setShowLogin(false)} />;
  }

  // 슬라이드 편집 모달
  const slideModal = slideEditTarget !== null && (
    <SlideEditModal
      slide={slideEditTarget._id ? slideEditTarget : null}
      onSave={(data) => handleSaveSlide(data, slideEditTarget._id)}
      onClose={() => setSlideEditTarget(null)}
    />
  );

  const SSO_BASE = 'https://saengsanso.com';
  const SSO_SEO_MAP: Record<string, { title: string; description: string; keywords?: string }> = {
    MAIN: {
      title: '생산소 省算所 SAENGSANSO — 충남 부여 대안예술공간',
      description: '충남 부여에 위치한 대안예술공간. 사운드스케이프, 커뮤니티 프로젝트, 도시기록, 워크숍 등 다양한 문화예술 활동을 기획합니다.',
      keywords: '생산소, SAENGSANSO, 부여 예술공간, 대안예술, 충남 문화예술, 사운드아트, 도시기록, NODE TREE',
    },
    ABOUT: {
      title: '생산소 | About — 소개',
      description: '2020년 서울에서 충남 부여로 이주한 NODE TREE(이화영+정강현)가 운영하는 대안예술공간 생산소를 소개합니다.',
      keywords: '생산소 소개, 부여 예술공간, 이화영, 정강현',
    },
    PROJECTS: {
      title: '생산소 | Projects — 프로젝트',
      description: '생산소의 전시, 위탁 용역, 커뮤니티 프로젝트 목록. 에코플로깅, 금강워킹, 사운드오케스트라 등.',
      keywords: '생산소 프로젝트, 에코플로깅, 금강워킹, 사운드오케스트라, 부여 문화예술',
    },
    NEWS: {
      title: '생산소 | News — 뉴스',
      description: '생산소의 공지사항 및 언론보도.',
      keywords: '생산소 뉴스, 생산소 보도',
    },
    ARCHIVE: {
      title: '생산소 | Archive — 아카이브',
      description: '생산소 활동 아카이브.',
    },
    SHOP: {
      title: '생산소 | Shop — 숍',
      description: '생산소 굿즈 및 아카이브 자료.',
    },
  };
  const ssoSeo = SSO_SEO_MAP[currentPage] || SSO_SEO_MAP.MAIN;

  return (
    <div style={{
      fontFamily: "Verdana, 'Noto Sans Korean', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif",
      width: '100vw', height: '100vh', overflow: isMain ? 'hidden' : 'auto',
      background: C.white, display: 'flex', flexDirection: 'column',
    }}>
      <SeoHead
        title={ssoSeo.title}
        description={ssoSeo.description}
        url={SSO_BASE}
        image={`${SSO_BASE}/logo.png`}
        keywords={ssoSeo.keywords}
      />
      {slideModal}
      {/* ─── 타이틀 행 ─── */}
      <div style={{ background: C.white, padding: '0 15px', flexShrink: 0 }}>
        <div style={{ paddingTop: '18px', paddingBottom: '12px', margin: 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          onClick={() => handleNav('MAIN')}>
          <div style={{ overflowX: 'hidden', overflowY: 'visible', flex: 1 }}>
            <div className="sso-marquee-track">
              {[0, 1].map(copy => (
                <span key={copy} style={{
                  fontSize: '48px', fontWeight: 900,
                  fontFamily: "Verdana, 'Noto Sans Korean', 'Apple SD Gothic Neo', sans-serif",
                  color: '#000000', lineHeight: '1.1',
                  whiteSpace: 'nowrap',
                  display: 'inline-block',
                  flexShrink: 0,
                }}>
                  {'생산소 省算所 SAENGSANSO\u00A0\u00A0\u00A0·\u00A0\u00A0\u00A0생산소 省算所 SAENGSANSO\u00A0\u00A0\u00A0·\u00A0\u00A0\u00A0생산소 省算所 SAENGSANSO\u00A0\u00A0\u00A0·\u00A0\u00A0\u00A0'}
                </span>
              ))}
            </div>
          </div>
        </div>
        {/* 로그인/로그아웃 */}
        <div style={{ textAlign: 'right', paddingBottom: '4px' }}>
          {!isAuthenticated ? (
            <span
              onClick={(e) => { e.stopPropagation(); setShowLogin(true); }}
              style={{ ...TEXT_XS, color: 'rgba(26,26,20,0.4)', cursor: 'pointer', textDecoration: 'none' }}
            >
              로그인
            </span>
          ) : (
            <span style={{ ...TEXT_XS, color: 'rgba(26,26,20,0.6)' }}>
              {user?.username}님{' '}
              <span
                onClick={() => setAdminEditMode(m => !m)}
                style={{ cursor: 'pointer', textDecoration: 'underline', marginRight: '8px', color: adminEditMode ? C.accent : 'inherit' }}
              >
                {adminEditMode ? '편집완료' : '편집'}
              </span>
              <span onClick={logout} style={{ cursor: 'pointer', textDecoration: 'underline' }}>로그아웃</span>
            </span>
          )}
        </div>
      </div>

      {/* ─── 네비게이션 행 ─── */}
      <div style={{ background: C.white, padding: '0 15px', flexShrink: 0, overflow: 'hidden' }}>
        <nav className="sso-desktop-nav"
          style={{ display: 'flex', alignItems: 'center', margin: 0, padding: 0, position: 'relative', zIndex: 100, flexShrink: 0 }}
          onMouseLeave={() => setActiveDropdown(null)}
        >
          {MENU_ITEMS.map((item, idx) => {
            const isActive = currentPage === item.page || (item.page === 'NEWS' && currentPage.startsWith('NEWS'));
            return (
              <div key={item.label} style={{
                  position: 'relative', display: 'inline-block',
                  transform: navVisible ? 'translateY(0)' : 'translateY(20px)',
                  opacity: navVisible ? 1 : 0,
                  transition: `transform 0.5s cubic-bezier(0.22,1,0.36,1) ${idx * 70}ms, opacity 0.4s ease ${idx * 70}ms`,
                }}
                onMouseEnter={() => item.sub ? setActiveDropdown(idx) : setActiveDropdown(null)}>
                <span className="sso-nav-item" onClick={() => handleNav(item.page)} style={{
                  display: 'table-cell', padding: '0 10px', height: '34px', lineHeight: '34px',
                  fontSize: '17px', fontWeight: 700,
                  fontFamily: "'Noto Sans Korean', 'Noto Sans KR', sans-serif",
                  textTransform: 'uppercase' as const, letterSpacing: 'normal',
                  cursor: 'pointer', whiteSpace: 'nowrap' as const, verticalAlign: 'middle',
                  color: C.dark,
                  borderBottom: isActive ? `2px solid ${C.accent}` : '2px solid transparent',
                  transition: 'border-color 0.3s, color 0.3s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderBottomColor = C.accent; e.currentTarget.style.color = C.accent; }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderBottomColor = isActive ? C.accent : 'transparent';
                    e.currentTarget.style.color = C.dark;
                  }}
                >
                  {item.label}
                </span>
                {item.sub && activeDropdown === idx && (
                  <div style={{
                    position: 'absolute', top: '34px', left: 0, background: C.white,
                    minWidth: '200px', boxShadow: '0 4px 20px rgba(26,26,20,0.15)', zIndex: 200, padding: '8px 0',
                  }}>
                    {item.sub.map(sub => (
                      <div key={sub.label} style={{
                        padding: '10px 20px', color: C.dark, fontSize: '13px', fontWeight: 400, cursor: 'pointer', transition: 'background 0.2s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = C.accent; e.currentTarget.style.color = C.white; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.dark; }}
                        onClick={() => handleNav(sub.page || item.page)}
                      >
                        {sub.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <button className="sso-mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', marginLeft: 'auto' }}>
            <div style={{ width: '22px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ display: 'block', height: '2px', width: '22px', background: C.dark, transition: 'all 0.3s', transform: mobileMenuOpen ? 'rotate(45deg) translate(2px, 5px)' : 'none' }} />
              <span style={{ display: 'block', height: '2px', width: '22px', background: C.dark, transition: 'all 0.3s', opacity: mobileMenuOpen ? 0 : 1 }} />
              <span style={{ display: 'block', height: '2px', width: '22px', background: C.dark, transition: 'all 0.3s', transform: mobileMenuOpen ? 'rotate(-45deg) translate(2px, -5px)' : 'none' }} />
            </div>
          </button>
        </nav>
      </div>

      {/* 모바일 메뉴 */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{ position: 'fixed', top: '120px', left: 0, right: 0, bottom: 0, background: C.white, zIndex: 90, padding: '20px', overflowY: 'auto' }}
          >
            {MENU_ITEMS.map(item => (
              <div key={item.label} style={{ borderBottom: '1px solid #6A9020' }}>
                <div onClick={() => handleNav(item.page)} style={{
                  padding: '16px 0', fontSize: '17px', fontWeight: 700,
                  textTransform: 'uppercase' as const, color: C.dark, cursor: 'pointer',
                }}>
                  {item.label}
                </div>
                {item.sub && (
                  <div style={{ paddingBottom: '12px' }}>
                    {item.sub.map(sub => (
                      <div key={sub.label} style={{ padding: '8px 0 8px 16px', fontSize: '13px', color: '#4A5030', cursor: 'pointer' }}
                        onClick={() => handleNav(sub.page || item.page)}>
                        {sub.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── 콘텐츠 영역 ─── */}
      <main style={{
        width: '100%', padding: '0 15px', flex: 1, display: 'flex', flexDirection: 'column',
        position: 'relative', minHeight: isMain ? 'calc(100vh - 100px)' : 'auto',
      }}>
        {renderPage()}
      </main>

      {/* ─── 푸터 ─── */}
      {currentPage !== 'MAIN' && currentPage !== 'ARCHIVE' && (
        <footer style={{
          padding: '20px 15px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', gap: '8px',
        }}>
          <span style={{ ...TEXT_XS, color: C.gray65 }}>
            Copyright (c) {new Date().getFullYear()} 생산소 SAENGSANSO All rights reserved.
          </span>
        </footer>
      )}

      {/* ─── 반응형 ─── */}
      <style>{`
@keyframes ssoMarquee {
  from { transform: translateX(-50%); }
  to   { transform: translateX(0); }
}
.sso-marquee-track {
  display: flex;
  width: max-content;
  animation: ssoMarquee 14s linear infinite;
  will-change: transform;
}
@keyframes ssoSlowDrift {
  0%   { transform: scale(1.06) translate(0%, 0%); }
  25%  { transform: scale(1.06) translate(-1.2%, -0.6%); }
  50%  { transform: scale(1.06) translate(-2%, 0%); }
  75%  { transform: scale(1.06) translate(-0.8%, 0.6%); }
  100% { transform: scale(1.06) translate(0%, 0%); }
}
.sso-slide-drift {
  animation: ssoSlowDrift 18s ease-in-out infinite;
}
.sso-nav-item {
          position: relative;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.3s, color 0.3s !important;
        }
        .sso-nav-item:hover {
          transform: translateY(-5px) scale(1.08);
        }
        .sso-nav-item::before {
          content: '✦';
          position: absolute;
          top: -16px;
          left: 50%;
          transform: translateX(-50%) scale(0) rotate(-30deg);
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          font-size: 9px;
          color: #1A1A14;
          line-height: 1;
          pointer-events: none;
        }
        .sso-nav-item:hover::before {
          transform: translateX(-50%) scale(1) rotate(0deg);
        }
        .sso-mobile-menu-btn { display: none !important; }
        @media (max-width: 768px) {
          .sso-desktop-nav > div > span { padding: 0 6px !important; font-size: 13px !important; }
          .sso-projects-layout { flex-direction: column !important; gap: 0 !important; }
          .sso-projects-label { flex: none !important; min-width: unset !important; margin-bottom: 8px !important; }
        }
        @media (max-width: 600px) {
          .sso-desktop-nav > div { display: none !important; }
          .sso-mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </div>
  );
}

export default SaengsansoApp;
