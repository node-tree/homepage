const path = require('path');
const { fillHwpx } = require('./hwpxFill');

// ═══════════════════════════════════════════════════════════════
// 서식7 회의록 — body(클라이언트가 조립한 21개 값) → HWPX 채움.
//   chulgangForm.js 와 동일 패턴: 서버는 얇은 매퍼, 클라이언트가 합성문자열 조립.
//   템플릿 경로는 __dirname 기준(서버리스 번들) — vercel.json includeFiles 로 포함.
//   회의사진(선택): BinData/hoeuirok_photo.png 바이트를 업로드 PNG 로 교체(없으면 더미 유지).
//
//   ── 안건 셀 belt(2026-06) ──
//   AI "자세하게" 강화로 결정사항(안건N_1·_2)이 "맥락 한 문장 + 결정"으로 길어질 수 있어,
//   해당 셀에 글자수 상한(DECISION_CAP)을 둔다. 개행은 한글 단일run 셀에서 렌더 안 되므로 공백화.
// ═══════════════════════════════════════════════════════════════

// backend/lib → ../templates/forms/서식7_회의록.hwpx
const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'forms',
  '서식7_회의록.hwpx',
);

// 템플릿에 박힌 더미 사진 엔트리(BinData/<이 이름>) — 업로드 시 이 바이트만 교체.
const PHOTO_BINDATA_KEY = 'hoeuirok_photo.png';

// 서식7 의 21개 플레이스홀더(헤더 6 + 안건 5슬롯 × {본문,_1,_2}=15).
//   body 누락 키는 ''(미치환 토큰 방지 — fillHwpx 가 throw).
const PLACEHOLDER_KEYS = [
  '회의일시',
  '회의장소',
  '회의장소상세',
  '참석인원',
  '참석자',
  '회의주제',
  '안건1', '안건1_1', '안건1_2',
  '안건2', '안건2_1', '안건2_2',
  '안건3', '안건3_1', '안건3_2',
  '안건4', '안건4_1', '안건4_2',
  '안건5', '안건5_1', '안건5_2',
];

// 결정사항(안건N_1/_2) 셀 상한 — "맥락 + 결정" 한 줄이 회의록 셀을 넘치지 않게.
const DECISION_CAP = 130;
// 안건 제목(안건N) 셀 상한.
const TITLE_CAP = 60;
const isDecisionKey = (k) => /^안건\d+_[12]$/.test(k);
const isTitleKey = (k) => /^안건\d+$/.test(k);

function clampCell(value, cap) {
  const v = (value == null ? '' : String(value)).replace(/\s*[\r\n]+\s*/g, ' ').trim();
  if (!cap || v.length <= cap) return v;
  const slice = v.slice(0, cap);
  const sent = Math.max(slice.lastIndexOf('다. '), slice.lastIndexOf('. '), slice.lastIndexOf('함. '));
  if (sent > cap * 0.6) return slice.slice(0, sent + 1).trim();
  const sp = slice.lastIndexOf(' ');
  return (sp > cap * 0.6 ? slice.slice(0, sp) : slice).trim() + '…';
}

function buildHoeuirokReplacements(body) {
  const b = body || {};
  const repl = {};
  for (const key of PLACEHOLDER_KEYS) {
    const v = b[key];
    let out;
    if (isDecisionKey(key)) out = clampCell(v, DECISION_CAP);
    else if (isTitleKey(key)) out = clampCell(v, TITLE_CAP);
    else out = v == null ? '' : String(v);
    repl[`{{${key}}}`] = out;
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

// 다운로드 파일명 베이스: 회의록_{회의주제}. 회의일시는 자유텍스트라 파싱 불가 → 주제 사용.
function buildFilenameBase(body) {
  const subject = sanitizeForFilename((body || {}).회의주제);
  return ['회의록', subject].filter(Boolean).join('_') || '회의록';
}

// photoBuffer(선택, Buffer): 있으면 BinData/hoeuirok_photo.png 교체. 없으면 더미 유지(회귀 없음).
async function generateHoeuirokForm(body, photoBuffer) {
  const replacements = buildHoeuirokReplacements(body);
  const imageReplacements =
    photoBuffer && Buffer.isBuffer(photoBuffer)
      ? { [PHOTO_BINDATA_KEY]: photoBuffer }
      : {};
  const buffer = await fillHwpx(TEMPLATE_PATH, replacements, imageReplacements);
  const filenameBase = buildFilenameBase(body);
  return { buffer, filenameBase };
}

module.exports = {
  generateHoeuirokForm,
  buildHoeuirokReplacements,
  buildFilenameBase,
  clampCell,
  DECISION_CAP,
  PLACEHOLDER_KEYS,
  PHOTO_BINDATA_KEY,
  TEMPLATE_PATH,
};
