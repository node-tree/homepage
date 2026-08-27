import React from 'react';

// ════════════════════════════════════════════════════════════════════════
// bits — v5 DB 페이지가 함께 쓰는 작은 조각들(표제 부제 · 상태 표시 · 관리자 줄).
// ════════════════════════════════════════════════════════════════════════

/** DB 부제(개행 포함)를 빈 줄 기준 문단으로 쪼개 `.note` 에 싣는다. */
export const Note: React.FC<{ text?: string }> = ({ text }) => {
  if (!text) return null;
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div className="note">
      {paras.map((p, i) => (
        <p key={i}>
          {p.split('\n').map((line, j) => (
            <React.Fragment key={j}>
              {j > 0 ? ' ' : null}
              {line.trim()}
            </React.Fragment>
          ))}
        </p>
      ))}
    </div>
  );
};

/** 로딩·오류·빈 목록 — Mono 한 줄. 스피너·아이콘 없음(v5 금칙). */
export const State: React.FC<{ text: string; onRetry?: () => void }> = ({ text, onRetry }) => (
  <section className="state">
    <div>
      {text}
      {onRetry ? <button onClick={onRetry}>다시 시도</button> : null}
    </div>
  </section>
);

/** 로그인 상태에서만 보이는 편집 안내(작성·수정·순서편집은 레거시 편집기에 그대로 있다).
 *  page 를 주면 그 페이지의 레거시 편집 화면(/legacy/work 등)으로 곧장 간다. */
export const AdminLine: React.FC<{ page?: 'about' | 'work' | 'commons' | 'cv' | 'contact' }> = ({ page }) => (
  <div className="adminline">
    편집 · <a href={page ? `/legacy/${page}` : '/legacy'}>레거시 편집기</a>에서 작성·수정·순서편집
  </div>
);
