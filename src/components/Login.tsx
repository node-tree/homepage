import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

interface LoginProps {
  onClose?: () => void;
}

const Login: React.FC<LoginProps> = ({ onClose }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, isAuthenticated } = useAuth();

  // 로그인 후 복귀 경로(?next=). 오픈 리다이렉트 방지를 위해 같은 출처의 절대경로만 허용한다.
  // (예: /admin/media 에서 세션 만료로 튕겨온 경우 로그인 직후 그 페이지로 돌아간다.)
  const nextPath = (() => {
    if (typeof window === 'undefined') return '/';
    const raw = new URLSearchParams(window.location.search).get('next');
    // 역슬래시·제어문자는 브라우저가 '/'로 정규화해 `/\evil.com` → `//evil.com` 이탈이 가능하다.
    // 그래서 문자열 검사 대신 현재 출처 기준으로 URL 을 해석하고, 출처가 다르면 홈으로 폴백,
    // 같으면 pathname+search+hash 만 재조립해 되돌린다(스킴·호스트는 절대 대입하지 않는다).
    if (!raw || !raw.startsWith('/') || /[\\\u0000-\u001f]/.test(raw)) return '/';
    try {
      const u = new URL(raw, window.location.origin);
      if (u.origin !== window.location.origin || u.pathname === '/login') return '/';
      return `${u.pathname}${u.search}${u.hash}`;
    } catch {
      return '/';
    }
  })();

  // 이미 로그인된 경우 복귀 경로(없으면 홈)로 리다이렉트
  useEffect(() => {
    if (isAuthenticated) {
      if (onClose) { onClose(); return; }
      window.location.href = nextPath;
    }
  }, [isAuthenticated, onClose, nextPath]);

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
      // 백엔드 API로 로그인 (api.js와 동일한 로직: nodetree.kr에서는 Vercel 백엔드 사용)
      const isNodeTreeSite = typeof window !== 'undefined' &&
        (window.location.hostname === 'nodetree.kr' || window.location.hostname === 'www.nodetree.kr' ||
         window.location.hostname === 'isoartlab.com' || window.location.hostname === 'www.isoartlab.com');
      const apiUrl = isNodeTreeSite
        ? '/api'
        : (process.env.REACT_APP_API_URL || '/api');

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

      const data = await response.json();

      if (data.success) {
        login(data.token, data.user);
        
        // 로그인 성공 상태 표시
        setError(null);
        setSuccess(true);
        
        // 부드러운 리다이렉트 (?next= 가 있으면 원래 가려던 페이지로)
        setTimeout(() => {
          window.location.href = nextPath;
        }, 800);
      } else {
        setError('사용자명 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch (error) {
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
            {onClose ? (
              <motion.span
                className="home-link"
                style={{ cursor: 'pointer' }}
                onClick={onClose}
                whileHover={{ scale: 1.05 }}
              >
                ← 돌아가기
              </motion.span>
            ) : (
              <motion.a
                href="/"
                className="home-link"
                whileHover={{ scale: 1.05 }}
              >
                ← 홈으로 돌아가기
              </motion.a>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login; 