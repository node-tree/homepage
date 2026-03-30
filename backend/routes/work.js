const express = require('express');
const router = express.Router();
const Work = require('../models/Work');
const auth = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');
const mongoose = require('mongoose');
const WorkHeader = require('../models/Work').WorkHeader;

// DB 연결 확인 — 별도 모듈에서 캐싱된 연결 재사용
const connectDB = require('../db');
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) return true;
  await connectDB();
  return true;
};

// HTML content에서 이미지 src 추출
const extractImagesFromHTML = (html) => {
  if (!html) return [];
  const imgs = [];
  const regex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    imgs.push(match[1]);
  }
  return imgs;
};

// GET /work/header - 상단 제목/부제목 조회
router.get('/header', async (req, res) => {
  try {
    await ensureDBConnection();
    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    let header = await WorkHeader.findOne({});
    if (!header) {
      header = new WorkHeader({ title: 'WORK', subtitle: '작업/프로젝트' });
      await header.save();
    }
    res.json({ success: true, data: header });
  } catch (e) {
    res.status(500).json({ success: false, message: '헤더 조회 실패', error: e.message });
  }
});

// PUT /work/header - 상단 제목/부제목 수정
router.put('/header', require('../middleware/auth'), adminOnly, async (req, res) => {
  try {
    await ensureDBConnection();
    let header = await WorkHeader.findOne({});
    if (!header) {
      header = new WorkHeader({});
    }
    if (req.body.title !== undefined) header.title = req.body.title;
    if (req.body.subtitle !== undefined) header.subtitle = req.body.subtitle;
    await header.save();
    res.json({ success: true, data: header });
  } catch (e) {
    res.status(500).json({ success: false, message: '헤더 수정 실패', error: e.message });
  }
});

// PUT /work/reorder - 글 순서 변경
router.put('/reorder', auth, adminOnly, async (req, res) => {
  try {
    await ensureDBConnection();

    const { orders } = req.body; // [{ id: '...', sortOrder: 0 }, { id: '...', sortOrder: 1 }, ...]

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        message: '순서 데이터가 필요합니다.'
      });
    }

    // 각 항목의 sortOrder 업데이트
    const updatePromises = orders.map(item =>
      Work.findByIdAndUpdate(item.id, { sortOrder: item.sortOrder })
    );

    await Promise.all(updatePromises);

    console.log('Work 순서 업데이트 완료:', orders.length, '개 항목');

    res.json({
      success: true,
      message: '순서가 성공적으로 변경되었습니다.'
    });

  } catch (error) {
    console.error('Work 순서 변경 오류:', error);
    res.status(500).json({
      success: false,
      message: '순서 변경에 실패했습니다.',
      error: error.message
    });
  }
});

// GET /api/work - 모든 work 데이터 조회
router.get('/', async (req, res) => {
  try {
    console.log('Work 데이터 조회 시작...');

    // DB 연결 상태 확인 및 연결
    await ensureDBConnection();
    console.log('DB 연결 확인 완료');

    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    const works = await Work.find().sort({ sortOrder: 1, _id: -1 });
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
        htmlContent: work.htmlContent || '',
        date: dateString,
        images: extractImagesFromHTML(work.contents),
        thumbnail: work.thumbnail || null,
        sortOrder: work.sortOrder || 0,
        imageLayout: work.imageLayout || []
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
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    await ensureDBConnection();

    const { title, content, htmlContent, thumbnail, imageLayout } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '제목과 내용을 모두 입력해주세요.'
      });
    }

    const newWork = new Work({
      title: title.trim(),
      contents: content.trim(), // content를 contents로 매핑
      htmlContent: htmlContent || '',
      thumbnail: thumbnail ? thumbnail.trim() : null,
      imageLayout: imageLayout || []
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
        htmlContent: savedWork.htmlContent,
        thumbnail: savedWork.thumbnail,
        imageLayout: savedWork.imageLayout || [],
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
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    await ensureDBConnection();

    const { id } = req.params;
    const { title, content, htmlContent, thumbnail, imageLayout } = req.body;

    // imageLayout만 업데이트하는 경우 title/content 검증 스킵
    const isLayoutOnlyUpdate = imageLayout !== undefined && !title && !content;

    if (!isLayoutOnlyUpdate && (!title || !content)) {
      return res.status(400).json({
        success: false,
        message: '제목과 내용을 모두 입력해주세요.'
      });
    }

    const updateData = {};
    if (title) updateData.title = title.trim();
    if (content) updateData.contents = content.trim();
    if (htmlContent !== undefined) updateData.htmlContent = htmlContent || '';
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail ? thumbnail.trim() : null;
    if (imageLayout !== undefined) updateData.imageLayout = imageLayout;

    const updatedWork = await Work.findByIdAndUpdate(
      id,
      updateData,
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
        htmlContent: updatedWork.htmlContent,
        thumbnail: updatedWork.thumbnail,
        imageLayout: updatedWork.imageLayout || [],
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
router.delete('/:id', auth, adminOnly, async (req, res) => {
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
        htmlContent: work.htmlContent || '',
        date: dateString,
        images: extractImagesFromHTML(work.contents),
        thumbnail: work.thumbnail || null,
        imageLayout: work.imageLayout || []
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