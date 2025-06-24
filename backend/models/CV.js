const mongoose = require('mongoose');

const cvSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    default: 'CV'
  },
  subtitle: {
    type: String,
    default: ''
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

cvSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('CV', cvSchema, 'cv'); 