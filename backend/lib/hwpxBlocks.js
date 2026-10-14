const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// HWPX 문단 블록·사진·서명 (2026-10).
//   템플릿은 한컴이 저장한 최신 제출본에서 사진·서명·실제 글을 뺀 것이다.
//   값 칸에는 두 종류의 자리표시가 있다.
//     · {{키}}   글자 자리표시 — fillHwpx 가 글자만 바꾼다(기존 방식).
//     · {{@키}}  문단 자리표시 — 이 문단 하나를 여러 문단으로 바꾼다.
//                칸 안에 「○ 세부내용 …」「가. …」처럼 여러 줄을 넣거나, 사진·서명 그림을 넣는 통로다.
//   문단 블록의 항목:
//     · '문자열'                     자리표시 문단의 글자 서식 그대로 한 문단
//     · { text, style }              styles[style] 글자 서식(예: 굵은 소제목)
//     · { pic }                      사진 한 장(글자처럼 취급) — buildPhotoItem 결과
//     · { floatPic }                 글 앞에 떠 있는 그림(서명) — buildSignatureItem 결과
//   빈 배열이면 빈 문단 하나를 남긴다(칸 높이·자리 유지).
// ═══════════════════════════════════════════════════════════════

function escapeXmlText(value) {
  if (value == null) return '';
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── 이미지 크기 읽기 ──────────────────────────────────────────────────────────
function readPngSize(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return null;
  if (buf.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// JPEG SOFn 마커에서 픽셀 크기. (C4·C8·CC 는 SOF 가 아니다)
function readJpegSize(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i++; // 채움 바이트(0xFF 0xFF …)
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

function readImageInfo(buf) {
  const png = readPngSize(buf);
  if (png) return { ...png, ext: 'png', mediaType: 'image/png' };
  const jpg = readJpegSize(buf);
  if (jpg) return { ...jpg, ext: 'jpg', mediaType: 'image/jpg' };
  return null;
}

// ── 그림 XML(한컴 저장본 구조 그대로) ─────────────────────────────────────────
//   원본 크기 orgSz = 픽셀×100, imgDim·imgClip = 픽셀×75 — 한컴이 저장한 값과 같은 규칙.
//   floating=false 면 글자처럼 취급(칸 안 사진), true 면 글 앞에 떠 있는 그림(서명).
function buildPicXml({
  itemId,
  pixelWidth,
  pixelHeight,
  width,
  height,
  id,
  instid,
  zOrder = 0,
  floating = false,
  vertOffset = 0,
  horzOffset = 0,
}) {
  const W = Math.round(width);
  const H = Math.round(height);
  const ow = Math.round(pixelWidth * 100);
  const oh = Math.round(pixelHeight * 100);
  const dw = Math.round(pixelWidth * 75);
  const dh = Math.round(pixelHeight * 75);
  const sx = (W / ow).toFixed(6);
  const sy = (H / oh).toFixed(6);
  return (
    `<hp:pic id="${id}" zOrder="${zOrder}" numberingType="PICTURE" textWrap="${floating ? 'IN_FRONT_OF_TEXT' : 'TOP_AND_BOTTOM'}" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${instid}" reverse="0">` +
    `<hp:offset x="0" y="0"/><hp:orgSz width="${ow}" height="${oh}"/><hp:curSz width="${W}" height="${H}"/>` +
    `<hp:flip horizontal="0" vertical="0"/>` +
    `<hp:rotationInfo angle="0" centerX="${Math.round(W / 2)}" centerY="${Math.round(H / 2)}" rotateimage="1"/>` +
    `<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>` +
    `<hc:scaMatrix e1="${sx}" e2="0" e3="0" e4="0" e5="${sy}" e6="0"/>` +
    `<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>` +
    `<hc:img binaryItemIDRef="${itemId}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>` +
    `<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${ow}" y="0"/><hc:pt2 x="${ow}" y="${oh}"/><hc:pt3 x="0" y="${oh}"/></hp:imgRect>` +
    `<hp:imgClip left="0" right="${dw}" top="0" bottom="${dh}"/>` +
    `<hp:inMargin left="0" right="0" top="0" bottom="0"/>` +
    `<hp:imgDim dimwidth="${dw}" dimheight="${dh}"/><hp:effects/>` +
    `<hp:sz width="${W}" widthRelTo="ABSOLUTE" height="${H}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="${floating ? 0 : 1}" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="${Math.round(vertOffset)}" horzOffset="${Math.round(horzOffset)}"/>` +
    `<hp:outMargin left="0" right="0" top="0" bottom="0"/>` +
    `<hp:shapeComment>그림입니다.</hp:shapeComment></hp:pic>`
  );
}

// 칸에 맞는 사진 크기: 가로 maxWidth 안, 세로 maxHeight 안에서 비율 유지.
function fitSize(pixelWidth, pixelHeight, maxWidth, maxHeight) {
  const ratio = pixelWidth / pixelHeight || 1;
  let W = maxWidth;
  if (maxHeight && W / ratio > maxHeight) W = maxHeight * ratio;
  return { width: Math.round(W), height: Math.round(W / ratio) };
}

// 사진 한 장 → { item, image }. item 은 블록 항목, image 는 fillHwpx extraImages 항목.
//   buffer 가 없거나 PNG/JPEG 가 아니면 null(호출부가 안내 글 등으로 대체).
let picSeq = 0;
function buildPhotoItem(buffer, { slot, maxWidth, maxHeight }) {
  const info = Buffer.isBuffer(buffer) ? readImageInfo(buffer) : null;
  if (!info) return null;
  const itemId = `photo_${slot}`;
  const fileName = `${itemId}.${info.ext}`;
  const { width, height } = fitSize(info.width, info.height, maxWidth, maxHeight);
  picSeq = (picSeq + 2) % 100000;
  const pic = buildPicXml({
    itemId,
    pixelWidth: info.width,
    pixelHeight: info.height,
    width,
    height,
    id: 1900000001 + picSeq,
    instid: 900000001 + picSeq,
    zOrder: 10 + (picSeq % 50),
  });
  return { item: { pic }, image: { itemId, fileName, buffer, mediaType: info.mediaType } };
}

// ── 서명(글 앞에 떠 있는 그림) ───────────────────────────────────────────────
//   서명 이미지는 저장소에 커밋하지 않는다(공개 저장소 — 위조 위험).
//     · 운영(Vercel): env 에 PNG base64
//     · 로컬: backend/templates/forms/signature_<역할>.png (.gitignore)
const SIGNATURE_SOURCES = {
  damdangja: { env: 'KKUMDARAK_SIGNATURE_PNG_B64', file: 'signature_damdangja.png' }, // 담당자 이한희
  gyeoljaeja: { env: 'KKUMDARAK_SIGNATURE_APPROVER_PNG_B64', file: 'signature_gyeoljaeja.png' }, // 결재자 이화영
};
const signatureCache = {};
function loadSignature(role) {
  if (signatureCache[role] !== undefined) return signatureCache[role];
  const src = SIGNATURE_SOURCES[role];
  let buf = null;
  if (src) {
    const b64 = process.env[src.env];
    if (b64 && b64.trim()) {
      try {
        const raw = b64.trim().replace(/^data:image\/png;base64,/, '');
        const decoded = Buffer.from(raw, 'base64');
        if (readPngSize(decoded)) buf = decoded;
        else console.warn(`${src.env} 이 PNG 로 해석되지 않습니다 — 파일 폴백`);
      } catch (e) {
        console.warn(`${src.env} 디코드 실패 — 파일 폴백:`, e.message);
      }
    }
    if (!buf) {
      const p = path.join(__dirname, '..', 'templates', 'forms', src.file);
      if (fs.existsSync(p)) buf = fs.readFileSync(p);
    }
  }
  signatureCache[role] = buf;
  return buf;
}

// 서명 → { item, image } 또는 null(서명 없음 → 빈 문단, 「(인)」 글자만 남음).
//   place: 한컴 저장본에서 잰 자리 { width, height, vertOffset, horzOffset }.
//   서명 이미지 비율이 원래와 달라도 세로 가운데가 같은 자리에 오게 맞춘다.
function buildSignatureItem(role, place, slot = role) {
  const buffer = loadSignature(role);
  const size = buffer ? readPngSize(buffer) : null;
  if (!size || !size.width || !size.height) return null;
  const itemId = `sign_${slot}`;
  const width = place.width;
  const height = Math.round((width * size.height) / size.width);
  const vertOffset = place.vertOffset + Math.round(((place.height || height) - height) / 2);
  picSeq = (picSeq + 2) % 100000;
  const pic = buildPicXml({
    itemId,
    pixelWidth: size.width,
    pixelHeight: size.height,
    width,
    height,
    id: 1900000001 + picSeq,
    instid: 900000001 + picSeq,
    zOrder: 60 + (picSeq % 30),
    floating: true,
    vertOffset,
    horzOffset: place.horzOffset,
  });
  return {
    item: { floatPic: pic },
    image: { itemId, fileName: `${itemId}.png`, buffer, mediaType: 'image/png' },
  };
}

// ── 문단 블록 펼치기 ─────────────────────────────────────────────────────────
//   {{@키}} 가 든 문단(다른 문단을 품지 않은 가장 안쪽 문단)을 items 문단들로 바꾼다.
//   새 문단은 자리표시 문단의 문단 서식(<hp:p> 속성)을 그대로 쓴다. 줄배치 캐시는 넣지 않는다
//   (fillHwpx 가 마지막에 전부 지워 한글이 다시 계산한다).
function paragraphTokenRe(key) {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `<hp:p\\b[^>]*>(?:(?!<hp:p\\b|<\\/hp:p>)[\\s\\S])*?\\{\\{@${k}\\}\\}(?:(?!<hp:p\\b|<\\/hp:p>)[\\s\\S])*?<\\/hp:p>`,
  );
}

function renderItems(pOpen, baseCharPr, items, styles) {
  const list = Array.isArray(items) && items.length ? items : [''];
  return list
    .map((it) => {
      if (it && typeof it === 'object' && it.pic) {
        return `${pOpen}<hp:run charPrIDRef="${baseCharPr}">${it.pic}<hp:t/></hp:run></hp:p>`;
      }
      if (it && typeof it === 'object' && it.floatPic) {
        return `${pOpen}<hp:run charPrIDRef="${baseCharPr}">${it.floatPic}<hp:t/></hp:run></hp:p>`;
      }
      const text = it && typeof it === 'object' ? it.text : it;
      const cp = (it && typeof it === 'object' && it.style && styles[it.style]) || baseCharPr;
      const t = text == null ? '' : String(text);
      return t
        ? `${pOpen}<hp:run charPrIDRef="${cp}"><hp:t>${escapeXmlText(t)}</hp:t></hp:run></hp:p>`
        : `${pOpen}<hp:run charPrIDRef="${cp}"/></hp:p>`;
    })
    .join('');
}

function expandParagraphBlocks(xml, blocks = {}, styles = {}) {
  let out = xml;
  for (const [key, items] of Object.entries(blocks)) {
    const re = paragraphTokenRe(key);
    // 같은 자리표시가 여러 번 나오면 모두 바꾼다(템플릿 실수 방어).
    for (let guard = 0; guard < 20; guard++) {
      const m = out.match(re);
      if (!m) break;
      const pOpen = m[0].match(/^<hp:p\b[^>]*>/)[0];
      const cpMatch = m[0].match(/<hp:run charPrIDRef="(\d+)"/);
      const baseCharPr = cpMatch ? cpMatch[1] : '0';
      out = out.slice(0, m.index) + renderItems(pOpen, baseCharPr, items, styles) + out.slice(m.index + m[0].length);
    }
  }
  return out;
}

// ── 여러 줄 글 → 문단 항목 ───────────────────────────────────────────────────
//   줄바꿈 = 문단 나눔. 빈 줄은 빈 문단 하나로(연속 빈 줄은 하나로 줄인다). 앞뒤 빈 줄은 버린다.
//   keepIndent: 줄 앞 공백을 살린다(지출결의서 「 - 항목」처럼 들여쓰기가 서식인 경우).
function linesToItems(text, style, { keepIndent = false } = {}) {
  const lines = String(text == null ? '' : text)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''));
  const out = [];
  for (const l of lines) {
    const t = l.trim();
    if (!t) {
      if (out.length && out[out.length - 1].text !== '') out.push({ text: '', style });
      continue;
    }
    out.push({ text: keepIndent ? l : l.replace(/^\s+/, ''), style });
  }
  while (out.length && out[out.length - 1].text === '') out.pop();
  return out;
}

// 「○ 머리말  본문」 꼴: 첫 줄 앞에 머리말을 붙이고 나머지 줄은 그대로 잇는다.
function headedItems(head, text, style) {
  const items = linesToItems(text, style);
  if (!items.length) return [{ text: `${head}  `.trimEnd(), style }];
  items[0] = { ...items[0], text: `${head}  ${items[0].text}` };
  return items;
}

// ── 표 행 지우기 ─────────────────────────────────────────────────────────────
//   rowFrom..rowTo(포함) 행을 지우고 그 아래 행 번호를 당긴다. rowCnt 도 줄인다.
//   지울 행 안에서 시작하는 병합(rowSpan>1)이 있으면 아무것도 하지 않는다. 위쪽 행에서 내려와
//   지울 범위를 덮는 병합은 판별하지 않으므로, 그런 표에는 쓰지 말 것(현재 결과보고서 회차 행에는 없음).
function removeTableRows(xml, rowFrom, rowTo) {
  const n = rowTo - rowFrom + 1;
  if (n <= 0) return xml;
  const tblRe = /<hp:tbl\b[^>]*>[\s\S]*?<\/hp:tbl>/g;
  return xml.replace(tblRe, (tbl) => {
    const rows = tbl.match(/<hp:tr>[\s\S]*?<\/hp:tr>/g) || [];
    const rowOf = (tr) => {
      const m = tr.match(/rowAddr="(\d+)"/);
      return m ? Number(m[1]) : -1;
    };
    const targets = rows.filter((tr) => {
      const r = rowOf(tr);
      return r >= rowFrom && r <= rowTo;
    });
    if (targets.length !== n) return tbl;
    if (targets.some((tr) => /rowSpan="(?!1")\d+"/.test(tr))) return tbl;
    let out = tbl;
    for (const tr of targets) out = out.replace(tr, '');
    out = out.replace(/rowAddr="(\d+)"/g, (m, r) => {
      const v = Number(r);
      return v > rowTo ? `rowAddr="${v - n}"` : m;
    });
    out = out.replace(/^<hp:tbl\b[^>]*>/, (tag) =>
      tag.replace(/rowCnt="(\d+)"/, (m, c) => `rowCnt="${Number(c) - n}"`),
    );
    return out;
  });
}

module.exports = {
  escapeXmlText,
  readPngSize,
  readJpegSize,
  readImageInfo,
  buildPicXml,
  fitSize,
  buildPhotoItem,
  buildSignatureItem,
  loadSignature,
  expandParagraphBlocks,
  linesToItems,
  headedItems,
  removeTableRows,
  SIGNATURE_SOURCES,
};
