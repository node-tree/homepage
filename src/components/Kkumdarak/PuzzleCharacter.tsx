import React, { useId } from 'react';

// ═══════════════════════════════════════════════════════════════
// PuzzleCharacter — 원본 PuzzlePiece*.svg 기하를 그대로 재현한 공유 컴포넌트
// 원본: /Users/kanghyunjung/Desktop/PuzzlePiece{,-1,-2,-3}.svg (viewBox 0 0 132 124)
//
// 구조(레이어 뒤 → 앞):
//  1. 우 돌기   cx114.4 cy58.24 r12.52  — 오른쪽 가장자리 세로중앙
//  2. 하 돌기   cx62.4  cy110.24 r12.52 — 아래 가장자리 가로중앙
//  3. 몸통 rect x10.4 y6.24 104×104 rx12.48  fill=bodyColor
//     - 드롭섀도 dx2.6 dy2.6 #1A1A1A blur0
//     - 안쪽 테두리 2.08px #1A1A1A
//  4. 좌 돌기   cx12.48 cy58.24 r11.48 — 왼쪽 가장자리 세로중앙
//  5. 코어 원   cx61.44 cy48.36 r14.6  — 상단 중앙(약간 위), fill=coreColor
//  6. 라벨 텍스트 — 코어 아래 중앙. Jua 폰트, #251B13, 2줄 지원
//
// 색은 전부 데이터 주입: bodyColor / coreColor / knobs{left,right,bottom}.
// 돌기 색이 없는 위치는 해당 돌기를 그리지 않음(원본 4종은 모두 3돌기).
// ═══════════════════════════════════════════════════════════════

export type Knobs = {
  left?: string;
  right?: string;
  bottom?: string;
};

type PuzzleCharacterProps = {
  bodyColor: string;
  coreColor: string;
  knobs?: Knobs;
  label?: string | string[];
  className?: string;
  /** 렌더 폭(px). 높이는 viewBox 비율(124/132)로 자동 산출. 기본 136 */
  size?: number;
  /** 라벨 폰트 크기(viewBox 단위). 기본 13 */
  labelFontSize?: number;
  /** 걷기 애니메이션: 앞에 나올 knob 방향. 기본 'left' */
  walkPhase?: 'left' | 'right';
};

const VB_W = 132;
const VB_H = 124;
const STROKE = '#251B13';
// 인라인 style로 폰트를 지정해 페이지 전역 CSS의 font-family 상속/규칙을 확실히 이긴다.
const LABEL_FONT = "'Jua', sans-serif";

const PuzzleCharacter: React.FC<PuzzleCharacterProps> = ({
  bodyColor,
  coreColor,
  knobs = {},
  label,
  className,
  size = 136,
  labelFontSize = 13,
  walkPhase,
}) => {
  const leftInFront = !walkPhase || walkPhase === 'left';
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const shadowId = `pc-shadow-${uid}`;
  const height = (size * VB_H) / VB_W;

  const lines = label == null
    ? []
    : Array.isArray(label)
      ? label
      : String(label).split('\n');

  // 라벨 블록: 코어(cy 48.36, r 14.6, 하단 ≈ 63) 아래, 가로중앙(x≈61).
  const labelStartY = 82;
  const lineHeight = labelFontSize + 1;

  return (
    <svg
      className={className}
      width={size}
      height={height}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={lines.join(' ')}
      // 인라인 style이 기존 .program-puzzle/.kd-puzzle-piece 의 고정 width/height CSS를
      // 덮어써 viewBox 비율을 유지하고 돌기가 잘리지 않도록 한다.
      style={{ display: 'block', width: `${size}px`, height: `${height}px`, overflow: 'visible' }}
    >
      <defs>
        <filter
          id={shadowId}
          x="10.4"
          y="6.24"
          width="106.6"
          height="106.6"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="bg" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dx="2.6" dy="2.6" />
          <feColorMatrix type="matrix" values="0 0 0 0 0.102 0 0 0 0 0.102 0 0 0 0 0.102 0 0 0 1 0" />
          <feBlend mode="normal" in2="bg" result="e1" />
          <feBlend mode="normal" in="SourceGraphic" in2="e1" result="shape" />
        </filter>
      </defs>

      {/* 뒤쪽 돌기 (body 뒤에 렌더) */}
      {leftInFront ? (
        knobs.right && <circle cx="114.4" cy="58.24" r="12.52" fill={knobs.right} stroke={STROKE} strokeWidth="2" data-knob="back" />
      ) : (
        knobs.left && <circle cx="12.48" cy="58.24" r="11.48" fill={knobs.left} stroke={STROKE} strokeWidth="2" data-knob="back" />
      )}
      {/* 하 돌기 — 아래 */}
      {knobs.bottom && (
        <circle cx="62.4" cy="110.24" r="12.52" fill={knobs.bottom} stroke={STROKE} strokeWidth="2" />
      )}

      {/* 몸통 (드롭섀도 + 안쪽 테두리) */}
      <g filter={`url(#${shadowId})`}>
        <rect x="10.4" y="6.24" width="104" height="104" rx="12.48" fill={bodyColor} />
        <rect
          x="11.44"
          y="7.28"
          width="101.92"
          height="101.92"
          rx="11.44"
          stroke="#1A1A1A"
          strokeWidth="2.08"
        />
      </g>

      {/* 앞쪽 돌기 (body 앞에 렌더) */}
      {leftInFront ? (
        knobs.left && <circle cx="12.48" cy="58.24" r="11.48" fill={knobs.left} stroke={STROKE} strokeWidth="2" data-knob="front" />
      ) : (
        knobs.right && <circle cx="114.4" cy="58.24" r="12.52" fill={knobs.right} stroke={STROKE} strokeWidth="2" data-knob="front" />
      )}

      {/* 코어 원 — 상단 중앙 */}
      <circle cx="61.44" cy="48.36" r="14.6" fill={coreColor} stroke={STROKE} strokeWidth="2" data-knob="core" />

      {/* 라벨 텍스트 — 코어 아래 중앙, Jua */}
      {lines.length > 0 && (
        <text
          x="61.44"
          y={labelStartY}
          textAnchor="middle"
          fontSize={labelFontSize}
          fill="#251B13"
          style={{ fontFamily: LABEL_FONT }}
        >
          {lines.map((line, i) => (
            <tspan key={i} x="61.44" dy={i === 0 ? 0 : lineHeight}>
              {line}
            </tspan>
          ))}
        </text>
      )}
    </svg>
  );
};

export default PuzzleCharacter;
