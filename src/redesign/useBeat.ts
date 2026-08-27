import { useEffect, useState } from 'react';
import { BeatState, beatAt } from '../components/DharaniClock/beat';

/**
 * useBeat — 讀誦(독송) 박을 1초마다 읽는다.
 *   계산 정본은 DharaniClock/beat.ts 하나뿐이다(시계 컴포넌트와 같은 값을 쓴다).
 *   헤더 카운터·소형 시계 바늘이 이 훅을 공유한다.
 */
export function useBeat(intervalMs = 1000): BeatState {
  const [beat, setBeat] = useState<BeatState>(() => beatAt());
  useEffect(() => {
    const id = window.setInterval(() => setBeat(beatAt()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return beat;
}
