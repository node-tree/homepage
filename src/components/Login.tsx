import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, isAuthenticated } = useAuth();

  // 이미 로그인된 경우 홈으로 리다이렉트
  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/';
    }
  }, [isAuthenticated]);

  // 입력 필드 변경 처리
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 로그인 처리
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 테스트 계정들 (백엔드 없을 때) - 배포 환경에서는 제한
      const isNodeTreeSite = window.location.hostname === 'nodetree.kr' || window.location.hostname === 'www.nodetree.kr';
      const testAccounts = isNodeTreeSite ? [
        // 배포 환경에서는 admin 계정만 허용
        { username: 'admin', password: 'nodetree2024!', role: 'admin' as const }
      ] : [
        // 개발 환경에서는 여러 테스트 계정 허용
        { username: 'admin', password: 'password', role: 'admin' as const },
        { username: 'user', password: '123456', role: 'user' as const },
        { username: 'nodetree', password: 'nodetree2024', role: 'admin' as const }
      ];

      const matchedAccount = testAccounts.find(account => 
        account.username === formData.username && account.password === formData.password
      );

      if (matchedAccount) {
        const testUser = {
          id: `test-${matchedAccount.username}-${Date.now()}`,
          username: matchedAccount.username,
          email: `${matchedAccount.username}@nodetree.com`,
          role: matchedAccount.role
        };
        
        const testToken = 'test-jwt-token-' + Date.now();
        login(testToken, testUser);
        
        // 로그인 성공 상태 표시
        setError(null);
        setSuccess(true);
        
        // 부드러운 리다이렉트
        setTimeout(() => {
          window.location.href = '/';
        }, 800);
        return;
      }

      // 백엔드 API 시도 - 같은 변수 재사용
      const apiUrl = process.env.REACT_APP_API_URL || 
        (isNodeTreeSite ? 'https://nodetree.kr/api' : 
         process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api');
      
      console.log('로그인 API URL:', apiUrl);
      
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailOrUsername: formData.username,
          password: formData.password
        })
      });

      console.log('로그인 응답 상태:', response.status);
      const data = await response.json();
      console.log('로그인 응답 데이터:', data);

      if (data.success) {
        login(data.token, data.user);
        
        // 로그인 성공 상태 표시
        setError(null);
        setSuccess(true);
        
        // 부드러운 리다이렉트
        setTimeout(() => {
          window.location.href = '/';
        }, 800);
      } else {
        setError('사용자명 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      setError('로그인에 실패했습니다. 사용자명과 비밀번호를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-wrapper">
        <motion.div 
          className="login-box"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="login-header">
            <h1 className="login-title">로그인</h1>
            <p className="login-subtitle">관리자 계정으로 로그인하세요</p>
          </div>

          {error && (
            <motion.div 
              className="error-message"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label className="form-label">사용자명</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="사용자명을 입력하세요"
                className="form-input"
                disabled={loading}
                required
                autoComplete="username"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
            </div>

            <div className="form-group">
              <label className="form-label">비밀번호</label>
              <div className="password-input-container">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="비밀번호를 입력하세요"
                  className="form-input password-input"
                  disabled={loading}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                />
                <button
                  type="button"
                  className="password-toggle-button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <motion.button
              type="submit"
              className={`login-button ${success ? 'success' : ''}`}
              disabled={loading || success}
              whileHover={{ scale: loading || success ? 1 : 1.02 }}
              whileTap={{ scale: loading || success ? 1 : 0.98 }}
            >
              {success ? '로그인 성공! 이동 중...' : loading ? '로그인 중...' : '로그인'}
            </motion.button>
          </form>

          <div className="back-to-home">
            <motion.a 
              href="/"
              className="home-link"
              whileHover={{ scale: 1.05 }}
            >
              ← 홈으로 돌아가기
            </motion.a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login; 