const path = require('path');
const { fillHwpx } = require('./hwpxFill');
const { buildPhotoItem, linesToItems } = require('./hwpxBlocks');

// ═══════════════════════════════════════════════════════════════
// 서식7 회의록 (2026-10 최신판).
//   템플릿 = 9월 회의록(한컴 저장본)에서 사진·글을 뺀 것.
//   · 회의내용: 안건마다 굵은 제목 한 줄 + 결정 문단 여러 줄, 안건 사이 빈 줄(제출본과 같은 모양).
//     안건 수·줄 수 제한 없음(입력 글의 줄바꿈 = 문단).
//   · 회의사진 2장(비율 유지, 9월본 크기). 없으면 「사진삽입」 안내.
//   body.안건 = [{ 제목, 내용 }] (내용은 여러 줄 글 또는 줄 배열).
//   예전 형식(안건1, 안건1_1, 안건1_2 …)도 받아서 같은 모양으로 만든다.
// ═══════════════════════════════════════════════════════════════

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'forms', '서식7_회의록.hwpx');

// 템플릿 글자 서식: 본문 17(9pt 검정), 안건 제목 16(9pt 굵게)
const STYLES = { title: '16' };
// 9월 제출본 사진 크기(한 쪽 안에 들어가게 줄인 값)
const PHOTO_BOX = { maxWidth: 15400, maxHeight: 11550 };
const MAX_AGENDA = 30; // 화면은 제한 없음 — 비정상 입력 방어용
const MAX_LINE = 600;

const str = (v) => (v == null ? '' : String(v).trim());

function normalizeAgenda(body) {
  const b = body || {};
  let list = [];
  if (Array.isArray(b.안건)) {
    list = b.안건.map((a) => ({
      제목: str(a && a.제목),
      내용: Array.isArray(a && a.내용) ? a.내용.map(str).join('\n') : str(a && a.내용),
    }));
  } else {
    for (let n = 1; n <= 5; n++) {
      list.push({ 제목: str(b[`안건${n}`]), 내용: [str(b[`안건${n}_1`]), str(b[`안건${n}_2`])].filter(Boolean).join('\n') });
    }
  }
  return list.filter((a) => a.제목 || a.내용).slice(0, MAX_AGENDA);
}

function agendaItems(list) {
  const items = [];
  list.forEach((a, i) => {
    if (i) items.push('');
    if (a.제목) items.push({ text: a.제목, style: 'title' });
    for (const it of linesToItems(a.내용)) {
      items.push(it.text.length > MAX_LINE ? { ...it, text: it.text.slice(0, MAX_LINE) } : it);
    }
  });
  return items;
}

function buildHoeuirokBlocks(body, photos = {}) {
  const b = body || {};
  const images = [];
  const photoBlock = (buffer, slot) => {
    const p = buildPhotoItem(buffer, { slot, ...PHOTO_BOX });
    if (!p) return ['사진삽입'];
    images.push(p.image);
    return [p.item];
  };
  const blocks = {
    회의일시: [str(b.회의일시)],
    회의장소: [str(b.회의장소), str(b.회의장소상세)].filter(Boolean),
    참석인원: [str(b.참석인원)],
    참석자: [str(b.참석자)],
    회의주제: linesToItems(b.회의주제),
    회의내용: agendaItems(normalizeAgenda(b)),
    사진1: photoBlock(photos.사진1, 'meeting1'),
    사진2: photoBlock(photos.사진2, 'meeting2'),
  };
  return { blocks, images };
}

function sanitizeForFilename(s) {
  return String(s || '')
    .replace(/[/\\:*?"<>|〈〉]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

// 다운로드 파일명: 회의록_{회의주제}
function buildFilenameBase(body) {
  const subject = sanitizeForFilename((body || {}).회의주제).slice(0, 40);
  return ['회의록', subject].filter(Boolean).join('_') || '회의록';
}

async function generateHoeuirokForm(body, photos = {}) {
  const { blocks, images } = buildHoeuirokBlocks(body, photos);
  const buffer = await fillHwpx(TEMPLATE_PATH, {}, {}, { blocks, styles: STYLES, extraImages: images });
  return { buffer, filenameBase: buildFilenameBase(body) };
}

module.exports = {
  generateHoeuirokForm,
  buildHoeuirokBlocks,
  normalizeAgenda,
  buildFilenameBase,
  TEMPLATE_PATH,
};
