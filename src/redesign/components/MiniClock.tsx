import React from 'react';
import { gakAngle, readingAngle } from '../../components/DharaniClock/beat';
import { useBeat } from '../useBeat';

/**
 * MiniClock — Work 상세 우상단 56px 시계(목업 `.miniclock`).
 *   ⚠ 큰 시계(DharaniClock)는 먹 조각 아틀라스 + WebGL2 캔버스라 56px 로 줄이면
 *   글자·OCR 박스가 뭉개지고 판독 블록·라벨이 겹친다(size prop 도 아직 없다).
 *   그래서 여기서는 **목업의 소형 SVG 마크업 그대로**를 쓰되,
 *   두 바늘 각도만 같은 정본(beat.ts)에서 받아 시간을 공유한다.
 */
const MiniClock: React.FC = () => {
  const beat = useBeat();
  return (
    <svg className="miniclock" viewBox="-460 -460 920 920" role="img" aria-label="讀誦 소형 시계">
      <circle className="k" r={440} />
      <circle r={330} />
      <circle r={200} />
      <circle className="k" r={76} />
      <line className="h2" x1="0" y1="0" x2="0" y2="-330" transform={`rotate(${gakAngle(beat.index)})`} />
      <line className="h1" x1="0" y1="0" x2="0" y2="-436" transform={`rotate(${readingAngle(beat.index).toFixed(2)})`} />
    </svg>
  );
};

export default MiniClock;
