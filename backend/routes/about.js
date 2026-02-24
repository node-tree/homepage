const express = require('express');
const mongoose = require('mongoose');
const About = require('../models/About');
const auth = require('../middleware/auth');

const router = express.Router();

// DB 연결 확인 — 별도 모듈에서 캐싱된 연결 재사용
const connectDB = require('../db');
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) return true;
  await connectDB();
  return true;
};

// GET /api/about - About 페이지 내용 조회
router.get('/', async (req, res) => {
  try {
    console.log('About 데이터 조회 시작...');
    
    await ensureDBConnection();
    console.log('DB 연결 확인 완료');
    
    res.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    let aboutData = await About.findOne({ isActive: true });

    // 데이터가 없으면 기본 데이터 생성
    if (!aboutData) {
      aboutData = new About({
        title: 'ABOUT',
        content: 'NODE TREE에 대한 내용을 작성해주세요.',
        htmlContent: '<div style="text-align: center;"><h2>NODE TREE</h2><p>NODE TREE에 대한 내용을 작성해주세요.</p></div>'
      });
      await aboutData.save();
      console.log('기본 About 데이터 생성 완료');
    }

    console.log('About 데이터 조회 완료');

    res.json({
      success: true,
      data: aboutData,
      message: 'About 데이터를 가져왔습니다.'
    });
  } catch (error) {
    console.error('About 데이터 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: 'About 데이터 조회에 실패했습니다.',
      error: error.message,
      mongoConnectionState: mongoose.connection.readyState
    });
  }
});

// PUT /api/about - About 내용 수정 (관리자만)
router.put('/', auth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    const { title, content, htmlContent } = req.body;
    
    if (!title && !content && !htmlContent) {
      return res.status(400).json({
        success: false,
        message: '수정할 내용을 입력해주세요.'
      });
    }

    const updateData = {
      updatedAt: Date.now()
    };

    if (title) updateData.title = title.trim();
    if (content) updateData.content = content.trim();
    if (htmlContent) updateData.htmlContent = htmlContent;

    let aboutData = await About.findOne({ isActive: true });
    
    if (!aboutData) {
      // 데이터가 없으면 새로 생성
      aboutData = new About({
        title: title || 'ABOUT',
        content: content || '',
        htmlContent: htmlContent || ''
      });
      await aboutData.save();
    } else {
      // 기존 데이터 업데이트
      Object.assign(aboutData, updateData);
      await aboutData.save();
    }
    
    console.log('About 데이터 수정 완료:', aboutData._id);
    
    res.json({
      success: true,
      message: 'About 내용이 성공적으로 수정되었습니다.',
      data: aboutData
    });
    
  } catch (error) {
    console.error('About 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: 'About 수정에 실패했습니다.',
      error: error.message
    });
  }
});

// DELETE /api/about/reset - 기존 데이터 삭제 및 초기화 (관리자만)
router.delete('/reset', auth, async (req, res) => {
  try {
    await ensureDBConnection();
    
    // 기존 모든 About 문서 삭제
    await About.deleteMany({});
    console.log('기존 About 데이터 모두 삭제 완료');
    
    res.json({
      success: true,
      message: '기존 About 데이터가 삭제되었습니다. 새로고침하면 새로운 데이터가 생성됩니다.'
    });
    
  } catch (error) {
    console.error('About 데이터 삭제 오류:', error);
    res.status(500).json({
      success: false,
      message: 'About 데이터 삭제에 실패했습니다.',
      error: error.message
    });
  }
});

module.exports = router; 