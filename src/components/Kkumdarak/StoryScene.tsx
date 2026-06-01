import React from 'react';
import { COLORS } from './data';
import { Person, PropBooks, PropLantern, PropPlant, PropTrophy, PropStar } from './illustrations';

// ═══════════════════════════════════════════════════════════════
// StoryScene — 소개 스토리텔링용 오리지널 일러스트 씬 7종
// 자작 벡터(캐릭터·정자·책·소품) 변주. maeve 색 + 둥근 외곽.
// viewBox 480×420, 배경 tint는 씬별 지정.
// ═══════════════════════════════════════════════════════════════

const I = COLORS.ink;
export type StorySceneKind = 'quote' | 'rebuild' | 'flow' | 'generations' | 'programs' | 'festival' | 'cta';

// 정자(꿈다락 책정) — 둥근 지붕 + 기둥 + 책 선반
const Pavilion: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M -96 -54 Q 0 -120 96 -54 Q 48 -72 0 -72 Q -48 -72 -96 -54 Z" fill={COLORS.pink} stroke={I} strokeWidth={3.5} strokeLinejoin="round" />
    <rect x="-86" y="-54" width="172" height="14" rx="5" fill={COLORS.pink} stroke={I} strokeWidth={3} />
    <rect x="-78" y="-40" width="10" height="78" rx="4" fill={COLORS.teal} stroke={I} strokeWidth={3} />
    <rect x="68" y="-40" width="10" height="78" rx="4" fill={COLORS.teal} stroke={I} strokeWidth={3} />
    {/* 책 선반 */}
    <rect x="-60" y="-22" width="120" height="50" rx="6" fill="#fff" stroke={I} strokeWidth={3} />
    <PropBooks x={-32} y={20} s={0.9} />
    <PropBooks x={28} y={20} s={0.9} />
    <rect x="-78" y="38" width="156" height="9" rx="4" fill={COLORS.teal} stroke={I} strokeWidth={3} />
  </g>
);

const SceneFrame: React.FC<{ tint: string; children: React.ReactNode }> = ({ tint, children }) => (
  <svg viewBox="0 0 480 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect x="0" y="0" width="480" height="420" fill={tint} />
    {children}
    {/* 공통 바닥 언덕 */}
    <path d="M0 348 Q 240 318 480 348 L480 420 L0 420 Z" fill={COLORS.teal} stroke={I} strokeWidth={3.5} />
  </svg>
);

const StoryScene: React.FC<{ kind: StorySceneKind }> = ({ kind }) => {
  switch (kind) {
    case 'quote':
      return (
        <SceneFrame tint="#FBE9C8">
          <PropStar x={120} y={96} s={1.6} c={COLORS.pink} />
          <PropStar x={360} y={130} s={1.1} c={COLORS.teal} />
          <PropStar x={250} y={70} s={0.9} c={COLORS.purple} />
          <Person x={240} y={300} s={2.4} body={COLORS.yellow} pose="wave" />
          <PropLantern x={150} y={330} s={1.8} />
          <PropLantern x={330} y={330} s={1.8} />
        </SceneFrame>
      );
    case 'rebuild':
      return (
        <SceneFrame tint="#E0D5F7">
          <PropStar x={400} y={80} s={1} c={COLORS.yellow} />
          <Pavilion x={240} y={210} s={1.15} />
          <Person x={120} y={320} s={1.8} body={COLORS.pink} pose="read" />
          <Person x={360} y={320} s={1.8} body={COLORS.teal} pose="stand" flip />
        </SceneFrame>
      );
    case 'flow':
      return (
        <SceneFrame tint="#C8EFE4">
          {/* 4단계 흐름 점선 + 색 노드 */}
          <path d="M70 220 H 410" stroke={I} strokeWidth={3} strokeDasharray="4 12" strokeLinecap="round" />
          {[
            { x: 80, c: COLORS.pink }, { x: 190, c: COLORS.yellow },
            { x: 300, c: COLORS.teal }, { x: 410, c: COLORS.purple },
          ].map((n, k) => (
            <g key={k} transform={`translate(${n.x} 220)`}>
              <circle r="30" fill={n.c} stroke={I} strokeWidth={3.5} />
              <text x="0" y="8" textAnchor="middle" fontFamily="'Jua','Fredoka',sans-serif" fontSize="24" fill={n.c === COLORS.yellow ? I : '#fff'}>{k + 1}</text>
            </g>
          ))}
          <Person x={240} y={330} s={1.8} body={COLORS.yellow} pose="jump" />
          <PropStar x={130} y={120} s={0.9} c={COLORS.pink} />
        </SceneFrame>
      );
    case 'generations':
      return (
        <SceneFrame tint="#FCD8E7">
          <PropStar x={400} y={84} s={1} c={COLORS.purple} />
          {/* 다섯 세대: 크기/색 변주 */}
          <Person x={84} y={332} s={1.5} body={COLORS.pink} pose="wave" />
          <Person x={170} y={336} s={1.3} body={COLORS.yellow} pose="stand" />
          <Person x={252} y={330} s={1.7} body={COLORS.teal} pose="jump" />
          <Person x={336} y={336} s={1.3} body={COLORS.purple} pose="read" />
          <Person x={416} y={332} s={1.5} body={COLORS.pinkDeep} pose="wave" flip />
        </SceneFrame>
      );
    case 'programs':
      return (
        <SceneFrame tint="#FFEFB8">
          {/* 7 소품 = 7 프로그램 */}
          <PropBooks x={90} y={150} s={1.1} />
          <PropLantern x={200} y={150} s={1.4} />
          <PropPlant x={310} y={150} s={1.2} />
          <PropTrophy x={410} y={150} s={1.1} />
          <PropStar x={130} y={250} s={1.1} c={COLORS.pink} />
          <PropStar x={250} y={250} s={1.1} c={COLORS.teal} />
          <PropStar x={370} y={250} s={1.1} c={COLORS.purple} />
          <Person x={240} y={332} s={1.5} body={COLORS.teal} pose="stand" />
        </SceneFrame>
      );
    case 'festival':
      return (
        <SceneFrame tint="#E0D5F7">
          {/* 깃발 garland */}
          <path d="M40 90 Q 240 130 440 90" stroke={I} strokeWidth={3} fill="none" />
          {[60, 130, 200, 270, 340, 410].map((fx, k) => {
            const cols = [COLORS.pink, COLORS.yellow, COLORS.teal, COLORS.purple];
            return <path key={k} d={`M${fx} 96 L${fx + 18} 96 L${fx + 9} 118 Z`} fill={cols[k % 4]} stroke={I} strokeWidth={2.5} strokeLinejoin="round" />;
          })}
          <PropTrophy x={240} y={210} s={2.1} />
          <Person x={140} y={332} s={1.6} body={COLORS.pink} pose="jump" />
          <Person x={340} y={332} s={1.6} body={COLORS.yellow} pose="wave" flip />
          <PropStar x={400} y={150} s={1} c={COLORS.yellow} />
        </SceneFrame>
      );
    case 'cta':
    default:
      return (
        <SceneFrame tint="#FBE9C8">
          <Pavilion x={240} y={200} s={1.05} />
          <PropStar x={110} y={110} s={1.2} c={COLORS.pink} />
          <PropStar x={380} y={130} s={1} c={COLORS.teal} />
          <Person x={150} y={330} s={1.6} body={COLORS.purple} pose="wave" />
          <Person x={330} y={330} s={1.6} body={COLORS.pink} pose="wave" flip />
          <Person x={240} y={336} s={1.4} body={COLORS.yellow} pose="stand" />
        </SceneFrame>
      );
  }
};

export default StoryScene;
