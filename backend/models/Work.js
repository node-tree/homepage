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

const workHeaderSchema = new mongoose.Schema({
  title: { type: String, default: 'WORK' },
  subtitle: { type: String, default: '작업/프로젝트' }
});

const WorkHeader = mongoose.model('WorkHeader', workHeaderSchema, 'work_header');

module.exports = mongoose.model('Work', workSchema);
module.exports.WorkHeader = WorkHeader; 