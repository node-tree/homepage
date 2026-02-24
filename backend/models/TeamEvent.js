const mongoose = require('mongoose');

const teamEventSchema = new mongoose.Schema({
  visitorId: {
    type: String,
    required: true
  },
  teamIndex: {
    type: Number,
    required: true,
    min: 0,
    max: 7
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// 같은 세션 내에서만 visitorId 유니크 보장
teamEventSchema.index({ visitorId: 1, sessionId: 1 }, { unique: true });

module.exports = mongoose.model('TeamEvent', teamEventSchema);
