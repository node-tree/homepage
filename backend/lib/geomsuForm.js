const path = require('path');
const { fillHwpx, formatKoreanDate } = require('./hwpxFill');

// ═══════════════════════════════════════════════════════════════
// 검수조서(일반용역비) — body(클라이언트 조립 값) → HWPX 채움.
//   jichul(서식11)·chulgang/hoeuirok(서식5/7) 패턴 결합: 텍스트 단일run 플레이스홀더 +
//   photo BinData 임베드(2슬롯). 서버는 얇은 매퍼.
//   템플릿(검수조서_일반용역비.hwpx)은 제공된 빈 양식을 기반으로 값 셀에만 단일run
//   플레이스홀더({{키}})를 심고 채우는 값은 검정(charPr 3)으로 둔다.
//   보조사업명·수행기관·검수책임자(이화영)는 리터럴 유지(토큰 아님).
//
//   금액은 amount(숫자) 하나에서 toLocaleString 산출. 날짜는 formatKoreanDate(UTC) —
//   YYYY-MM-DD 가 UTC 자정 저장돼도 하루 밀림 없음. 미치환 토큰은 fillHwpx 가 throw.
// ═══════════════════════════════════════════════════════════════

// backend/lib → ../templates/forms/검수조서_일반용역비.hwpx
const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'forms',
  '검수조서_일반용역비.hwpx',
);

// 템플릿에 박힌 더미 사진 엔트리(BinData/<이 이름>) — 업로드 시 이 바이트만 교체.
const PHOTO_BINDATA_KEY_1 = 'geomsu_photo1.png';
const PHOTO_BINDATA_KEY_2 = 'geomsu_photo2.png';

// 템플릿의 7개 텍스트 플레이스홀더(단일run). 누락 키는 ''(미치환 토큰 방지).
const PLACEHOLDER_KEYS = [
  '용역명',
  '계약상대자',
  '계약금액',
  '검수일자',
  '산출물링크',
  '검수결과',
  '검수의견',
];

// 검수결과 3택 → 체크박스 라인('■' 선택 / '□' 미선택). 라벨은 양식 원문과 동일.
const RESULT_LABELS = {
  pass: '합격',
  conditional: '보완 후 합격',
  fail: '불합격',
};
const RESULT_ORDER = ['pass', 'conditional', 'fail'];

function buildResultLine(result) {
  const chosen = RESULT_ORDER.includes(result) ? result : null;
  return RESULT_ORDER.map((k) => {
    const box = k === chosen ? '■' : '□';
    return `${box} ${RESULT_LABELS[k]}`;
  }).join('      ');
}

// 날짜: 이미 'YYYY. M. D.' 면 그대로, ISO/Date면 변환(jichulForm 과 동일 규칙).
function fmtDate(v) {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?$/.test(s)) return s;
  return formatKoreanDate(v);
}

function buildGeomsuReplacements(body) {
  const b = body || {};
  const amount = Number(b.amount != null ? b.amount : b.계약금액) || 0;
  const 계약금액 = amount.toLocaleString('ko-KR');

  // 산출물 링크: 'https://' 가 비면 빈칸이 어색 → 입력 없으면 'https://' 유지.
  const linkRaw = (b.산출물링크 != null ? b.산출물링크 : b.link) || '';
  const 산출물링크 = String(linkRaw).trim() || 'https://';

  const values = {
    용역명: b.용역명 || '',
    계약상대자: b.계약상대자 || '',
    계약금액,
    검수일자: fmtDate(b.검수일자),
    산출물링크,
    검수결과: buildResultLine(b.검수결과),
    검수의견: b.검수의견 || '',
  };

  const repl = {};
  for (const key of PLACEHOLDER_KEYS) {
    const v = values[key];
    repl[`{{${key}}}`] = v == null ? '' : String(v);
  }
  return repl;
}

// 파일시스템·헤더 안전을 위해 금지문자 제거(파일명 fallback 용)
function sanitizeForFilename(s) {
  return String(s || '')
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function buildFilenameBase(body) {
  const name = sanitizeForFilename((body || {}).용역명);
  return ['검수조서', name].filter(Boolean).join('_') || '검수조서';
}

// photoBuffer1/2(선택, Buffer): 있으면 해당 BinData 교체. 없으면 더미 유지(회귀 없음).
async function generateGeomsuForm(body, photoBuffer1, photoBuffer2) {
  const replacements = buildGeomsuReplacements(body);
  const imageReplacements = {};
  if (photoBuffer1 && Buffer.isBuffer(photoBuffer1)) {
    imageReplacements[PHOTO_BINDATA_KEY_1] = photoBuffer1;
  }
  if (photoBuffer2 && Buffer.isBuffer(photoBuffer2)) {
    imageReplacements[PHOTO_BINDATA_KEY_2] = photoBuffer2;
  }
  const buffer = await fillHwpx(TEMPLATE_PATH, replacements, imageReplacements);
  const filenameBase = buildFilenameBase(body);
  return { buffer, filenameBase };
}

module.exports = {
  generateGeomsuForm,
  buildGeomsuReplacements,
  buildResultLine,
  buildFilenameBase,
  PLACEHOLDER_KEYS,
  PHOTO_BINDATA_KEY_1,
  PHOTO_BINDATA_KEY_2,
  TEMPLATE_PATH,
};
