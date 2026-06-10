// ═══════════════════════════════════════════════════════════════
// FreeformCanvas — 자유 배치(자유 캔버스) 블록 편집기
//   · 이미지/텍스트/도형을 캔버스 안에서 드래그 이동·핸들 리사이즈.
//   · z-index 앞/뒤, 회전, 불투명도 조절.
//   · 좌표/크기는 캔버스 대비 % 로 저장 → 반응형으로 스케일.
// ═══════════════════════════════════════════════════════════════

import React, { useCallback, useRef, useState } from 'react';
import { FreeformBlock, FreeItem } from './blockTypes';
import { emptyFreeItem } from './htmlSerialize';

interface FreeformCanvasProps {
  block: FreeformBlock;
  onChange: (block: FreeformBlock) => void;
  onPickImage: (cb: (url: string) => void) => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const FreeformCanvas: React.FC<FreeformCanvasProps> = ({ block, onChange, onPickImage }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragState = useRef<{
    id: string;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    orig: FreeItem;
    rect: DOMRect;
  } | null>(null);

  const updateItem = useCallback(
    (id: string, patch: Partial<FreeItem>) => {
      onChange({
        ...block,
        items: block.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      });
    },
    [block, onChange]
  );

  const addItem = (kind: FreeItem['kind']) => {
    const item = emptyFreeItem(kind);
    item.z = (block.items.reduce((m, i) => Math.max(m, i.z), 0) || 0) + 1;
    if (kind === 'image') {
      onPickImage((url) => {
        item.src = url;
        onChange({ ...block, items: [...block.items, item] });
        setSelectedId(item.id);
      });
      return;
    }
    onChange({ ...block, items: [...block.items, item] });
    setSelectedId(item.id);
  };

  const removeItem = (id: string) => {
    onChange({ ...block, items: block.items.filter((it) => it.id !== id) });
    setSelectedId(null);
  };

  const onPointerDown = (e: React.PointerEvent, item: FreeItem, mode: 'move' | 'resize') => {
    e.stopPropagation();
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectedId(item.id);
    dragState.current = {
      id: item.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...item },
      rect,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds) return;
    const dxPct = ((e.clientX - ds.startX) / ds.rect.width) * 100;
    const dyPct = ((e.clientY - ds.startY) / ds.rect.height) * 100;
    if (ds.mode === 'move') {
      updateItem(ds.id, {
        x: clamp(ds.orig.x + dxPct, 0, 100 - ds.orig.w),
        y: clamp(ds.orig.y + dyPct, 0, 100 - ds.orig.h),
      });
    } else {
      updateItem(ds.id, {
        w: clamp(ds.orig.w + dxPct, 5, 100 - ds.orig.x),
        h: clamp(ds.orig.h + dyPct, 5, 100 - ds.orig.y),
      });
    }
  };

  const onPointerUp = () => {
    dragState.current = null;
  };

  const selected = block.items.find((it) => it.id === selectedId) || null;

  const bringForward = () => {
    if (!selected) return;
    const maxZ = block.items.reduce((m, i) => Math.max(m, i.z), 0);
    updateItem(selected.id, { z: maxZ + 1 });
  };
  const sendBackward = () => {
    if (!selected) return;
    const minZ = block.items.reduce((m, i) => Math.min(m, i.z), 0);
    updateItem(selected.id, { z: minZ - 1 });
  };

  return (
    <div className="bk-free-wrap">
      <div className="bk-free-toolbar">
        <button type="button" className="bk-mini-btn" onClick={() => addItem('image')}>
          + 이미지
        </button>
        <button type="button" className="bk-mini-btn" onClick={() => addItem('text')}>
          + 텍스트
        </button>
        <button type="button" className="bk-mini-btn" onClick={() => addItem('shape')}>
          + 도형
        </button>
        <label className="bk-mini-label">
          비율
          <input
            type="range"
            min={0.3}
            max={1.2}
            step={0.05}
            value={block.ratio}
            onChange={(e) => onChange({ ...block, ratio: Number(e.target.value) })}
          />
        </label>
      </div>

      <div
        ref={canvasRef}
        className="bk-free-canvas"
        style={{ paddingBottom: `${block.ratio * 100}%`, background: block.background || '#fafafa' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => setSelectedId(null)}
      >
        {block.items.map((it) => (
          <div
            key={it.id}
            className={`bk-free-item ${selectedId === it.id ? 'sel' : ''}`}
            style={{
              left: `${it.x}%`,
              top: `${it.y}%`,
              width: `${it.w}%`,
              height: `${it.h}%`,
              zIndex: it.z,
              opacity: it.opacity ?? 1,
              transform: `rotate(${it.rotation || 0}deg)`,
            }}
            onPointerDown={(e) => onPointerDown(e, it, 'move')}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedId(it.id);
            }}
          >
            {it.kind === 'image' && it.src && (
              <img src={it.src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} />
            )}
            {it.kind === 'text' && (
              <div
                className="bk-free-text"
                contentEditable
                suppressContentEditableWarning
                style={{ color: it.color || '#222' }}
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={(e) => updateItem(it.id, { html: (e.target as HTMLElement).innerHTML })}
                dangerouslySetInnerHTML={{ __html: it.html || '' }}
              />
            )}
            {it.kind === 'shape' && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: it.color || '#222',
                  borderRadius: it.shape === 'circle' ? '50%' : 0,
                }}
              />
            )}
            {selectedId === it.id && (
              <span className="bk-free-handle" onPointerDown={(e) => onPointerDown(e, it, 'resize')} />
            )}
          </div>
        ))}
      </div>

      {selected && (
        <div className="bk-free-inspector">
          <span className="bk-insp-title">선택 항목</span>
          <div className="bk-insp-row">
            <button type="button" className="bk-mini-btn" onClick={bringForward}>
              앞으로
            </button>
            <button type="button" className="bk-mini-btn" onClick={sendBackward}>
              뒤로
            </button>
            <button type="button" className="bk-mini-btn danger" onClick={() => removeItem(selected.id)}>
              삭제
            </button>
          </div>
          <label className="bk-insp-label">
            회전 {selected.rotation || 0}°
            <input
              type="range"
              min={-180}
              max={180}
              value={selected.rotation || 0}
              onChange={(e) => updateItem(selected.id, { rotation: Number(e.target.value) })}
            />
          </label>
          <label className="bk-insp-label">
            불투명도 {Math.round((selected.opacity ?? 1) * 100)}%
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={selected.opacity ?? 1}
              onChange={(e) => updateItem(selected.id, { opacity: Number(e.target.value) })}
            />
          </label>
          {(selected.kind === 'shape' || selected.kind === 'text') && (
            <label className="bk-insp-label">
              색상
              <input
                type="color"
                value={selected.color || '#222222'}
                onChange={(e) => updateItem(selected.id, { color: e.target.value })}
              />
            </label>
          )}
          {selected.kind === 'shape' && (
            <label className="bk-insp-label">
              모양
              <select
                value={selected.shape || 'rect'}
                onChange={(e) => updateItem(selected.id, { shape: e.target.value as any })}
              >
                <option value="rect">사각형</option>
                <option value="circle">원</option>
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
};

export default FreeformCanvas;
