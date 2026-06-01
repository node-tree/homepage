import React from 'react';

interface Props {
  src: string;
  alt?: string;
  className?: string;
}

// 파일명 → character-NN 변환
function resolveCharId(src: string): string {
  // "char-09.svg" or "char-9.svg" → "character-09"
  const shortMatch = src.match(/^char-(\d{1,2})\.svg$/);
  if (shortMatch) {
    return `character-${String(Number(shortMatch[1])).padStart(2, '0')}`;
  }
  // "09-character-09-firefly-spots.svg" → "character-09"
  const longMatch = src.match(/^(\d{2})-character/);
  if (longMatch) {
    return `character-${longMatch[1]}`;
  }
  // "character-09" or "character-09-..." already
  const directMatch = src.match(/character-(\d{2})/);
  if (directMatch) return `character-${directMatch[1]}`;
  return 'character-01';
}

// 모션 클래스 매핑
const MOTION_CLASS: Record<string, string> = {
  'character-01': 'sway',
  'character-02': 'bounce',
  'character-03': 'blink',
  'character-04': 'blink',
  'character-05': 'wave',
  'character-06': 'sway',
  'character-07': 'wave',
  'character-08': 'sit-stand',
  'character-09': 'blink-bounce',
  'character-10': 'wave',
  'character-11': 'sway',
  'character-12': 'walk',
  'character-13': 'blink',
  'character-14': 'breath',
  'character-15': 'breath',
  'character-16': 'bounce',
  'character-17': 'wave',
  'character-18': 'sway',
  'character-19': 'walk',
  'character-20': 'sit-stand',
  'character-21': 'blink-bounce',
};

const MotionCharacter: React.FC<Props> = ({ src, alt, className }) => {
  // src에서 경로 제거 후 파일명만 추출
  const filename = src.replace(/^.*\//, '');
  const charId = resolveCharId(filename);
  const motion = MOTION_CLASS[charId] || 'sway';

  return (
    <div
      className={[
        'motion-character',
        `motion-character--${charId}`,
        `motion-character-motion--${motion}`,
        `program-rig--${charId}`,
        className,
      ].filter(Boolean).join(' ')}
      data-character={charId}
      data-motion={motion}
      style={{ position: 'relative' }}
    >
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <img
          key={i}
          src={`/kkumdarak/chars-v2/${charId}/frame-0${i}.svg`}
          alt={i === 1 ? (alt || '') : ''}
          className="kd-loop-frame"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ))}
    </div>
  );
};

export default MotionCharacter;
