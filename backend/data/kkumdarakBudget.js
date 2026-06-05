// ─────────────────────────────────────────────────────────────────────────────
// 꿈다락 예산 마스터 (고정 상수) — e나라도움 비목/세목 코드와 1:1 정합.
//
// 기획서: Obsidian Vault/NODE TREE/회계/2026/꿈다락/꿈다락-관리페이지-기획.md §1-1
// 출처(검증): 변경교부신청서 산출식표(검산 diff 0). 합계·세세목·인력활동비 모두 정합.
//   (인력활동비 합계 = 상용임금+일용임금+고용부담금+기획/개발활동비 ≤ 총사업비 40%)
//
// 이 모듈은 순수 상수 + 검증(assert)만 한다. DB 접근/쓰기 없음.
//   require() 시점에 합계·세세목·편성제한이 모두 검증되므로,
//   `node -e "require('./backend/data/kkumdarakBudget.js')"` 만으로 무결성 확인 가능.
// ─────────────────────────────────────────────────────────────────────────────

const assert = require('assert');

const TOTAL_BUDGET = 100000000; // 총사업비 1억원
const PERSONNEL_LIMIT_RATIO = 0.4; // 인력활동비 ≤ 총사업비 40%
const MEETING_MEAL_LIMIT = 1000000; // 회의식비 누계 ≤ 100만원

// 사업기간 (예탁계좌 출금일 기준 경고용)
//   start = 공식 e나라도움 등록 사업기간 시작일 2026-04-06 (선정공문·오리엔테이션 요약).
//   5-11 은 사업개시(채용)일일 뿐이며, 4월 집행(오리엔테이션 200,000원 등)이 집행가능으로
//   확인돼 있어 4-06 을 시작일로 둔다 — 정상 4월건에 거짓 OUT_OF_PERIOD 경고를 내지 않기 위함.
const PROJECT_PERIOD = {
  start: '2026-04-06',
  end: '2026-12-31',
};

// 일반수용비(210/01) 세세목 — 한 단계 더 쪼갠 내부 항목.
// isPersonnelActivity: 인력활동비(40% 제한)에 합산되는 항목 표시.
// 출처: 변경교부신청서 산출식표(합 66,453,000 검산 diff 0).
const GENERAL_SUPPLY_SUBITEMS = [
  { key: '기획개발활동비', label: '기획개발활동비', amount: 34294850, isPersonnelActivity: true },
  { key: '교육강사비', label: '교육강사비', amount: 13335000, isPersonnelActivity: false },
  { key: '특별강의비', label: '특별강의비', amount: 1625000, isPersonnelActivity: false },
  { key: '원고료', label: '원고료', amount: 1750000, isPersonnelActivity: false },
  { key: '교육재료비', label: '교육재료비', amount: 12858150, isPersonnelActivity: false },
  { key: '인쇄물출력비', label: '인쇄물출력비', amount: 1040000, isPersonnelActivity: false },
  { key: '회계검증수수료', label: '회계검증수수료', amount: 1100000, isPersonnelActivity: false },
  { key: '기타진행비', label: '기타진행비', amount: 450000, isPersonnelActivity: false },
];

// 8개 비목 라인 (편성액). lineKey = `${majorCode}-${subCode}` 로 유일 식별.
//   isPersonnelActivity: 라인 전체가 인력활동비인 경우(상용임금·고용부담금).
//   일반수용비(210/01)는 라인 단위가 아니라 세세목 단위로 인력활동비를 가르므로
//   라인 플래그는 false, 합산은 subItems 기준으로 한다(아래 computePersonnelActivityTotal).
const BUDGET_LINES = [
  {
    lineKey: '110-03',
    majorCode: '110', majorName: '인건비',
    subCode: '03', subName: '상용임금',
    amount: 5000000,
    paymentHint: '계좌이체',
    isPersonnelActivity: true,
  },
  {
    lineKey: '210-01',
    majorCode: '210', majorName: '운영비',
    subCode: '01', subName: '일반수용비',
    amount: 66453000,
    paymentHint: '이체+카드',
    isPersonnelActivity: false, // 세세목 단위로 판정 (기획개발활동비만 해당)
    subItems: GENERAL_SUPPLY_SUBITEMS,
  },
  {
    lineKey: '210-02',
    majorCode: '210', majorName: '운영비',
    subCode: '02', subName: '공공요금및제세',
    amount: 2381000,
    paymentHint: '카드',
    isPersonnelActivity: false,
  },
  {
    lineKey: '210-07',
    majorCode: '210', majorName: '운영비',
    subCode: '07', subName: '임차료',
    amount: 1200000,
    paymentHint: '이체/카드',
    isPersonnelActivity: false,
  },
  {
    lineKey: '210-14',
    majorCode: '210', majorName: '운영비',
    subCode: '14', subName: '일반용역비',
    amount: 17330000,
    paymentHint: '계좌이체',
    isPersonnelActivity: false,
  },
  {
    lineKey: '220-01',
    majorCode: '220', majorName: '여비',
    subCode: '01', subName: '국내여비',
    amount: 1441000,
    paymentHint: '이체/카드',
    isPersonnelActivity: false,
  },
  {
    lineKey: '240-01',
    majorCode: '240', majorName: '업무추진비',
    subCode: '01', subName: '사업추진비',
    amount: 5650000,
    paymentHint: '카드',
    isPersonnelActivity: false,
  },
  {
    lineKey: '320-01',
    majorCode: '320', majorName: '민간이전',
    subCode: '01', subName: '고용부담금',
    amount: 545000,
    paymentHint: '이체',
    isPersonnelActivity: true,
  },
];

// 인력활동비 합계 = 라인 플래그(상용임금·고용부담금) + 일반수용비 세세목 중 인력활동비(기획개발활동비).
//   출처: 상용임금 + 일용임금(편성 없음) + 고용부담금 + 기획/개발활동비.
function computePersonnelActivityTotal() {
  let total = 0;
  for (const line of BUDGET_LINES) {
    if (line.isPersonnelActivity) {
      total += line.amount;
    } else if (Array.isArray(line.subItems)) {
      for (const si of line.subItems) {
        if (si.isPersonnelActivity) total += si.amount;
      }
    }
  }
  return total;
}

const PERSONNEL_ACTIVITY_TOTAL = computePersonnelActivityTotal();
const PERSONNEL_ACTIVITY_LIMIT = Math.floor(TOTAL_BUDGET * PERSONNEL_LIMIT_RATIO); // 40,000,000

// ── 무결성 검증 (require 시점에 실행) ────────────────────────────────────────
// 1) 8개 라인 합계 = 1억
const linesSum = BUDGET_LINES.reduce((s, l) => s + l.amount, 0);
assert.strictEqual(
  linesSum, TOTAL_BUDGET,
  `예산 라인 합계 불일치: ${linesSum} ≠ ${TOTAL_BUDGET}`
);

// 2) 일반수용비 세세목 합계 = 66,453,000
const generalSupplyLine = BUDGET_LINES.find((l) => l.lineKey === '210-01');
const subItemsSum = GENERAL_SUPPLY_SUBITEMS.reduce((s, si) => s + si.amount, 0);
assert.strictEqual(
  subItemsSum, generalSupplyLine.amount,
  `일반수용비 세세목 합계 불일치: ${subItemsSum} ≠ ${generalSupplyLine.amount}`
);

// 3) lineKey 유일성
const keySet = new Set(BUDGET_LINES.map((l) => l.lineKey));
assert.strictEqual(keySet.size, BUDGET_LINES.length, 'lineKey 중복 존재');

// 4) 인력활동비 합계 = 39,839,850 (= 39.84%), 40% 이하
//    구성 = 상용임금 5,000,000 + 일용임금 0 + 고용부담금 545,000 + 기획개발활동비 34,294,850
assert.strictEqual(
  PERSONNEL_ACTIVITY_TOTAL, 39839850,
  `인력활동비 합계 불일치: ${PERSONNEL_ACTIVITY_TOTAL} ≠ 39,839,850`
);
assert.ok(
  PERSONNEL_ACTIVITY_TOTAL <= PERSONNEL_ACTIVITY_LIMIT,
  `인력활동비 편성제한 초과: ${PERSONNEL_ACTIVITY_TOTAL} > ${PERSONNEL_ACTIVITY_LIMIT}`
);

// lineKey 빠른 조회 맵
const BUDGET_LINE_MAP = BUDGET_LINES.reduce((m, l) => {
  m[l.lineKey] = l;
  return m;
}, {});

function lineKeyOf(majorCode, subCode) {
  return `${majorCode}-${subCode}`;
}

module.exports = {
  TOTAL_BUDGET,
  PERSONNEL_LIMIT_RATIO,
  PERSONNEL_ACTIVITY_LIMIT,
  PERSONNEL_ACTIVITY_TOTAL, // 39,839,850 (편성 기준 인력활동비 합계)
  MEETING_MEAL_LIMIT,
  PROJECT_PERIOD,
  BUDGET_LINES,
  BUDGET_LINE_MAP,
  GENERAL_SUPPLY_SUBITEMS,
  computePersonnelActivityTotal,
  lineKeyOf,
};
