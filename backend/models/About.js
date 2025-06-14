const mongoose = require('mongoose');

const aboutSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    default: 'ABOUT'
  },
  content: {
    type: String,
    required: true,
    default: ''
  },
  htmlContent: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// 업데이트 시 updatedAt 자동 갱신
aboutSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 'about' 컬렉션을 사용하도록 명시적으로 지정
module.exports = mongoose.model('About', aboutSchema, 'about'); 