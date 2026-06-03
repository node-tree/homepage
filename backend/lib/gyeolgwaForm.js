const path = require('path');
const { fillHwpx } = require('./hwpxFill');

// ═══════════════════════════════════════════════════════════════
// 서식6 프로그램 기획·개발 결과보고서 — body(클라이언트 조립 32개 값) → HWPX 채움.
//   chulgangForm.js / hoeuirokForm.js 와 동일 패턴: 서버는 얇은 매퍼.
//   템플릿 경로는 __dirname 기준(서버리스 번들) — vercel.json includeFiles 로 포함.
//   사진: 서식6 템플릿엔 더미 사진칸(BinData)이 임베드돼 있지 않으므로 photoBuffer 는
//   현재 무시된다(없는 BinData 키는 fillHwpx 가 안전하게 무시 — 회귀 없음). 텍스트만 채움.
// ═══════════════════════════════════════════════════════════════

// backend/lib → ../templates/forms/서식6_결과보고서.hwpx
const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'forms',
  '서식6_결과보고서.hwpx',
);

// 향후 서식6 에 사진칸이 임베드되면 이 키로 교체(현재 템플릿엔 미존재 — 무시됨).
const PHOTO_BINDATA_KEY = 'gyeolgwa_photo.png';

// 서식6 의 32개 플레이스홀더. body 누락 키는 ''(미치환 토큰 방지 — fillHwpx 가 throw).
const PLACEHOLDER_KEYS = [
  '운영기관명',
  '교육대상',
  '세부대상',
  '교육인원',
  '참여인력수',
  '참여인력',
  '프로그램명',
  '장르',
  '주요내용',
  // 활동개요표 5행
  '일시1', '일시2', '일시3', '일시4', '일시5',
  '주제1', '주제2', '주제3', '주제4', '주제5',
  '참석1', '참석2', '참석3', '참석4', '참석5',
  // 세부내용(AI)
  '내용_역할',
  '내용_과정',
  '내용_실행',
  '내용_평가',
  // 확인일자/담당자
  '확인년',
  '확인월',
  '확인일',
  '담당자',
];

function buildGyeolgwaReplacements(body) {
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

// 다운로드 파일명 베이스: 결과보고서_{프로그램}
function buildFilenameBase(body) {
  const program = sanitizeForFilename((body || {}).프로그램명);
  return ['결과보고서', program].filter(Boolean).join('_') || '결과보고서';
}

// photoBuffer(선택): 서식6 엔 사진칸이 없어 현재 무시(없는 BinData 키 → fillHwpx 안전 무시).
async function generateGyeolgwaForm(body, photoBuffer) {
  const replacements = buildGyeolgwaReplacements(body);
  const imageReplacements =
    photoBuffer && Buffer.isBuffer(photoBuffer)
      ? { [PHOTO_BINDATA_KEY]: photoBuffer }
      : {};
  const buffer = await fillHwpx(TEMPLATE_PATH, replacements, imageReplacements);
  const filenameBase = buildFilenameBase(body);
  return { buffer, filenameBase };
}

module.exports = {
  generateGyeolgwaForm,
  buildGyeolgwaReplacements,
  buildFilenameBase,
  PLACEHOLDER_KEYS,
  PHOTO_BINDATA_KEY,
  TEMPLATE_PATH,
};
