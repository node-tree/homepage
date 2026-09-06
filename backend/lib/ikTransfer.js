// ═══════════════════════════════════════════════════════════════
// ikTransfer — 파일 이동/복사를 "복제 방식"으로 수행
//
//   왜 ImageKit 의 move/copy API 를 쓰지 않는가 (2026-09-04 실측)
//     무료 플랜은 파일 버전 한도가 0 이라, files/move·files/copy 가 **항상** 실패한다.
//       POST /v1/files/move → 400 "Versions Limit Exceeded. Limit: 0, Actual: 1"
//       POST /v1/files/copy → 400 (동일)
//     반면 rename·bulkJobs(moveFolder/copyFolder/renameFolder)·upload·delete 는 정상 동작한다.
//   → 그래서 파일 단위 이동/복사는
//       원본 다운로드(?tr=orig-true) → 새 경로 업로드 → 무결성 대조 → (이동이면) 원본 삭제
//     순서로 직접 구현한다. 리드가 어제 307개를 같은 방식으로 무중단 정리했다.
//
//   안전 장치
//     · 대상에 동명 파일이 있으면 **덮어쓰지 않고 409**.
//       업로드는 overwriteFile:false 로 보내 경쟁 상태(TOCTOU)에서도 덮어쓰기가 불가능하다
//       (실측: useUniqueFileName:false + overwriteFile:false + 동명 → 400 에러).
//     · 업로드 응답의 filePath·size·width·height 를 원본과 대조. 하나라도 어긋나면
//       **새 파일을 지우고 502** — 반쪽짜리 복제본을 남기지 않는다.
//     · 이동일 때 순서는 "업로드 → DB 참조 갱신 → 원본 삭제".
//       DB 갱신이 실패하면 원본을 **지우지 않고** 새 파일을 지운다(원상 복구).
//     · 한글 파일명은 ImageKit 이 준 문자열을 그대로 쓴다. NFD 를 NFC 로 바꾸면 404 다(실측).
// ═══════════════════════════════════════════════════════════════

const https = require('https');
const http = require('http');
const ikRefs = require('./ikRefs');
const ikRefsDb = require('./ikRefsDb');

/** 서버 메모리에 올리는 원본의 상한. 초과하면 받지 않고 실패시킨다. */
const MAX_BYTES = 50 * 1024 * 1024;

class TransferError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}

function endpoint() {
  return String(process.env.IMAGEKIT_URL_ENDPOINT || '').replace(/\/+$/, '');
}

/** 경로를 URL 에 넣을 수 있게 인코딩(형태 보존 — 정규화 금지) */
function encodePathForUrl(p) {
  return p
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/**
 * URL 을 버퍼로 받는다. 리다이렉트 1회 추종, 크기 상한 초과 시 즉시 중단.
 */
function download(url, { maxBytes = MAX_BYTES, redirects = 1 } = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('http://') ? http : https;
    const req = lib.get(url, { timeout: 60000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        const next = new URL(res.headers.location, url);
        // 리다이렉트는 우리 ImageKit 엔드포인트 호스트로만 따라간다.
        // (임의 호스트를 따라가면 서버가 SSRF 로 끌려갈 수 있다)
        let allowedHost = '';
        try {
          allowedHost = new URL(endpoint()).host;
        } catch {
          allowedHost = '';
        }
        if (!allowedHost || next.host !== allowedHost) {
          return reject(
            new TransferError(502, `허용되지 않은 리다이렉트 대상입니다: ${next.host}`)
          );
        }
        return resolve(download(next.toString(), { maxBytes, redirects: redirects - 1 }));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new TransferError(502, `원본 다운로드 실패 (HTTP ${res.statusCode})`));
      }
      const declared = Number(res.headers['content-length'] || 0);
      if (declared && declared > maxBytes) {
        res.destroy();
        return reject(
          new TransferError(400, `파일이 너무 큽니다(${declared} bytes). 상한 ${maxBytes} bytes.`)
        );
      }
      const chunks = [];
      let total = 0;
      res.on('data', (c) => {
        total += c.length;
        if (total > maxBytes) {
          res.destroy();
          reject(new TransferError(400, `파일이 너무 큽니다(> ${maxBytes} bytes).`));
          return;
        }
        chunks.push(c);
      });
      res.on('end', () => resolve({ buf: Buffer.concat(chunks), contentType: res.headers['content-type'] }));
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new TransferError(504, '원본 다운로드 시간 초과'));
    });
    req.on('error', (e) => reject(new TransferError(502, `원본 다운로드 오류: ${e.message}`)));
  });
}

/** 부모 폴더 경로(루트면 '/') */
function parentOf(filePath) {
  const i = filePath.lastIndexOf('/');
  return i <= 0 ? '/' : filePath.slice(0, i);
}
function baseOf(filePath) {
  return filePath.slice(filePath.lastIndexOf('/') + 1);
}

/**
 * 원본 메타 확보. fileId 가 있으면 그걸로, 없으면 부모 폴더 목록에서 경로로 찾는다.
 *   비교는 "ImageKit 이 준 문자열 그대로" 우선, 못 찾으면 NFC 정규화 비교로 폴백한다
 *   (DB/사용자 입력이 NFC 인데 실제 파일은 NFD 인 경우를 구제).
 */
async function resolveSource(ik, { fileId, sourceFilePath }) {
  if (fileId) {
    const d = await ik.getFileDetails(fileId);
    return d;
  }
  const parent = parentOf(sourceFilePath);
  const rows = await ik.listFiles({
    path: parent === '/' ? undefined : parent,
    type: 'file',
    limit: 1000,
  });
  const exact = rows.find((f) => f.filePath === sourceFilePath);
  if (exact) return exact;
  const wantCanon = ikRefs.canonPath(sourceFilePath);
  const loose = rows.find((f) => ikRefs.canonPath(f.filePath) === wantCanon);
  if (loose) return loose;
  throw new TransferError(404, `원본을 찾지 못했습니다: ${sourceFilePath}`);
}

/** 대상 폴더에 같은 이름의 파일이 있는가 */
async function findAtDestination(ik, destFolder, name) {
  const rows = await ik.listFiles({
    path: destFolder === '/' ? undefined : destFolder,
    type: 'file',
    limit: 1000,
  });
  const wantCanon = ikRefs.canonPath(`${destFolder === '/' ? '' : destFolder}/${name}`);
  return rows.find((f) => f.name === name || ikRefs.canonPath(f.filePath) === wantCanon) || null;
}

/**
 * 파일 1건 이동/복사.
 *
 *   opts:
 *     ik              ImageKit SDK 인스턴스 (필수)
 *     db              mongo Db (updateRefs 시 필요)
 *     sourceFilePath  원본 경로(ImageKit 이 준 문자열 권장)
 *     fileId          알고 있으면 전달(메타 조회 1회 절약 + 정확)
 *     destinationFolder 대상 폴더
 *     mode            'move' | 'copy'
 *     updateRefs      move 일 때 DB 참조 갱신 여부(기본 true)
 *     actor           감사 로그용
 *     only            applyMappings 대상 컬렉션 제한(테스트용)
 *     onRefsUpdate    치환 함수 주입(테스트에서 실패 주입용)
 *
 *   반환: { mode, sourceFilePath, destinationPath, newFileId, verified, refs, originalDeleted }
 */
async function transferFile(opts) {
  const {
    ik,
    db = null,
    fileId = null,
    sourceFilePath,
    destinationFolder,
    mode = 'move',
    updateRefs = true,
    actor = 'unknown',
    only = null,
    maxBytes = MAX_BYTES,
    onRefsUpdate = null,
    // 테스트에서 네트워크 없이 오케스트레이션만 검증하기 위한 주입 지점.
    downloadFn = download,
  } = opts;

  if (!ik) throw new TransferError(503, 'ImageKit 이 초기화되지 않았습니다.');
  if (mode !== 'move' && mode !== 'copy') throw new TransferError(400, 'mode 는 move 또는 copy 여야 합니다.');

  // 1) 원본 메타
  const src = await resolveSource(ik, { fileId, sourceFilePath });
  const srcPath = src.filePath; // ImageKit 이 준 문자열 그대로 사용(정규화 금지)
  const name = src.name || baseOf(srcPath);
  const dstFolder = destinationFolder === '/' ? '/' : String(destinationFolder).replace(/\/+$/, '');
  const destPath = dstFolder === '/' ? `/${name}` : `${dstFolder}/${name}`;

  if (ikRefs.canonPath(parentOf(srcPath)) === ikRefs.canonPath(dstFolder)) {
    throw new TransferError(400, '이미 같은 폴더에 있는 파일입니다.');
  }

  // 2) 대상 충돌 사전 확인(덮어쓰기 금지)
  const clash = await findAtDestination(ik, dstFolder, name);
  if (clash) {
    throw new TransferError(409, `대상에 같은 이름의 파일이 이미 있습니다: ${clash.filePath}`, {
      existingFileId: clash.fileId,
      existingFilePath: clash.filePath,
    });
  }

  // 3) 원본 바이트 다운로드 — ?tr=orig-true 로 변환 없는 원본을 받는다
  const url = `${endpoint()}${encodePathForUrl(srcPath)}`;
  let got = await downloadFn(`${url}?tr=orig-true`, { maxBytes });
  if (typeof src.size === 'number' && src.size > 0 && got.buf.length !== src.size) {
    // 변환이 끼어든 경우 대비 — 파라미터 없는 원본으로 한 번 더 시도
    const plain = await downloadFn(url, { maxBytes });
    if (plain.buf.length === src.size) got = plain;
  }
  if (typeof src.size === 'number' && src.size > 0 && got.buf.length !== src.size) {
    throw new TransferError(
      502,
      `원본 크기가 메타데이터와 다릅니다(메타 ${src.size} / 받은 ${got.buf.length}). 안전을 위해 중단했습니다.`
    );
  }

  // 4) 새 경로로 업로드 — overwriteFile:false 로 경쟁 상태에서도 덮어쓰기 불가
  let uploaded;
  try {
    uploaded = await ik.upload({
      file: got.buf,
      fileName: name,
      folder: dstFolder,
      useUniqueFileName: false,
      overwriteFile: false,
    });
  } catch (e) {
    const msg = e?.message || '업로드 실패';
    if (/already exists/i.test(msg)) {
      throw new TransferError(409, `대상에 같은 이름의 파일이 이미 있습니다: ${destPath}`);
    }
    throw new TransferError(502, `새 위치 업로드 실패: ${msg}`);
  }

  // 5) 무결성 대조 — 하나라도 어긋나면 새 파일을 지우고 실패
  const problems = [];
  if (ikRefs.canonPath(uploaded.filePath) !== ikRefs.canonPath(destPath)) {
    problems.push(`경로 불일치(기대 ${destPath} / 실제 ${uploaded.filePath})`);
  }
  if (uploaded.size !== got.buf.length) {
    problems.push(`크기 불일치(보낸 ${got.buf.length} / 저장 ${uploaded.size})`);
  }
  if (src.fileType === 'image' && src.width && src.height) {
    if (uploaded.width !== src.width || uploaded.height !== src.height) {
      problems.push(
        `해상도 불일치(원본 ${src.width}x${src.height} / 복제 ${uploaded.width}x${uploaded.height})`
      );
    }
  }
  if (problems.length) {
    await ik.deleteFile(uploaded.fileId).catch(() => {});
    throw new TransferError(502, `복제 검증 실패로 되돌렸습니다 — ${problems.join('; ')}`);
  }

  const verified = {
    size: uploaded.size,
    width: uploaded.width ?? null,
    height: uploaded.height ?? null,
    sourceSize: src.size,
    sourceWidth: src.width ?? null,
    sourceHeight: src.height ?? null,
  };

  if (mode === 'copy') {
    return {
      mode: 'copy',
      sourceFilePath: srcPath,
      destinationPath: uploaded.filePath,
      newFileId: uploaded.fileId,
      verified,
      refs: { updated: false, skipped: true, reason: '복사는 원본이 그대로 남아 참조가 유효합니다.' },
      originalDeleted: false,
    };
  }

  // 6) 이동: DB 참조 갱신 → 성공해야 원본을 지운다
  let refs = { updated: false, skipped: true, reason: 'updateRefs=false' };
  if (updateRefs) {
    if (!db) {
      await ik.deleteFile(uploaded.fileId).catch(() => {});
      throw new TransferError(503, 'DB 에 연결되어 있지 않아 참조를 갱신할 수 없어 이동을 취소했습니다.');
    }
    // to 는 ImageKit 이 준 실제 경로(형태 보존)를 쓴다.
    const mappings = [{ from: srcPath, to: uploaded.filePath, kind: 'file' }];
    try {
      const apply = onRefsUpdate || ikRefsDb.applyMappings;
      const r = await apply(db, mappings, { actor, only });
      refs = {
        updated: true,
        batchId: r.batchId,
        documents: r.documents,
        refsUpdated: r.refsUpdated,
        failures: r.failures,
      };
    } catch (e) {
      // 원본은 건드리지 않고 새 파일만 지운다 → 이동 전 상태로 완전 복구
      await ik.deleteFile(uploaded.fileId).catch(() => {});
      throw new TransferError(500, `DB 참조 갱신 실패로 이동을 취소했습니다: ${e.message}`, {
        compensated: true,
      });
    }
  }

  // 7) 원본 삭제
  let originalDeleted = true;
  try {
    await ik.deleteFile(src.fileId);
  } catch (e) {
    originalDeleted = false;
    // 여기서 실패하면 같은 파일이 두 곳에 남는다(데이터 손실은 없음). 그대로 알린다.
    return {
      mode: 'move',
      sourceFilePath: srcPath,
      destinationPath: uploaded.filePath,
      newFileId: uploaded.fileId,
      verified,
      refs,
      originalDeleted,
      warning: `새 위치 복제와 참조 갱신은 끝났지만 원본 삭제에 실패했습니다(${e.message}). 원본이 남아 있으니 수동 삭제가 필요합니다.`,
    };
  }

  return {
    mode: 'move',
    sourceFilePath: srcPath,
    destinationPath: uploaded.filePath,
    newFileId: uploaded.fileId,
    verified,
    refs,
    originalDeleted,
  };
}

module.exports = { transferFile, TransferError, MAX_BYTES, download, encodePathForUrl, resolveSource, findAtDestination };
