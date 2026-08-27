import React from 'react';
import { AbsentPlate, Still } from '../data/types';

/**
 * PlateFrame — 복장 도판 창(설계 §2.4).
 *   봉인 brightness(.72) → 호버 개봉 brightness(1). still 이 null 이면 absent:
 *   자리는 남기고(점선 창) 값만 비운다 — 결측의 조판 규칙(§2.2).
 *   이미지는 지금 placeholder(/redesign/doc.webp, 목업 doc.png 를 리사이즈·WebP).
 *   실제 도판은 ImageKit(ik.imagekit.io/gc3jtyt9o) 로 교체한다.
 */
export interface PlateFrameProps {
  still: Still | null;
  absent?: AbsentPlate;
  className?: string;
}

const PlateFrame: React.FC<PlateFrameProps> = ({ still, absent, className }) => {
  if (!still) {
    const a = absent ?? { note: 'ABSENT · 도판 미기재' };
    return (
      <div
        className={`plate absent${className ? ' ' + className : ''}`}
        data-absent={a.note}
        style={a.ratio ? { aspectRatio: a.ratio } : undefined}
        role="img"
        aria-label={a.note}
      />
    );
  }
  return (
    <div
      className={`plate${still.open ? ' open' : ''}${className ? ' ' + className : ''}`}
      style={{
        ...(still.ratio ? { aspectRatio: still.ratio } : null),
        ...(still.position ? { backgroundPosition: still.position } : null),
      }}
      role="img"
      aria-label="도판 — 봉인 상태(호버 시 개봉). placeholder"
    />
  );
};

export default React.memo(PlateFrame);
