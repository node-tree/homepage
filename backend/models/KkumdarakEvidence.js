const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// 꿈다락 증빙 파일(독립 라이브러리) — 집행 건과 분리된 증빙 관리 메뉴용.
//   파일 본체는 GridFS(evidenceStore)에 저장하고, 여기엔 메타 + storageId 만.
//   비목(majorCode/subCode)·서식(formCode)·메모로 태그해 한 곳에서 관리.
// ─────────────────────────────────────────────────────────────────────────────
const kkumdarakEvidenceSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true }, // 표시 이름(파일명 또는 링크 제목)
    kind: { type: String, default: 'file' }, // 'file'(GridFS 업로드) | 'link'(외부 URL)
    url: { type: String, default: '' }, // kind='link' 일 때 외부 링크
    majorCode: { type: String, default: '' }, // 비목 코드(태그, 선택)
    subCode: { type: String, default: '' }, // 세목 코드(태그, 선택)
    formCode: { type: String, default: '' }, // 서식/증빙 종류(예: 서식11 지출결의서)
    note: { type: String, default: '' }, // 메모
    storageId: { type: String, default: '' }, // GridFS 파일 ID
    driveFileId: { type: String, default: '' }, // Drive 미러(옵션)
    webViewLink: { type: String, default: '' },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: '' },
  },
  { timestamps: true, collection: 'kkumdarak_evidence_file' },
);

kkumdarakEvidenceSchema.index({ majorCode: 1, subCode: 1, createdAt: -1 });

module.exports =
  mongoose.models.KkumdarakEvidence ||
  mongoose.model('KkumdarakEvidence', kkumdarakEvidenceSchema);
