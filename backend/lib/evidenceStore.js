// ─────────────────────────────────────────────────────────────────────────────
// 증빙 파일 저장소 — MongoDB GridFS(앱이 연결된 Atlas). 외부 자격증명 불필요.
//   업로드(put) → 파일 id 반환, 다운로드(openDownloadStream), 삭제(delete).
//   Google Drive(driveUpload.js)는 자격증명 있을 때만 쓰는 옵션 — 기본 저장은 GridFS.
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');
const { Readable } = require('stream');

const BUCKET = 'kkumdarak_evidence';

function bucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('DB 연결이 없습니다.');
  return new GridFSBucket(db, { bucketName: BUCKET });
}

// 버퍼 → GridFS. { fileId } 반환.
function put(buffer, filename, mimeType) {
  return new Promise((resolve, reject) => {
    const stream = bucket().openUploadStream(filename, {
      contentType: mimeType || 'application/octet-stream',
    });
    Readable.from(buffer)
      .pipe(stream)
      .on('error', reject)
      .on('finish', () => resolve({ fileId: stream.id.toString() }));
  });
}

// GridFS 다운로드 스트림 + 메타(filename/contentType/length).
async function openDownload(fileId) {
  const _id = new ObjectId(fileId);
  const files = await bucket().find({ _id }).toArray();
  if (!files.length) return null;
  const file = files[0];
  return {
    stream: bucket().openDownloadStream(_id),
    filename: file.filename,
    contentType: file.contentType || 'application/octet-stream',
    length: file.length,
  };
}

async function remove(fileId) {
  if (!fileId) return;
  try {
    await bucket().delete(new ObjectId(fileId));
  } catch (e) {
    if (!/FileNotFound/i.test(e.message)) throw e;
  }
}

module.exports = { put, openDownload, remove, BUCKET };
