const mongoose = require('mongoose');

const workSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  contents: {
    type: String,
    required: true
  },
  htmlContent: {
    type: String,
    default: ''
  },
  thumbnail: {
    type: String,
    required: false
  }
}, {
  timestamps: true,
  collection: 'work'
});

module.exports = mongoose.model('Work', workSchema); 