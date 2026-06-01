import React from 'react';
import { COLORS } from './data';

// ═══════════════════════════════════════════════════════════════
// 오리지널 벡터 라이브러리 (전부 자작 SVG, 외부 에셋 미사용)
//  · 아이콘 세트 (내비/메타/UI)
//  · 다섯 세대 캐릭터 (여러 포즈/색)
//  · 마을 소품 모티프 (책·정자·등불·화분·트로피·별)
//  · 카드/피드용 일러스트 (분야별 변주)
//  · 배경 도트 텍스처
// 스타일: maeve 무드 — 둥근 라운드 · 굵은 검은 외곽 · 핫핑크/틸/옐로/퍼플
// 라이선스: 본 프로젝트 오리지널(자작). 상용/타사 아트워크 미사용.
// ═══════════════════════════════════════════════════════════════

const I: string = COLORS.ink;
const SW = 3;

// ── 아이콘 세트 (24x24, 스트로크) ───────────────────────────────
type IconProps = { size?: number; color?: string };
const iconBase = (size = 22, color: string = I) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: color, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});

export const IconBook: React.FC<IconProps> = ({ size, color }) => (
  <svg {...iconBase(size, color)} aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 1-2-2Z" /><path d="M20 5a2 2 0 0 0-2-2h-6v18h6a2 2 0 0 0 2-2Z" /></svg>
);
export const IconCalendar: React.FC<IconProps> = ({ size, color }) => (
  <svg {...iconBase(size, color)} aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>
);
export const IconSparkle: React.FC<IconProps> = ({ size, color }) => (
  <svg {...iconBase(size, color)} aria-hidden="true"><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>
);
export const IconMap: React.FC<IconProps> = ({ size, color }) => (
  <svg {...iconBase(size, color)} aria-hidden="true"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></svg>
);
export const IconArrow: React.FC<IconProps> = ({ size, color }) => (
  <svg {...iconBase(size, color)} aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const IconHeart: React.FC<IconProps> = ({ size, color }) => (
  <svg {...iconBase(size, color)} aria-hidden="true"><path d="M12 20s-7-4.6-7-9.6A4 4 0 0 1 12 7a4 4 0 0 1 7 3.4C19 15.4 12 20 12 20Z" /></svg>
);
export const IconSearch: React.FC<IconProps> = ({ size, color }) => (
  <svg {...iconBase(size, color)} aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);

// ── 다섯 세대 캐릭터 (포즈/색 변주) ─────────────────────────────
export const Person: React.FC<{ x: number; y: number; s?: number; body: string; pose?: string; flip?: boolean }> = ({
  x, y, s = 1, body, pose = 'stand', flip,
}) => (
  <g transform={`translate(${x} ${y}) scale(${(flip ? -s : s)} ${s})`}>
    {pose === 'wave' && <path d="M14 4 L24 -6" stroke={I} strokeWidth={SW} strokeLinecap="round" />}
    {pose === 'jump' && <><path d="M-12 30 L-20 22" stroke={I} strokeWidth={SW} strokeLinecap="round" /><path d="M12 30 L20 22" stroke={I} strokeWidth={SW} strokeLinecap="round" /></>}
    <path d="M -16 36 Q -16 6 0 6 Q 16 6 16 36 Z" fill={body} stroke={I} strokeWidth={SW} strokeLinejoin="round" />
    {pose === 'read' && <rect x="-14" y="22" width="28" height="14" rx="3" fill={COLORS.cream} stroke={I} strokeWidth={2.5} />}
    <circle cx="0" cy="-8" r="11" fill={COLORS.cream} stroke={I} strokeWidth={SW} />
    <path d="M -11 -10 Q 0 -24 11 -10 Q 6 -16 0 -16 Q -6 -16 -11 -10 Z" fill={I} />
    <circle cx="-4" cy="-8" r="1.7" fill={I} /><circle cx="4" cy="-8" r="1.7" fill={I} />
    {pose !== 'stand' && <path d="M -3 -3 Q 0 -1 3 -3" stroke={I} strokeWidth={1.6} fill="none" strokeLinecap="round" />}
  </g>
);

// ── 마을 소품 모티프 ────────────────────────────────────────────
export const PropBooks: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <rect x="-20" y="-2" width="40" height="10" fill={COLORS.yellow} stroke={I} strokeWidth={2.5} />
    <rect x="-16" y="-12" width="36" height="10" fill={COLORS.teal} stroke={I} strokeWidth={2.5} />
    <rect x="-18" y="-22" width="38" height="10" fill={COLORS.pink} stroke={I} strokeWidth={2.5} />
  </g>
);
export const PropLantern: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <line x1="0" y1="-24" x2="0" y2="-16" stroke={I} strokeWidth={2.5} />
    <rect x="-10" y="-16" width="20" height="24" rx="5" fill={COLORS.yellow} stroke={I} strokeWidth={2.5} />
    <line x1="-10" y1="-4" x2="10" y2="-4" stroke={I} strokeWidth={1.6} />
  </g>
);
export const PropPlant: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M 0 -24 Q -17 -24 -11 0 Q 0 -11 11 0 Q 17 -24 0 -24 Z" fill={COLORS.teal} stroke={I} strokeWidth={2.5} strokeLinejoin="round" />
    <path d="M -11 2 L 11 2 L 8 15 L -8 15 Z" fill={COLORS.purple} stroke={I} strokeWidth={2.5} strokeLinejoin="round" />
  </g>
);
export const PropTrophy: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M -13 -18 L 13 -18 L 8 4 L -8 4 Z" fill={COLORS.yellow} stroke={I} strokeWidth={2.5} strokeLinejoin="round" />
    <rect x="-6" y="4" width="12" height="7" fill={COLORS.yellow} stroke={I} strokeWidth={2} />
    <rect x="-12" y="11" width="24" height="6" rx="2" fill={I} />
  </g>
);
export const PropStar: React.FC<{ x: number; y: number; s?: number; c?: string }> = ({ x, y, s = 1, c = COLORS.yellow }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M0 -13 L4 -4 L13 0 L4 4 L0 13 L-4 4 L-13 0 L-4 -4 Z" fill={c} stroke={I} strokeWidth={2.5} strokeLinejoin="round" />
  </g>
);

// ── 카드/피드용 일러스트 (분야별 변주, seed 결정론) ─────────────
const SCENES = ['books', 'sound', 'memory', 'hands', 'scape', 'festival'] as const;
type SceneKind = typeof SCENES[number];

export const CardArt: React.FC<{ seed: string; tint: string; kind?: SceneKind }> = ({ seed, tint, kind }) => {
  const h = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
  const scene: SceneKind = kind || SCENES[h % SCENES.length];
  const palette = [COLORS.pink, COLORS.yellow, COLORS.teal, COLORS.purple];
  const pick = (n: number) => palette[(h + n) % palette.length];
  return (
    <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect x="0" y="0" width="300" height="200" fill={tint} />
      <circle cx={244 - (h % 24)} cy={44} r={22} fill={pick(1)} stroke={I} strokeWidth={SW} />
      <path d="M0 158 Q 150 130 300 158 L300 200 L0 200 Z" fill={pick(2)} stroke={I} strokeWidth={SW} />

      {scene === 'books' && (<><PropBooks x={86} y={150} s={1.5} /><PropStar x={205} y={96} s={0.9} c={pick(0)} /></>)}
      {scene === 'sound' && (<g>
        <circle cx={96} cy={108} r={26} fill="none" stroke={I} strokeWidth={SW} />
        <circle cx={96} cy={108} r={14} fill={pick(0)} stroke={I} strokeWidth={SW} />
        <path d="M150 90 q 30 -20 60 0 M150 110 q 30 -16 60 0 M150 130 q 30 -12 60 0" stroke={I} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      </g>)}
      {scene === 'memory' && (<g>
        <rect x={70} y={86} width={66} height={50} rx={10} fill={pick(0)} stroke={I} strokeWidth={SW} />
        <PropLantern x={196} y={132} s={1.4} />
      </g>)}
      {scene === 'hands' && (<g>
        <PropPlant x={100} y={140} s={1.5} />
        <circle cx={206} cy={96} r={24} fill={pick(3)} stroke={I} strokeWidth={SW} />
      </g>)}
      {scene === 'scape' && (<g>
        <path d="M40 140 L86 88 L120 130 L150 104 L196 140 Z" fill={pick(3)} stroke={I} strokeWidth={SW} strokeLinejoin="round" />
        <PropStar x={228} y={92} s={0.9} c={pick(0)} />
      </g>)}
      {scene === 'festival' && (<g>
        <PropTrophy x={100} y={140} s={1.5} />
        <PropStar x={150} y={70} s={0.8} c={pick(0)} />
        <PropStar x={208} y={112} s={1} c={pick(3)} />
      </g>)}

      <Person x={236} y={150} s={1.1} body={pick(0)} pose={h % 2 ? 'wave' : 'read'} />
    </svg>
  );
};

export const FestivalCardArt: React.FC<{ seed: string; tint: string; label?: string }> = ({ seed, tint, label }) => {
  const h = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
  const modes = ['ticket', 'mountain', 'cloud', 'tent'] as const;
  const mode = modes[h % modes.length];
  const bg = [COLORS.teal, COLORS.yellow, COLORS.pink, COLORS.tealLite][h % 4];
  const accent = [COLORS.pinkDeep, COLORS.tealDeep, COLORS.purple, COLORS.yellow][(h + 1) % 4];
  return (
    <svg viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="300" height="200" fill={tint || COLORS.surface} />
      <rect x="16" y="16" width="268" height="168" fill={bg} stroke={I} strokeWidth={SW} />
      {mode === 'ticket' && (
        <g transform="translate(62 58)">
          <rect x="0" y="0" width="176" height="84" fill={COLORS.pink} stroke={I} strokeWidth={SW} />
          <path d="M0 34a15 15 0 0 1 0 20M176 34a15 15 0 0 0 0 20" fill="none" stroke={I} strokeWidth={SW} />
          <rect x="42" y="24" width="92" height="36" fill={COLORS.teal} stroke={I} strokeWidth={SW} />
        </g>
      )}
      {mode === 'mountain' && (
        <path d="M54 154 112 82 154 132 188 98 246 154Z" fill={accent} stroke={I} strokeWidth={SW} strokeLinejoin="round" />
      )}
      {mode === 'cloud' && (
        <path d="M80 128 Q54 128 54 104 Q54 82 78 78 Q88 52 120 58 Q138 38 164 58 Q198 54 210 82 Q244 84 244 112 Q244 134 218 134 H86 Q82 134 80 128Z" fill={accent} stroke={I} strokeWidth={SW} strokeLinejoin="round" />
      )}
      {mode === 'tent' && (
        <path d="M54 156 H246 L194 56 Q150 104 106 56Z" fill={accent} stroke={I} strokeWidth={SW} strokeLinejoin="round" />
      )}
      <circle cx="236" cy="50" r="22" fill={COLORS.yellow} stroke={I} strokeWidth={SW} />
      <circle cx="68" cy="50" r="12" fill={COLORS.pinkDeep} stroke={I} strokeWidth={SW} />
      {label && (
        <text x="150" y="112" textAnchor="middle" fontFamily="'Gothic A1',sans-serif" fontWeight="800" fontSize="22" fill={I}>
          {label}
        </text>
      )}
    </svg>
  );
};

// ── 배경 도트 텍스처 ────────────────────────────────────────────
let dotSeq = 0;
export const DotsBg: React.FC<{ color?: string; opacity?: number }> = ({ color = I, opacity = 0.08 }) => {
  const id = `kd-dots-${++dotSeq}`;
  return (
    <svg width="100%" height="100%" aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <defs>
        <pattern id={id} width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="2" fill={color} opacity={opacity} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
};
