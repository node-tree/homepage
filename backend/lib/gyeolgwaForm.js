const path = require('path');
const { fillHwpx } = require('./hwpxFill');
const { buildPhotoItem, buildSignatureItem, linesToItems, removeTableRows } = require('./hwpxBlocks');

// ═══════════════════════════════════════════════════════════════
// 서식6 프로그램 기획·개발 결과보고서 (2026-10 최신판).
//   템플릿 = 9월 마을의 신호 결과보고서(한컴 저장본)에서 사진·서명·글을 뺀 것.
//   · 제목 「(N월)」 — 보고월.
//   · 활동 개요 회차 행: 입력한 만큼(1~5행), 남는 행은 지운다(9월 장암책정본은 3행).
//   · 세부내용: 굵은 번호 소제목 5개 + 본문 여러 문단(입력 글의 줄바꿈 = 문단), 소제목 사이 빈 줄.
//   · 활동사진 4장(칸 폭 9248, 세로 사진은 4:3 높이에 맞춤). 없으면 「사진삽입」 안내.
//   · 담당자 서명: 「(인)」 위에 떠 있는 그림(제출본과 같은 자리).
// ═══════════════════════════════════════════════════════════════

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'forms', '서식6_결과보고서.hwpx');

// 템플릿 글자 서식: 본문 12(9pt 검정), 소제목 19(9pt 굵게)
const STYLES = { head: '19' };
const PHOTO_BOX = { maxWidth: 9248, maxHeight: 6936 };
const SIGNATURE_PLACE = { width: 4989, height: 2204, vertOffset: 1064, horzOffset: 25723 };
const ROW_FIRST = 12; // 회차 1행의 표 행 번호
const MAX_ROWS = 5;

const SECTIONS = [
  ['역할', '1. 기획개발 참여인력 역할'],
  ['대상', '2. 대상 분석'],
  ['과정', '3. 기획개발 과정'],
  ['실행', '4. 프로그램 실행 계획'],
  ['평가', '5. 평가 및 성과 계획'],
];
const SECTION_CAP = 4000; // 비정상 입력 방어(9월본 소제목당 최대 약 2,100자)

const str = (v) => (v == null ? '' : String(v).trim());

// 세부내용 5칸. 예전 키(내용_역할/과정/실행/평가)도 받는다.
function normalizeSections(b) {
  const s = b.세부 && typeof b.세부 === 'object' ? b.세부 : {};
  return {
    역할: str(s.역할 != null ? s.역할 : b.내용_역할),
    대상: str(s.대상),
    과정: str(s.과정 != null ? s.과정 : b.내용_과정),
    실행: str(s.실행 != null ? s.실행 : b.내용_실행),
    평가: str(s.평가 != null ? s.평가 : b.내용_평가),
  };
}

function normalizeRows(b) {
  let rows = [];
  if (Array.isArray(b.회차)) {
    rows = b.회차.map((r) => ({ 일시: str(r && r.일시), 주제: str(r && r.주제), 참석: str(r && r.참석) }));
  } else {
    for (let i = 1; i <= MAX_ROWS; i++) rows.push({ 일시: str(b[`일시${i}`]), 주제: str(b[`주제${i}`]), 참석: str(b[`참석${i}`]) });
  }
  // 끝쪽 빈 행은 버린다(중간 빈 행은 자리 유지).
  while (rows.length && !rows[rows.length - 1].일시 && !rows[rows.length - 1].주제 && !rows[rows.length - 1].참석) rows.pop();
  return rows.slice(0, MAX_ROWS);
}

function sectionItems(sections) {
  const items = [];
  SECTIONS.forEach(([key, head], i) => {
    if (i) items.push('');
    items.push({ text: head, style: 'head' });
    items.push(...linesToItems(sections[key].slice(0, SECTION_CAP)));
  });
  return items;
}

function buildGyeolgwaBlocks(body, photos = {}) {
  const b = body || {};
  const images = [];
  const photoBlock = (buffer, slot) => {
    const p = buildPhotoItem(buffer, { slot, ...PHOTO_BOX });
    if (!p) return ['사진삽입'];
    images.push(p.image);
    return [p.item];
  };
  const sig = buildSignatureItem('damdangja', SIGNATURE_PLACE);
  if (sig) images.push(sig.image);

  const rows = normalizeRows(b);
  const blocks = {
    운영기관명: [str(b.운영기관명)],
    교육대상: [str(b.교육대상)],
    세부대상: linesToItems(b.세부대상),
    교육인원: [str(b.교육인원)],
    참여인력: linesToItems(b.참여인력),
    프로그램명: [str(b.프로그램명)],
    장르: [str(b.장르)],
    주요내용: linesToItems(b.주요내용),
    세부내용: sectionItems(normalizeSections(b)),
    사진1: photoBlock(photos.사진1, 'activity1'),
    사진2: photoBlock(photos.사진2, 'activity2'),
    사진3: photoBlock(photos.사진3, 'activity3'),
    사진4: photoBlock(photos.사진4, 'activity4'),
    서명: sig ? [sig.item] : [''],
  };
  for (let i = 1; i <= MAX_ROWS; i++) {
    const r = rows[i - 1] || { 일시: '', 주제: '', 참석: '' };
    blocks[`일시${i}`] = [r.일시];
    blocks[`주제${i}`] = [r.주제];
    blocks[`참석${i}`] = [r.참석];
  }
  // 회차 행: 입력이 하나도 없으면 1행은 남긴다.
  const keepRows = Math.max(1, rows.length);
  return { blocks, images, keepRows };
}

function buildGyeolgwaReplacements(body) {
  const b = body || {};
  return {
    '{{보고월}}': str(b.보고월) || '0',
    '{{참여인력수}}': str(b.참여인력수),
    '{{확인년}}': str(b.확인년),
    '{{확인월}}': str(b.확인월),
    '{{확인일}}': str(b.확인일),
    '{{담당자}}': str(b.담당자),
  };
}

function sanitizeForFilename(s) {
  return String(s || '')
    .replace(/[/\\:*?"<>|〈〉()（）]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

// 다운로드 파일명: 「{프로그램} 프로그램 기획·개발 결과보고서 {N}월」(제출본 이름 규칙)
function buildFilenameBase(body) {
  const b = body || {};
  const program = sanitizeForFilename(b.프로그램명);
  const month = str(b.보고월);
  return [program, '프로그램 기획·개발 결과보고서', month ? `${month}월` : ''].filter(Boolean).join(' ');
}

async function generateGyeolgwaForm(body, photos = {}) {
  const { blocks, images, keepRows } = buildGyeolgwaBlocks(body, photos);
  const transforms = [];
  if (keepRows < MAX_ROWS) {
    transforms.push((xml) => removeTableRows(xml, ROW_FIRST + keepRows, ROW_FIRST + MAX_ROWS - 1));
  }
  const buffer = await fillHwpx(TEMPLATE_PATH, buildGyeolgwaReplacements(body), {}, {
    blocks,
    styles: STYLES,
    extraImages: images,
    sectionTransforms: transforms,
  });
  return { buffer, filenameBase: buildFilenameBase(body) };
}

module.exports = {
  generateGyeolgwaForm,
  buildGyeolgwaBlocks,
  buildGyeolgwaReplacements,
  buildFilenameBase,
  normalizeSections,
  SECTIONS,
  TEMPLATE_PATH,
};
