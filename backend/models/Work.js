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
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  imageLayout: {
    type: [{
      src: String,
      size: { type: String, enum: ['full', 'half', 'third'], default: 'full' },
      order: Number
    }],
    default: []
  },
  research: {
    html: { type: String, default: '' },
    markdown: { type: String, default: '' },
    toc: {
      type: [{
        level: Number,
        text: String,
        anchor: String,
        file: String
      }],
      default: []
    },
    sourceFiles: { type: [String], default: [] },
    obsidianPath: { type: String, default: '' },
    syncedAt: { type: Date, default: null }
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