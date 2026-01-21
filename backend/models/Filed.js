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
  },
  category: {
    type: String,
    enum: ['문화예술교육', '커뮤니티'],
    default: '문화예술교육'
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  collection: 'workshop'
});

const filedHeaderSchema = new mongoose.Schema({
  title: { type: String, default: 'FILED' },
  subtitle: { type: String, default: '기록/아카이브' }
});

const FiledHeader = mongoose.model('FiledHeader', filedHeaderSchema, 'filed_header');

module.exports = mongoose.model('Filed', filedSchema);
module.exports.FiledHeader = FiledHeader; 