const KkumdarakSession = require('../models/KkumdarakSession');
const { PROGRAMS } = require('../data/kkumdarakPrograms');

// ─────────────────────────────────────────────────────────────────────────────
// 프로그램 실적 집계 — 상수(마스터) + 세션 집계를 병합.
//   GET /programs 와 GET /dashboard/summary 가 공유(분기 방지).
//   실참여(actualParticipants) = 그 프로그램 세션들의 attendance 합(세션 단위 입력).
//   빈 DB 에서도 동작: 실참여=0, 등록회차=0, 잔여=총회차.
//   (KkumdarakProgram.actualParticipants 오버레이는 더 이상 사용하지 않음 — 세션 합산으로 대체.)
// ─────────────────────────────────────────────────────────────────────────────

// 프로그램별 세션 집계 맵 { programKey: { count, attendance } }
async function sessionStatsMap() {
  const rows = await KkumdarakSession.aggregate([
    {
      $group: {
        _id: '$programKey',
        count: { $sum: 1 },
        attendance: { $sum: '$attendance' },
      },
    },
  ]);
  return rows.reduce((m, r) => {
    m[r._id] = { count: r.count, attendance: r.attendance || 0 };
    return m;
  }, {});
}

// 상수 7개에 세션 집계를 병합한 프로그램 실적 배열.
//   각 항목: { ...상수(주강사 포함), actualParticipants(=Σattendance), registeredSessions,
//             remainingSessions, sessionProgress }
async function buildProgramStats() {
  const stats = await sessionStatsMap();

  return PROGRAMS.map((p) => {
    const s = stats[p.key] || { count: 0, attendance: 0 };
    const registered = s.count;
    const actual = s.attendance; // 세션 attendance 합
    const remaining = p.totalSessions - registered; // 실수(초과 시 음수 — 정보성)
    const ratio = p.totalSessions > 0 ? registered / p.totalSessions : 0;
    return {
      key: p.key,
      name: p.name,
      targetGroup: p.targetGroup,
      quota: p.quota,
      totalSessions: p.totalSessions,
      totalHours: p.totalHours,
      schedule: p.schedule,
      intro: p.intro,
      주강사: p.주강사 || [], // 출강확인서 자동기입용(GET /programs 에 노출)
      actualParticipants: actual,
      registeredSessions: registered,
      remainingSessions: remaining,
      // 진척% (바 표시는 프론트에서 0~1 클램프) — 소수 2자리
      sessionProgress: Math.round(ratio * 10000) / 100,
    };
  });
}

module.exports = { buildProgramStats, sessionStatsMap };
