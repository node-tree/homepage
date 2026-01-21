const mongoose = require('mongoose');

const homeSettingsSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Node Tree'
  },
  subtitle: {
    type: String,
    default: '서사 교차점의 기록'
  },
  titlePosition: {
    type: String,
    enum: ['center', 'bottom-left', 'bottom-right', 'top-left', 'top-right'],
    default: 'bottom-left'
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

homeSettingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('HomeSettings', homeSettingsSchema, 'home_settings');
