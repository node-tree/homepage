// ════════════════════════════════════════════════════════════════════════
// walkerBus.ts — 삼베 대리 신체 ↔ 페이지 사이의 최소 신호선
//   "옷이 몸보다 먼저 도착해 기다린다"(설계 §4.1) → 삼베가 새 페이지 자리에 **도착한 뒤**
//   콘텐츠가 드러난다. React 상태 트리를 거치지 않으려고 모듈 싱글턴으로 둔다.
// ════════════════════════════════════════════════════════════════════════
type Listener = (path: string) => void;

const listeners = new Set<Listener>();

export function onArrive(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitArrive(path: string): void {
  listeners.forEach((fn) => fn(path));
}

/** 콘텐츠 reveal 최대 대기 — 2 tick(297ms × 2 = 박/16). 보행이 느려도 페이지는 이 안에 열린다. */
export const REVEAL_CAP_MS = 594;
