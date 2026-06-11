import React from 'react';

// ── 꿈다락 프로그램 캐릭터 PNG 플립북 (고정 UI 자산, public 번들) ──────────────
//   기존 SVG 리그(MotionCharacter / chars-v2 프레임)를 사용자 제공 PNG 캐릭터로 교체.
//   · 프로그램 식별은 PROGRAMS / VillageDiary 의 한글 name 기준(공백·구두점 정규화 폴백).
//   · 투명 배경 RGBA PNG. public 정적 번들(고정 UI 라 단순·안정적).
//   · 매핑되지 않는 프로그램(예: 축제 '다시, 안녕')은 PNG 가 없어 null → 호출부가 폴백 렌더.
//
//   ── 6프레임 플립북(2026-06 복원) ────────────────────────────────────
//   어제(c0dff11) 정적 PNG 1장 + CSS 흔들림(transform 루프)으로 바꾸며 6프레임 플립북이
//   죽었다(1프레임만 표시). 사용자는 프레임 애니메이션을 원함 → MotionCharacter(chars-v2 SVG)
//   와 동일한 .kd-loop-frame 6장 스택 + @keyframes kd-loop-6(steps(1,end) 1.5s, 음수 딜레이
//   스태거) 메커니즘으로 복원한다. 각 캐릭터는 program-loops/character-NN/frame-0{1..6}.png 6장.
//   모션은 플립북(프레임 교체)이 담당하므로 기존 CSS 흔들림(program-char-motion--*,
//   program-char-png-motion)은 제거했다.
//   prefers-reduced-motion 은 kkumdarak.css 전역 규칙 + .kd-loop-frame 규칙으로 첫 프레임만 정지.

const LOOP_BASE = '/kkumdarak/program-loops';

// 정규화: 공백·쉼표·가운뎃점 등 제거 후 비교(표기 흔들림 흡수).
const normalize = (s: string): string =>
  (s || '').replace(/[\s,·∙ㆍ]/g, '').toLowerCase();

// 프로그램 캐릭터 정의: 정규화 name → character 폴더 id(program-loops/character-NN).
//   매핑(확정, 마스코트=각 캐릭터의 frame-01 과 동일 그림):
//     장암 책정      → character-16 (파란 책 로봇)
//     마을의 신호    → character-15 (주황 고양이)
//     기억순환 정류장 → character-12 (노란 벼)
//     손의 기억      → character-18 (초록 새싹)
//     소리일기       → character-09 (검정 점박이)
//     풍경일기       → character-06 (흰 꽃)
const CHAR_BY_NAME: Record<string, string> = {
  [normalize('장암 책정')]:      'character-16',
  [normalize('마을의 신호')]:    'character-15',
  [normalize('기억순환 정류장')]: 'character-12',
  [normalize('손의 기억')]:      'character-18',
  [normalize('소리일기')]:       'character-09',
  [normalize('풍경일기')]:       'character-06',
};

// 프로그램명으로 캐릭터 폴더 id 조회(없으면 null).
const charIdForName = (name?: string): string | null =>
  (name && CHAR_BY_NAME[normalize(name)]) || null;

// 프로그램명으로 캐릭터 매핑 존재 여부(호출부 폴백 분기 판단용 — 기존 시그니처 유지).
//   truthy(첫 프레임 경로) 면 ProgramCharacterPng 플립북을, falsy 면 MotionCharacter 폴백을 선택.
export const characterPngForName = (name?: string): string | null => {
  const id = charIdForName(name);
  return id ? `${LOOP_BASE}/${id}/frame-01.png` : null;
};

// PNG 6프레임 플립북 렌더. 매핑이 없으면 null(호출부에서 기존 폴백 사용).
//   컨테이너(position:relative) > .kd-loop-frame 6장(absolute 스택). MotionCharacter 와 동일 구조.
//   모션은 .kd-loop-frame 의 @keyframes kd-loop-6(steps) 가 담당 — 별도 흔들림 래퍼 없음.
const ProgramCharacterPng: React.FC<{
  name?: string;
  alt?: string;
  className?: string;
}> = ({ name, alt, className }) => {
  const id = charIdForName(name);
  if (!id) return null;
  return (
    <div
      className={[
        'program-char-loop',
        `program-char-loop--${id}`,
        className,
      ].filter(Boolean).join(' ')}
      data-character={id}
      style={{ position: 'relative' }}
    >
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <img
          key={i}
          src={`${LOOP_BASE}/${id}/frame-0${i}.png`}
          alt={i === 1 ? (alt || name || '') : ''}
          className="kd-loop-frame program-char-png"
          loading="lazy"
          draggable={false}
        />
      ))}
    </div>
  );
};

export default ProgramCharacterPng;
