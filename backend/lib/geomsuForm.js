const path = require('path');
const { fillHwpx } = require('./hwpxFill');
const { buildPhotoItem, buildSignatureItem } = require('./hwpxBlocks');

// ═══════════════════════════════════════════════════════════════
// 검수조서 (2026-10 최신판 — 5월 제출본 형식).
//   5월에 실제로 낸 검수조서는 「검 수 조 서」 물품 검수 형식이다:
//   품명·규격·수량·비고 표(4행) + 사진 2×2(4장) + 「상기 물품을 정히 영수함.」 + 날짜 +
//   「노드트리 행정실무 성명 이한희」와 서명.
//   템플릿 = 5월 제출본(한컴 저장본)에서 사진·서명·글을 뺀 것.
// ═══════════════════════════════════════════════════════════════

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'forms', '검수조서.hwpx');

const MAX_ITEMS = 4;
const PHOTO_BOX = { maxWidth: 19956, maxHeight: 14967 };
const SIGNATURE_PLACE = { width: 5950, height: 2629, vertOffset: 951, horzOffset: 35324 };

const str = (v) => (v == null ? '' : String(v).trim());

function normalizeItems(b) {
  const list = Array.isArray(b.품목) ? b.품목 : [];
  return list
    .map((it) => ({ 품명: str(it && it.품명), 규격: str(it && it.규격), 수량: str(it && it.수량), 비고: str(it && it.비고) }))
    .filter((it) => it.품명 || it.규격 || it.수량 || it.비고)
    .slice(0, MAX_ITEMS);
}

// photos: { 사진1..4: Buffer|null }
function buildGeomsuBlocks(body, photos = {}) {
  const b = body || {};
  const images = [];
  const items = normalizeItems(b);
  const blocks = {};
  for (let i = 1; i <= MAX_ITEMS; i++) {
    const it = items[i - 1] || {};
    for (const k of ['품명', '규격', '수량', '비고']) blocks[`${k}${i}`] = [it[k] || ''];
  }
  for (let i = 1; i <= 4; i++) {
    const p = buildPhotoItem(photos[`사진${i}`], { slot: `geomsu${i}`, ...PHOTO_BOX });
    if (p) images.push(p.image);
    blocks[`사진${i}`] = p ? [p.item] : [''];
  }
  const sig = buildSignatureItem('damdangja', SIGNATURE_PLACE, 'geomsu');
  if (sig) images.push(sig.image);
  blocks.서명 = sig ? [sig.item] : [''];
  return { blocks, images, items };
}

function buildGeomsuReplacements(body) {
  const b = body || {};
  return {
    '{{확인년}}': str(b.확인년),
    '{{확인월}}': str(b.확인월),
    '{{확인일}}': str(b.확인일),
    '{{담당자}}': str(b.담당자) || '이한희',
  };
}

function sanitizeForFilename(s) {
  return String(s || '')
    .replace(/[/\\:*?"<>|()]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .slice(0, 30);
}

async function generateGeomsuForm(body, photos = {}) {
  const { blocks, images, items } = buildGeomsuBlocks(body, photos);
  const buffer = await fillHwpx(TEMPLATE_PATH, buildGeomsuReplacements(body), {}, { blocks, extraImages: images });
  const first = items[0] ? sanitizeForFilename(items[0].품명) : '';
  return { buffer, filenameBase: ['검수조서', first].filter(Boolean).join('_') };
}

module.exports = {
  generateGeomsuForm,
  buildGeomsuBlocks,
  buildGeomsuReplacements,
  normalizeItems,
  TEMPLATE_PATH,
};
