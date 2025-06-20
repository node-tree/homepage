const mongoose = require('mongoose');

const filedSchema = new mongoose.Schema({
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
  collection: 'workshop'
});

module.exports = mongoose.model('Filed', filedSchema); 