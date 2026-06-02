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

// 템플릿 zip 을 로드해 replacements({ '{{키}}': '값' }) + imageReplacements({ '<binFile>': Buffer })
//   를 적용한 새 .hwpx Buffer 반환. async (Promise<Buffer>) — 라우트에서 await.
//   imageReplacements 키는 BinData 의 파일 basename(예 'chulgang_photo.png'). 템플릿에 없으면 무시.
async function fillHwpx(templatePath, replacements, imageReplacements = {}) {
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
        xml = replaceAll(xml, key, replacements[key]);
      }
      // 미치환 {{...}} 검출(자가검증 — 라운드트립 불가 환경의 런타임 가드)
      const leftover = xml.match(/\{\{[^}]+\}\}/g);
      if (leftover && leftover.length) {
        leftoverByEntry[name] = Array.from(new Set(leftover));
      }
      out.file(name, xml, { compression: 'DEFLATE' });
    } else {
      // 그 외(content.hpf, 교체 안 된 BinData, 기타) — 바이트 그대로
      const bytes = await entry.async('uint8array');
      out.file(name, bytes, { compression: 'DEFLATE' });
    }
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

module.exports = { fillHwpx, numToKorean, formatKoreanDate };
