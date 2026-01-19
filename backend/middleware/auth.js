const jwt = require('jsonwebtoken');

// 개발 환경에서의 폴백 시크릿 (프로덕션에서는 반드시 환경변수 설정 필요)
const DEFAULT_SECRET = 'nodetree-default-jwt-secret-2024';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;

if (!process.env.JWT_SECRET) {
  console.warn("⚠️ 경고: JWT_SECRET 환경 변수가 설정되지 않았습니다. 기본값을 사용합니다.");
  console.warn("⚠️ 프로덕션 환경에서는 반드시 JWT_SECRET을 설정하세요!");
}

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