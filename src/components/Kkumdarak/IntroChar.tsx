import React from 'react';
import MotionCharacter from './MotionCharacter';

interface Props {
  src: string;   // e.g. "char-11.svg"
  alt?: string;
}

// 기존 소개/지도/마을일기 API를 유지하면서 새 모션용 21개 캐릭터 SVG를 사용한다.
const IntroChar: React.FC<Props> = ({ src, alt }) => {
  const key = src.replace('.svg', '');     // char-11
  const num = key.split('-')[1];           // 11

  return (
    <MotionCharacter
      src={src}
      alt={alt}
      className={`intro-char-svg intro-char-rig ic-${num}`}
    />
  );
};

export default IntroChar;
