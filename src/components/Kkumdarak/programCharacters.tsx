import React from 'react';

// ── 꿈다락 프로그램 캐릭터 PNG (고정 UI 자산, public 번들) ──────────────
//   기존 SVG 리그(MotionCharacter / chars-v2 프레임)를 사용자 제공 PNG 캐릭터로 교체.
//   · 프로그램 식별은 PROGRAMS / VillageDiary 의 한글 name 기준(공백·구두점 정규화 폴백).
//   · 투명 배경 RGBA PNG. ImageKit 이 아닌 public 정적 번들(고정 UI 라 단순·안정적).
//   · 매핑되지 않는 프로그램(예: 축제 '다시, 안녕')은 PNG 가 없어 null → 호출부가 폴백 렌더.

const BASE = '/kkumdarak/characters-png';

// 정규화: 공백·쉼표·가운뎃점 등 제거 후 비교(표기 흔들림 흡수).
const normalize = (s: string): string =>
  (s || '').replace(/[\s,·∙ㆍ]/g, '').toLowerCase();

// 프로그램명(정규화) → PNG 파일. 키는 정규화된 한글 name.
const PNG_BY_NAME: Record<string, string> = {
  [normalize('장암 책정')]: `${BASE}/jangam-chaekjeong.png`,   // 파란 책 로봇
  [normalize('마을의 신호')]: `${BASE}/maeul-sinho.png`,        // 주황 고양이+말풍선
  [normalize('기억순환 정류장')]: `${BASE}/gieok-sunhwan.png`,  // 노란 벼 인사
  [normalize('손의 기억')]: `${BASE}/son-gieok.png`,           // 초록 새싹
  [normalize('소리일기')]: `${BASE}/sori-ilgi.png`,            // 검정 점박이
  [normalize('풍경일기')]: `${BASE}/punggyeong-ilgi.png`,      // 흰 꽃
};

// 프로그램명으로 PNG 경로 조회(없으면 null).
export const characterPngForName = (name?: string): string | null =>
  (name && PNG_BY_NAME[normalize(name)]) || null;

// PNG 캐릭터 렌더. PNG 가 없으면 null(호출부에서 기존 폴백 사용).
const ProgramCharacterPng: React.FC<{
  name?: string;
  alt?: string;
  className?: string;
}> = ({ name, alt, className }) => {
  const src = characterPngForName(name);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt || name || ''}
      className={['program-char-png', className].filter(Boolean).join(' ')}
      loading="lazy"
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
};

export default ProgramCharacterPng;
