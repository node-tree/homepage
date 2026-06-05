const path = require('path');
const { fillHwpx, numToKorean, formatKoreanDate } = require('./hwpxFill');

// ═══════════════════════════════════════════════════════════════
// 서식11 지출결의서 — body(클라이언트 조립 값 / 집행 트랜잭션 매핑) → HWPX 채움.
//   chulgang/hoeuirok/gyeolgwa 와 동일 패턴: 서버는 얇은 매퍼.
//   템플릿(서식11_지출결의서.hwpx)은 제공된 정식 원본 양식을 그대로 사용하며,
//   값 셀에만 단일run 플레이스홀더({{키}})를 심고 채우는 값은 검정(charPr 31/32/33)으로 둔다.
//   안내문구·예산분류 나열·하단 임차물품 반납표는 원본 리터럴 그대로(토큰 아님).
//
//   금액은 단일 amount 에서 한글(numToKorean)·숫자(toLocaleString) 둘 다 파생 — 불일치 방지.
//   날짜는 formatKoreanDate(UTC 게터)로 'YYYY. M. D.' — YYYY-MM-DD 가 UTC 자정 저장돼도 하루 밀림 없음.
//   미치환 토큰은 fillHwpx 가 throw(누락 가드).
// ═══════════════════════════════════════════════════════════════

// backend/lib → ../templates/forms/서식11_지출결의서.hwpx
const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'forms',
  '서식11_지출결의서.hwpx',
);

// 템플릿의 12개 플레이스홀더(단일run). 누락 키는 ''(미치환 토큰 방지).
const PLACEHOLDER_KEYS = [
  '단체명',
  '담당자',
  '결제일',
  '결의일',
  '항',
  '목',
  '세',
  '추진명',
  '추진일시',
  '금액한글',
  '금액숫자',
  '지급처',
];

// body → 치환맵. amount(숫자) 하나에서 금액한글/금액숫자를 함께 산출한다.
//   날짜(결제일/결의일)는 YYYY-MM-DD 또는 빈값 허용 → 'YYYY. M. D.'.
function buildJichulReplacements(body) {
  const b = body || {};

  const amount = Number(b.amount != null ? b.amount : b.금액) || 0;
  const 금액숫자 = amount.toLocaleString('ko-KR');
  const 금액한글 = numToKorean(amount); // 예: 100000 → '일십만'

  // 날짜: 명시 포맷(이미 'YYYY. M. D.')이면 그대로, ISO/Date면 변환.
  const fmtDate = (v) => {
    if (!v) return '';
    const s = String(v);
    if (/^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?$/.test(s)) return s; // 이미 한글식
    return formatKoreanDate(v);
  };

  const values = {
    단체명: b.단체명 != null ? b.단체명 : '노드트리',
    담당자: b.담당자 || '',
    결제일: fmtDate(b.결제일),
    결의일: fmtDate(b.결의일),
    항: b.항 || '',
    목: b.목 || '',
    세: b.세 || '',
    추진명: b.추진명 || '',
    추진일시: b.추진일시 || '',
    금액한글,
    금액숫자,
    지급처: b.지급처 || '',
  };

  const repl = {};
  for (const key of PLACEHOLDER_KEYS) {
    const v = values[key];
    repl[`{{${key}}}`] = v == null ? '' : String(v);
  }
  return repl;
}

async function generateJichulForm(body) {
  const replacements = buildJichulReplacements(body);
  const buffer = await fillHwpx(TEMPLATE_PATH, replacements);
  const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
  const titlePart = safe((body && (body.추진명 || body.목)) || '지출결의서');
  const filenameBase = `서식11_지출결의서_${titlePart}`;
  return { buffer, filenameBase };
}

module.exports = { generateJichulForm, buildJichulReplacements, PLACEHOLDER_KEYS };
