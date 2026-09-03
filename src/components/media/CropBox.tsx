// ═══════════════════════════════════════════════════════════════
// CropBox — 미리보기 위에 얹는 크롭 선택 영역
//   · 정규화 좌표(0~1)로만 다룬다 → 프리뷰 크기·기기와 무관하게 동일 결과.
//   · Pointer Events 하나로 마우스/터치를 함께 처리한다(모바일 필수).
//   · 비율 프리셋이 걸리면 세로를 가로에 맞춰 강제한다(컨테이너 종횡비 보정 포함).
//   · 드래그 중 스크롤이 따라 움직이지 않도록 touch-action:none(CSS)을 건다.
// ═══════════════════════════════════════════════════════════════

import React, { useCallback, useRef } from 'react';
import { CropRect } from '../../utils/imageEdit';

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move' | 'new';

export interface CropBoxProps {
  rect: CropRect;
  onChange: (r: CropRect) => void;
  /** 가로/세로 비율(예: 16/9). null 이면 자유 */
  ratio: number | null;
  /** 프리뷰 요소의 실제 표시 종횡비(가로/세로) — 비율 계산 보정에 필요 */
  boxAspect: number;
  disabled?: boolean;
}

const MIN = 0.04; // 최소 4%

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

const CropBox: React.FC<CropBoxProps> = ({ rect, onChange, ratio, boxAspect, disabled }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: Handle; startX: number; startY: number; start: CropRect } | null>(null);

  const toLocal = useCallback((clientX: number, clientY: number) => {
    const el = wrapRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: clamp((clientX - r.left) / Math.max(1, r.width), 0, 1),
      y: clamp((clientY - r.top) / Math.max(1, r.height), 0, 1),
    };
  }, []);

  // 비율 고정: 정규화 좌표에서의 세로 = 가로 * (boxAspect / ratio)
  //   (정규화계는 가로/세로가 각각 1이라 실제 픽셀 비율을 boxAspect 로 보정해야 한다)
  const heightFor = useCallback(
    (w: number) => (ratio ? clamp((w * boxAspect) / ratio, MIN, 1) : null),
    [ratio, boxAspect]
  );

  const applyRatio = useCallback(
    (r: CropRect, anchor: 'nw' | 'ne' | 'sw' | 'se' | 'center'): CropRect => {
      const h = heightFor(r.w);
      if (h == null) return r;
      let y = r.y;
      if (anchor === 'sw' || anchor === 'se') y = r.y + r.h - h; // 아래를 고정
      else if (anchor === 'center') y = r.y + r.h / 2 - h / 2;
      y = clamp(y, 0, 1 - h);
      return { ...r, y, h };
    },
    [heightFor]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent, handle: Handle) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const p = toLocal(e.clientX, e.clientY);
      // 선택 영역이 전체(초기 상태)면 안쪽을 잡아도 '이동'이 불가능하다(움직일 여백이 0).
      // 이때는 새 선택 시작으로 해석한다 — 실측에서 "드래그해도 아무 일이 없는" 문제로 드러났다.
      const isFull = rect.w >= 0.999 && rect.h >= 0.999;
      if (handle === 'new' || (handle === 'move' && isFull)) {
        const start: CropRect = { x: p.x, y: p.y, w: MIN, h: MIN };
        drag.current = { handle: 'se', startX: p.x, startY: p.y, start };
        onChange(applyRatio(start, 'nw'));
        return;
      }
      drag.current = { handle, startX: p.x, startY: p.y, start: { ...rect } };
    },
    [disabled, rect, toLocal, onChange, applyRatio]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || disabled) return;
      e.preventDefault();
      const p = toLocal(e.clientX, e.clientY);
      const dx = p.x - d.startX;
      const dy = p.y - d.startY;
      const s = d.start;
      let next: CropRect = { ...s };

      if (d.handle === 'move') {
        next.x = clamp(s.x + dx, 0, 1 - s.w);
        next.y = clamp(s.y + dy, 0, 1 - s.h);
      } else {
        const right = s.x + s.w;
        const bottom = s.y + s.h;
        if (d.handle === 'se') {
          next.w = clamp(p.x - s.x, MIN, 1 - s.x);
          next.h = clamp(p.y - s.y, MIN, 1 - s.y);
          next = applyRatio(next, 'nw');
        } else if (d.handle === 'sw') {
          const x = clamp(p.x, 0, right - MIN);
          next.x = x;
          next.w = right - x;
          next.h = clamp(p.y - s.y, MIN, 1 - s.y);
          next = applyRatio(next, 'ne');
        } else if (d.handle === 'ne') {
          const y = clamp(p.y, 0, bottom - MIN);
          next.y = y;
          next.h = bottom - y;
          next.w = clamp(p.x - s.x, MIN, 1 - s.x);
          next = applyRatio(next, 'sw');
        } else if (d.handle === 'nw') {
          const x = clamp(p.x, 0, right - MIN);
          const y = clamp(p.y, 0, bottom - MIN);
          next.x = x;
          next.w = right - x;
          next.y = y;
          next.h = bottom - y;
          next = applyRatio(next, 'se');
        }
      }
      // 경계 밖으로 나가지 않게 마무리 보정
      next.w = clamp(next.w, MIN, 1);
      next.h = clamp(next.h, MIN, 1);
      next.x = clamp(next.x, 0, 1 - next.w);
      next.y = clamp(next.y, 0, 1 - next.h);
      onChange(next);
    },
    [disabled, toLocal, onChange, applyRatio]
  );

  const endDrag = useCallback(() => {
    drag.current = null;
  }, []);

  const pct = (v: number) => `${(v * 100).toFixed(3)}%`;

  return (
    <div
      ref={wrapRef}
      className="ma-cropwrap"
      onPointerDown={(e) => onPointerDown(e, 'new')}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* 잘려나갈 영역을 어둡게 — 네 방향 마스크 */}
      <div className="ma-crop-mask" style={{ left: 0, top: 0, width: '100%', height: pct(rect.y) }} />
      <div className="ma-crop-mask" style={{ left: 0, top: pct(rect.y + rect.h), width: '100%', bottom: 0 }} />
      <div className="ma-crop-mask" style={{ left: 0, top: pct(rect.y), width: pct(rect.x), height: pct(rect.h) }} />
      <div
        className="ma-crop-mask"
        style={{ left: pct(rect.x + rect.w), top: pct(rect.y), right: 0, height: pct(rect.h) }}
      />

      <div
        className="ma-crop-rect"
        style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
        onPointerDown={(e) => onPointerDown(e, 'move')}
        role="presentation"
      >
        {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
          <span
            key={h}
            className={`ma-crop-handle ${h}`}
            onPointerDown={(e) => onPointerDown(e, h)}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
};

export default CropBox;
