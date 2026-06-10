const mongoose = require('mongoose');

// 꿈다락 공개 페이지 설정(KkumdarakSettings) 싱글톤 모델 — VillageDiary.js 패턴 1:1.
// 프로그램 오버라이드(신청 링크 + 인라인 텍스트/모집상태)를 단일 문서의 data 필드에 통째로 담는다.
//   data = {
//     programs:       { [programName]: { applyUrl?: string, closed?: boolean } },  // 신청 링크(레거시 closed 폴백)
//     programContent: { [programName]: {
//                         name?, en?, summary?, desc?: string,                     // 인라인 텍스트 편집
//                         status?: 'ongoing' | 'recruiting' | 'closed'             // 모집 상태(1차 소스, 3단계)
//                       } }
//   }
//   · 모집 상태는 programContent.status(진행중/모집중/모집마감) 가 1차, 미설정 시 programs[].closed 로 폴백(프론트 resolveStatus). 이전 2단계 'open' 값은 'ongoing' 으로 매핑.
//   · 프로그램 식별자는 Programs.tsx 가 렌더하는 인라인 PROGRAMS 의 name 을 키로 쓴다
//     (해당 배열에는 id 가 없고 name 으로 key 되므로 name 이 안정 식별자다).
//   · 자유 구조이므로 Mixed(Object)로 저장한다(스키마/마이그레이션 변경 불필요).
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
