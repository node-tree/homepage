import React from 'react';

/**
 * VerticalMeta — 세로쓰기 메타(설계 §2.5). 데스크톱은 writing-mode: vertical-rl,
 * 모바일(<768)은 nt.css 가 가로 Mono 한 줄로 폴백시킨다(§5.6).
 */
const VerticalMeta: React.FC<{ rows: { k: string; v: string }[] }> = ({ rows }) => (
  <div className="metav">
    {rows.map((r) => (
      <div key={r.k}>
        <span className="k">{r.k}</span>
        {/* 목업은 HTML 이라 연속 공백이 하나로 접힌다. JSX 는 접지 않으므로 한 칸만 둔다. */}
        {` ${r.v}`}
      </div>
    ))}
  </div>
);

export default React.memo(VerticalMeta);
