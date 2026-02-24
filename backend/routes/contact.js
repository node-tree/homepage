const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const Contact = require('../models/Contact');
const auth = require('../middleware/auth');

const router = express.Router();

// DB 연결 확인 — 별도 모듈에서 캐싱된 연결 재사용
const connectDB = require('../db');
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) return true;
  await connectDB();
  return true;
};

// GET /api/contact - Contact 설정 조회
router.get('/', async (req, res) => {
  try {
    console.log('Contact 데이터 조회 시작...');

    await ensureDBConnection();
    console.log('DB 연결 확인 완료');

    let contactData = await Contact.findOne({ isActive: true });

    // 데이터가 없으면 기본 데이터 생성
    if (!contactData) {
      contactData = new Contact({
        emails: ['contact@nodetree.kr'],
        location: 'Seoul, South Korea',
        socialLinks: [
          { name: 'Instagram', url: 'https://www.instagram.com/nodetree_kr' },
          { name: 'YouTube', url: 'https://www.youtube.com/@nodetree' }
        ]
      });
      await contactData.save();
      console.log('기본 Contact 데이터 생성 완료');
    }

    console.log('Contact 데이터 조회 완료');

    res.json({
      success: true,
      data: contactData,
      message: 'Contact 데이터를 가져왔습니다.'
    });
  } catch (error) {
    console.error('Contact 데이터 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: 'Contact 데이터 조회에 실패했습니다.',
      error: error.message
    });
  }
});

// PUT /api/contact - Contact 설정 수정 (관리자만)
router.put('/', auth, async (req, res) => {
  try {
    await ensureDBConnection();

    const { emails, location, socialLinks } = req.body;

    const updateData = {
      updatedAt: Date.now()
    };

    if (emails) updateData.emails = emails;
    if (location) updateData.location = location.trim();
    if (socialLinks) updateData.socialLinks = socialLinks;

    let contactData = await Contact.findOne({ isActive: true });

    if (!contactData) {
      contactData = new Contact({
        emails: emails || ['contact@nodetree.kr'],
        location: location || 'Seoul, South Korea',
        socialLinks: socialLinks || []
      });
      await contactData.save();
    } else {
      Object.assign(contactData, updateData);
      await contactData.save();
    }

    console.log('Contact 데이터 수정 완료:', contactData._id);

    res.json({
      success: true,
      message: 'Contact 설정이 성공적으로 수정되었습니다.',
      data: contactData
    });

  } catch (error) {
    console.error('Contact 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: 'Contact 수정에 실패했습니다.',
      error: error.message
    });
  }
});

// POST /api/contact/send - 문의 메일 전송
router.post('/send', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // 필수 필드 검증
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: '모든 필드를 입력해주세요.'
      });
    }

    // 이메일 유효성 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: '유효한 이메일 주소를 입력해주세요.'
      });
    }

    // Contact 설정에서 수신 이메일 가져오기
    await ensureDBConnection();
    const contactData = await Contact.findOne({ isActive: true });
    const recipientEmail = contactData?.emails?.[0] || 'contact@nodetree.kr';

    // 이메일 전송 설정 (환경변수 사용)
    // SMTP 설정이 없으면 메일 내용을 로그로 기록
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('========== 새 문의 메일 ==========');
      console.log('보낸사람:', name, '<' + email + '>');
      console.log('받는사람:', recipientEmail);
      console.log('제목:', subject);
      console.log('내용:', message);
      console.log('시간:', new Date().toISOString());
      console.log('==================================');

      return res.json({
        success: true,
        message: '문의가 접수되었습니다. 빠른 시일 내에 답변드리겠습니다.'
      });
    }

    // SMTP 설정이 있는 경우 실제 이메일 전송
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: `"${name}" <${process.env.SMTP_USER}>`,
      replyTo: email,
      to: recipientEmail,
      subject: `[NODETREE 문의] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #111; padding-bottom: 10px;">새 문의가 접수되었습니다</h2>
          <div style="padding: 20px 0;">
            <p><strong>이름:</strong> ${name}</p>
            <p><strong>이메일:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>제목:</strong> ${subject}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p><strong>내용:</strong></p>
            <div style="background: #f8f8f8; padding: 15px; border-radius: 8px; white-space: pre-wrap;">${message}</div>
          </div>
          <p style="color: #888; font-size: 12px; margin-top: 30px;">이 이메일은 nodetree.kr 문의 폼에서 자동 발송되었습니다.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('문의 메일 전송 완료:', email, '->', recipientEmail);

    res.json({
      success: true,
      message: '메시지가 성공적으로 전송되었습니다.'
    });

  } catch (error) {
    console.error('메일 전송 오류:', error);
    res.status(500).json({
      success: false,
      message: '메시지 전송에 실패했습니다. 잠시 후 다시 시도해주세요.',
      error: error.message
    });
  }
});

module.exports = router;
