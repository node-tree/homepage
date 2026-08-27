// ════════════════════════════════════════════════════════════════════════
// beat.ts — 讀誦(독송) 박(拍) 계산
//   1 명 = 1 박 = 9.508088 s · 3,029 박 = 1 순환(정확히 8 시간)
//   기준은 **Asia/Seoul 자정** — 하루에 세 번 순환하고, 방문 시각마다 자리가 다르다.
//   1 각(角) = 20 박(= 20 정간, WG-017b).
// ════════════════════════════════════════════════════════════════════════

export const BEAT_SEC = 9.508088;
export const BEATS = 3029;
export const BEATS_PER_GAK = 20;
/** 3,029 × 9.508088 = 28,799.998 s ≈ 8 h — 순환은 하루에 세 번 */
export const CYCLE_SEC = BEATS * BEAT_SEC;

/** Asia/Seoul 자정(그날 00:00 KST)부터 흐른 초. DST 없음(KST = UTC+9 고정). */
export function seoulSecondsSinceMidnight(now: Date = new Date()): number {
  const ms = now.getTime();
  const KST = 9 * 3600 * 1000;
  const shifted = ms + KST;                 // UTC 기준으로 밀어 KST 벽시계로 읽는다
  return (shifted - Math.floor(shifted / 86400000) * 86400000) / 1000;
}

export interface BeatState {
  /** 0 … 3028 */
  index: number;
  /** 한 각 안의 자리 0 … 19 */
  phase: number;
  /** 각 번호(자정 기준) */
  gak: number;
  /** 현재 박 안의 진행 0…1 */
  frac: number;
  /** 자정 이후 초 */
  sec: number;
}

export function beatAt(now: Date = new Date()): BeatState {
  const sec = seoulSecondsSinceMidnight(now);
  const total = Math.floor(sec / BEAT_SEC);
  const index = ((total % BEATS) + BEATS) % BEATS;
  return {
    index,
    phase: index % BEATS_PER_GAK,
    gak: Math.floor(index / BEATS_PER_GAK),
    frac: sec / BEAT_SEC - total,
    sec,
  };
}

/** 讀誦 바늘 각도(도) — 목업 정본: index 0842 → 100.09° */
export const readingAngle = (index: number) => (index / BEATS) * 360;

/**
 * 角 바늘 각도(도). 20 박마다 한 걸음(18°).
 *   讀誦 바늘과 같은 판 위에서 각을 3,029 로 읽으면 두 바늘이 2.4° 안에서 겹쳐
 *   시계가 되지 않는다. 그래서 각 바늘은 **20 각 = 한 바퀴**(1 각 = 20 정간의
 *   호흡을 그대로 각에 적용)로 읽는다 — 목업의 두 바늘 분리를 지킨다.
 */
export const gakAngle = (index: number) =>
  ((Math.floor(index / BEATS_PER_GAK) % 20) / 20) * 360;

export const pad4 = (n: number) => String(n).padStart(4, '0');
export const pad2 = (n: number) => String(n).padStart(2, '0');
