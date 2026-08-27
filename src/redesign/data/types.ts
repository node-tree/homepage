// ════════════════════════════════════════════════════════════════════════
// types.ts — v5 리디자인 데이터 계약
//   확신도 4등급(설계 §2.2)이 데이터 모델의 1급 시민이다.
//   measured 확정 · stated 설명 · proxy 예정 · absent 미기재(자리는 남고 값이 없다)
// ════════════════════════════════════════════════════════════════════════

export type Confidence = 'measured' | 'stated' | 'proxy' | 'absent';

/** 도판 창. null 이면 absent — 자리는 남기고 값만 비운다. */
export interface Still {
  /** 봉인(기본 72%) 해제 상태로 둘지 — 목업 `.plate.open` */
  open?: boolean;
  /** CSS aspect-ratio. 미지정이면 16/9 */
  ratio?: string;
  /** CSS background-position */
  position?: string;
}

export interface AbsentPlate {
  /** `.plate.absent[data-absent]` 로 찍히는 문구 */
  note: string;
  ratio?: string;
}
