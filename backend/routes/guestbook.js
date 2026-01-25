const express = require('express');
const router = express.Router();
const Guestbook = require('../models/Guestbook');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');

// 간소화된 DB 연결 확인 함수
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (mongoose.connection.readyState === 2) {
    console.log('MongoDB 연결 중... 대기');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MongoDB 연결 대기 타임아웃'));
      }, 10000);

      mongoose.connection.once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });
      mongoose.connection.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    return true;
  }

  if (mongoose.connection.readyState === 0) {
    console.log('MongoDB 연결 시도...');

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI 환경변수가 설정되지 않았습니다.');
    }

    const options = {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 0,
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 10000,
      bufferCommands: false,
      family: 4,
      heartbeatFrequencyMS: 30000,
    };

    let mongoUri = process.env.MONGODB_URI;
    if (!mongoUri.includes('retryWrites')) {
      const separator = mongoUri.includes('?') ? '&' : '?';
      mongoUri += `${separator}retryWrites=true&w=majority`;
    }

    await mongoose.connect(mongoUri, options);
    console.log('MongoDB 연결 성공');
  }

  return true;
};

// GET /api/guestbook - 모든 방명록 조회
router.get('/', async (req, res) => {
  try {
    await ensureDBConnection();

    const entries = await Guestbook.find().sort({ createdAt: -1 });

    const formattedEntries = entries.map(entry => ({
      id: entry._id.toString(),
      name: entry.name,
      message: entry.message,
      seed: entry.seed,
      colorIndex: entry.colorIndex,
      createdAt: entry.createdAt.toISOString()
    }));

    res.json({
      success: true,
      data: formattedEntries,
      count: formattedEntries.length
    });
  } catch (error) {
    console.error('방명록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '방명록을 불러오는데 실패했습니다.',
      error: error.message
    });
  }
});

// POST /api/guestbook - 새 방명록 작성
router.post('/', async (req, res) => {
  try {
    await ensureDBConnection();

    const { name, message } = req.body;

    if (!name || !message) {
      return res.status(400).json({
        success: false,
        message: '이름과 메시지를 모두 입력해주세요.'
      });
    }

    if (name.length > 50) {
      return res.status(400).json({
        success: false,
        message: '이름은 50자 이하로 입력해주세요.'
      });
    }

    if (message.length > 500) {
      return res.status(400).json({
        success: false,
        message: '메시지는 500자 이하로 입력해주세요.'
      });
    }

    const newEntry = new Guestbook({
      name: name.trim(),
      message: message.trim()
    });

    const savedEntry = await newEntry.save();
    console.log('새 방명록 저장 완료:', savedEntry._id);

    res.json({
      success: true,
      message: '방명록이 성공적으로 저장되었습니다.',
      data: {
        id: savedEntry._id.toString(),
        name: savedEntry.name,
        message: savedEntry.message,
        seed: savedEntry.seed,
        colorIndex: savedEntry.colorIndex,
        createdAt: savedEntry.createdAt.toISOString()
      }
    });

  } catch (error) {
    console.error('방명록 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '방명록 저장에 실패했습니다.',
      error: error.message
    });
  }
});

// DELETE /api/guestbook/:id - 방명록 삭제 (관리자 전용)
router.delete('/:id', auth, async (req, res) => {
  try {
    await ensureDBConnection();

    const { id } = req.params;

    const deletedEntry = await Guestbook.findByIdAndDelete(id);

    if (!deletedEntry) {
      return res.status(404).json({
        success: false,
        message: '방명록을 찾을 수 없습니다.'
      });
    }

    console.log('방명록 삭제 완료:', deletedEntry._id);

    res.json({
      success: true,
      message: '방명록이 삭제되었습니다.',
      data: {
        id: deletedEntry._id.toString()
      }
    });

  } catch (error) {
    console.error('방명록 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '방명록 삭제에 실패했습니다.',
      error: error.message
    });
  }
});

module.exports = router;
