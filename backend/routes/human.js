const express = require('express');
const { HumanHeader } = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/human/header - 상단 제목/부제목 조회
router.get('/header', async (req, res) => {
  try {
    let header = await HumanHeader.findOne({});
    if (!header) {
      header = new HumanHeader({ title: 'ART NETWORK', subtitle: '예술의 장을 구성하는 여러 지점들-‘누구와 함께’, ‘무엇이 연결되는가’' });
      await header.save();
    }
    res.json({ success: true, data: header });
  } catch (e) {
    res.status(500).json({ success: false, message: '헤더 조회 실패', error: e.message });
  }
});

// PUT /api/human/header - 상단 제목/부제목 수정
router.put('/header', auth, async (req, res) => {
  try {
    let header = await HumanHeader.findOne({});
    if (!header) {
      header = new HumanHeader({});
    }
    if (req.body.title !== undefined) header.title = req.body.title;
    if (req.body.subtitle !== undefined) header.subtitle = req.body.subtitle;
    await header.save();
    res.json({ success: true, data: header });
  } catch (e) {
    res.status(500).json({ success: false, message: '헤더 수정 실패', error: e.message });
  }
});

module.exports = router; 