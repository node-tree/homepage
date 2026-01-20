const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  emails: [{
    type: String
  }],
  location: {
    type: String,
    default: 'Seoul, South Korea'
  },
  socialLinks: [{
    name: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    }
  }],
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
contactSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Contact', contactSchema, 'contact');
