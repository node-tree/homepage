#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// 꿈다락 예산 시드/검증 스크립트.
//
// 현재 동작: 예산 상수(backend/data/kkumdarakBudget.js)를 로드해 무결성을 확인하고
//   사람이 읽을 수 있게 출력만 한다. require() 시점에 합계·세세목·편성제한 assert 가
//   모두 실행되므로, 이 스크립트가 통과하면 예산 상수가 정합한 것이다.
//
// ⛔ 실제 DB 쓰기는 하지 않는다. (사용자 승인 전 prod 연결·시드 금지)
//   향후 DB 시드가 필요하면 아래 seedToDB() 의 주석 가드를 명시적으로 해제한다.
//
// 실행(읽기 전용, 안전):  node scripts/seed-kkumdarak-budget.js
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path');
const budget = require(path.join(__dirname, '..', 'backend', 'data', 'kkumdarakBudget'));

const won = (n) => `${n.toLocaleString('ko-KR')}원`;

function printSummary() {
  console.log('\n=== 꿈다락 예산 마스터 (고정 시드) ===\n');
  console.log(`총사업비: ${won(budget.TOTAL_BUDGET)}\n`);

  console.log('[비목 라인 8개]');
  for (const l of budget.BUDGET_LINES) {
    const flag = l.isPersonnelActivity ? '  ← 인력활동비' : '';
    console.log(
      `  ${l.lineKey}  ${l.majorName}(${l.majorCode})/${l.subName}(${l.subCode})` +
      `  ${won(l.amount).padStart(16)}  [${l.paymentHint}]${flag}`
    );
  }
  const linesSum = budget.BUDGET_LINES.reduce((s, l) => s + l.amount, 0);
  console.log(`  ${''.padEnd(40)} 합계: ${won(linesSum)}\n`);

  console.log('[일반수용비(210-01) 세세목]');
  for (const si of budget.GENERAL_SUPPLY_SUBITEMS) {
    const flag = si.isPersonnelActivity ? '  ← 인력활동비' : '';
    console.log(`  - ${si.label.padEnd(12)} ${won(si.amount).padStart(16)}${flag}`);
  }
  const subSum = budget.GENERAL_SUPPLY_SUBITEMS.reduce((s, si) => s + si.amount, 0);
  console.log(`  ${''.padEnd(14)} 합계: ${won(subSum)}\n`);

  console.log('[편성제한 검증]');
  const ratio = (budget.PERSONNEL_ACTIVITY_TOTAL / budget.TOTAL_BUDGET) * 100;
  console.log(
    `  인력활동비 합계: ${won(budget.PERSONNEL_ACTIVITY_TOTAL)} ` +
    `(${ratio.toFixed(2)}%)  ≤ 한도 ${won(budget.PERSONNEL_ACTIVITY_LIMIT)}(40%)  ` +
    `→ ${budget.PERSONNEL_ACTIVITY_TOTAL <= budget.PERSONNEL_ACTIVITY_LIMIT ? 'OK' : '초과!'}`
  );
  console.log(
    `  회의식비 누계 한도: ${won(budget.MEETING_MEAL_LIMIT)} ` +
    `(집행 트랜잭션 subItem='회의식비' 합으로 검증 — 편성 라인 아님)`
  );
  console.log(`\n  사업기간: ${budget.PROJECT_PERIOD.start} ~ ${budget.PROJECT_PERIOD.end}`);
  console.log('\n✅ 모든 무결성 검증(합계·세세목·인력활동비 40%) 통과 — require 단계에서 assert 됨.\n');
}

// 향후 DB 시드용 골격 — 현재는 호출하지 않으며 실행 시 즉시 중단한다.
// eslint-disable-next-line no-unused-vars
async function seedToDB() {
  console.warn('⛔ DB 시드는 사용자 명시 승인 전까지 비활성화되어 있습니다.');
  return;

  /* === 승인 후에만 아래 가드를 해제 ===
  const mongoose = require('mongoose');
  const connectDB = require('../backend/db');
  // const KkumdarakTransaction = require('../backend/models/KkumdarakTransaction');
  await connectDB();
  // 예산은 코드 상수(불변)라 DB 저장 대상이 아니다. 시드 대상은 초기 트랜잭션(있을 경우)뿐.
  // ... 초기 트랜잭션 삽입 로직 ...
  await mongoose.connection.close();
  === */
}

if (require.main === module) {
  printSummary();
  // seedToDB(); // ⛔ 의도적으로 호출하지 않음
}

module.exports = { printSummary, seedToDB };
