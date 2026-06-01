import React from 'react';
import { COLORS } from './data';

// ═══════════════════════════════════════════════════════════════
// DirectionsMap — 약도 (SVG, maeve 톤: 원색 + 굵은 검은 외곽)
// 도로: 석동로(본도로) + 석동로29번길(갈래)
// 핀: 생산소(핫핑크) / 주민자치센터(틸) / 농협(퍼플) / 면사무소(옐로)
// 사용자가 추후 손볼 수 있게 별도 컴포넌트로 분리.
// ═══════════════════════════════════════════════════════════════

const I = COLORS.ink;
const FONT = "'Archivo','Gothic A1','Noto Sans KR',sans-serif";

const DirectionsMap: React.FC = () => {
  return (
    <svg
      viewBox="0 0 400 320"
      width="100%"
      style={{ display: 'block' }}
      role="img"
      aria-label="장암면 약도"
    >
      {/* 배경 */}
      <rect x="0" y="0" width="400" height="320" fill={COLORS.cream} />
      <path d="M0 232 Q 120 204 250 236 T 400 222 L400 320 L0 320 Z" fill={COLORS.teal} opacity="0.5" />

      {/* 석동로 — 본도로 */}
      <path d="M-10 150 Q 120 130 200 150 T 410 150" fill="none" stroke={I} strokeWidth="24" strokeLinecap="round" />
      <path d="M-10 150 Q 120 130 200 150 T 410 150" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" />
      <path d="M-10 150 Q 120 130 200 150 T 410 150" fill="none" stroke={I} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 14" />

      {/* 석동로29번길 — 갈래 */}
      <path d="M210 150 Q 240 200 280 232" fill="none" stroke={I} strokeWidth="18" strokeLinecap="round" />
      <path d="M210 150 Q 240 200 280 232" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" />

      {/* 도로 라벨 */}
      <text x="58" y="120" fontFamily={FONT} fontWeight="800" fontSize="13" fill={I}>석동로</text>
      <text x="244" y="200" fontFamily={FONT} fontWeight="800" fontSize="11" fill={I}>석동로29번길</text>

      {/* 랜드마크 — 농협 (퍼플 라운드 사각) */}
      <g transform="translate(110 150)">
        <rect x="-13" y="-13" width="26" height="26" rx="7" fill={COLORS.purple} stroke={I} strokeWidth="3" />
        <text x="0" y="38" fontFamily={FONT} fontWeight="800" fontSize="12" fill={I} textAnchor="middle">농협</text>
      </g>

      {/* 랜드마크 — 면사무소 (옐로 원) */}
      <g transform="translate(320 150)">
        <circle r="14" fill={COLORS.yellow} stroke={I} strokeWidth="3" />
        <text x="0" y="38" fontFamily={FONT} fontWeight="800" fontSize="12" fill={I} textAnchor="middle">면사무소</text>
      </g>

      {/* 핀 — 주민자치센터 (틸) */}
      <g transform="translate(180 150)">
        <path d="M0 0 C -16 -21 -16 -40 0 -40 C 16 -40 16 -21 0 0 Z" fill={COLORS.teal} stroke={I} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="0" cy="-27" r="6.5" fill="#fff" stroke={I} strokeWidth="2" />
        <text x="0" y="20" fontFamily={FONT} fontWeight="800" fontSize="12" fill={COLORS.tealDeep} textAnchor="middle">주민자치센터</text>
      </g>

      {/* 핀 — 생산소 (핫핑크, 강조) */}
      <g transform="translate(282 232)">
        <path d="M0 0 C -19 -25 -19 -47 0 -47 C 19 -47 19 -25 0 0 Z" fill={COLORS.pink} stroke={I} strokeWidth="3.5" strokeLinejoin="round" />
        <circle cx="0" cy="-31" r="7.5" fill="#fff" stroke={I} strokeWidth="2" />
        <text x="0" y="22" fontFamily={FONT} fontWeight="800" fontSize="13" fill={COLORS.pinkDeep} textAnchor="middle">장암 생산소</text>
      </g>
    </svg>
  );
};

export default DirectionsMap;
