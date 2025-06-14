const express = require('express');
const router = express.Router();
const Filed = require('../models/Filed');
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

// GET /api/filed - 모든 filed 데이터 조회
router.get('/', async (req, res) => {
  try {
    console.log('Filed 데이터 조회 시작...');
    
    // DB 연결 상태 확인 및 연결
    await ensureDBConnection();
    console.log('DB 연결 확인 완료');
    
    const fileds = await Filed.find().sort({ _id: -1 });
    console.log(`DB에서 ${fileds.length}개의 Filed 데이터 조회 완료`);
    
    // 프론트엔드에서 사용하는 형식으로 변환
    const formattedFileds = fileds.map(filed => {
      let dateString;
      try {
        // createdAt이 있고 Date 객체인지 확인
        if (filed.createdAt && filed.createdAt instanceof Date) {
          dateString = filed.createdAt.toLocaleDateString('ko-KR');
        } else {
          // createdAt이 없으면 _id에서 날짜 추출하거나 현재 날짜 사용
          const objectId = filed._id;
          const timestamp = objectId.getTimestamp();
          dateString = timestamp.toLocaleDateString('ko-KR');
        }
      } catch (dateError) {
        console.warn('날짜 변환 오류:', dateError);
        dateString = new Date().toLocaleDateString('ko-KR');
      }

      return {
        id: filed._id.toString(),
        title: filed.title || '제목 없음',
        content: filed.contents || '내용 없음', // contents를 content로 매핑
        date: dateString,
        images: [],
        thumbnail: filed.thumbnail || null
      };
    });

    res.json({
      success: true,
      data: formattedFileds,
      count: formattedFileds.length,
      source: 'database',
      message: `실제 데이터베이스에서 ${formattedFileds.length}개의 워크샵 데이터를 가져왔습니다.`
    });
  } catch (error) {
    console.error('Filed 데이터 조회 오류:', error);
    console.error('에러 스택:', error.stack);
    
    // MongoDB 연결 실패 시에만 테스트 데이터 반환
    const testData = [
      {
        id: "workshop-fallback-1",
        title: "🔧 DB 연결 실패 - 워크샵 테스트 데이터 1",
        content: `워크샵 데이터베이스 연결에 실패했습니다. 에러: ${error.message}. 실제 워크샵 데이터를 보려면 MongoDB 연결을 확인해주세요.`,
        date: new Date().toLocaleDateString('ko-KR'),
        images: [],
        thumbnail: null
      },
      {
        id: "workshop-fallback-2", 
        title: "🔧 DB 연결 실패 - 워크샵 테스트 데이터 2",
        content: "MongoDB Atlas 연결 문자열과 네트워크 설정을 확인해주세요. /api/debug 엔드포인트에서 상세 정보를 확인할 수 있습니다.",
        date: new Date().toLocaleDateString('ko-KR'),
        images: [],
        thumbnail: null
      },
      {
        id: "workshop-fallback-3",
        title: "🔧 DB 연결 실패 - 워크샵 테스트 데이터 3",
        content: "Vercel 환경변수 MONGODB_URI가 올바르게 설정되어 있는지 확인해주세요. 현재는 임시 워크샵 테스트 데이터를 표시하고 있습니다.",
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
      note: "⚠️ MongoDB 연결 실패로 워크샵 테스트 데이터를 반환합니다. /api/debug에서 상세 정보를 확인하세요."
    });
  }
});

// POST /api/filed - 새 워크샵 글 작성
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

    const newFiled = new Filed({
      title: title.trim(),
      contents: content.trim(), // content를 contents로 매핑
      thumbnail: thumbnail ? thumbnail.trim() : null
    });

    const savedFiled = await newFiled.save();
    console.log('새 Filed 데이터 저장 완료:', savedFiled._id);
    
    res.json({
      success: true,
      message: '워크샵 글이 성공적으로 저장되었습니다.',
      data: {
        id: savedFiled._id.toString(),
        title: savedFiled.title,
        content: savedFiled.contents,
        thumbnail: savedFiled.thumbnail,
        date: savedFiled.createdAt ? savedFiled.createdAt.toLocaleDateString('ko-KR') : new Date().toLocaleDateString('ko-KR')
      }
    });
    
  } catch (error) {
    console.error('Filed 글 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '워크샵 글 저장에 실패했습니다.',
      error: error.message,
      mongoConnectionState: mongoose.connection.readyState
    });
  }
});

// PUT /api/filed/:id - 워크샵 글 수정
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

    const updatedFiled = await Filed.findByIdAndUpdate(
      id,
      {
        title: title.trim(),
        contents: content.trim(),
        thumbnail: thumbnail ? thumbnail.trim() : null
      },
      { new: true }
    );

    if (!updatedFiled) {
      return res.status(404).json({
        success: false,
        message: '워크샵 글을 찾을 수 없습니다.'
      });
    }
    
    console.log('Filed 데이터 수정 완료:', updatedFiled._id);
    
    res.json({
      success: true,
      message: '워크샵 글이 성공적으로 수정되었습니다.',
      data: {
        id: updatedFiled._id.toString(),
        title: updatedFiled.title,
        content: updatedFiled.contents,
        thumbnail: updatedFiled.thumbnail,
        date: updatedFiled.createdAt ? updatedFiled.createdAt.toLocaleDateString('ko-KR') : new Date().toLocaleDateString('ko-KR')
      }
    });
    
  } catch (error) {
    console.error('Filed 글 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '워크샵 글 수정에 실패했습니다.',
      error: error.message,
      mongoConnectionState: mongoose.connection.readyState
    });
  }
});

// DELETE /api/filed/:id - 워크샵 글 삭제
router.delete('/:id', auth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    const { id } = req.params;
    
    const deletedFiled = await Filed.findByIdAndDelete(id);
    
    if (!deletedFiled) {
      return res.status(404).json({
        success: false,
        message: '워크샵 글을 찾을 수 없습니다.'
      });
    }
    
    console.log('Filed 데이터 삭제 완료:', deletedFiled._id);
    
    res.json({
      success: true,
      message: '워크샵 글이 성공적으로 삭제되었습니다.',
      data: {
        id: deletedFiled._id.toString(),
        title: deletedFiled.title
      }
    });
    
  } catch (error) {
    console.error('Filed 글 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '워크샵 글 삭제에 실패했습니다.',
      error: error.message,
      mongoConnectionState: mongoose.connection.readyState
    });
  }
});

// GET /api/filed/:id - 특정 워크샵 글 조회
router.get('/:id', async (req, res) => {
  try {
    await ensureDBConnection();
    
    const { id } = req.params;
    const filed = await Filed.findById(id);
    
    if (!filed) {
      return res.status(404).json({
        success: false,
        message: '워크샵 글을 찾을 수 없습니다.'
      });
    }
    
    let dateString;
    try {
      if (filed.createdAt && filed.createdAt instanceof Date) {
        dateString = filed.createdAt.toLocaleDateString('ko-KR');
      } else {
        const objectId = filed._id;
        const timestamp = objectId.getTimestamp();
        dateString = timestamp.toLocaleDateString('ko-KR');
      }
    } catch (dateError) {
      dateString = new Date().toLocaleDateString('ko-KR');
    }
    
    res.json({
      success: true,
      data: {
        id: filed._id.toString(),
        title: filed.title || '제목 없음',
        content: filed.contents || '내용 없음',
        date: dateString,
        images: [],
        thumbnail: filed.thumbnail || null
      },
      source: 'database'
    });
    
  } catch (error) {
    console.error('Filed 글 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '워크샵 글 조회에 실패했습니다.',
      error: error.message,
      mongoConnectionState: mongoose.connection.readyState
    });
  }
});

module.exports = router; 