import React from 'react';

/**
 * rich — 데이터 문자열의 `**굵게**` 를 목업의 <b> 로 되돌린다.
 * (데이터 파일에 JSX·HTML 을 넣지 않기 위한 최소 마크업. dangerouslySetInnerHTML 안 쓴다.)
 */
export function rich(text: string): React.ReactNode {
  const parts = text.split('**');
  return parts.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : <React.Fragment key={i}>{p}</React.Fragment>));
}
