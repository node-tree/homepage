#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// 꿈다락 프로그램 시드/검증 스크립트.
//
// 현재 동작: 프로그램 상수(backend/data/kkumdarakPrograms.js)를 로드해 무결성을
//   확인·출력만 한다. require() 시점에 합계(정원 228·총회차 63·시수 192) assert 가
//   실행되므로, 이 스크립트가 통과하면 프로그램 상수가 정합한 것이다.
//
//   ⚠️ 프로그램 마스터는 코드 상수(불변)라 DB 저장 대상이 아니다(budget 상수와 동일 원칙).
//   DB(KkumdarakProgram)는 가변값(actualParticipants)만, KkumdarakSession 은 회차만 보관한다.
//   따라서 별도 시드 INSERT 가 필요 없다 — 빈 DB 에서도 GET /programs 가 7개를 반환한다.
//
// ⛔ 실제 DB 쓰기는 하지 않는다. (사용자 승인 전 prod 연결·시드 금지)
//   향후 초기 회차/실참여를 DB 에 미리 채워야 할 경우 아래 seedToDB() 가드를 명시 해제.
//
// 실행(읽기 전용, 안전):  node scripts/seed-kkumdarak-programs.js
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path');
const programs = require(path.join(__dirname, '..', 'backend', 'data', 'kkumdarakPrograms'));

function printSummary() {
  console.log('\n=== 꿈다락 프로그램 마스터 (고정 시드, 7개) ===\n');
  for (const p of programs.PROGRAMS) {
    console.log(
      `  ${p.name}  [${p.targetGroup}]  정원 ${String(p.quota).padStart(3)}명 · ` +
      `총회차 ${String(p.totalSessions).padStart(2)} · 시수 ${String(p.totalHours).padStart(2)}`,
    );
  }
  console.log('');
  console.log(`  합계 — 정원 ${programs.TOTAL_QUOTA}명 / 총회차 ${programs.TOTAL_SESSIONS} / 시수 ${programs.TOTAL_HOURS}`);
  console.log('  (검증 기대치: 정원 228 · 총회차 63 · 시수 192)');
  console.log('\n✅ 합계 assert 통과 — require 단계에서 검증됨.\n');
}

// 향후 DB 시드용 골격 — 현재는 호출하지 않으며 실행 시 즉시 중단한다.
// eslint-disable-next-line no-unused-vars
async function seedToDB() {
  console.warn('⛔ DB 시드는 사용자 명시 승인 전까지 비활성화되어 있습니다.');
  return;

  /* === 승인 후에만 아래 가드를 해제 ===
  const mongoose = require('mongoose');
  const connectDB = require('../backend/db');
  // const KkumdarakProgram = require('../backend/models/KkumdarakProgram');
  // const KkumdarakSession = require('../backend/models/KkumdarakSession');
  await connectDB();
  // 프로그램 마스터는 상수(불변)라 DB 저장 대상 아님. 시드 대상은 초기 실참여/회차(있을 경우)뿐.
  // ... 초기 actualParticipants / 회차 삽입 로직 ...
  await mongoose.connection.close();
  === */
}

if (require.main === module) {
  printSummary();
  // seedToDB(); // ⛔ 의도적으로 호출하지 않음
}

module.exports = { printSummary, seedToDB };
