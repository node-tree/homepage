const express = require('express');
const router = express.Router();
const LocationPost = require('../models/LocationPost');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
const { LocationHeader } = require('../models/LocationVideo');

// DB 연결 확인 함수
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

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

// GET /location/header - 상단 제목/부제목 조회 (기존 LocationHeader 사용)
router.get('/header', async (req, res) => {
  try {
    await ensureDBConnection();
    let header = await LocationHeader.findOne({});
    if (!header) {
      header = new LocationHeader({ title: 'CROSS CITY', subtitle: '서사 교차점의 기록장소' });
      await header.save();
    }
    res.json({ success: true, data: header });
  } catch (e) {
    res.status(500).json({ success: false, message: '헤더 조회 실패', error: e.message });
  }
});

// PUT /location/header - 상단 제목/부제목 수정
router.put('/header', auth, async (req, res) => {
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

// PUT /location/reorder - 글 순서 변경
router.put('/reorder', auth, async (req, res) => {
  try {
    await ensureDBConnection();

    const { orders } = req.body;

    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        message: '순서 데이터가 필요합니다.'
      });
    }

    const updatePromises = orders.map(item =>
      LocationPost.findByIdAndUpdate(item.id, { sortOrder: item.sortOrder })
    );

    await Promise.all(updatePromises);

    console.log('Location 순서 업데이트 완료:', orders.length, '개 항목');

    res.json({
      success: true,
      message: '순서가 성공적으로 변경되었습니다.'
    });

  } catch (error) {
    console.error('Location 순서 변경 오류:', error);
    res.status(500).json({
      success: false,
      message: '순서 변경에 실패했습니다.',
      error: error.message
    });
  }
});

// GET /api/location - 모든 location 데이터 조회
router.get('/', async (req, res) => {
  try {
    console.log('Location 데이터 조회 시작...');

    await ensureDBConnection();
    console.log('DB 연결 확인 완료');

    const posts = await LocationPost.find().sort({ sortOrder: 1, _id: -1 });
    console.log(`DB에서 ${posts.length}개의 Location 데이터 조회 완료`);

    const formattedPosts = posts.map(post => {
      let dateString;
      try {
        if (post.createdAt && post.createdAt instanceof Date) {
          dateString = post.createdAt.toLocaleDateString('ko-KR');
        } else {
          const objectId = post._id;
          const timestamp = objectId.getTimestamp();
          dateString = timestamp.toLocaleDateString('ko-KR');
        }
      } catch (dateError) {
        console.warn('날짜 변환 오류:', dateError);
        dateString = new Date().toLocaleDateString('ko-KR');
      }

      return {
        id: post._id.toString(),
        title: post.title || '제목 없음',
        content: post.contents || '내용 없음',
        htmlContent: post.htmlContent || '',
        date: dateString,
        images: [],
        thumbnail: post.thumbnail || null,
        sortOrder: post.sortOrder || 0
      };
    });

    res.json({
      success: true,
      data: formattedPosts,
      count: formattedPosts.length,
      source: 'database',
      message: `실제 데이터베이스에서 ${formattedPosts.length}개의 데이터를 가져왔습니다.`
    });
  } catch (error) {
    console.error('Location 데이터 조회 오류:', error);

    res.status(500).json({
      success: false,
      data: [],
      count: 0,
      error: error.message,
      mongoConnectionState: mongoose.connection.readyState
    });
  }
});

// POST /api/location - 새 글 작성
router.post('/', auth, async (req, res) => {
  try {
    await ensureDBConnection();

    const { title, content, htmlContent, thumbnail } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '제목과 내용을 모두 입력해주세요.'
      });
    }

    const newPost = new LocationPost({
      title: title.trim(),
      contents: content.trim(),
      htmlContent: htmlContent || '',
      thumbnail: thumbnail ? thumbnail.trim() : null
    });

    const savedPost = await newPost.save();
    console.log('새 Location 데이터 저장 완료:', savedPost._id);

    res.json({
      success: true,
      message: '글이 성공적으로 저장되었습니다.',
      data: {
        id: savedPost._id.toString(),
        title: savedPost.title,
        content: savedPost.contents,
        htmlContent: savedPost.htmlContent,
        thumbnail: savedPost.thumbnail,
        date: savedPost.createdAt ? savedPost.createdAt.toLocaleDateString('ko-KR') : new Date().toLocaleDateString('ko-KR')
      }
    });

  } catch (error) {
    console.error('Location 글 저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '글 저장에 실패했습니다.',
      error: error.message,
      mongoConnectionState: mongoose.connection.readyState
    });
  }
});

// PUT /api/location/:id - 글 수정
router.put('/:id', auth, async (req, res) => {
  try {
    await ensureDBConnection();

    const { id } = req.params;
    const { title, content, htmlContent, thumbnail } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '제목과 내용을 모두 입력해주세요.'
      });
    }

    const updatedPost = await LocationPost.findByIdAndUpdate(
      id,
      {
        title: title.trim(),
        contents: content.trim(),
        htmlContent: htmlContent || '',
        thumbnail: thumbnail ? thumbnail.trim() : null
      },
      { new: true }
    );

    if (!updatedPost) {
      return res.status(404).json({
        success: false,
        message: '글을 찾을 수 없습니다.'
      });
    }

    console.log('Location 데이터 수정 완료:', updatedPost._id);

    res.json({
      success: true,
      message: '글이 성공적으로 수정되었습니다.',
      data: {
        id: updatedPost._id.toString(),
        title: updatedPost.title,
        content: updatedPost.contents,
        htmlContent: updatedPost.htmlContent,
        thumbnail: updatedPost.thumbnail,
        date: updatedPost.createdAt ? updatedPost.createdAt.toLocaleDateString('ko-KR') : new Date().toLocaleDateString('ko-KR')
      }
    });

  } catch (error) {
    console.error('Location 글 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '글 수정에 실패했습니다.',
      error: error.message,
      mongoConnectionState: mongoose.connection.readyState
    });
  }
});

// DELETE /api/location/:id - 글 삭제
router.delete('/:id', auth, async (req, res) => {
  try {
    await ensureDBConnection();

    const { id } = req.params;

    const deletedPost = await LocationPost.findByIdAndDelete(id);

    if (!deletedPost) {
      return res.status(404).json({
        success: false,
        message: '글을 찾을 수 없습니다.'
      });
    }

    console.log('Location 데이터 삭제 완료:', deletedPost._id);

    res.json({
      success: true,
      message: '글이 성공적으로 삭제되었습니다.',
      data: {
        id: deletedPost._id.toString(),
        title: deletedPost.title
      }
    });

  } catch (error) {
    console.error('Location 글 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: '글 삭제에 실패했습니다.',
      error: error.message,
      mongoConnectionState: mongoose.connection.readyState
    });
  }
});

// GET /api/location/:id - 특정 글 조회
router.get('/:id', async (req, res) => {
  try {
    await ensureDBConnection();

    const { id } = req.params;
    const post = await LocationPost.findById(id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: '글을 찾을 수 없습니다.'
      });
    }

    let dateString;
    try {
      if (post.createdAt && post.createdAt instanceof Date) {
        dateString = post.createdAt.toLocaleDateString('ko-KR');
      } else {
        const objectId = post._id;
        const timestamp = objectId.getTimestamp();
        dateString = timestamp.toLocaleDateString('ko-KR');
      }
    } catch (dateError) {
      dateString = new Date().toLocaleDateString('ko-KR');
    }

    res.json({
      success: true,
      data: {
        id: post._id.toString(),
        title: post.title || '제목 없음',
        content: post.contents || '내용 없음',
        htmlContent: post.htmlContent || '',
        date: dateString,
        images: [],
        thumbnail: post.thumbnail || null
      },
      source: 'database'
    });

  } catch (error) {
    console.error('Location 글 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '글 조회에 실패했습니다.',
      error: error.message,
      mongoConnectionState: mongoose.connection.readyState
    });
  }
});

module.exports = router;
