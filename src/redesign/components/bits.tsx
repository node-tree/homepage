import React from 'react';
import { useEditMode } from '../edit';

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

/** 로그인 상태에서만 보이는 편집 줄.
 *  이제 편집은 **이 페이지 안에서** 한다(v5 판식·v5 헤더 그대로) — 레거시 앱으로 튕기지 않는다.
 *  /legacy 편집기는 백업으로 남아 있으므로 작은 보조 문으로만 걸어 둔다. */
export const AdminLine: React.FC<{ page?: 'about' | 'work' | 'commons' | 'cv' | 'contact' }> = ({ page }) => {
  const { editing, canEdit, toggle } = useEditMode();
  if (!canEdit) return null;
  return (
    <div className="adminline">
      편집 ·{' '}
      <button type="button" className="nte-linkbtn" onClick={toggle} aria-pressed={editing}>
        {editing ? '편집 모드 끄기' : '이 페이지에서 편집'}
      </button>{' '}
      · <a href={page ? `/legacy/${page}` : '/legacy'}>레거시 편집기</a>(백업)
    </div>
  );
};
