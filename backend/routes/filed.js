const express = require('express');
const router = express.Router();
const Filed = require('../models/Filed');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const FiledHeader = require('../models/Filed').FiledHeader;

// DB 연결 확인 — 별도 모듈에서 캐싱된 연결 재사용
const connectDB = require('../db');
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) return true;
  await connectDB();
  return true;
};

// GET /filed/header - 상단 제목/부제목 조회
router.get('/header', async (req, res) => {
  try {
    await ensureDBConnection();
    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    let header = await FiledHeader.findOne({});
    if (!header) {
      header = new FiledHeader({ title: 'FILED', subtitle: '기록/아카이브' });
      await header.save();
    }
    res.json({ success: true, data: header });
  } catch (e) {
    res.status(500).json({ success: false, message: '헤더 조회 실패', error: e.message });
  }
});

// PUT /filed/header - 상단 제목/부제목 수정
router.put('/header', require('../middleware/auth'), async (req, res) => {
  try {
    await ensureDBConnection();
    let header = await FiledHeader.findOne({});
    if (!header) {
      header = new FiledHeader({});
    }
    if (req.body.title !== undefined) header.title = req.body.title;
    if (req.body.subtitle !== undefined) header.subtitle = req.body.subtitle;
    await header.save();
    res.json({ success: true, data: header });
  } catch (e) {
    res.status(500).json({ success: false, message: '헤더 수정 실패', error: e.message });
  }
});

// PUT /filed/reorder - 글 순서 변경
router.put('/reorder', auth, async (req, res) => {
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
      Filed.findByIdAndUpdate(item.id, { sortOrder: item.sortOrder })
    );

    await Promise.all(updatePromises);

    console.log('Filed 순서 업데이트 완료:', orders.length, '개 항목');

    res.json({
      success: true,
      message: '순서가 성공적으로 변경되었습니다.'
    });

  } catch (error) {
    console.error('Filed 순서 변경 오류:', error);
    res.status(500).json({
      success: false,
      message: '순서 변경에 실패했습니다.',
      error: error.message
    });
  }
});

// GET /api/filed - 모든 filed 데이터 조회 (카테고리 필터 지원)
router.get('/', async (req, res) => {
  try {
    console.log('Filed 데이터 조회 시작...');

    // DB 연결 상태 확인 및 연결
    await ensureDBConnection();
    console.log('DB 연결 확인 완료');

    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    // 카테고리 필터 (선택적)
    const { category } = req.query;
    const filter = category ? { category } : {};

    const fileds = await Filed.find(filter).sort({ sortOrder: 1, _id: -1 });
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
        htmlContent: filed.htmlContent || '',
        date: dateString,
        images: [],
        thumbnail: filed.thumbnail || null,
        category: filed.category || '문화예술교육',
        sortOrder: filed.sortOrder || 0,
        imageLayout: filed.imageLayout || []
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

    const { title, content, htmlContent, thumbnail, category, imageLayout } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '제목과 내용을 모두 입력해주세요.'
      });
    }

    const newFiled = new Filed({
      title: title.trim(),
      contents: content.trim(),
      htmlContent: htmlContent || '',
      thumbnail: thumbnail ? thumbnail.trim() : null,
      category: category || '문화예술교육',
      imageLayout: imageLayout || []
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
        htmlContent: savedFiled.htmlContent,
        thumbnail: savedFiled.thumbnail,
        category: savedFiled.category,
        imageLayout: savedFiled.imageLayout || [],
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
    const { title, content, htmlContent, thumbnail, category, imageLayout } = req.body;

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
    if (category) updateData.category = category;
    if (imageLayout !== undefined) updateData.imageLayout = imageLayout;

    const updatedFiled = await Filed.findByIdAndUpdate(
      id,
      updateData,
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
        htmlContent: updatedFiled.htmlContent,
        thumbnail: updatedFiled.thumbnail,
        category: updatedFiled.category,
        imageLayout: updatedFiled.imageLayout || [],
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
        htmlContent: filed.htmlContent || '',
        date: dateString,
        images: [],
        thumbnail: filed.thumbnail || null,
        category: filed.category || '문화예술교육',
        imageLayout: filed.imageLayout || []
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