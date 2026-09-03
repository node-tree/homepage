// ═══════════════════════════════════════════════════════════════
// ImageKit URL 참조 치환 — 순수 로직(DB 접근 없음)
//
//   왜 "스키마별 핸들러"가 아니라 재귀 순회인가
//     URL 이 박혀 있는 자리가 컬렉션마다 제각각이다 — HTML 본문(work.contents),
//     배열 원소(work.imageLayout[].src), 임의 키 중첩(signal_map_content.data.<id>.photos[]),
//     설정 트리(kkumdarak_settings.data.intro.members.<k>.character) …
//     스키마를 열거하면 새 필드가 생길 때마다 조용히 누락된다.
//     → 문서 전체를 재귀로 훑고 "문자열 안의 ImageKit URL"만 바꾼다.
//
//   실측으로 확인한 저장 형태(운영 DB 356건 스캔)
//     · 한글 경로가 **원문 그대로**(185건)와 **퍼센트 인코딩**(14건) 둘 다 존재
//     · 인코딩된 것 중에는 **NFD(자모 분리)** 형태도 있다
//       예: %E1%84%83%E1%85%A1 → 'ᄃ'+'ᅡ' (NFC 로는 '다')
//     · 쿼리가 붙은 것 32건 — `?tr=` 뿐 아니라 `?updatedAt=` 도 있다 → 반드시 보존
//   → 비교는 "디코딩 + NFC 정규화"한 canonical 경로로 하고,
//     치환 결과는 원본의 인코딩 스타일을 따라가 diff 를 최소화한다.
// ═══════════════════════════════════════════════════════════════

const DEFAULT_ENDPOINT = 'https://ik.imagekit.io/gc3jtyt9o';

/** 설정된 ImageKit 엔드포인트(끝 슬래시 제거). */
function endpoint() {
  return String(process.env.IMAGEKIT_URL_ENDPOINT || DEFAULT_ENDPOINT).replace(/\/+$/, '');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 문자열 안의 ImageKit URL 을 찾는 정규식.
 *   프로토콜(http/https)은 무엇이든 받고, 경로는 공백·따옴표·꺾쇠·닫는괄호·역슬래시 전까지.
 *   (HTML `src="..."`, 마크다운 `](...)`, JSON 이스케이프 `\"` 모두에서 안전하게 끊긴다)
 */
function urlRegex(ep = endpoint()) {
  const hostPath = ep.replace(/^https?:\/\//, '');
  return new RegExp(`https?://${escapeRe(hostPath)}(/[^\\s"'<>)\\\\]*)`, 'g');
}

/**
 * 경로 정규화(비교 전용 canonical 형태).
 *   쿼리·해시 제거 → 퍼센트 디코딩 → NFC 정규화 → 앞 슬래시 보장 → 중복 슬래시 정리.
 */
function canonPath(p) {
  if (!p && p !== '') return '';
  let s = String(p).split('#')[0].split('?')[0];
  try {
    s = decodeURIComponent(s);
  } catch {
    /* 깨진 인코딩(%가 단독으로 있는 등)은 원문 그대로 비교 */
  }
  if (typeof s.normalize === 'function') s = s.normalize('NFC');
  if (!s.startsWith('/')) s = `/${s}`;
  s = s.replace(/\/+/g, '/');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s;
}

/**
 * 새 경로를 "원본과 같은 인코딩 스타일"로 직렬화한다.
 *   원본이 퍼센트 인코딩이었으면 인코딩해서, 아니면 원문(한글 그대로) 그대로.
 *   → 불필요한 문자열 변경(diff 소음)을 줄인다. 둘 다 브라우저에서 동일하게 동작한다.
 */
function encodePathLike(sampleRawPath, newPath) {
  const hadPercent = /%[0-9A-Fa-f]{2}/.test(sampleRawPath);
  if (!hadPercent) return newPath;
  return newPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/**
 * 매핑 목록 → 조회 함수.
 *   mappings: [{ from, to, kind: 'file' | 'folder' }]
 *   · file  : canonical 경로 완전 일치
 *   · folder: 자기 자신 또는 `from + '/'` 접두사. `/old` 매핑이 `/older/x` 를 건드리지 않는다.
 *   · 폴더는 긴 경로부터 검사해 중첩 매핑에서 더 구체적인 규칙이 이긴다.
 */
function buildMapper(mappings) {
  const files = new Map();
  const folders = [];
  for (const m of mappings || []) {
    const from = canonPath(m.from);
    const to = canonPath(m.to);
    if (!from || !to || from === to || from === '/') continue;
    if (m.kind === 'folder') folders.push({ from, to });
    else files.set(from, to);
  }
  folders.sort((a, b) => b.from.length - a.from.length);

  return function map(canon) {
    if (files.has(canon)) return files.get(canon);
    for (const f of folders) {
      if (canon === f.from) return f.to;
      if (canon.startsWith(`${f.from}/`)) return f.to + canon.slice(f.from.length);
    }
    return null;
  };
}

/**
 * 문자열 안의 ImageKit URL 을 치환한다.
 *   쿼리/해시는 그대로 보존한다(?tr=, ?updatedAt= 등).
 *   반환: { out, count, hits:[{from,to}] }
 */
function replaceInString(str, mapper, ep = endpoint()) {
  if (typeof str !== 'string' || str.indexOf(ep.replace(/^https?:\/\//, '')) === -1) {
    return { out: str, count: 0, hits: [] };
  }
  const re = urlRegex(ep);
  const hits = [];
  const out = str.replace(re, (full, rawTail) => {
    const qIdx = rawTail.search(/[?#]/);
    const rawPath = qIdx >= 0 ? rawTail.slice(0, qIdx) : rawTail;
    const suffix = qIdx >= 0 ? rawTail.slice(qIdx) : '';
    const canon = canonPath(rawPath);
    const to = mapper(canon);
    if (!to) return full;
    hits.push({ from: canon, to });
    return ep + encodePathLike(rawPath, to) + suffix;
  });
  return { out, count: hits.length, hits };
}

/** Date·ObjectId·Buffer 등 "내려가면 안 되는" 값 판별 */
function isOpaque(v) {
  return (
    v instanceof Date ||
    (typeof Buffer !== 'undefined' && Buffer.isBuffer(v)) ||
    (v && typeof v === 'object' && v._bsontype)
  );
}

/**
 * 문서(임의 중첩)를 재귀 순회하며 문자열 안의 URL 을 치환한다.
 *   변경이 없으면 **원본 참조를 그대로 반환**한다(불필요한 쓰기 방지).
 *   반환: { value, count, hits }
 */
function replaceDeep(value, mapper, ep = endpoint()) {
  let count = 0;
  const hits = [];

  function walk(v) {
    if (typeof v === 'string') {
      const r = replaceInString(v, mapper, ep);
      if (r.count) {
        count += r.count;
        hits.push(...r.hits);
        return r.out;
      }
      return v;
    }
    if (Array.isArray(v)) {
      let changed = false;
      const arr = v.map((x) => {
        const n = walk(x);
        if (n !== x) changed = true;
        return n;
      });
      return changed ? arr : v;
    }
    if (v && typeof v === 'object') {
      if (isOpaque(v)) return v;
      let changed = false;
      const o = {};
      for (const k of Object.keys(v)) {
        const n = walk(v[k]);
        if (n !== v[k]) changed = true;
        o[k] = n;
      }
      return changed ? o : v;
    }
    return v;
  }

  return { value: walk(value), count, hits };
}

/**
 * 문서를 훑어 ImageKit URL 참조를 수집한다(치환 없음).
 *   cb({ field, url, path })  path 는 canonical.
 */
function scanDeep(value, cb, ep = endpoint()) {
  const re = urlRegex(ep);

  function walk(v, field) {
    if (typeof v === 'string') {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(v))) {
        const tail = m[1];
        const qIdx = tail.search(/[?#]/);
        const rawPath = qIdx >= 0 ? tail.slice(0, qIdx) : tail;
        cb({ field, url: m[0], path: canonPath(rawPath) });
      }
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${field}[${i}]`));
      return;
    }
    if (v && typeof v === 'object' && !isOpaque(v)) {
      for (const k of Object.keys(v)) walk(v[k], field ? `${field}.${k}` : k);
    }
  }

  walk(value, '');
}

/** 파일 이동/이름변경/폴더 이동을 매핑 항목으로 만들어 주는 헬퍼 */
function fileMoveMapping(sourceFilePath, destinationFolder) {
  const from = canonPath(sourceFilePath);
  const name = from.slice(from.lastIndexOf('/') + 1);
  const dst = canonPath(destinationFolder);
  const to = dst === '/' ? `/${name}` : `${dst}/${name}`;
  return { from, to, kind: 'file' };
}

function fileRenameMapping(filePath, newFileName) {
  const from = canonPath(filePath);
  const parent = from.slice(0, from.lastIndexOf('/')) || '';
  return { from, to: `${parent}/${canonPath(newFileName).replace(/^\//, '')}`, kind: 'file' };
}

function folderMoveMapping(sourceFolderPath, destinationFolder) {
  const from = canonPath(sourceFolderPath);
  const name = from.slice(from.lastIndexOf('/') + 1);
  const dst = canonPath(destinationFolder);
  const to = dst === '/' ? `/${name}` : `${dst}/${name}`;
  return { from, to, kind: 'folder' };
}

function folderRenameMapping(folderPath, newFolderName) {
  const from = canonPath(folderPath);
  const parent = from.slice(0, from.lastIndexOf('/')) || '';
  return { from, to: `${parent}/${canonPath(newFolderName).replace(/^\//, '')}`, kind: 'folder' };
}

/** 매핑을 뒤집는다(보상 이동·롤백용) */
function invertMappings(mappings) {
  return (mappings || []).map((m) => ({ from: m.to, to: m.from, kind: m.kind }));
}

module.exports = {
  DEFAULT_ENDPOINT,
  endpoint,
  urlRegex,
  canonPath,
  encodePathLike,
  buildMapper,
  replaceInString,
  replaceDeep,
  scanDeep,
  fileMoveMapping,
  fileRenameMapping,
  folderMoveMapping,
  folderRenameMapping,
  invertMappings,
};
