import React, { useMemo } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// 마감·일정 알림 (정본 일정 기준). 순수 프론트 — 백엔드 불필요.
//   고정 마감은 D-day 계산, 반복(원천세·집행등록)은 안내.
// ─────────────────────────────────────────────────────────────────────────────

const RECURRING = [
  '원천세 신고·납부 — 매월 10일 (0원도 신고)',
  '집행 등록(e나라도움) — 보조금 사용 후 10일 이내',
];

const FIXED: { date: string; label: string }[] = [
  { date: '2026-08-31', label: '사업추진상황보고서(중간보고) 제출' },
  { date: '2026-09-30', label: '2차 교부신청 (40%)' },
  { date: '2026-11-30', label: '프로그램 운영 종료' },
  { date: '2026-12-10', label: '원인행위(집행) 마감' },
  { date: '2026-12-21', label: 'e나라도움 집행마감' },
  { date: '2026-12-28', label: '실적보고서 제출' },
  { date: '2027-01-31', label: '최종 정산·보고서 + 잔액 반납' },
  { date: '2027-04-30', label: '정보공시' },
];

function daysBetween(target: string): number {
  const t = new Date(target + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((t.getTime() - today.getTime()) / 86400000);
}

const DeadlinesCard: React.FC = () => {
  const items = useMemo(
    () =>
      FIXED.map((f) => ({ ...f, d: daysBetween(f.date) }))
        .sort((a, b) => a.d - b.d),
    [],
  );

  return (
    <section className="kd-deadlines">
      <h3 className="kd-deadlines-title">마감·일정 알림</h3>

      <ul className="kd-deadlines-recurring">
        {RECURRING.map((r) => (
          <li key={r}>🔁 {r}</li>
        ))}
      </ul>

      <ul className="kd-deadlines-list">
        {items.map((it) => {
          const cls = it.d < 0 ? 'is-past' : it.d <= 14 ? 'is-soon' : '';
          const dd = it.d < 0 ? `지남 ${-it.d}일` : it.d === 0 ? 'D-DAY' : `D-${it.d}`;
          return (
            <li key={it.date} className={cls}>
              <span className="kd-deadlines-dday">{dd}</span>
              <span className="kd-deadlines-date">{it.date}</span>
              <span className="kd-deadlines-label">{it.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default DeadlinesCard;
