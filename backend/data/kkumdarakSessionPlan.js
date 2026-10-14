// ─────────────────────────────────────────────────────────────────────────────
// 꿈다락 회차별 «기본 계획서» 주제 (2026-10: 회차표 기준으로 교체).
//   출처: backend/data/kkumdarakSchedule.js — 강사배정 PDF·변경교부신청서(0605·공문 1차·0921 수정안2)를
//   합친 최신 회차표. 7개 프로그램 모두 회차별 주제가 명시돼 있어 정밀도는 전부 exact 다.
//   (이전판은 03-프로그램.md 의 단계명으로 회차를 추정했다 — stage 정밀도는 더 쓰지 않는다)
//
//   ⚠️ 이 값이 출강확인서 「교육주제」의 **기본 주제(앵커)** 다.
//   AI 초안은 이 주제를 바꾸지 못하고 뒤에 보강구만 덧붙일 수 있다(aiDraft.mergeTopic 가 코드로 강제).
//
//   회차 번호는 웹 회차 번호(webNo). 손의 기억은 1~10=B형, 11~16=A형(〈땅을 달래는 노래〉).
// ─────────────────────────────────────────────────────────────────────────────

const assert = require('assert');
const { PROGRAM_MAP } = require('./kkumdarakPrograms');
const { sessionsByProgram } = require('./kkumdarakSchedule');

const SOURCE = '꿈다락 회차표(강사배정 PDF·변경교부신청서 0921 수정안2 반영)';

const SESSION_PLAN = {};
for (const key of Object.keys(PROGRAM_MAP)) {
  const list = sessionsByProgram(key);
  if (!list.length) continue;
  SESSION_PLAN[key] = { source: SOURCE, sessions: list };
}

// ── 무결성 검증 (require 시점) ───────────────────────────────────────────────
for (const [key, plan] of Object.entries(SESSION_PLAN)) {
  const program = PROGRAM_MAP[key];
  assert.strictEqual(
    plan.sessions.length,
    program.totalSessions,
    `${key} 회차 수 불일치: ${plan.sessions.length} ≠ ${program.totalSessions}`,
  );
  plan.sessions.forEach((s, i) => assert.strictEqual(s.webNo, i + 1, `${key} 회차 번호 불연속: ${s.webNo}`));
}

const people = (s) =>
  [
    ...s.main.map((n) => `${n}(주)`),
    ...s.special.map((n) => `${n}(특강)`),
    ...s.assist.map((n) => `${n}(보조)`),
  ].join(', ');

// ── 회차 → 기본 주제 해석 ────────────────────────────────────────────────────
//   반환: { 기본주제, 정밀도('exact'|'none'), 단계, 회차범위, 세부활동[], 근거, 가정, 총회차 }
//     · 단계 = 프롬프트용 회차 정보(유형·일시·강사) — 이전 「단계」 자리를 그대로 쓴다.
//     · 세부활동 = 회차표의 주요 내용 줄.
function resolvePlanTopic(programKey, sessionNo) {
  const empty = { 기본주제: '', 정밀도: 'none', 단계: '', 회차범위: '', 세부활동: [], 근거: '', 가정: '', 총회차: 0 };
  const program = PROGRAM_MAP[programKey];
  if (!program) return empty;
  const plan = SESSION_PLAN[programKey];
  const base = { ...empty, 총회차: program.totalSessions };
  if (!plan) return base;

  const n = Number(sessionNo);
  if (!Number.isInteger(n) || n < 1 || n > program.totalSessions) {
    return { ...base, 근거: plan.source };
  }
  const s = plan.sessions[n - 1];
  const trackLabel = s.track.variant ? `${s.track.label} ${s.no}회차` : `${s.no}회차`;
  return {
    기본주제: s.topic,
    정밀도: 'exact',
    단계: `${trackLabel} · ${s.date} ${s.start}~${s.end} · ${people(s)}`,
    회차범위: trackLabel,
    세부활동: s.content || [],
    근거: `${plan.source} — ${trackLabel}`,
    가정: '',
    총회차: program.totalSessions,
  };
}

module.exports = {
  SESSION_PLAN,
  resolvePlanTopic,
};
