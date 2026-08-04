const fs = require('fs');
const JSZip = require('jszip');

// ═══════════════════════════════════════════════════════════════
// HWPX 채움 파이프라인 (순수 Node).
//   HWPX = OPC/OCF(EPUB 계열) zip. 한글이 파일을 받아들이는 절대조건:
//     · mimetype 엔트리가 ZIP 의 "최초 엔트리"이며 ZIP_STORED(무압축)
//     · 나머지 엔트리는 DEFLATE
//   이를 보장하려고 in-place 재정렬이 아니라 새 JSZip 을 처음부터 다시 쌓는다.
//
//   치환 대상:
//     · 텍스트: 엔트리명이 'Contents/' 로 시작하고 '.xml' 로 끝나는 것만 UTF-8 디코드 후 문자열 치환.
//     · 이미지: BinData/<key> 엔트리의 바이트를 imageReplacements[key] Buffer 로 교체(있을 때만).
//   그 외 엔트리(content.hpf·기타)는 바이트 그대로 통과시켜 구조 100% 보존.
//   (content.hpf 는 이미지를 href/media-type 로만 참조 — 바이트 길이/해시 미보관이므로 바이트만 교체하면 됨.)
// ═══════════════════════════════════════════════════════════════

// 모든 occurrence 치환(replace 의 first-only 회피, 정규식/이스케이프 불필요).
function replaceAll(haystack, find, replacement) {
  if (!find) return haystack;
  return haystack.split(find).join(replacement == null ? '' : String(replacement));
}

// 텍스트 플레이스홀더 주입 값의 XML 텍스트 이스케이프.
//   값은 <hp:t> 요소 텍스트 노드로만 들어가므로 메타문자 &,<,> 만 처리(속성 아님 → ",' 불필요).
//   & 를 최우선으로 치환(이미 만든 엔티티의 & 가 다시 escape 되는 이중치환 방지).
//   금액 콤마·날짜·■/□ 검수결과 라인 등 사전조립 값은 메타문자가 없어 무해(no-op).
//   ⚠️ 텍스트 치환 경로에서만 호출 — imageReplacements(BinData 바이너리)에는 적용하지 않는다.
function escapeXmlText(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── 표 쪽나눔 정상화(2026-08) ────────────────────────────────────────────────
//   증상: 다운받아 열면 표가 이어지지 않고 통째로 다음 쪽으로 내려간다.
//   원인: 템플릿의 표가 «글자처럼 취급»(hp:pos treatAsChar="1") 이다. 한글은 글자처럼 취급된
//        표를 한 덩어리 글자로 보므로 쪽 경계에서 절대 나누지 못하고 통째로 밀어낸다
//        (pageBreak="CELL" 이 걸려 있어도 무시된다 — 두 설정은 함께 있어야 동작).
//   조치: 생성 시점에 ① 표의 쪽나눔을 '셀 단위로 나눔'(pageBreak="CELL")으로 보장하고
//        ② 글자처럼 취급을 해제(treatAsChar="0")한다. 위치 기준(PARA/offset 0)·본문 배치
//        (textWrap="TOP_AND_BOTTOM")는 건드리지 않아 표가 놓이는 자리는 그대로다.
//   템플릿 바이너리를 고치지 않고 코드에서 처리하는 이유: 5개 서식이 전부 같은 결함이고,
//   사용자가 한글에서 서식을 다시 저장해 교체해도 이 보정이 계속 적용되게 하기 위함.
//   반환: { xml, changed } — changed 는 보정한 속성 수(자가검증·로깅용).
function enableTableSplitAcrossPages(xml) {
  let changed = 0;

  // ① 표 자체 — 쪽 나눔 = 셀 단위로 나눔
  let out = xml.replace(/<hp:tbl\b[^>]*>/g, (tag) => {
    if (/pageBreak="CELL"/.test(tag)) return tag;
    changed++;
    return /pageBreak="[^"]*"/.test(tag)
      ? tag.replace(/pageBreak="[^"]*"/, 'pageBreak="CELL"')
      : tag.replace(/^<hp:tbl\b/, '<hp:tbl pageBreak="CELL"');
  });

  // ② 표의 위치 속성 — 글자처럼 취급 해제.
  //   <hp:tbl> 직후엔 <hp:sz/><hp:pos/> 가 연달아 오므로, 표 태그 뒤 400자 이내의 첫 hp:pos
  //   만 대상으로 삼는다(셀 안 이미지 등 다른 hp:pos 를 건드리지 않기 위한 경계).
  out = out.replace(/(<hp:tbl\b[^>]*>[\s\S]{0,400}?<hp:pos\b)([^>]*?)(\/>)/g, (m, head, attrs, tail) => {
    if (!/treatAsChar="1"/.test(attrs)) return m;
    changed++;
    return head + attrs.replace('treatAsChar="1"', 'treatAsChar="0"') + tail;
  });

  return { xml: out, changed };
}

// PNG IHDR 에서 픽셀 크기 읽기(서명 이미지 종횡비 계산용). PNG 가 아니면 null.
//   시그니처 8바이트 + 길이4 + 'IHDR'4 다음에 width(4) height(4) 빅엔디안.
function readPngSize(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 24) return null;
  if (buf.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null;
  if (buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// mm → HWPUNIT(1/7200 inch). 1 inch = 25.4mm.
const MM = 7200 / 25.4;
function mmToHwp(mm) {
  return Math.round(mm * MM);
}

// 인라인 그림 run XML — «글자처럼 취급»(treatAsChar="1") 이라 앞 글자 바로 오른쪽에 붙어 흐른다.
//   서식의 기존 hp:pic(진행사진) 구조를 그대로 따르되 크기/참조 id 만 바꾼다.
function buildInlinePicXml({ binaryItemId, width, height, charPrIDRef = '11', id = 900 }) {
  const w = Math.round(width);
  const h = Math.round(height);
  return (
    `<hp:run charPrIDRef="${charPrIDRef}">` +
    `<hp:pic id="${id}" zOrder="0" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${id + 1}" reverse="0">` +
    `<hp:offset x="0" y="0"/><hp:orgSz width="${w}" height="${h}"/><hp:curSz width="${w}" height="${h}"/>` +
    `<hp:flip horizontal="0" vertical="0"/>` +
    `<hp:rotationInfo angle="0" centerX="${Math.round(w / 2)}" centerY="${Math.round(h / 2)}" rotateimage="0"/>` +
    `<hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo>` +
    `<hc:img binaryItemIDRef="${binaryItemId}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/>` +
    `<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${w}" y="0"/><hc:pt2 x="${w}" y="${h}"/><hc:pt3 x="0" y="${h}"/></hp:imgRect>` +
    `<hp:imgClip left="0" right="${w}" top="0" bottom="${h}"/>` +
    `<hp:inMargin left="0" right="0" top="0" bottom="0"/>` +
    `<hp:imgDim dimwidth="${w}" dimheight="${h}"/><hp:effects/>` +
    `<hp:sz width="${w}" widthRelTo="ABSOLUTE" height="${h}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin left="0" right="0" top="0" bottom="0"/>` +
    `</hp:pic><hp:t/></hp:run>`
  );
}

// content.hpf manifest 에 BinData 이미지 item 추가(이미 있으면 그대로).
function addManifestImage(hpfXml, { itemId, fileName, mediaType = 'image/png' }) {
  if (hpfXml.includes(`id="${itemId}"`)) return hpfXml;
  const item = `<opf:item id="${itemId}" href="BinData/${fileName}" media-type="${mediaType}" isEmbeded="1"/>`;
  return hpfXml.replace('</opf:manifest>', `${item}</opf:manifest>`);
}

// 템플릿 zip 을 로드해 replacements({ '{{키}}': '값' }) + imageReplacements({ '<binFile>': Buffer })
//   를 적용한 새 .hwpx Buffer 반환. async (Promise<Buffer>) — 라우트에서 await.
//   imageReplacements 키는 BinData 의 파일 basename(예 'chulgang_photo.png'). 템플릿에 없으면 무시.
//   options:
//     · extraImages: [{ fileName, buffer, itemId }] — 템플릿에 없던 이미지를 새로 넣는다
//       (BinData 엔트리 추가 + content.hpf manifest item 추가). 서명 이미지 등.
//     · sectionTransforms: [(xml) => xml] — 치환 후 Contents/section*.xml 에 순서대로 적용.
//       (서명 그림 run 삽입처럼 서식별 XML 편집을 호출부가 주입하는 통로)
async function fillHwpx(templatePath, replacements, imageReplacements = {}, options = {}) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`HWPX 템플릿을 찾을 수 없습니다: ${templatePath}`);
  }
  const templateBuf = fs.readFileSync(templatePath);
  const src = await JSZip.loadAsync(templateBuf);

  // 원본 엔트리 순서 보존(파일만, 디렉터리 pseudo-entry 제외).
  const orderedNames = [];
  src.forEach((relativePath, file) => {
    if (file.dir) return; // OPC 리더는 명시적 디렉터리 레코드 불필요
    orderedNames.push(relativePath);
  });

  const replKeys = Object.keys(replacements || {});
  const imgRepl = imageReplacements || {};
  const extraImages = Array.isArray(options.extraImages) ? options.extraImages.filter(Boolean) : [];
  const sectionTransforms = Array.isArray(options.sectionTransforms)
    ? options.sectionTransforms.filter((f) => typeof f === 'function')
    : [];

  // 새 zip 을 처음부터 재구성: mimetype 을 가장 먼저(STORED), 그 외는 원순서대로 DEFLATE.
  const out = new JSZip();

  // 1) mimetype 최초 엔트리 + STORED (필수)
  if (src.file('mimetype')) {
    const mimeBytes = await src.file('mimetype').async('uint8array');
    out.file('mimetype', mimeBytes, { compression: 'STORE' });
  }

  // 2) 나머지 엔트리(원순서) — Contents/*.xml 치환, BinData/<key> 이미지 교체, 그 외 바이트 패스스루
  const leftoverByEntry = {}; // 미치환 토큰 검출용
  for (const name of orderedNames) {
    if (name === 'mimetype') continue; // 이미 추가

    const entry = src.file(name);
    const isContentsXml = name.startsWith('Contents/') && name.endsWith('.xml');

    // 이미지 교체: name 이 'BinData/<key>' 이고 그 key 의 Buffer 가 주어졌으면 바이트 교체.
    //   (imgRepl 가 비었거나 key 가 없으면 이 분기 미진입 → 원본 더미 바이트 유지 = 회귀 없음)
    let imageBuf = null;
    if (name.startsWith('BinData/')) {
      const baseKey = name.slice('BinData/'.length);
      if (Object.prototype.hasOwnProperty.call(imgRepl, baseKey) && imgRepl[baseKey]) {
        imageBuf = imgRepl[baseKey];
      }
    }

    if (imageBuf) {
      // 업로드 이미지로 교체(DEFLATE 유지). JSZip 이 local header(CRC·size)를 재계산한다.
      out.file(name, imageBuf, { compression: 'DEFLATE' });
    } else if (isContentsXml) {
      let xml = await entry.async('string'); // UTF-8 디코드
      for (const key of replKeys) {
        // 주입 값만 XML 이스케이프(템플릿의 키 {{...}} 는 메타문자 없음 — find 는 그대로).
        xml = replaceAll(xml, key, escapeXmlText(replacements[key]));
      }
      // 본문 섹션의 표가 쪽 경계에서 이어지도록 보정(글자처럼 취급 해제 + 셀 단위 나눔).
      if (/^Contents\/section\d+\.xml$/.test(name)) {
        xml = enableTableSplitAcrossPages(xml).xml;
        for (const t of sectionTransforms) xml = t(xml);
      }
      // 새로 넣는 이미지의 manifest item 등록(content.hpf 도 Contents/ 하위 XML 이지만
      // 확장자가 .hpf 라 이 분기에 안 걸리므로 아래 별도 분기에서 처리한다)
      // 미치환 {{...}} 검출(자가검증 — 라운드트립 불가 환경의 런타임 가드)
      const leftover = xml.match(/\{\{[^}]+\}\}/g);
      if (leftover && leftover.length) {
        leftoverByEntry[name] = Array.from(new Set(leftover));
      }
      out.file(name, xml, { compression: 'DEFLATE' });
    } else if (name === 'Contents/content.hpf' && extraImages.length) {
      // 새 이미지의 manifest item 추가(그 외 내용은 그대로).
      let hpf = await entry.async('string');
      for (const img of extraImages) {
        hpf = addManifestImage(hpf, { itemId: img.itemId, fileName: img.fileName });
      }
      out.file(name, hpf, { compression: 'DEFLATE' });
    } else {
      // 그 외(content.hpf, 교체 안 된 BinData, 기타) — 바이트 그대로
      const bytes = await entry.async('uint8array');
      out.file(name, bytes, { compression: 'DEFLATE' });
    }
  }

  // 3) 템플릿에 없던 이미지(서명 등) 추가 — BinData 엔트리로 신규 기록.
  for (const img of extraImages) {
    if (!img.buffer || !img.fileName) continue;
    out.file(`BinData/${img.fileName}`, img.buffer, { compression: 'DEFLATE' });
  }

  // 미치환 토큰이 남으면 거부(한글이 토큰 텍스트를 그대로 출력하는 사고 방지)
  const leftoverNames = Object.keys(leftoverByEntry);
  if (leftoverNames.length) {
    const detail = leftoverNames
      .map((n) => `${n}: ${leftoverByEntry[n].join(', ')}`)
      .join(' | ');
    throw new Error(`치환되지 않은 플레이스홀더가 남았습니다 — ${detail}`);
  }

  return out.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ── 숫자 → 한글 금액 ──────────────────────────────────────────
//   스펙 예시: 129000 → '일십이만구천' (일십 의 선두 '일' 유지 — 표준 한국어의
//   "십/백/천 앞 일 생략" 규칙을 적용하지 않음). 억 단위까지 지원(편성 1억).
//   원/정 접미사 없음(템플릿 토큰 주변 텍스트로 처리).
function numToKorean(n) {
  let v = Math.floor(Math.abs(Number(n) || 0));
  if (v === 0) return '영';
  const digits = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const places = ['', '십', '백', '천'];
  const groups = ['', '만', '억', '조'];
  const parts = [];
  let g = 0;
  while (v > 0) {
    const chunk = v % 10000;
    if (chunk > 0) {
      const c = String(chunk).padStart(4, '0');
      let s = '';
      for (let i = 0; i < 4; i++) {
        const d = Number(c[i]);
        if (d === 0) continue; // 0 자리 건너뜀
        s += digits[d] + places[3 - i];
      }
      parts.unshift(s + groups[g]);
    }
    v = Math.floor(v / 10000);
    g++;
  }
  return parts.join('');
}

// ── 날짜 포맷 'YYYY. M. D.' (UTC 게터 — YYYY-MM-DD 가 UTC 자정으로 저장되므로
//   음수 TZ 서버에서 하루 밀림 방지). 입력은 Date|문자열, 유효치 않으면 ''.
function formatKoreanDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}.`;
}

module.exports = {
  fillHwpx,
  numToKorean,
  formatKoreanDate,
  escapeXmlText,
  enableTableSplitAcrossPages,
  buildInlinePicXml,
  addManifestImage,
  readPngSize,
  mmToHwp,
};
