const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// 꿈다락 회차(세션) — 프로그램별 실제 진행 회차 기록 (Work.js 문서형 패턴).
//   회차 "등록" = 이 도큐먼트 1건 생성. 프로그램별 등록 회차 수 = count.
//   진척: 등록회차수(count) / 총회차(상수) , 잔여 = 총회차 − 등록회차수.
//   실참여(attendance)는 회차 단위로 입력 → 프로그램 실참여 = 그 회차들 attendance 합
//   (programStats.buildProgramStats). 예정 회차는 0 으로 시작.
//   {programKey, sessionNo} 복합 unique — 같은 프로그램에 같은 회차번호 중복 등록 차단(409).
// ─────────────────────────────────────────────────────────────────────────────

const kkumdarakSessionSchema = new mongoose.Schema(
  {
    programKey: { type: String, required: true, index: true },
    sessionNo: { type: Number, required: true }, // 회차번호
    date: { type: Date, default: null }, // 진행일
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    attendance: { type: Number, default: 0, min: 0 }, // 회차 실참여 인원
    status: { type: String, enum: ['예정', '완료'], default: '예정' },
    note: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'kkumdarak_session',
  }
);

// 프로그램별 회차번호 유일성(중복 등록 방지). 위반 시 E11000 → 라우트에서 409 매핑.
kkumdarakSessionSchema.index({ programKey: 1, sessionNo: 1 }, { unique: true });

module.exports = mongoose.model(
  'KkumdarakSession',
  kkumdarakSessionSchema,
  'kkumdarak_session'
);
