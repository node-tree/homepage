// 마을의 신호 웹지도 콘텐츠(SignalMapContent) 싱글톤 모델 — KkumdarakSettings 패턴 1:1.
//   data = { [signalOrPlaceId]: { story?, makers?, audio?, name? } }
//   신호·장소의 기본값은 프론트 정적(scene.ts)이고, 이 문서는 오버라이드만 담는다.
const mongoose = require('mongoose');

const signalMapContentSchema = new mongoose.Schema({
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SignalMapContent', signalMapContentSchema, 'signal_map_content');
