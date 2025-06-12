import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();

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
      // 테스트 계정들 (백엔드 없을 때)
      const testAccounts = [
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
        alert(`로그인 성공! (${matchedAccount.role === 'admin' ? '관리자' : '사용자'} 모드)`);
        window.location.href = '/';
        return;
      }

      // 백엔드 API 시도 (나중에 백엔드 배포 시 사용)
      const apiUrl = process.env.REACT_APP_API_URL || 
        (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api');
      
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
        alert('로그인 성공! (실제 DB)');
        window.location.href = '/'; // 메인으로 리다이렉트
      } else {
        setError('로그인 정보가 올바르지 않습니다. 테스트 계정: admin/password, user/123456, nodetree/nodetree2024');
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      setError('로그인 정보가 올바르지 않습니다. 테스트 계정: admin/password, user/123456, nodetree/nodetree2024');
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
              />
            </div>

            <div className="form-group">
              <label className="form-label">비밀번호</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="비밀번호를 입력하세요"
                className="form-input"
                disabled={loading}
                required
                minLength={6}
              />
            </div>

            <motion.button
              type="submit"
              className="login-button"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? '로그인 중...' : '로그인'}
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