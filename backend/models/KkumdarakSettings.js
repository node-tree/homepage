const mongoose = require('mongoose');

// 꿈다락 공개 페이지 설정(KkumdarakSettings) 싱글톤 모델 — VillageDiary.js 패턴 1:1.
// 프로그램 신청 링크/마감 상태 오버라이드를 단일 문서의 data 필드에 통째로 담는다.
//   data = { programs: { [programName]: { applyUrl?: string, closed?: boolean } } }
//   · 프로그램 식별자는 Programs.tsx 가 렌더하는 인라인 PROGRAMS 의 name 을 키로 쓴다
//     (해당 배열에는 id 가 없고 name 으로 key 되므로 name 이 안정 식별자다).
//   · 자유 구조이므로 Mixed(Object)로 저장한다.
//   · 사업관리(KkumdarakProgram/세션·증빙·장부) 와 무관한 별개 컬렉션이다.
const kkumdarakSettingsSchema = new mongoose.Schema({
  data: {
    type: Object,
    default: {}
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

kkumdarakSettingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('KkumdarakSettings', kkumdarakSettingsSchema, 'kkumdarak_settings');
