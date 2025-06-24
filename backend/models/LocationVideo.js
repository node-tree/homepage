const mongoose = require('mongoose');

const locationVideoSchema = new mongoose.Schema({
  cityName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  videoUrl: {
    type: String,
    required: true,
    trim: true
  },
  videoTitle: {
    type: String,
    required: false,
    trim: true
  },
  videoDescription: {
    type: String,
    required: false,
    trim: true
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
locationVideoSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// 'video' 컬렉션을 사용하도록 명시적으로 지정
module.exports = mongoose.model('LocationVideo', locationVideoSchema, 'video');

const locationHeaderSchema = new mongoose.Schema({
  title: { type: String, default: 'LOCATION' },
  subtitle: { type: String, default: '장소/3D' }
});

const LocationHeader = mongoose.model('LocationHeader', locationHeaderSchema, 'location_header');

module.exports.LocationHeader = LocationHeader; 