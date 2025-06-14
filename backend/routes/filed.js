const express = require('express');
const router = express.Router();
const Filed = require('../models/Filed');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');

// MongoDB 연결 확인 함수
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('MongoDB 연결이 끊어져 있습니다.');
  }
};

// GET /api/filed - 모든 filed 데이터 조회
router.get('/', async (req, res) => {
  try {
    // DB 연결 상태 확인
    await ensureDBConnection();
    
    const works = await Filed.find().sort({ _id: -1 });
    
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
      source: 'database'
    });
  } catch (error) {
    console.error('Filed 데이터 조회 오류:', error);
    
    // MongoDB 연결 실패 시 테스트 데이터 반환
    const testData = [
      {
        id: "filed-sample-1",
        title: "연구 기록 1 (테스트 데이터)",
        content: "새로운 기술 스택에 대한 연구 기록입니다. React와 TypeScript를 활용한 개발 방법론을 정리했습니다. [DB 연결 실패로 테스트 데이터 표시 중]",
        date: new Date().toLocaleDateString('ko-KR'),
        images: [],
        thumbnail: null
      },
      {
        id: "filed-sample-2", 
        title: "아이디어 노트 (테스트 데이터)",
        content: "창의적인 아이디어들을 정리한 노트입니다. UI/UX 개선 방안과 사용자 경험 향상을 위한 아이디어들을 기록했습니다. [DB 연결 실패로 테스트 데이터 표시 중]",
        date: new Date().toLocaleDateString('ko-KR'),
        images: [],
        thumbnail: null
      },
      {
        id: "filed-sample-3",
        title: "개발 일지 (테스트 데이터)",
        content: "프로젝트 개발 과정에서 겪은 문제들과 해결 방법을 기록한 일지입니다. 버그 수정과 성능 최적화 내용을 포함합니다. [DB 연결 실패로 테스트 데이터 표시 중]",
        date: new Date().toLocaleDateString('ko-KR'),
        images: [],
        thumbnail: null
      }
    ];
    
    res.json({
      success: true,
      data: testData,
      count: testData.length,
      source: 'fallback',
      error: error.message,
      note: "MongoDB 연결 실패로 테스트 데이터를 반환합니다. /api/debug에서 상세 정보를 확인하세요."
    });
  }
});

// POST /api/filed - 새 기록 작성
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

    const newWork = new Filed({
      title: title.trim(),
      contents: content.trim(), // content를 contents로 매핑
      thumbnail: thumbnail ? thumbnail.trim() : null
    });

    const savedWork = await newWork.save();
    
    res.json({
      success: true,
      message: '기록이 성공적으로 저장되었습니다.',
      data: {
        id: savedWork._id.toString(),
        title: savedWork.title,
        content: savedWork.contents,
        thumbnail: savedWork.thumbnail,
        date: savedWork.createdAt ? savedWork.createdAt.toLocaleDateString('ko-KR') : new Date().toLocaleDateString('ko-KR')
      }
    });
    
  } catch (error) {
    console.error('Filed 기록 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '기록 저장에 실패했습니다.',
      error: error.message
    });
  }
});

// PUT /api/filed/:id - 기록 수정
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

    const updatedWork = await Filed.findByIdAndUpdate(
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
        message: '기록을 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      message: '기록이 성공적으로 수정되었습니다.',
      data: {
        id: updatedWork._id.toString(),
        title: updatedWork.title,
        content: updatedWork.contents,
        thumbnail: updatedWork.thumbnail,
        date: updatedWork.createdAt ? updatedWork.createdAt.toLocaleDateString('ko-KR') : new Date().toLocaleDateString('ko-KR')
      }
    });
    
  } catch (error) {
    console.error('Filed 기록 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '기록 수정에 실패했습니다.',
      error: error.message
    });
  }
});

// DELETE /api/filed/:id - 기록 삭제
router.delete('/:id', auth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    const { id } = req.params;

    const deletedWork = await Filed.findByIdAndDelete(id);

    if (!deletedWork) {
      return res.status(404).json({
        success: false,
        message: '기록을 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      message: '기록이 성공적으로 삭제되었습니다.',
      data: {
        id: deletedWork._id.toString(),
        title: deletedWork.title
      }
    });
    
  } catch (error) {
    console.error('Filed 기록 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '기록 삭제에 실패했습니다.',
      error: error.message
    });
  }
});

module.exports = router; 