const express = require('express');
const router = express.Router();
const Work = require('../models/Work');
const auth = require('../middleware/auth');

// GET /api/work - 모든 work 데이터 조회
router.get('/', async (req, res) => {
  try {
    const works = await Work.find().sort({ _id: -1 });
    
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
      count: formattedWorks.length
    });
  } catch (error) {
    console.error('Work 데이터 조회 오류:', error);
    
    // MongoDB 연결 실패 시 테스트 데이터 반환
    const testData = [
      {
        id: "sample-1",
        title: "첫 번째 프로젝트",
        content: "노드트리 홈페이지 개발 프로젝트입니다. React와 Node.js를 사용하여 개발했습니다.",
        date: new Date().toLocaleDateString('ko-KR'),
        images: [],
        thumbnail: null
      },
      {
        id: "sample-2", 
        title: "두 번째 작업",
        content: "데이터베이스 연동 및 로그인 시스템을 구현했습니다. MongoDB Atlas와 JWT를 활용했습니다.",
        date: new Date().toLocaleDateString('ko-KR'),
        images: [],
        thumbnail: null
      },
      {
        id: "sample-3",
        title: "UI/UX 디자인",
        content: "반응형 웹 디자인과 애니메이션 효과를 구현했습니다. Framer Motion을 사용했습니다.",
        date: new Date().toLocaleDateString('ko-KR'),
        images: [],
        thumbnail: null
      }
    ];
    
    res.json({
      success: true,
      data: testData,
      count: testData.length,
      note: "MongoDB 연결 실패로 테스트 데이터를 반환합니다."
    });
  }
});

// POST /api/work - 새 글 작성
router.post('/', auth, async (req, res) => {
  try {
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
      error: error.message
    });
  }
});

// PUT /api/work/:id - 글 수정
router.put('/:id', auth, async (req, res) => {
  try {
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
      error: error.message
    });
  }
});

// DELETE /api/work/:id - 글 삭제
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const deletedWork = await Work.findByIdAndDelete(id);

    if (!deletedWork) {
      return res.status(404).json({
        success: false,
        message: '글을 찾을 수 없습니다.'
      });
    }
    
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
      error: error.message
    });
  }
});

module.exports = router; 