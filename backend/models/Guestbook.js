const mongoose = require('mongoose');

const guestbookSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  // 파티클 애니메이션을 위한 랜덤 시드값
  seed: {
    type: Number,
    default: () => Math.random() * 10000
  },
  // 색상 테마 (자동 할당)
  colorIndex: {
    type: Number,
    default: () => Math.floor(Math.random() * 5)
  }
}, {
  timestamps: true,
  collection: 'guestbook'
});

module.exports = mongoose.model('Guestbook', guestbookSchema);
