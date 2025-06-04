import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
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
      const response = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailOrUsername: formData.username,
          password: formData.password
        })
      });

      const data = await response.json();

      if (data.success) {
        login(data.token, data.user);
        alert('로그인 성공!');
        window.location.href = '/'; // 메인으로 리다이렉트
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 회원가입 처리
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.username || !formData.email || !formData.password) {
      setError('모든 필드를 입력해주세요.');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        login(data.token, data.user);
        alert('회원가입 및 로그인 성공!');
        window.location.href = '/'; // 메인으로 리다이렉트
      } else {
        setError(data.message);
      }
    } catch (error) {
      console.error('회원가입 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 모드 전환
  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setError(null);
    setFormData({ username: '', email: '', password: '' });
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
            <h1 className="login-title">
              {isLoginMode ? '로그인' : '회원가입'}
            </h1>
            <p className="login-subtitle">
              {isLoginMode ? '관리자 계정으로 로그인하세요' : '새 계정을 만드세요'}
            </p>
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

          <form onSubmit={isLoginMode ? handleLogin : handleRegister} className="login-form">
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

            {!isLoginMode && (
              <div className="form-group">
                <label className="form-label">이메일</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="이메일을 입력하세요"
                  className="form-input"
                  disabled={loading}
                  required
                />
              </div>
            )}

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
              {loading ? (
                isLoginMode ? '로그인 중...' : '회원가입 중...'
              ) : (
                isLoginMode ? '로그인' : '회원가입'
              )}
            </motion.button>
          </form>

          <div className="login-footer">
            <p>
              {isLoginMode ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
              <button 
                type="button" 
                className="toggle-button"
                onClick={toggleMode}
                disabled={loading}
              >
                {isLoginMode ? '회원가입' : '로그인'}
              </button>
            </p>
          </div>

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