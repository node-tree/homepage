const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

const auth = (req, res, next) => {
  try {
    // Authorization 헤더에서 토큰 가져오기
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: '접근 권한이 없습니다. 토큰이 필요합니다.'
      });
    }

    // "Bearer TOKEN" 형식에서 토큰 추출
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '토큰이 제공되지 않았습니다.'
      });
    }

    // 토큰 검증
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();

  } catch (error) {
    console.error('토큰 검증 오류:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: '토큰이 만료되었습니다. 다시 로그인해주세요.'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 토큰입니다.'
      });
    }

    return res.status(500).json({
      success: false,
      message: '토큰 검증 중 서버 오류가 발생했습니다.'
    });
  }
};

module.exports = auth; 