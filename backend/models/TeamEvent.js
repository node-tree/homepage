const mongoose = require('mongoose');

const teamEventSchema = new mongoose.Schema({
  visitorId: {
    type: String,
    required: true,
    unique: true,
    index: true
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

module.exports = mongoose.model('TeamEvent', teamEventSchema);
