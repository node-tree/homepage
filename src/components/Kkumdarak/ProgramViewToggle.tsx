import React from 'react';

// 프로그램 「카드 | 일정」 전환 알약 — 일정(#schedule)은 메뉴에서 빠지고 프로그램 안 보기 방식이 됐다.
//   해시 링크라 Kkumdarak 의 hashchange 가 섹션을 바꾼다(옛 #schedule 링크도 그대로 열린다).
const ProgramViewToggle: React.FC<{ current: 'programs' | 'schedule' }> = ({ current }) => (
  <nav className="kd-view-toggle" aria-label="프로그램 보기 방식">
    <a href="#programs" className={current === 'programs' ? 'is-on' : ''} aria-current={current === 'programs' ? 'page' : undefined}>
      카드
    </a>
    <a href="#schedule" className={current === 'schedule' ? 'is-on' : ''} aria-current={current === 'schedule' ? 'page' : undefined}>
      일정
    </a>
  </nav>
);

export default ProgramViewToggle;
