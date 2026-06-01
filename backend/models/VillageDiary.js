const mongoose = require('mongoose');

// 마을일기(VillageDiary) 싱글톤 모델 — HomeSettings.js 패턴 참고.
// 전체 오버라이드 객체 { [programId]: DiaryCardData[] } 를 단일 문서의 data 필드에 통째로 담는다.
// DiaryCardData = { side, title, date, dot, imageUrl? } — 자유 구조이므로 Mixed(Object)로 저장.
const villageDiarySchema = new mongoose.Schema({
  data: {
    type: Object,
    default: {}
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

villageDiarySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('VillageDiary', villageDiarySchema, 'village_diary');
