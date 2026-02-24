const mongoose = require('mongoose');

// 모듈 레벨에서 연결 프로미스를 캐싱하여 콜드 스타트 시 중복 연결 방지
let cachedConnection = null;

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI 환경변수가 설정되지 않았습니다.');
    }

    // 이미 연결되어 있다면 즉시 반환
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    // 진행 중인 연결이 있으면 재사용 (중복 연결 방지)
    if (cachedConnection) {
      await cachedConnection;
      return mongoose.connection;
    }

    console.log('🔄 새로운 MongoDB 연결 시도...');

    const options = {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 0,
      maxPoolSize: 10,
      minPoolSize: 1,
      maxIdleTimeMS: 60000,
      bufferCommands: false,
      family: 4,
      heartbeatFrequencyMS: 30000,
    };

    let mongoUri = process.env.MONGODB_URI;
    if (!mongoUri.includes('retryWrites')) {
      const separator = mongoUri.includes('?') ? '&' : '?';
      mongoUri += `${separator}retryWrites=true&w=majority`;
    }

    // 연결 프로미스를 캐싱
    cachedConnection = mongoose.connect(mongoUri, options);
    await cachedConnection;

    console.log(`✅ MongoDB 연결 성공: ${mongoose.connection.host}`);
    return mongoose.connection;
  } catch (error) {
    cachedConnection = null;
    console.error(`❌ MongoDB 연결 실패:`, error.message);
    throw error;
  }
};

module.exports = connectDB;
