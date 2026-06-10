// ═══════════════════════════════════════════════════════════════
// BlockEditor — 공용 블록 기반 WYSIWYG 에디터
//   글 등록/수정이 있는 모든 페이지(Work·Commons·About)가 공유한다.
//
//   · value(HTML) ↔ blocks 양방향. 외부에는 항상 HTML(contents)로 보고.
//   · 블록 추가(+/슬래시) · 삭제 · 복제 · 드래그 순서변경(@dnd-kit).
//   · 텍스트 인라인 서식, 이미지(ImageKit 피커), 갤러리, 영상, 도형, 공백,
//     템플릿 프리셋, 자유 캔버스.
//   · undo/redo(Ctrl+Z/Y), 변경 시 onChange(html) 콜백.
// ═══════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Block,
  GalleryLayout,
  TextTag,
  createBlock,
  newId,
  resolveVideo,
} from './blockTypes';
import {
  blocksToHtml,
  htmlToBlocks,
  emptyGalleryItems,
} from './htmlSerialize';
import { ikUrl } from '../../utils/ikUrl';
import ImageKitPicker from './ImageKitPicker';
import InlineText, { InlineApi } from './InlineText';
import FreeformCanvas from './FreeformCanvas';
import './BlockEditor.css';

interface BlockEditorProps {
  value: string; // HTML(contents)
  onChange: (html: string) => void;
  placeholder?: string;
}

const COLORS = [
  '#000000', '#333333', '#666666', '#999999',
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71',
  '#3498db', '#9b59b6', '#1abc9c', '#e91e63',
];

const TEXT_TAGS: { tag: TextTag; label: string }[] = [
  { tag: 'p', label: '본문' },
  { tag: 'h1', label: '제목 1' },
  { tag: 'h2', label: '제목 2' },
  { tag: 'h3', label: '제목 3' },
  { tag: 'blockquote', label: '인용' },
  { tag: 'ul', label: '목록 •' },
  { tag: 'ol', label: '목록 1.' },
];

const TEMPLATES: { layout: GalleryLayout; label: string; count: number; hasText: boolean }[] = [
  { layout: 'grid2', label: '그리드 2열', count: 4, hasText: false },
  { layout: 'grid3', label: '그리드 3열', count: 6, hasText: false },
  { layout: 'masonry', label: '메이슨리', count: 6, hasText: false },
  { layout: 'carousel', label: '캐러셀', count: 4, hasText: false },
  { layout: 'hero', label: '히어로+텍스트', count: 1, hasText: true },
  { layout: 'split', label: '스플릿(좌이미지/우텍스트)', count: 1, hasText: true },
];

// ───────────────────────── Sortable wrapper ─────────────────────────
const SortableBlock: React.FC<{ id: string; children: (handleProps: any) => React.ReactNode }> = ({
  id,
  children,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="bk-block">
      {children({ ...attributes, ...listeners })}
    </div>
  );
};

const BlockEditor: React.FC<BlockEditorProps> = ({ value, onChange, placeholder }) => {
  const [blocks, setBlocks] = useState<Block[]>(() => htmlToBlocks(value));
  const [addMenuAt, setAddMenuAt] = useState<number | null>(null);
  const [tplMenuAt, setTplMenuAt] = useState<number | null>(null);
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const inlineApiRef = useRef<InlineApi | null>(null);

  // 이미지 피커 상태
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMultiple, setPickerMultiple] = useState(false);
  const pickerCb = useRef<((urls: string[]) => void) | null>(null);

  // undo/redo
  const history = useRef<Block[][]>([htmlToBlocks(value)]);
  const histIndex = useRef(0);
  const skipPush = useRef(false);

  // 우리가 마지막으로 onChange 로 내보낸 HTML. 부모가 이 값을 그대로 value 로
  // 되돌려줄 때(자기 출력의 에코)는 재초기화하지 않아야 히스토리가 보존된다.
  const lastEmittedRef = useRef(value);
  // 외부 value 가 "우리 출력이 아닌" 값으로 바뀌면(편집 대상 변경) 재초기화.
  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      const next = htmlToBlocks(value);
      setBlocks(next);
      history.current = [next];
      histIndex.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // onChange 래퍼 — 내보낸 값을 기억해 위 에코 가드가 동작하게 한다.
  const emit = useCallback(
    (html: string) => {
      lastEmittedRef.current = html;
      onChange(html);
    },
    [onChange]
  );

  // 블록 변경 → HTML 보고 + 히스토리 푸시
  const commit = useCallback(
    (next: Block[], pushHistory = true) => {
      setBlocks(next);
      if (pushHistory && !skipPush.current) {
        const trimmed = history.current.slice(0, histIndex.current + 1);
        trimmed.push(next);
        // 최대 100단계
        if (trimmed.length > 100) trimmed.shift();
        history.current = trimmed;
        histIndex.current = trimmed.length - 1;
      }
      emit(blocksToHtml(next));
    },
    [emit]
  );

  const undo = useCallback(() => {
    if (histIndex.current > 0) {
      histIndex.current -= 1;
      const prev = history.current[histIndex.current];
      skipPush.current = true;
      setBlocks(prev);
      emit(blocksToHtml(prev));
      skipPush.current = false;
    }
  }, [emit]);

  const redo = useCallback(() => {
    if (histIndex.current < history.current.length - 1) {
      histIndex.current += 1;
      const next = history.current[histIndex.current];
      skipPush.current = true;
      setBlocks(next);
      emit(blocksToHtml(next));
      skipPush.current = false;
    }
  }, [emit]);

  // Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex((b) => b.id === active.id);
    const newIdx = blocks.findIndex((b) => b.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    commit(arrayMove(blocks, oldIdx, newIdx));
  };

  // ───── 블록 조작 ─────
  const insertBlock = (block: Block, at: number) => {
    const next = [...blocks];
    next.splice(at, 0, block);
    commit(next);
  };
  const updateBlock = (id: string, patch: Partial<Block>, pushHistory = true) => {
    commit(
      blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)),
      pushHistory
    );
  };
  const replaceBlock = (id: string, block: Block) => {
    commit(blocks.map((b) => (b.id === id ? block : b)));
  };
  const removeBlock = (id: string) => commit(blocks.filter((b) => b.id !== id));
  const duplicateBlock = (id: string) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const copy = JSON.parse(JSON.stringify(blocks[idx])) as Block;
    copy.id = newId();
    const next = [...blocks];
    next.splice(idx + 1, 0, copy);
    commit(next);
  };

  // ───── 이미지 피커 호출 ─────
  const openPicker = (cb: (urls: string[]) => void, multiple = false) => {
    pickerCb.current = cb;
    setPickerMultiple(multiple);
    setPickerOpen(true);
  };
  const handlePickerSelect = (urls: string[]) => {
    pickerCb.current?.(urls);
  };

  // ───── 블록 추가 메뉴 ─────
  const addOptions: { type: Block['type']; label: string }[] = [
    { type: 'text', label: '텍스트' },
    { type: 'image', label: '이미지' },
    { type: 'gallery', label: '갤러리' },
    { type: 'video', label: '영상' },
    { type: 'shape', label: '도형/구분선' },
    { type: 'spacer', label: '공백' },
    { type: 'freeform', label: '자유 캔버스' },
  ];

  const handleAdd = (type: Block['type'], at: number) => {
    const block = createBlock(type);
    if (type === 'image') {
      openPicker((urls) => {
        if (urls[0]) {
          (block as any).src = urls[0];
          insertBlock(block, at);
        }
      });
      setAddMenuAt(null);
      return;
    }
    insertBlock(block, at);
    setAddMenuAt(null);
  };

  const handleTemplate = (layout: GalleryLayout, at: number) => {
    const tpl = TEMPLATES.find((t) => t.layout === layout)!;
    const block = createBlock('gallery') as any;
    block.layout = layout;
    block.items = emptyGalleryItems(tpl.count);
    if (tpl.hasText) block.text = '<p>텍스트를 입력하세요</p>';
    insertBlock(block, at);
    setTplMenuAt(null);
  };

  // 닫기: 외부 클릭 시 메뉴/색상 닫기
  useEffect(() => {
    const close = () => {
      setAddMenuAt(null);
      setTplMenuAt(null);
      setColorPickerFor(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // ───────────────────────── 블록 렌더러 ─────────────────────────
  const renderBlockBody = (block: Block) => {
    switch (block.type) {
      case 'text':
        return (
          <div className="bk-text-block">
            <div className="bk-text-controls" onClick={stop}>
              <select
                value={block.tag}
                onChange={(e) => updateBlock(block.id, { tag: e.target.value as TextTag })}
                className="bk-mini-select"
              >
                {TEXT_TAGS.map((t) => (
                  <option key={t.tag} value={t.tag}>
                    {t.label}
                  </option>
                ))}
              </select>
              <button type="button" className="bk-fmt" onMouseDown={(e) => e.preventDefault()} onClick={() => inlineApiRef.current?.exec('bold')}>
                <strong>B</strong>
              </button>
              <button type="button" className="bk-fmt" onMouseDown={(e) => e.preventDefault()} onClick={() => inlineApiRef.current?.exec('italic')}>
                <em>I</em>
              </button>
              <button type="button" className="bk-fmt" onMouseDown={(e) => e.preventDefault()} onClick={() => inlineApiRef.current?.exec('underline')}>
                <u>U</u>
              </button>
              <button
                type="button"
                className="bk-fmt"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const url = prompt('링크 URL:');
                  if (url) inlineApiRef.current?.exec('createLink', url);
                }}
              >
                🔗
              </button>
              <select
                className="bk-mini-select"
                defaultValue=""
                onMouseDown={(e) => e.preventDefault()}
                onChange={(e) => {
                  if (e.target.value) inlineApiRef.current?.exec('fontSize', e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">크기</option>
                <option value="2">작게</option>
                <option value="3">보통</option>
                <option value="4">크게</option>
                <option value="5">매우 크게</option>
              </select>
              <div className="bk-color-wrap">
                <button
                  type="button"
                  className="bk-fmt"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setColorPickerFor(colorPickerFor === block.id ? null : block.id);
                  }}
                >
                  색
                </button>
                {colorPickerFor === block.id && (
                  <div className="bk-color-pop" onClick={stop}>
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="bk-color-sw"
                        style={{ background: c }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          inlineApiRef.current?.exec('foreColor', c);
                          setColorPickerFor(null);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="bk-align-group">
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`bk-fmt ${block.align === a ? 'on' : ''}`}
                    onClick={() => updateBlock(block.id, { align: a })}
                  >
                    {a === 'left' ? '좌' : a === 'center' ? '중' : '우'}
                  </button>
                ))}
              </div>
            </div>
            <InlineText
              html={block.html}
              tag={block.tag}
              align={block.align}
              placeholder={placeholder}
              onCommit={(html) => updateBlock(block.id, { html }, false)}
              onFocusToolbar={(api) => {
                inlineApiRef.current = api;
              }}
            />
          </div>
        );

      case 'image':
        return (
          <div className="bk-image-block" style={{ textAlign: block.align || 'center' }}>
            {block.src ? (
              <>
                <img
                  src={ikUrl(block.src, { w: 1200 })}
                  alt={block.alt || ''}
                  style={{ width: block.width ? `${block.width}%` : '100%', maxWidth: '100%' }}
                />
                <input
                  className="bk-caption-input"
                  placeholder="캡션(선택)"
                  value={block.caption || ''}
                  onClick={stop}
                  onChange={(e) => updateBlock(block.id, { caption: e.target.value }, false)}
                />
                <div className="bk-img-controls" onClick={stop}>
                  <button type="button" className="bk-mini-btn" onClick={() => openPicker((urls) => urls[0] && updateBlock(block.id, { src: urls[0] }))}>
                    교체
                  </button>
                  <label className="bk-mini-label">
                    폭 {block.width || 100}%
                    <input
                      type="range"
                      min={20}
                      max={100}
                      value={block.width || 100}
                      onChange={(e) => updateBlock(block.id, { width: Number(e.target.value) }, false)}
                    />
                  </label>
                  <div className="bk-align-group">
                    {(['left', 'center', 'right'] as const).map((a) => (
                      <button key={a} type="button" className={`bk-fmt ${block.align === a ? 'on' : ''}`} onClick={() => updateBlock(block.id, { align: a })}>
                        {a === 'left' ? '좌' : a === 'center' ? '중' : '우'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <button type="button" className="bk-placeholder" onClick={() => openPicker((urls) => urls[0] && updateBlock(block.id, { src: urls[0] }))}>
                + 이미지 선택
              </button>
            )}
          </div>
        );

      case 'gallery':
        return (
          <div className="bk-gallery-block" onClick={stop}>
            <div className="bk-gallery-head">
              <select
                className="bk-mini-select"
                value={block.layout}
                onChange={(e) => updateBlock(block.id, { layout: e.target.value as GalleryLayout })}
              >
                {TEMPLATES.map((t) => (
                  <option key={t.layout} value={t.layout}>
                    {t.label}
                  </option>
                ))}
              </select>
              {(block.layout === 'grid2' ||
                block.layout === 'grid3' ||
                block.layout === 'masonry' ||
                block.layout === 'carousel') && (
                <button
                  type="button"
                  className="bk-mini-btn"
                  onClick={() =>
                    openPicker((urls) => {
                      const items = [...block.items, ...urls.map((u) => ({ src: u, alt: '', caption: '' }))];
                      updateBlock(block.id, { items });
                    }, true)
                  }
                >
                  + 이미지 추가
                </button>
              )}
              {block.layout === 'split' && (
                <button type="button" className="bk-mini-btn" onClick={() => updateBlock(block.id, { reversed: !block.reversed })}>
                  좌우 반전
                </button>
              )}
            </div>
            <div className={`bk-gallery-preview bk-prev-${block.layout}`}>
              {block.items.map((it, i) => (
                <div key={i} className="bk-gallery-cell">
                  {it.src ? (
                    <img src={ikUrl(it.src, { w: 400 })} alt="" />
                  ) : (
                    <button
                      type="button"
                      className="bk-cell-placeholder"
                      onClick={() => openPicker((urls) => {
                        if (urls[0]) {
                          const items = block.items.map((x, xi) => (xi === i ? { ...x, src: urls[0] } : x));
                          updateBlock(block.id, { items });
                        }
                      })}
                    >
                      +
                    </button>
                  )}
                  {it.src && (
                    <button
                      type="button"
                      className="bk-cell-remove"
                      onClick={() => updateBlock(block.id, { items: block.items.filter((_, xi) => xi !== i) })}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {(block.layout === 'split' || block.layout === 'hero') && (
              <div className="bk-gallery-text">
                <InlineText
                  html={block.text || ''}
                  tag="div"
                  placeholder="텍스트 영역"
                  onCommit={(html) => updateBlock(block.id, { text: html }, false)}
                  onFocusToolbar={(api) => {
                    inlineApiRef.current = api;
                  }}
                />
              </div>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="bk-video-block" onClick={stop} style={{ textAlign: block.align || 'center' }}>
            <div className="bk-video-input">
              <input
                type="url"
                placeholder="YouTube / Vimeo / 영상 URL"
                value={block.url}
                onChange={(e) => {
                  const url = e.target.value;
                  const { provider, embedSrc } = resolveVideo(url);
                  updateBlock(block.id, { url, provider, embedSrc }, false);
                }}
              />
            </div>
            {block.embedSrc ? (
              <div
                className="bk-video-frame"
                style={{ width: block.width ? `${block.width}%` : '100%', margin: '0 auto' }}
              >
                {block.provider === 'file' ? (
                  <video src={block.embedSrc} controls />
                ) : (
                  <iframe src={block.embedSrc} title="video" frameBorder="0" allowFullScreen />
                )}
              </div>
            ) : (
              <div className="bk-placeholder bk-placeholder-static">URL을 입력하면 미리보기가 표시됩니다</div>
            )}
            {block.embedSrc && (
              <div className="bk-img-controls">
                <label className="bk-mini-label">
                  폭 {block.width || 100}%
                  <input type="range" min={30} max={100} value={block.width || 100} onChange={(e) => updateBlock(block.id, { width: Number(e.target.value) }, false)} />
                </label>
                <div className="bk-align-group">
                  {(['left', 'center', 'right'] as const).map((a) => (
                    <button key={a} type="button" className={`bk-fmt ${block.align === a ? 'on' : ''}`} onClick={() => updateBlock(block.id, { align: a })}>
                      {a === 'left' ? '좌' : a === 'center' ? '중' : '우'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'shape':
        return (
          <div className="bk-shape-block" onClick={stop} style={{ textAlign: block.align || 'center' }}>
            <div className="bk-shape-preview">
              {block.kind === 'divider' || block.kind === 'line' ? (
                <hr style={{ border: 'none', borderTop: `${block.size || 1}px solid ${block.color || '#222'}`, width: '60%', margin: '12px auto' }} />
              ) : (
                <div
                  style={{
                    width: block.size || 60,
                    height: block.size || 60,
                    background: block.color || '#222',
                    borderRadius: block.kind === 'circle' ? '50%' : 0,
                    display: 'inline-block',
                  }}
                />
              )}
            </div>
            <div className="bk-img-controls">
              <select className="bk-mini-select" value={block.kind} onChange={(e) => updateBlock(block.id, { kind: e.target.value as any })}>
                <option value="divider">구분선</option>
                <option value="line">선</option>
                <option value="rect">사각형</option>
                <option value="circle">원</option>
              </select>
              <input type="color" value={block.color || '#222222'} onChange={(e) => updateBlock(block.id, { color: e.target.value }, false)} />
              <label className="bk-mini-label">
                크기 {block.size || 1}
                <input
                  type="range"
                  min={1}
                  max={block.kind === 'divider' || block.kind === 'line' ? 12 : 300}
                  value={block.size || 1}
                  onChange={(e) => updateBlock(block.id, { size: Number(e.target.value) }, false)}
                />
              </label>
            </div>
          </div>
        );

      case 'spacer':
        return (
          <div className="bk-spacer-block" onClick={stop}>
            <div className="bk-spacer-bar" style={{ height: block.height }}>
              <span>공백 {block.height}px</span>
            </div>
            <input
              type="range"
              min={8}
              max={240}
              value={block.height}
              onChange={(e) => updateBlock(block.id, { height: Number(e.target.value) }, false)}
            />
          </div>
        );

      case 'freeform':
        return (
          <div onClick={stop}>
            <FreeformCanvas
              block={block}
              onChange={(b) => replaceBlock(block.id, b)}
              onPickImage={(cb) => openPicker((urls) => urls[0] && cb(urls[0]))}
            />
          </div>
        );

      case 'html':
      default:
        return (
          <div className="bk-html-block" onClick={stop}>
            <div className="bk-html-badge">레거시 HTML 블록 (원본 보존)</div>
            <div className="bk-html-preview" dangerouslySetInnerHTML={{ __html: (block as any).html }} />
          </div>
        );
    }
  };

  // 블록 사이/끝의 추가 버튼 행
  const renderInserter = (at: number) => (
    <div className="bk-inserter" onClick={stop}>
      <div className="bk-inserter-line" />
      <div className="bk-inserter-actions">
        <div className="bk-add-wrap">
          <button
            type="button"
            className="bk-add-btn"
            onClick={(e) => {
              e.stopPropagation();
              setAddMenuAt(addMenuAt === at ? null : at);
              setTplMenuAt(null);
            }}
          >
            + 블록
          </button>
          {addMenuAt === at && (
            <div className="bk-menu" onClick={stop}>
              {addOptions.map((o) => (
                <button key={o.type} type="button" className="bk-menu-item" onClick={() => handleAdd(o.type, at)}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="bk-add-wrap">
          <button
            type="button"
            className="bk-add-btn ghost"
            onClick={(e) => {
              e.stopPropagation();
              setTplMenuAt(tplMenuAt === at ? null : at);
              setAddMenuAt(null);
            }}
          >
            템플릿
          </button>
          {tplMenuAt === at && (
            <div className="bk-menu" onClick={stop}>
              {TEMPLATES.map((t) => (
                <button key={t.layout} type="button" className="bk-menu-item" onClick={() => handleTemplate(t.layout, at)}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks]);

  return (
    <div className="bk-editor">
      <div className="bk-global-toolbar">
        <button type="button" className="bk-tool" onClick={undo} title="실행 취소 (Ctrl+Z)">
          ↶ 취소
        </button>
        <button type="button" className="bk-tool" onClick={redo} title="다시 실행 (Ctrl+Y)">
          ↷ 다시
        </button>
        <span className="bk-tool-hint">블록을 드래그해 순서를 바꿀 수 있습니다</span>
      </div>

      {renderInserter(0)}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
          {blocks.map((block, idx) => (
            <React.Fragment key={block.id}>
              <SortableBlock id={block.id}>
                {(handleProps) => (
                  <div className="bk-block-inner">
                    <div className="bk-block-side">
                      <button type="button" className="bk-handle" {...handleProps} title="드래그하여 이동">
                        ⠿
                      </button>
                      <button type="button" className="bk-side-btn" onClick={() => duplicateBlock(block.id)} title="복제">
                        ⎘
                      </button>
                      <button type="button" className="bk-side-btn danger" onClick={() => removeBlock(block.id)} title="삭제">
                        ×
                      </button>
                    </div>
                    <div className="bk-block-content">{renderBlockBody(block)}</div>
                  </div>
                )}
              </SortableBlock>
              {renderInserter(idx + 1)}
            </React.Fragment>
          ))}
        </SortableContext>
      </DndContext>

      {blocks.length === 0 && (
        <div className="bk-empty-hint">위의 “+ 블록” 또는 “템플릿”으로 내용을 추가하세요.</div>
      )}

      <ImageKitPicker
        open={pickerOpen}
        multiple={pickerMultiple}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
      />
    </div>
  );
};

export default BlockEditor;
