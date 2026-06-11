import React from 'react';

// ── 꿈다락 프로그램 캐릭터 PNG (고정 UI 자산, public 번들) ──────────────
//   기존 SVG 리그(MotionCharacter / chars-v2 프레임)를 사용자 제공 PNG 캐릭터로 교체.
//   · 프로그램 식별은 PROGRAMS / VillageDiary 의 한글 name 기준(공백·구두점 정규화 폴백).
//   · 투명 배경 RGBA PNG. ImageKit 이 아닌 public 정적 번들(고정 UI 라 단순·안정적).
//   · 매핑되지 않는 프로그램(예: 축제 '다시, 안녕')은 PNG 가 없어 null → 호출부가 폴백 렌더.
//
//   ── 모션루프(2026-06) ────────────────────────────────────────────
//   정적 PNG 가 정지된 채로 보이던 문제를 해결하기 위해, PNG 를 감싸는 래퍼 <span> 에
//   CSS 키프레임 루프(transform/opacity 만 → GPU)를 입힌다. 프로그램 성격별로 다른 모션을
//   배정해 '전부 똑같이 둥실대는' 단조로움을 피한다. 애니메이션은 래퍼에만 걸어
//   .program-rig-png(is-step 워크 트랜스폼)·.intro-char-rig(마을일기 크기) 컨텍스트와 분리한다.
//   prefers-reduced-motion 은 kkumdarak.css 전역 규칙(.kkumdarak * animation 무력화)으로 정지.

const BASE = '/kkumdarak/characters-png';

// 정규화: 공백·쉼표·가운뎃점 등 제거 후 비교(표기 흔들림 흡수).
const normalize = (s: string): string =>
  (s || '').replace(/[\s,·∙ㆍ]/g, '').toLowerCase();

// 프로그램 캐릭터 정의: 정규화 name → { png, motion }.
//   motion 은 캐릭터 성격에 맞춘 모션 키(아래 program-char-motion--{key} CSS 와 1:1).
//     · breath  : 느린 숨쉬기(가만히 살아있음)        — 장암 책정(책 로봇, 묵직)
//     · bounce  : 통통 튀기(활기찬 신호)              — 마을의 신호(말풍선 고양이)
//     · sway    : 좌우 흔들(벼·바람결)                — 기억순환 정류장(벼 인사)
//     · sprout  : 살짝 솟았다 가라앉는 새싹 호흡        — 손의 기억(새싹)
//     · wave    : 팔 흔들 채집(손 들고 모으기)         — 소리일기(점박이, 팔 위로)
//     · bloom   : 꽃이 피듯 가볍게 기울며 부풀기         — 풍경일기(흰 꽃)
type CharMotion = 'breath' | 'bounce' | 'sway' | 'sprout' | 'wave' | 'bloom';

interface CharDef {
  png: string;
  motion: CharMotion;
}

const CHAR_BY_NAME: Record<string, CharDef> = {
  [normalize('장암 책정')]:     { png: `${BASE}/jangam-chaekjeong.png`, motion: 'breath' }, // 파란 책 로봇
  [normalize('마을의 신호')]:   { png: `${BASE}/maeul-sinho.png`,       motion: 'bounce' }, // 주황 고양이+말풍선
  [normalize('기억순환 정류장')]: { png: `${BASE}/gieok-sunhwan.png`,    motion: 'sway' },   // 노란 벼 인사
  [normalize('손의 기억')]:     { png: `${BASE}/son-gieok.png`,         motion: 'sprout' }, // 초록 새싹
  [normalize('소리일기')]:      { png: `${BASE}/sori-ilgi.png`,         motion: 'wave' },   // 검정 점박이
  [normalize('풍경일기')]:      { png: `${BASE}/punggyeong-ilgi.png`,   motion: 'bloom' },  // 흰 꽃
};

// 프로그램명으로 캐릭터 정의 조회(없으면 null).
const charDefForName = (name?: string): CharDef | null =>
  (name && CHAR_BY_NAME[normalize(name)]) || null;

// 프로그램명으로 PNG 경로 조회(없으면 null). (호출부 폴백 분기 판단용 — 기존 시그니처 유지)
export const characterPngForName = (name?: string): string | null =>
  charDefForName(name)?.png || null;

// 프로그램명으로 모션 키 조회(없으면 null).
export const characterMotionForName = (name?: string): CharMotion | null =>
  charDefForName(name)?.motion || null;

// PNG 캐릭터 렌더. PNG 가 없으면 null(호출부에서 기존 폴백 사용).
//   래퍼 <span>(모션 루프) > <img>(아트). 모션은 래퍼에만 — img 는 크기만 담당.
const ProgramCharacterPng: React.FC<{
  name?: string;
  alt?: string;
  className?: string;
}> = ({ name, alt, className }) => {
  const def = charDefForName(name);
  if (!def) return null;
  return (
    <span
      className={[
        'program-char-png-motion',
        `program-char-motion--${def.motion}`,
        className,
      ].filter(Boolean).join(' ')}
      data-motion={def.motion}
    >
      <img
        src={def.png}
        alt={alt || name || ''}
        className="program-char-png"
        loading="lazy"
        draggable={false}
      />
    </span>
  );
};

export default ProgramCharacterPng;
