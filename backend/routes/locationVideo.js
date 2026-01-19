const express = require('express');
const mongoose = require('mongoose');
const LocationVideo = require('../models/LocationVideo');
const auth = require('../middleware/auth');
const LocationHeader = require('../models/LocationVideo').LocationHeader;

const router = express.Router();

// DB 연결 확인 함수
const ensureDBConnection = async () => {
  // 이미 연결되어 있으면 바로 반환
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  // 연결 중이라면 연결 완료될 때까지 대기
  if (mongoose.connection.readyState === 2) {
    console.log('⏳ MongoDB 연결 중... 대기');
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

  // 연결되지 않았다면 새로 연결 시도
  if (mongoose.connection.readyState === 0) {
    console.log('🔄 MongoDB 연결 시도...');

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
    console.log('✅ MongoDB 연결 성공');
  }

  return true;
};

// GET /location-video/header - 상단 제목/부제목 조회
router.get('/header', async (req, res) => {
  try {
    await ensureDBConnection();
    let header = await LocationHeader.findOne({});
    if (!header) {
      header = new LocationHeader({ title: 'LOCATION', subtitle: '장소/3D' });
      await header.save();
    }
    res.json({ success: true, data: header });
  } catch (e) {
    res.status(500).json({ success: false, message: '헤더 조회 실패', error: e.message });
  }
});

// PUT /location-video/header - 상단 제목/부제목 수정
router.put('/header', require('../middleware/auth'), async (req, res) => {
  try {
    await ensureDBConnection();
    let header = await LocationHeader.findOne({});
    if (!header) {
      header = new LocationHeader({});
    }
    if (req.body.title !== undefined) header.title = req.body.title;
    if (req.body.subtitle !== undefined) header.subtitle = req.body.subtitle;
    await header.save();
    res.json({ success: true, data: header });
  } catch (e) {
    res.status(500).json({ success: false, message: '헤더 수정 실패', error: e.message });
  }
});

// GET /api/location-video - 모든 위치별 영상 조회
router.get('/', async (req, res) => {
  try {
    console.log('위치별 영상 데이터 조회 시작...');
    
    await ensureDBConnection();
    console.log('DB 연결 확인 완료');
    
    const videos = await LocationVideo.find({ isActive: true }).sort({ createdAt: -1 });
    console.log(`DB에서 ${videos.length}개의 영상 데이터 조회 완료`);
    
    res.json({
      success: true,
      data: videos,
      count: videos.length,
      message: `${videos.length}개의 위치별 영상 데이터를 가져왔습니다.`
    });
  } catch (error) {
    console.error('위치별 영상 데이터 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '영상 데이터 조회에 실패했습니다.',
      error: error.message,
      mongoConnectionState: mongoose.connection.readyState
    });
  }
});

// GET /api/location-video/:cityName - 특정 도시의 영상 조회
router.get('/:cityName', async (req, res) => {
  try {
    const { cityName } = req.params;
    console.log(`${cityName} 영상 데이터 조회 시작...`);
    
    await ensureDBConnection();
    
    const video = await LocationVideo.findOne({ 
      cityName: cityName, 
      isActive: true 
    });
    
    if (!video) {
      return res.status(404).json({
        success: false,
        message: `${cityName}에 대한 영상을 찾을 수 없습니다.`
      });
    }
    
    console.log(`${cityName} 영상 데이터 조회 완료`);
    
    res.json({
      success: true,
      data: video,
      message: `${cityName} 영상 데이터를 가져왔습니다.`
    });
  } catch (error) {
    console.error('특정 도시 영상 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '영상 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// POST /api/location-video - 새 영상 등록 (관리자만)
router.post('/', auth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    const { cityName, videoUrl, videoTitle, videoDescription } = req.body;
    
    if (!cityName || !videoUrl) {
      return res.status(400).json({
        success: false,
        message: '도시명과 영상 URL을 모두 입력해주세요.'
      });
    }

    // 기존 영상이 있는지 확인
    const existingVideo = await LocationVideo.findOne({ cityName });
    
    if (existingVideo) {
      return res.status(400).json({
        success: false,
        message: `${cityName}에 대한 영상이 이미 등록되어 있습니다. 수정을 원하시면 PUT 요청을 사용해주세요.`
      });
    }

    const newVideo = new LocationVideo({
      cityName: cityName.trim(),
      videoUrl: videoUrl.trim(),
      videoTitle: videoTitle ? videoTitle.trim() : null,
      videoDescription: videoDescription ? videoDescription.trim() : null
    });

    const savedVideo = await newVideo.save();
    console.log('새 영상 데이터 저장 완료:', savedVideo._id);
    
    res.json({
      success: true,
      message: '영상이 성공적으로 등록되었습니다.',
      data: savedVideo
    });
    
  } catch (error) {
    console.error('영상 등록 오류:', error);
    res.status(500).json({
      success: false,
      message: '영상 등록에 실패했습니다.',
      error: error.message
    });
  }
});

// PUT /api/location-video/:cityName - 영상 수정 (관리자만)
router.put('/:cityName', auth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    const { cityName } = req.params;
    const { videoUrl, videoTitle, videoDescription, isActive } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        message: '영상 URL을 입력해주세요.'
      });
    }

    const updateData = {
      videoUrl: videoUrl.trim(),
      videoTitle: videoTitle ? videoTitle.trim() : null,
      videoDescription: videoDescription ? videoDescription.trim() : null,
      updatedAt: Date.now()
    };

    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }

    const updatedVideo = await LocationVideo.findOneAndUpdate(
      { cityName },
      updateData,
      { new: true, upsert: true }
    );
    
    console.log('영상 데이터 수정 완료:', updatedVideo._id);
    
    res.json({
      success: true,
      message: '영상이 성공적으로 수정되었습니다.',
      data: updatedVideo
    });
    
  } catch (error) {
    console.error('영상 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '영상 수정에 실패했습니다.',
      error: error.message
    });
  }
});

// DELETE /api/location-video/:cityName - 영상 삭제 (관리자만)
router.delete('/:cityName', auth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    const { cityName } = req.params;
    
    const deletedVideo = await LocationVideo.findOneAndUpdate(
      { cityName },
      { isActive: false, updatedAt: Date.now() },
      { new: true }
    );

    if (!deletedVideo) {
      return res.status(404).json({
        success: false,
        message: '삭제할 영상을 찾을 수 없습니다.'
      });
    }
    
    console.log('영상 데이터 삭제 완료:', deletedVideo._id);
    
    res.json({
      success: true,
      message: '영상이 성공적으로 삭제되었습니다.',
      data: deletedVideo
    });
    
  } catch (error) {
    console.error('영상 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '영상 삭제에 실패했습니다.',
      error: error.message
    });
  }
});

module.exports = router; 