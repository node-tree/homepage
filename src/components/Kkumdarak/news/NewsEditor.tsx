import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './villageNews.css';
import './newsEditor.css';
import {
  MASTHEAD,
  COLOPHON_LINES,
  EDITABLE_BLOCK_KINDS,
  BLOCK_KIND_META,
  THEME_PRESETS,
  type NewsStatus,
  type NewsTheme,
  type SerializableBlock,
  type SerializedNewsIssue,
} from './newsData';
import { NewsBlockView, OwlCut, FireflyCut } from './NewsBlocks';
import type { BlockSpan, BlockTone, RuleTop } from './newsData';
import ImageKitPicker from '../../editor/ImageKitPicker';
import { ikUrl } from '../../../utils/ikUrl';

// ═══════════════════════════════════════════════════════════════
// 「마을소식」 소식지 등록·편집 — 편집국 책상(편집자 전용, lazy 청크)
//   · 호 메타(호수·제목·날짜줄·테마) + 블록 편집기 + 실시간 미리보기.
//   · 미리보기는 실제 신문 렌더러(NewsBlocks)로 즉시 — "자유도" 체감의 핵심.
//   · 데스크톱: 폼·미리보기 분할 / 모바일: 폼·미리보기 탭 전환.
//   · Custom(render 함수) 블록은 직렬화 불가 → 여기서 만들지 않는다(7종만).
//   · 저장은 호출측(VillageNews)이 read-merge-write 로 처리(이 컴포넌트는 한 호만 편집).
//   ※ default export — VillageNews 가 lazy(() => import('./NewsEditor')) 로 분리.
// ═══════════════════════════════════════════════════════════════

// ── 빈 블록 팩토리 — "블록 추가" 시 종류별 기본 골격 ──────────────
function makeBlock(kind: SerializableBlock['kind']): SerializableBlock {
  switch (kind) {
    case 'topStory':
      return { kind, span: 'full', ruleTop: 'bold', kicker: '분류', headline: '머리기사 제목', deck: '', lead: '리드 문장을 입력하세요.', body: ['본문 문단을 입력하세요.'], byline: '' };
    case 'article':
      return { kind, span: 'full', ruleTop: 'bold', kicker: '분류', headline: '기사 제목', deck: '', byline: '', columns: 2, dropCap: false, body: ['본문 문단을 입력하세요.'], pullQuote: '' };
    case 'verse':
      return { kind, span: 'half', ruleTop: 'thin', kicker: '코너명', title: '제목', lines: ['세로로 흐르는 글을 입력하세요.'], attribution: '' };
    case 'photoSpread':
      return { kind, span: 'full', ruleTop: 'thin', images: [], caption: '', credit: '' };
    case 'collage':
      return { kind, span: 'half', ruleTop: 'thin', title: '스크랩 제목', items: [], caption: '' };
    case 'programBoard':
      return { kind, span: 'full', ruleTop: 'double', title: '공고란 제목', notes: [{ no: '①', name: '〈 〉', field: '분야', target: '대상', period: '기간', extra: '' }], footer: '' };
    case 'noticeBox':
      return { kind, span: 'full', ruleTop: 'thin', tone: 'spot', label: '사고(社告)', body: '알림 내용을 입력하세요.' };
    default: {
      const _ex: never = kind;
      return _ex;
    }
  }
}


// 깊은 복제(편집 격리 — 정적 호를 직접 변형하지 않기 위해).
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

// 멀티라인 텍스트 ↔ 문단 배열 헬퍼.
function linesToText(lines: string[]): string {
  return (lines || []).join('\n');
}
function textToLines(text: string): string[] {
  return text.split('\n').map((s) => s.replace(/\s+$/, '')).filter((s, i, a) => !(s === '' && i === a.length - 1 && a.length > 1));
}

const SPAN_OPTS: { v: BlockSpan; label: string }[] = [
  { v: 'full', label: '전폭' },
  { v: 'half', label: '절반' },
  { v: 'third', label: '1/3' },
];
const TONE_OPTS: { v: BlockTone; label: string }[] = [
  { v: 'paper', label: '바탕' },
  { v: 'ink', label: '먹면' },
  { v: 'spot', label: '신호색' },
];
const RULE_OPTS: { v: RuleTop; label: string }[] = [
  { v: 'none', label: '없음' },
  { v: 'thin', label: '얇은' },
  { v: 'bold', label: '굵은' },
  { v: 'double', label: '이중' },
];

interface NewsEditorProps {
  // 편집 대상 호(기존 호 편집 시 SerializedNewsIssue, 새 호면 makeIssue 로 생성된 골격).
  // 정적 호를 편집할 땐 정적 NewsIssue 를 직렬화 사본으로 받는다.
  initialIssue: SerializedNewsIssue;
  isNew: boolean;
  // 정적 코드에 내장된 호인지(삭제 대신 "되돌리기" 라벨, 백엔드 사본만 제거).
  isStatic: boolean;
  nextNoSuggestion: number;
  // 저장: draft/published 중 어느 상태로 저장할지. 호출측이 read-merge-write + newsStatus 동기화.
  onSave: (issue: SerializedNewsIssue, status: NewsStatus) => Promise<void>;
  // 삭제/되돌리기: 백엔드 사본 제거. 정적 호면 정적본으로 복귀.
  onDelete?: (issue: SerializedNewsIssue) => Promise<void>;
  onCancel: () => void;
}

// 미리보기 렌더러 — VillageNews 의 신문 프레임을 그대로 축약 복제(읽기 전용).
const NewsPreview: React.FC<{ issue: SerializedNewsIssue }> = ({ issue }) => {
  const t = issue.theme;
  const vars = {
    '--kd-news-paper': t.paper,
    '--kd-news-ink': t.ink,
    '--kd-news-spot': t.spot,
    '--kd-news-spot2': t.spot2 || t.spot,
    '--kd-news-headline-font': t.headlineFont || "'Noto Serif KR', 'Nanum Myeongjo', serif",
  } as React.CSSProperties;
  const hasTexture = t.texture !== 'none';
  return (
    <div className="kd-news kdne-preview-paper" style={vars}>
      <div className="kd-news-sheet">
        <header className="kdn-masthead">
          <span className="kdn-masthead-cut kdn-masthead-cut--owl" aria-hidden="true">
            <OwlCut className="kdn-cut-svg" />
          </span>
          <div className="kdn-masthead-center">
            <h1 className="kdn-masthead-title">{MASTHEAD.title}</h1>
            <p className="kdn-masthead-motto">{MASTHEAD.motto}</p>
          </div>
          <span className="kdn-masthead-cut kdn-masthead-cut--firefly" aria-hidden="true">
            <FireflyCut className="kdn-cut-svg" />
          </span>
        </header>
        <div className="kdn-folio">
          <p className="kdn-folio-line">{issue.dateline || '날짜줄을 입력하세요'}</p>
          <span className="kdn-folio-archive-label kdn-folio-only">제{issue.no}호</span>
        </div>
        <div className="kdn-grid">
          {issue.blocks.length === 0 ? (
            <p className="kdne-preview-empty">블록을 추가하면 여기에 지면이 나타납니다.</p>
          ) : (
            issue.blocks.map((block, i) => <NewsBlockView key={i} block={block} />)
          )}
        </div>
        <footer className="kdn-colophon">
          <span className="kdn-colophon-mark" aria-hidden="true">異素</span>
          <ul className="kdn-colophon-lines">
            {COLOPHON_LINES.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </footer>
      </div>
      {hasTexture && null}
    </div>
  );
};

// 작은 재사용 입력 컴포넌트들 ───────────────────────────────────────
const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="kdne-field">
    <span className="kdne-field-label">{label}</span>
    {children}
    {hint && <span className="kdne-field-hint">{hint}</span>}
  </label>
);

const OptionRow: React.FC<{
  block: SerializableBlock;
  onChange: (patch: Partial<SerializableBlock>) => void;
}> = ({ block, onChange }) => (
  <div className="kdne-optrow">
    <label className="kdne-opt">
      <span>폭</span>
      <select value={block.span || 'full'} onChange={(e) => onChange({ span: e.target.value as BlockSpan })}>
        {SPAN_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </label>
    <label className="kdne-opt">
      <span>면</span>
      <select value={block.tone || 'paper'} onChange={(e) => onChange({ tone: e.target.value as BlockTone })}>
        {TONE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </label>
    <label className="kdne-opt">
      <span>괘선</span>
      <select value={block.ruleTop || 'none'} onChange={(e) => onChange({ ruleTop: e.target.value as RuleTop })}>
        {RULE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </label>
  </div>
);

// ── 블록별 필드 폼 ───────────────────────────────────────────────
const BlockFields: React.FC<{
  block: SerializableBlock;
  onChange: (patch: Partial<SerializableBlock>) => void;
  onPickImages: (multiple: boolean, apply: (urls: string[]) => void) => void;
}> = ({ block, onChange, onPickImages }) => {
  switch (block.kind) {
    case 'topStory':
      return (
        <>
          <Field label="키커(분류)"><input value={block.kicker} onChange={(e) => onChange({ kicker: e.target.value })} /></Field>
          <Field label="헤드라인"><input value={block.headline} onChange={(e) => onChange({ headline: e.target.value })} /></Field>
          <Field label="데크(부제)"><input value={block.deck || ''} onChange={(e) => onChange({ deck: e.target.value })} /></Field>
          <Field label="리드문"><textarea rows={2} value={block.lead} onChange={(e) => onChange({ lead: e.target.value })} /></Field>
          <Field label="본문(한 줄 = 한 문단)" hint="엔터로 문단을 나눕니다.">
            <textarea rows={5} value={linesToText(block.body)} onChange={(e) => onChange({ body: textToLines(e.target.value) })} />
          </Field>
          <Field label="바이라인"><input value={block.byline || ''} onChange={(e) => onChange({ byline: e.target.value })} /></Field>
        </>
      );
    case 'article':
      return (
        <>
          <Field label="키커(분류)"><input value={block.kicker} onChange={(e) => onChange({ kicker: e.target.value })} /></Field>
          <Field label="헤드라인"><input value={block.headline} onChange={(e) => onChange({ headline: e.target.value })} /></Field>
          <Field label="데크(부제)"><input value={block.deck || ''} onChange={(e) => onChange({ deck: e.target.value })} /></Field>
          <Field label="바이라인"><input value={block.byline || ''} onChange={(e) => onChange({ byline: e.target.value })} /></Field>
          <div className="kdne-optrow">
            <label className="kdne-opt">
              <span>단수</span>
              <select value={block.columns || 2} onChange={(e) => onChange({ columns: Number(e.target.value) as 2 | 3 })}>
                <option value={2}>2단</option>
                <option value={3}>3단</option>
              </select>
            </label>
            <label className="kdne-opt kdne-opt--check">
              <input type="checkbox" checked={!!block.dropCap} onChange={(e) => onChange({ dropCap: e.target.checked })} />
              <span>드롭캡</span>
            </label>
          </div>
          <Field label="본문(한 줄 = 한 문단)" hint="엔터로 문단을 나눕니다.">
            <textarea rows={6} value={linesToText(block.body)} onChange={(e) => onChange({ body: textToLines(e.target.value) })} />
          </Field>
          <Field label="발췌 인용(선택)"><input value={block.pullQuote || ''} onChange={(e) => onChange({ pullQuote: e.target.value })} /></Field>
        </>
      );
    case 'verse':
      return (
        <>
          <Field label="키커(코너명)"><input value={block.kicker || ''} onChange={(e) => onChange({ kicker: e.target.value })} /></Field>
          <Field label="제목"><input value={block.title || ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
          <Field label="본문(한 줄 = 한 행)" hint="세로로 흐를 글. 엔터로 행을 나눕니다.">
            <textarea rows={6} value={linesToText(block.lines)} onChange={(e) => onChange({ lines: textToLines(e.target.value) })} />
          </Field>
          <Field label="맺음/출처"><input value={block.attribution || ''} onChange={(e) => onChange({ attribution: e.target.value })} /></Field>
        </>
      );
    case 'photoSpread':
      return (
        <>
          <div className="kdne-imglist">
            {block.images.map((img, i) => (
              <div key={i} className="kdne-imgrow">
                <img src={ikUrl(img.src, { w: 120 })} alt={img.alt} className="kdne-imgthumb" />
                <input className="kdne-imgalt" placeholder="설명(alt)" value={img.alt} onChange={(e) => {
                  const next = [...block.images]; next[i] = { ...next[i], alt: e.target.value }; onChange({ images: next });
                }} />
                <button type="button" className="kdne-mini-del" onClick={() => onChange({ images: block.images.filter((_, k) => k !== i) })}>삭제</button>
              </div>
            ))}
          </div>
          <button type="button" className="kdne-add-img" onClick={() => onPickImages(true, (urls) => {
            const add = urls.map((u) => ({ src: u, alt: '' }));
            onChange({ images: [...block.images, ...add] });
          })}>+ 사진 추가</button>
          <Field label="캡션"><input value={block.caption || ''} onChange={(e) => onChange({ caption: e.target.value })} /></Field>
          <Field label="크레딧"><input value={block.credit || ''} onChange={(e) => onChange({ credit: e.target.value })} /></Field>
        </>
      );
    case 'collage':
      return (
        <>
          <Field label="스크랩 제목"><input value={block.title || ''} onChange={(e) => onChange({ title: e.target.value })} /></Field>
          <div className="kdne-imglist">
            {block.items.map((it, i) => (
              <div key={i} className="kdne-imgrow">
                <img src={ikUrl(it.src, { w: 120 })} alt={it.alt} className="kdne-imgthumb" style={{ transform: `rotate(${it.rotate ?? 0}deg)` }} />
                <input className="kdne-imgalt" placeholder="설명(alt)" value={it.alt} onChange={(e) => {
                  const next = [...block.items]; next[i] = { ...next[i], alt: e.target.value }; onChange({ items: next });
                }} />
                <label className="kdne-imgrot">기울임
                  <input type="number" value={it.rotate ?? 0} onChange={(e) => {
                    const next = [...block.items]; next[i] = { ...next[i], rotate: Number(e.target.value) }; onChange({ items: next });
                  }} />°
                </label>
                <button type="button" className="kdne-mini-del" onClick={() => onChange({ items: block.items.filter((_, k) => k !== i) })}>삭제</button>
              </div>
            ))}
          </div>
          <button type="button" className="kdne-add-img" onClick={() => onPickImages(true, (urls) => {
            const add = urls.map((u, idx) => ({ src: u, alt: '', rotate: (idx % 2 === 0 ? -4 : 4) }));
            onChange({ items: [...block.items, ...add] });
          })}>+ 스크랩 추가</button>
          <Field label="캡션"><input value={block.caption || ''} onChange={(e) => onChange({ caption: e.target.value })} /></Field>
        </>
      );
    case 'programBoard':
      return (
        <>
          <Field label="공고란 제목"><input value={block.title} onChange={(e) => onChange({ title: e.target.value })} /></Field>
          <div className="kdne-notes">
            {block.notes.map((n, i) => (
              <div key={i} className="kdne-note">
                <div className="kdne-note-head">
                  <input className="kdne-note-no" placeholder="①" value={n.no} onChange={(e) => { const next = [...block.notes]; next[i] = { ...next[i], no: e.target.value }; onChange({ notes: next }); }} />
                  <input className="kdne-note-name" placeholder="〈프로그램명〉" value={n.name} onChange={(e) => { const next = [...block.notes]; next[i] = { ...next[i], name: e.target.value }; onChange({ notes: next }); }} />
                  <button type="button" className="kdne-mini-del" onClick={() => onChange({ notes: block.notes.filter((_, k) => k !== i) })}>삭제</button>
                </div>
                <div className="kdne-note-grid">
                  <input placeholder="분야" value={n.field} onChange={(e) => { const next = [...block.notes]; next[i] = { ...next[i], field: e.target.value }; onChange({ notes: next }); }} />
                  <input placeholder="대상/정원" value={n.target} onChange={(e) => { const next = [...block.notes]; next[i] = { ...next[i], target: e.target.value }; onChange({ notes: next }); }} />
                  <input placeholder="기간" value={n.period} onChange={(e) => { const next = [...block.notes]; next[i] = { ...next[i], period: e.target.value }; onChange({ notes: next }); }} />
                  <input placeholder="부기(선택)" value={n.extra || ''} onChange={(e) => { const next = [...block.notes]; next[i] = { ...next[i], extra: e.target.value }; onChange({ notes: next }); }} />
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="kdne-add-img" onClick={() => onChange({ notes: [...block.notes, { no: '', name: '〈 〉', field: '', target: '', period: '', extra: '' }] })}>+ 단신 추가</button>
          <Field label="공통 안내(푸터)"><input value={block.footer || ''} onChange={(e) => onChange({ footer: e.target.value })} /></Field>
        </>
      );
    case 'noticeBox':
      return (
        <>
          <Field label="라벨"><input value={block.label || ''} onChange={(e) => onChange({ label: e.target.value })} /></Field>
          <Field label="내용"><textarea rows={3} value={block.body} onChange={(e) => onChange({ body: e.target.value })} /></Field>
        </>
      );
    default: {
      const _ex: never = block;
      return _ex;
    }
  }
};

const NewsEditor: React.FC<NewsEditorProps> = ({
  initialIssue,
  isNew,
  isStatic,
  onSave,
  onDelete,
  onCancel,
}) => {
  const [issue, setIssue] = useState<SerializedNewsIssue>(() => clone(initialIssue));
  const [dirty, setDirty] = useState<boolean>(isNew);
  const [saving, setSaving] = useState<null | 'draft' | 'published'>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');
  const [addOpen, setAddOpen] = useState(false);
  const [customTheme, setCustomTheme] = useState(false);

  // 이미지 피커 상태(콜백 보관 — 어느 블록의 어느 필드에 적용할지).
  const [picker, setPicker] = useState<{ open: boolean; multiple: boolean; apply: (urls: string[]) => void }>(
    { open: false, multiple: false, apply: () => {} },
  );

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

  const patchIssue = useCallback((patch: Partial<SerializedNewsIssue>) => {
    setIssue((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    setFeedback(null);
  }, []);

  const patchTheme = useCallback((patch: Partial<NewsTheme>) => {
    setIssue((prev) => ({ ...prev, theme: { ...prev.theme, ...patch } }));
    setDirty(true);
    setFeedback(null);
  }, []);

  // ── 블록 조작 ────────────────────────────────────────────────
  const patchBlock = useCallback((idx: number, patch: Partial<SerializableBlock>) => {
    setIssue((prev) => {
      const blocks = prev.blocks.slice();
      blocks[idx] = { ...blocks[idx], ...patch } as SerializableBlock;
      return { ...prev, blocks };
    });
    setDirty(true);
    setFeedback(null);
  }, []);

  const addBlock = useCallback((kind: SerializableBlock['kind']) => {
    setIssue((prev) => ({ ...prev, blocks: [...prev.blocks, makeBlock(kind)] }));
    setDirty(true);
    setAddOpen(false);
    setFeedback(null);
  }, []);

  const moveBlock = useCallback((idx: number, dir: -1 | 1) => {
    setIssue((prev) => {
      const blocks = prev.blocks.slice();
      const j = idx + dir;
      if (j < 0 || j >= blocks.length) return prev;
      [blocks[idx], blocks[j]] = [blocks[j], blocks[idx]];
      return { ...prev, blocks };
    });
    setDirty(true);
  }, []);

  const dupBlock = useCallback((idx: number) => {
    setIssue((prev) => {
      const blocks = prev.blocks.slice();
      blocks.splice(idx + 1, 0, clone(blocks[idx]));
      return { ...prev, blocks };
    });
    setDirty(true);
  }, []);

  const delBlock = useCallback((idx: number) => {
    setIssue((prev) => ({ ...prev, blocks: prev.blocks.filter((_, k) => k !== idx) }));
    setDirty(true);
  }, []);

  // ── 이미지 피커 열기 ──────────────────────────────────────────
  const openPicker = useCallback((multiple: boolean, apply: (urls: string[]) => void) => {
    setPicker({ open: true, multiple, apply });
  }, []);

  // ── 저장 ──────────────────────────────────────────────────────
  const doSave = useCallback(
    async (status: NewsStatus) => {
      if (saving) return;
      // 최소 검증: 제목/호수.
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
        const toSave: SerializedNewsIssue = { ...clone(issue), status };
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

  // ── 삭제/되돌리기 ─────────────────────────────────────────────
  const doDelete = useCallback(async () => {
    if (!onDelete || deleting) return;
    const label = isStatic ? '이 호를 정적본(코드 내장)으로 되돌릴까요? 백엔드 편집 사본이 제거됩니다.' : '이 호를 삭제할까요? 되돌릴 수 없습니다.';
    if (typeof window !== 'undefined' && !window.confirm(label)) return;
    setDeleting(true);
    setFeedback(null);
    try {
      await onDelete(issue);
      // 성공 시 호출측이 리스트로 복귀시킨다.
    } catch (err: any) {
      if (err && err.code === 'KKUM_AUTH_EXPIRED') {
        setFeedback({ kind: 'err', msg: '인증이 만료되었습니다. 다시 로그인 후 시도해주세요.' });
      } else {
        setFeedback({ kind: 'err', msg: err?.message || '삭제에 실패했습니다.' });
      }
      setDeleting(false);
    }
  }, [onDelete, deleting, isStatic, issue]);

  const cancel = useCallback(() => {
    if (dirty && typeof window !== 'undefined') {
      if (!window.confirm('저장하지 않은 변경이 있습니다. 정말 나갈까요?')) return;
    }
    onCancel();
  }, [dirty, onCancel]);

  const activePresetKey = useMemo(() => {
    const t = issue.theme;
    const hit = THEME_PRESETS.find((p) => p.theme.paper === t.paper && p.theme.ink === t.ink && p.theme.spot === t.spot);
    return hit?.key ?? '';
  }, [issue.theme]);

  return (
    <div className="kdne">
      {/* ── 상단 액션바(편집국 책상 머리) ── */}
      <div className="kdne-bar">
        <div className="kdne-bar-left">
          <button type="button" className="kdne-back" onClick={cancel}>← 소식지 목록</button>
          <span className="kdne-bar-title">{isNew ? '새 소식지' : `제${issue.no}호 편집`}</span>
          {dirty && <span className="kdne-dirty">● 미저장</span>}
        </div>
        <div className="kdne-bar-actions">
          <button type="button" className="kdne-tab-toggle" onClick={() => setMobileTab((t) => (t === 'edit' ? 'preview' : 'edit'))}>
            {mobileTab === 'edit' ? '미리보기' : '편집으로'}
          </button>
          <button type="button" className="kdne-btn-save kdne-btn-draft" disabled={!!saving} onClick={() => doSave('draft')}>
            {saving === 'draft' ? '저장 중…' : '준비중으로 저장'}
          </button>
          <button type="button" className="kdne-btn-save kdne-btn-pub" disabled={!!saving} onClick={() => doSave('published')}>
            {saving === 'published' ? '발행 중…' : '발행'}
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`kdne-feedback ${feedback.kind === 'ok' ? 'is-ok' : 'is-err'}`} role={feedback.kind === 'err' ? 'alert' : 'status'}>
          {feedback.msg}
        </div>
      )}

      <div className={`kdne-split kdne-mobile-${mobileTab}`}>
        {/* ── 좌: 편집 폼 ── */}
        <div className="kdne-form" aria-label="소식지 편집">
          {/* 호 메타 */}
          <section className="kdne-section">
            <h3 className="kdne-section-title">호(號) 정보</h3>
            <div className="kdne-meta-grid">
              <Field label="호수">
                <input type="number" min={1} value={issue.no} onChange={(e) => patchIssue({ no: Number(e.target.value) })} />
              </Field>
              <Field label="제목">
                <input value={issue.title} onChange={(e) => patchIssue({ title: e.target.value })} />
              </Field>
            </div>
            <Field label="날짜줄(제호 아래 한 줄)" hint="예: 제2호 · 2026년 11월 · 충남 부여군 장암면">
              <input value={issue.dateline} onChange={(e) => patchIssue({ dateline: e.target.value })} />
            </Field>
          </section>

          {/* 테마 */}
          <section className="kdne-section">
            <h3 className="kdne-section-title">신문 무드(테마)</h3>
            <div className="kdne-presets">
              {THEME_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`kdne-preset${activePresetKey === p.key ? ' is-active' : ''}`}
                  onClick={() => { patchTheme({ ...p.theme }); setCustomTheme(false); }}
                  title={p.label}
                >
                  <span className="kdne-preset-swatch" style={{ background: p.theme.paper, borderColor: p.theme.ink }}>
                    <span style={{ background: p.theme.ink }} />
                    <span style={{ background: p.theme.spot }} />
                  </span>
                  <span className="kdne-preset-label">{p.label}</span>
                </button>
              ))}
            </div>
            <div className="kdne-theme-extra">
              <label className="kdne-opt kdne-opt--check">
                <input type="checkbox" checked={issue.theme.texture !== 'none'} onChange={(e) => patchTheme({ texture: e.target.checked ? 'newsprint' : 'none' })} />
                <span>종이결 질감</span>
              </label>
              <button type="button" className="kdne-custom-toggle" onClick={() => setCustomTheme((v) => !v)}>
                {customTheme ? '색 직접지정 닫기' : '색 직접지정'}
              </button>
            </div>
            {customTheme && (
              <div className="kdne-color-grid">
                <label className="kdne-color">바탕<input type="color" value={issue.theme.paper} onChange={(e) => patchTheme({ paper: e.target.value })} /></label>
                <label className="kdne-color">먹<input type="color" value={issue.theme.ink} onChange={(e) => patchTheme({ ink: e.target.value })} /></label>
                <label className="kdne-color">신호색<input type="color" value={issue.theme.spot} onChange={(e) => patchTheme({ spot: e.target.value })} /></label>
                <label className="kdne-color">보조색<input type="color" value={issue.theme.spot2 || issue.theme.spot} onChange={(e) => patchTheme({ spot2: e.target.value })} /></label>
              </div>
            )}
          </section>

          {/* 블록 편집기 */}
          <section className="kdne-section">
            <div className="kdne-blocks-head">
              <h3 className="kdne-section-title">지면 블록 ({issue.blocks.length})</h3>
              <div className="kdne-add-wrap">
                <button type="button" className="kdne-add-block" onClick={() => setAddOpen((v) => !v)}>+ 블록 추가</button>
                {addOpen && (
                  <div className="kdne-add-menu" role="menu">
                    {EDITABLE_BLOCK_KINDS.map((k) => (
                      <button key={k} type="button" className="kdne-add-item" role="menuitem" onClick={() => addBlock(k)}>
                        <span className="kdne-add-name">{BLOCK_KIND_META[k].label}</span>
                        <span className="kdne-add-hint">{BLOCK_KIND_META[k].hint}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {issue.blocks.length === 0 && (
              <p className="kdne-empty-blocks">아직 블록이 없습니다. 「+ 블록 추가」로 지면을 짜보세요.</p>
            )}

            <ol className="kdne-block-list">
              {issue.blocks.map((block, i) => (
                <li key={i} className="kdne-block-card">
                  <div className="kdne-block-head">
                    <span className="kdne-block-kind">{BLOCK_KIND_META[block.kind].label}</span>
                    <div className="kdne-block-tools">
                      <button type="button" title="위로" disabled={i === 0} onClick={() => moveBlock(i, -1)}>↑</button>
                      <button type="button" title="아래로" disabled={i === issue.blocks.length - 1} onClick={() => moveBlock(i, 1)}>↓</button>
                      <button type="button" title="복제" onClick={() => dupBlock(i)}>복제</button>
                      <button type="button" title="삭제" className="kdne-block-del" onClick={() => delBlock(i)}>삭제</button>
                    </div>
                  </div>
                  <OptionRow block={block} onChange={(patch) => patchBlock(i, patch)} />
                  <div className="kdne-block-fields">
                    <BlockFields block={block} onChange={(patch) => patchBlock(i, patch)} onPickImages={openPicker} />
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* 위험 구역: 삭제/되돌리기 */}
          {!isNew && onDelete && (
            <section className="kdne-section kdne-danger">
              <button type="button" className="kdne-delete" disabled={deleting} onClick={doDelete}>
                {deleting ? '처리 중…' : isStatic ? '정적본으로 되돌리기' : '이 호 삭제'}
              </button>
              <p className="kdne-danger-hint">
                {isStatic
                  ? '백엔드 편집 사본을 제거하고 코드에 내장된 원본 호로 복귀합니다.'
                  : '이 호를 영구히 삭제합니다.'}
              </p>
            </section>
          )}
        </div>

        {/* ── 우: 실시간 미리보기 ── */}
        <div className="kdne-preview" aria-label="실시간 미리보기">
          <div className="kdne-preview-label">실시간 미리보기</div>
          <div className="kdne-preview-scroll">
            <NewsPreview issue={issue} />
          </div>
        </div>
      </div>

      <ImageKitPicker
        open={picker.open}
        multiple={picker.multiple}
        title="신문 이미지 선택"
        onClose={() => setPicker((p) => ({ ...p, open: false }))}
        onSelect={(urls) => {
          picker.apply(urls);
          setDirty(true);
          setFeedback(null);
        }}
      />
    </div>
  );
};

export default NewsEditor;
