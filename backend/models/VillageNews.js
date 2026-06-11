const mongoose = require('mongoose');

// 마을소식(VillageNews) 싱글톤 모델 — VillageDiary.js 패턴 1:1 복제.
// 「마을소식」 호(號)들의 편집 사본을 단일 문서의 data 필드에 통째로 담는다.
//   data = { issues: { [issueId]: SerializedNewsIssue } }
//   SerializedNewsIssue = { id, no, title, dateline, status, theme, blocks } (JSON-직렬화 가능)
// blocks 는 Custom(render 함수) 블록을 제외한 직렬화 가능 블록만 — 에디터가 그 외 7종만 생성한다.
// 자유 구조이므로 Mixed(Object)로 저장. 정적 NEWS_ISSUES 와 id 가 겹치면 이 사본이 우선한다.
const villageNewsSchema = new mongoose.Schema({
  data: {
    type: Object,
    default: {}
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

villageNewsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('VillageNews', villageNewsSchema, 'village_news');
