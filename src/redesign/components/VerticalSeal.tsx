import React from 'react';

/**
 * VerticalSeal — 세로 표찰(§동양 조판).
 *   판식 규칙은 옛 표찰(題簽)과 같다: **한자는 세우고(upright) 라틴·숫자는 눕힌다(mixed)**.
 *   VerticalMeta(.metav) 가 상세의 세로 메타라면, 이쪽은 판의 가장자리에 서는 한 줄 표찰이다.
 *
 *   자리(where)는 조판이 정한다 — 컴포넌트는 글자만 낸다.
 *     head  페이지 표제 왼쪽 1정간 — 책의 제첨(題簽) 자리
 *     foot  푸터 오른쪽 끝 — 간기(刊記) 자리
 *
 *   모바일(<768)에서는 nt.css 가 라틴 줄(.rm)을 접고 한자만 남긴다 —
 *   1정간(=100vw/10)이 좁아 두 줄이 서면 계선을 넘는다.
 */
export type SealPlace = 'head' | 'foot';

export interface VerticalSealProps {
  /** 세워 쓰는 한자(2~5자). 길면 판이 늘어난다. */
  mark: string;
  /** 눕혀 쓰는 라틴·숫자 한 줄(선택) */
  roman?: string;
  place: SealPlace;
}

const VerticalSeal: React.FC<VerticalSealProps> = ({ mark, roman, place }) => (
  <div className={`vseal v${place}`}>
    <span className="mk">{mark}</span>
    {roman ? <span className="rm">{roman}</span> : null}
  </div>
);

export default React.memo(VerticalSeal);
