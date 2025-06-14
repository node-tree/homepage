const express = require('express');
const router = express.Router();
const Work = require('../models/Work');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// 간소화된 DB 연결 확인 함수
const ensureDBConnection = async () => {
  // 이미 연결되어 있으면 바로 반환
  if (mongoose.connection.readyState === 1) {
    return true;
  }
  
  // 연결되지 않았다면 새로 연결 시도
  if (mongoose.connection.readyState === 0) {
    console.log('🔄 MongoDB 연결 시도...');
    
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI 환경변수가 설정되지 않았습니다.');
    }

    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 0,
      maxPoolSize: 1,
      minPoolSize: 0,
      maxIdleTimeMS: 10000,
      bufferMaxEntries: 0,
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

// GET /api/work - 모든 work 데이터 조회
router.get('/', async (req, res) => {
  try {
    console.log('Work 데이터 조회 시작...');
    
    // DB 연결 상태 확인 및 연결
    await ensureDBConnection();
    console.log('DB 연결 확인 완료');
    
    const works = await Work.find().sort({ _id: -1 });
    console.log(`DB에서 ${works.length}개의 Work 데이터 조회 완료`);
    
    // 프론트엔드에서 사용하는 형식으로 변환
    const formattedWorks = works.map(work => {
      let dateString;
      try {
        // createdAt이 있고 Date 객체인지 확인
        if (work.createdAt && work.createdAt instanceof Date) {
          dateString = work.createdAt.toLocaleDateString('ko-KR');
        } else {
          // createdAt이 없으면 _id에서 날짜 추출하거나 현재 날짜 사용
          const objectId = work._id;
          const timestamp = objectId.getTimestamp();
          dateString = timestamp.toLocaleDateString('ko-KR');
        }
      } catch (dateError) {
        console.warn('날짜 변환 오류:', dateError);
        dateString = new Date().toLocaleDateString('ko-KR');
      }

      return {
        id: work._id.toString(),
        title: work.title || '제목 없음',
        content: work.contents || '내용 없음', // contents를 content로 매핑
        date: dateString,
        images: [],
        thumbnail: work.thumbnail || null
      };
    });

    res.json({
      success: true,
      data: formattedWorks,
      count: formattedWorks.length,
      source: 'database',
      message: `실제 데이터베이스에서 ${formattedWorks.length}개의 데이터를 가져왔습니다.`
    });
  } catch (error) {
    console.error('Work 데이터 조회 오류:', error);
    console.error('에러 스택:', error.stack);
    
    // MongoDB 연결 실패 시에만 테스트 데이터 반환
    const testData = [
      {
        id: "fallback-1",
        title: "🔧 DB 연결 실패 - 테스트 데이터 1",
        content: `데이터베이스 연결에 실패했습니다. 에러: ${error.message}. 실제 데이터를 보려면 MongoDB 연결을 확인해주세요.`,
        date: new Date().toLocaleDateString('ko-KR'),
        images: [],
        thumbnail: null
      },
      {
        id: "fallback-2", 
        title: "🔧 DB 연결 실패 - 테스트 데이터 2",
        content: "MongoDB Atlas 연결 문자열과 네트워크 설정을 확인해주세요. /api/debug 엔드포인트에서 상세 정보를 확인할 수 있습니다.",
        date: new Date().toLocaleDateString('ko-KR'),
        images: [],
        thumbnail: null
      },
      {
        id: "fallback-3",
        title: "🔧 DB 연결 실패 - 테스트 데이터 3",
        content: "Vercel 환경변수 MONGODB_URI가 올바르게 설정되어 있는지 확인해주세요. 현재는 임시 테스트 데이터를 표시하고 있습니다.",
        date: new Date().toLocaleDateString('ko-KR'),
        images: [],
        thumbnail: null
      }
    ];
    
    res.json({
      success: false,
      data: testData,
      count: testData.length,
      source: 'fallback',
      error: error.message,
      mongoConnectionState: mongoose.connection.readyState,
      note: "⚠️ MongoDB 연결 실패로 테스트 데이터를 반환합니다. /api/debug에서 상세 정보를 확인하세요."
    });
  }
});

// POST /api/work - 새 글 작성
router.post('/', auth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    const { title, content, thumbnail } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '제목과 내용을 모두 입력해주세요.'
      });
    }

    const newWork = new Work({
      title: title.trim(),
      contents: content.trim(), // content를 contents로 매핑
      thumbnail: thumbnail ? thumbnail.trim() : null
    });

    const savedWork = await newWork.save();
    console.log('새 Work 데이터 저장 완료:', savedWork._id);
    
    res.json({
      success: true,
      message: '글이 성공적으로 저장되었습니다.',
      data: {
        id: savedWork._id.toString(),
        title: savedWork.title,
        content: savedWork.contents,
        thumbnail: savedWork.thumbnail,
        date: savedWork.createdAt ? savedWork.createdAt.toLocaleDateString('ko-KR') : new Date().toLocaleDateString('ko-KR')
      }
    });
    
  } catch (error) {
    console.error('Work 글 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '글 저장에 실패했습니다.',
      error: error.message,
      mongoConnectionState: mongoose.connection.readyState
    });
  }
});

// PUT /api/work/:id - 글 수정
router.put('/:id', auth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    const { id } = req.params;
    const { title, content, thumbnail } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '제목과 내용을 모두 입력해주세요.'
      });
    }

    const updatedWork = await Work.findByIdAndUpdate(
      id,
      {
        title: title.trim(),
        contents: content.trim(),
        thumbnail: thumbnail ? thumbnail.trim() : null
      },
      { new: true }
    );

    if (!updatedWork) {
      return res.status(404).json({
        success: false,
        message: '글을 찾을 수 없습니다.'
      });
    }
    
    console.log('Work 데이터 수정 완료:', updatedWork._id);
    
    res.json({
      success: true,
      message: '글이 성공적으로 수정되었습니다.',
      data: {
        id: updatedWork._id.toString(),
        title: updatedWork.title,
        content: updatedWork.contents,
        thumbnail: updatedWork.thumbnail,
        date: updatedWork.createdAt ? updatedWork.createdAt.toLocaleDateString('ko-KR') : new Date().toLocaleDateString('ko-KR')
      }
    });
    
  } catch (error) {
    console.error('Work 글 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '글 수정에 실패했습니다.',
      error: error.message,
      mongoConnectionState: mongoose.connection.readyState
    });
  }
});

// DELETE /api/work/:id - 글 삭제
router.delete('/:id', auth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    const { id } = req.params;
    
    const deletedWork = await Work.findByIdAndDelete(id);
    
    if (!deletedWork) {
      return res.status(404).json({
        success: false,
        message: '글을 찾을 수 없습니다.'
      });
    }
    
    console.log('Work 데이터 삭제 완료:', deletedWork._id);
    
    res.json({
      success: true,
      message: '글이 성공적으로 삭제되었습니다.',
      data: {
        id: deletedWork._id.toString(),
        title: deletedWork.title
      }
    });
    
  } catch (error) {
    console.error('Work 글 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '글 삭제에 실패했습니다.',
      error: error.message,
      mongoConnectionState: mongoose.connection.readyState
    });
  }
});

// GET /api/work/:id - 특정 글 조회
router.get('/:id', async (req, res) => {
  try {
    await ensureDBConnection();
    
    const { id } = req.params;
    const work = await Work.findById(id);
    
    if (!work) {
      return res.status(404).json({
        success: false,
        message: '글을 찾을 수 없습니다.'
      });
    }
    
    let dateString;
    try {
      if (work.createdAt && work.createdAt instanceof Date) {
        dateString = work.createdAt.toLocaleDateString('ko-KR');
      } else {
        const objectId = work._id;
        const timestamp = objectId.getTimestamp();
        dateString = timestamp.toLocaleDateString('ko-KR');
      }
    } catch (dateError) {
      dateString = new Date().toLocaleDateString('ko-KR');
    }
    
    res.json({
      success: true,
      data: {
        id: work._id.toString(),
        title: work.title || '제목 없음',
        content: work.contents || '내용 없음',
        date: dateString,
        images: [],
        thumbnail: work.thumbnail || null
      },
      source: 'database'
    });
    
  } catch (error) {
    console.error('Work 글 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '글 조회에 실패했습니다.',
      error: error.message,
      mongoConnectionState: mongoose.connection.readyState
    });
  }
});

module.exports = router; 