const path = require('path');
const { fillHwpx } = require('./hwpxFill');

// ═══════════════════════════════════════════════════════════════
// 서식5 출강확인서 — body(클라이언트가 조립한 21개 값) → HWPX 채움.
//   프론트(FormsView)가 출강강사·기수회차·교육일자 등 합성문자열을 모두 만들어 보내고,
//   서버는 얇은 매퍼로만 동작한다(세션/프로그램 재조회·주강사 배열 처리 불필요).
//   템플릿 경로는 __dirname 기준(서버리스 번들) — vercel.json includeFiles 로 포함.
//   진행사진(선택): BinData/chulgang_photo.png 바이트를 업로드 PNG 로 교체(없으면 더미 유지).
// ═══════════════════════════════════════════════════════════════

// backend/lib → ../templates/forms/서식5_출강확인서.hwpx
const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'forms',
  '서식5_출강확인서.hwpx',
);

// 템플릿에 박힌 더미 사진 엔트리(BinData/<이 이름>) — 업로드 시 이 바이트만 교체.
const PHOTO_BINDATA_KEY = 'chulgang_photo.png';

// 서식5 의 21개 플레이스홀더. body 누락 키는 ''(미치환 토큰 방지 — fillHwpx 가 throw).
const PLACEHOLDER_KEYS = [
  '출강강사',
  '교육장소',
  '교육장소상세',
  '강사수',
  '프로그램명',
  '기수회차',
  '정원',
  '실참여',
  '교육일자',
  '교육시간',
  '교육주제',
  '교육목표',
  '세부내용',
  '교육재료',
  '평가_운영',
  '평가_반응',
  '평가_보완',
  '확인년',
  '확인월',
  '확인일',
  '담당자',
];

function buildChulgangReplacements(body) {
  const b = body || {};
  const repl = {};
  for (const key of PLACEHOLDER_KEYS) {
    const v = b[key];
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

// 다운로드 파일명 베이스: 출강확인서_{프로그램}_{N회차}
function buildFilenameBase(body) {
  const b = body || {};
  const program = sanitizeForFilename(b.프로그램명);
  // 기수회차 "(1기수 / 5회차)" 에서 "N회차" 추출(없으면 생략)
  const m = String(b.기수회차 || '').match(/(\d+)\s*회차/);
  const hoecha = m ? `${m[1]}회차` : '';
  return ['출강확인서', program, hoecha].filter(Boolean).join('_');
}

// photoBuffer(선택, Buffer): 있으면 BinData/chulgang_photo.png 교체. 없으면 더미 유지(회귀 없음).
async function generateChulgangForm(body, photoBuffer) {
  const replacements = buildChulgangReplacements(body);
  const imageReplacements =
    photoBuffer && Buffer.isBuffer(photoBuffer)
      ? { [PHOTO_BINDATA_KEY]: photoBuffer }
      : {};
  const buffer = await fillHwpx(TEMPLATE_PATH, replacements, imageReplacements);
  const filenameBase = buildFilenameBase(body);
  return { buffer, filenameBase };
}

module.exports = {
  generateChulgangForm,
  buildChulgangReplacements,
  buildFilenameBase,
  PLACEHOLDER_KEYS,
  PHOTO_BINDATA_KEY,
  TEMPLATE_PATH,
};
