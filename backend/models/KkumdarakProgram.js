const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// 꿈다락 프로그램 — 가변 오버레이 도큐먼트 (Work.js 문서형 패턴).
//   프로그램 목록의 진실원천은 상수(backend/data/kkumdarakPrograms.js)이고,
//   이 컬렉션은 가변값만 보관한다. 현재 가변 필드 = actualParticipants(실참여).
//   programKey 로 1:1 매핑(upsert) — 시드 전엔 도큐먼트가 없을 수 있으므로
//   라우트 PUT 은 findOneAndUpdate({programKey}, ..., {upsert:true}) 로 쓴다.
//   (name·quota·totalSessions 등 고정 메타는 상수에서 읽으므로 여기 저장하지 않는다.)
// ─────────────────────────────────────────────────────────────────────────────

const kkumdarakProgramSchema = new mongoose.Schema(
  {
    programKey: { type: String, required: true, unique: true, index: true },
    actualParticipants: { type: Number, default: 0, min: 0 },
    note: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'kkumdarak_program',
  }
);

module.exports = mongoose.model(
  'KkumdarakProgram',
  kkumdarakProgramSchema,
  'kkumdarak_program'
);
