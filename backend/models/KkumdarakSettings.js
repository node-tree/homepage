const mongoose = require('mongoose');

// 꿈다락 공개 페이지 설정(KkumdarakSettings) 싱글톤 모델 — VillageDiary.js 패턴 1:1.
// 프로그램 오버라이드(신청 링크 + 인라인 텍스트/모집상태)를 단일 문서의 data 필드에 통째로 담는다.
//   data = {
//     programs:       { [programName]: { applyUrl?: string, closed?: boolean } },  // 신청 링크(레거시 closed 폴백)
//     programContent: { [programName]: {
//                         name?, en?, summary?, desc?: string,                     // 인라인 텍스트 편집
//                         applyStatus?: 'open' | 'closed',                         // 신청 버튼 축(신청하기/모집마감)
//                         phaseStatus?: 'ongoing' | 'recruiting',                  // 상단 배지 축(진행중/신청중)
//                         status?: '...'                                           // @deprecated 레거시 단일 필드(폴백 전용)
//                       } }
//   }
//   · 모집 상태는 두 축 독립: programContent.applyStatus(신청 버튼) + phaseStatus(상단 배지)가 1차.
//   · 폴백/마이그레이션(프론트 resolveApplyStatus/resolvePhaseStatus):
//       레거시 단일 status 'closed'→applyStatus:'closed', 'recruiting'→phaseStatus:'recruiting'(+apply open),
//       'ongoing'/'open'→phaseStatus:'ongoing'(+apply open). status 미설정이면 programs[].closed 로 신청 버튼 폴백.
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
