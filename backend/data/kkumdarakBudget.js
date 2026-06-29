// ─────────────────────────────────────────────────────────────────────────────
// 꿈다락 예산 마스터 (고정 상수) — e나라도움 비목/세목 코드와 1:1 정합.
//
// 기획서: Obsidian Vault/NODE TREE/회계/2026/꿈다락/꿈다락-관리페이지-기획.md §1-1
// 출처(검증): 변경교부신청서 산출식표(검산 diff 0). 합계·세세목·인력활동비 모두 정합.
//   (인력활동비 합계 = 상용임금+일용임금+고용부담금+기획/개발활동비 ≤ 총사업비 40%)
//
// 이 모듈은 순수 상수 + 검증(assert)만 한다. DB 접근/쓰기 없음.
//   require() 시점에 합계·세세목·편성제한·라인별 subItems 소계가 모두 검증되므로,
//   `node -e "require('./backend/data/kkumdarakBudget.js')"` 만으로 무결성 확인 가능.
//
// subItems(편성 산출근거): 모든 비목에 { label, amount, formula } 로 편성 내역을 둔다.
//   - 210-01(일반수용비)만 트랜잭션이 subItem(key)으로 신뢰성 있게 태깅되어
//     세세목별 집행/잔액/진척을 산출한다(executable: true).
//   - 그 외 비목 subItems 는 "편성 내역(산출근거)" 표시 전용 — 항목별 집행을
//     추정/날조하지 않는다. 집행/잔액/진척은 비목(라인) 합계 레벨로만 관리한다.
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
// formula: 편성액 산출근거(품목·단가·수량). 출처: 변경교부신청서 산출식표.
// 출처: 변경교부신청서 산출식표(합 66,453,000 검산 diff 0).
//   ※ 이 비목만 트랜잭션이 subItem(key)으로 신뢰성 있게 태깅되어 세세목별 집행을 산출한다.
const GENERAL_SUPPLY_SUBITEMS = [
  { key: '기획개발활동비', label: '기획개발활동비', amount: 34294850, isPersonnelActivity: true, formula: '이화영 14,214,900 + 정강현 9,135,450 + 이공희 6,786,500 + 이진영 4,158,000' },
  { key: '교육강사비', label: '교육강사비', amount: 13335000, isPersonnelActivity: false, formula: '주강사 43,000원/3h · 보조강사 22,000원/3h 인별 합' },
  { key: '특별강의비', label: '특별강의비', amount: 1625000, isPersonnelActivity: false, formula: '함종호 375,000원×3회 + 조중현 250,000원×2회' },
  { key: '원고료', label: '원고료', amount: 1750000, isPersonnelActivity: false, formula: '일반원고 15,000원×50매 + 자료편집 5,000원×200매' },
  {
    key: '교육재료비', label: '교육재료비', amount: 12858150, isPersonnelActivity: false,
    formula: '프로그램별 재료비 합',
    // 프로그램별 재료비 (정본 검산: 합 12,858,150). UI 에서 한 단계 더 드릴다운.
    breakdown: [
      { program: '신규가 장암책정', amount: 8737850, detail: '합판18mm 1,809,000 + 합판12mm 400,000 + 각목38×89 360,000 + 각목38×38 160,000 + 수성페인트 900,000 + 우드스테인 344,000 + 코팅재 240,000 + 사포 250,000 + 붓 150,000 + 롤러트레이 150,000 + 목공피스 300,000 + 목장갑 100,000 + 샌딩기 410,000 + 경첩·부속 292,000 + 액자·디스플레이 405,000 + LED조명 960,000 + 시판넬·캡션 800,000 + 인터뷰액자 500,000 + 마감재 207,850' },
      { program: '신규다 기억순환', amount: 400000, detail: '전시 디스플레이 자재' },
      { program: '기존가 손의기억', amount: 2260000, detail: 'A형 도구 210,000 + B형 도구 1,750,000 + 공동 도구함 300,000' },
      { program: '기존나 소리일기', amount: 716300, detail: '결과물 재료' },
      { program: '기존다 풍경일기', amount: 544000, detail: '휴대용 화판 144,000 + 색재료 400,000' },
      { program: '축제 다시안녕', amount: 200000, detail: '체험부스 재료' },
    ],
  },
  { key: '인쇄물출력비', label: '인쇄물출력비', amount: 1040000, isPersonnelActivity: false, formula: '현수막 55,000원×8 + 포스터·배너 600,000' },
  { key: '회계검증수수료', label: '회계검증수수료', amount: 1100000, isPersonnelActivity: false, formula: '1,100,000원×1식' },
  { key: '기타진행비', label: '기타진행비', amount: 450000, isPersonnelActivity: false, formula: '안전장비 200,000 + 기타 250,000' },
];

// 8개 비목 라인 (편성액). lineKey = `${majorCode}-${subCode}` 로 유일 식별.
//   isPersonnelActivity: 라인 전체가 인력활동비인 경우(상용임금·고용부담금).
//   일반수용비(210/01)는 라인 단위가 아니라 세세목 단위로 인력활동비를 가르므로
//   라인 플래그는 false, 합산은 subItems 기준으로 한다(아래 computePersonnelActivityTotal).
//   subItems: 편성 산출근거 [{ label, amount, formula }]. 소계 = 라인 amount (require-time assert).
const BUDGET_LINES = [
  {
    lineKey: '110-03',
    majorCode: '110', majorName: '인건비',
    subCode: '03', subName: '상용임금',
    amount: 5000000,
    paymentHint: '계좌이체',
    isPersonnelActivity: true,
    subItems: [
      { label: '행정인력비(이한희)', amount: 5000000, formula: '625,000원/월 × 8개월(5~12월, 월 60h) × 1인' },
    ],
  },
  {
    lineKey: '210-01',
    majorCode: '210', majorName: '운영비',
    subCode: '01', subName: '일반수용비',
    amount: 66453000,
    paymentHint: '이체+카드',
    isPersonnelActivity: false, // 세세목 단위로 판정 (기획개발활동비만 해당)
    subItems: GENERAL_SUPPLY_SUBITEMS,
    subItemsExecutable: true, // 트랜잭션 subItem 태깅으로 세세목별 집행 산출 가능
  },
  {
    lineKey: '210-02',
    majorCode: '210', majorName: '운영비',
    subCode: '02', subName: '공공요금및제세',
    amount: 2381000,
    paymentHint: '카드',
    isPersonnelActivity: false,
    subItems: [
      { label: '우체국 발송비', amount: 2105000, formula: '소식지 1·2차 + 자료집 배송 ×1식' },
      { label: '보험비', amount: 276000, formula: '참여자·강사 상해보험 ×1식' },
    ],
  },
  {
    lineKey: '210-07',
    majorCode: '210', majorName: '운영비',
    subCode: '07', subName: '임차료',
    amount: 1200000,
    paymentHint: '이체/카드',
    isPersonnelActivity: false,
    subItems: [
      { label: '차량대여비', amount: 1200000, formula: '300,000원 × 4대 × 1일' },
    ],
  },
  {
    lineKey: '210-14',
    majorCode: '210', majorName: '운영비',
    subCode: '14', subName: '일반용역비',
    amount: 17330000,
    paymentHint: '계좌이체',
    isPersonnelActivity: false,
    subItems: [
      { label: '자료집', amount: 5000000, formula: '디자인편집 1,500,000 + 인쇄 200부 1,500,000 + 소식지 1·2차 2,000,000' },
      { label: '영상', amount: 8000000, formula: '인터랙티브 아카이브 4,000,000 + 기록영상 편집·배포 4,000,000' },
      { label: '행사대행', amount: 4330000, formula: '축제 일괄(LED 2,580,000 + 음향 500,000 + 체험부스 750,000 + 현수막 500,000)' },
    ],
  },
  {
    lineKey: '220-01',
    majorCode: '220', majorName: '여비',
    subCode: '01', subName: '국내여비',
    amount: 1441000,
    paymentHint: '이체/카드',
    isPersonnelActivity: false,
    subItems: [
      { label: '오리엔테이션(2인 당일)', amount: 201600, formula: 'KTX왕복 50,800×2 + 일비 25,000×2 + 식비 25,000×2' },
      { label: 'e나라도움 교육출장(대전 2회)', amount: 134600, formula: '시외버스 17,300×2회 + 일비 25,000×2 + 식비 25,000×2' },
      { label: '워크숍(1인 당일)', amount: 100800, formula: 'KTX왕복 50,800 + 일비 25,000 + 식비 25,000' },
      { label: '공유회/결과보고(5인 1박2일)', amount: 1004000, formula: 'KTX왕복 50,800×5 + 일비 25,000×5 + 식비 25,000×5 + 숙박 100,000×5' },
    ],
  },
  {
    lineKey: '240-01',
    majorCode: '240', majorName: '업무추진비',
    subCode: '01', subName: '사업추진비',
    amount: 5650000,
    paymentHint: '카드',
    isPersonnelActivity: false,
    subItems: [
      { label: '다과비', amount: 4650000, formula: '5,000원/인 프로그램별 8건 합(신규가 1,020,000 + 신규나 700,000 + 신규다 850,000 + 기존가A 420,000 + 기존가B 600,000 + 기존나 240,000 + 기존다 560,000 + 축제 260,000)' },
      { label: '회의식비', amount: 1000000, formula: '25,000원/인 × 5명 × 8회 [편성제한 100만 — 상한 일치]' },
    ],
  },
  {
    lineKey: '320-01',
    majorCode: '320', majorName: '민간이전',
    subCode: '01', subName: '고용부담금',
    amount: 545000,
    paymentHint: '이체',
    isPersonnelActivity: true,
    subItems: [
      { label: '고용부담금', amount: 545000, formula: '545,000원 × 1식 (이한희 4대보험 사업주부담)' },
    ],
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

// 2-b) 모든 라인 subItems 소계 = 라인 amount (편성 내역 정합 강제)
for (const line of BUDGET_LINES) {
  assert.ok(
    Array.isArray(line.subItems) && line.subItems.length > 0,
    `${line.lineKey} subItems 누락`
  );
  const sub = line.subItems.reduce((s, si) => s + (si.amount || 0), 0);
  assert.strictEqual(
    sub, line.amount,
    `${line.lineKey}(${line.subName}) subItems 소계 불일치: ${sub} ≠ ${line.amount}`
  );
  for (const si of line.subItems) {
    assert.ok(typeof si.label === 'string' && si.label.length > 0, `${line.lineKey} subItem label 누락`);
    assert.ok(typeof si.formula === 'string' && si.formula.length > 0, `${line.lineKey} subItem formula 누락`);
    // 프로그램별 breakdown 이 있으면 소계 = 세세목 amount (드릴다운 정합)
    if (Array.isArray(si.breakdown)) {
      const bd = si.breakdown.reduce((t, b) => t + (b.amount || 0), 0);
      assert.strictEqual(
        bd, si.amount,
        `${line.lineKey} ${si.label} breakdown 소계 불일치: ${bd} ≠ ${si.amount}`
      );
    }
  }
}

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
