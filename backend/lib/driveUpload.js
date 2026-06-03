// ─────────────────────────────────────────────────────────────────────────────
// Google Drive 증빙 업로더 — 기존 calendar.js OAuth2 패턴 재활용.
//   루트 폴더(KKUMDARAK_DRIVE_FOLDER_ID) 아래 "비목명" 하위폴더에 파일 업로드.
//   자격증명 미설정이면 NO_DRIVE 에러 throw → 라우트가 503 으로 안내(calendar.js 동일).
//   실제 Drive 호출은 사용자가 증빙 첨부할 때만 발생.
// ─────────────────────────────────────────────────────────────────────────────
const { google } = require('googleapis');
const { Readable } = require('stream');

function getDriveClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_DRIVE_REFRESH_TOKEN) {
    const err = new Error('Google Drive 미설정 (GOOGLE_CLIENT_ID/SECRET·GOOGLE_DRIVE_REFRESH_TOKEN 필요)');
    err.code = 'NO_DRIVE';
    throw err;
  }
  const auth = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, 'http://localhost');
  auth.setCredentials({ refresh_token: GOOGLE_DRIVE_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth });
}

function rootFolderId() {
  const id = process.env.KKUMDARAK_DRIVE_FOLDER_ID;
  if (!id) {
    const err = new Error('Google Drive 루트 폴더 미설정 (KKUMDARAK_DRIVE_FOLDER_ID 필요)');
    err.code = 'NO_DRIVE';
    throw err;
  }
  return id;
}

// 비목명 하위폴더 id 조회(없으면 생성). majorName 예: "운영비".
async function ensureSubfolder(drive, parentId, name) {
  const safe = String(name || '기타').replace(/'/g, "\\'");
  const list = await drive.files.list({
    q: `'${parentId}' in parents and name='${safe}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name)',
    spaces: 'drive',
  });
  if (list.data.files && list.data.files.length) return list.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name: String(name || '기타'), mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  });
  return created.data.id;
}

// 증빙 파일 업로드 → { fileId, webViewLink, name }
async function uploadEvidence({ buffer, filename, mimeType, majorName }) {
  const drive = getDriveClient();
  const folderId = await ensureSubfolder(drive, rootFolderId(), majorName);
  const res = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: mimeType || 'application/octet-stream', body: Readable.from(buffer) },
    fields: 'id,name,webViewLink',
  });
  return { fileId: res.data.id, name: res.data.name, webViewLink: res.data.webViewLink || '' };
}

// Drive 파일 삭제(실패해도 호출측에서 메타는 제거).
async function deleteEvidence(fileId) {
  if (!fileId) return;
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
}

module.exports = { uploadEvidence, deleteEvidence };
