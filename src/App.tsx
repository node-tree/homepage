import React, { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Home from './components/Home';
import Location3D from './components/Location3D';
import Contact from './components/Contact';
import Filed from './components/Filed';
import CV from './components/CV';
import LocationVideoSettings from './components/LocationVideoSettings';
import About from './components/About';
import { playHoverSound, playClickSound, getBgVolume, setBgVolume, getClickVolume, setClickVolume } from './utils/sound';

const Work = lazy(() => import('./components/Work'));

// 네비게이션 항목
const NAV_ITEMS = [
  { id: 1, text: 'NODE TREE', page: 'ABOUT' },
  { id: 2, text: 'CROSS CITY', page: 'LOCATION' },
  { id: 3, text: 'ART WORK', page: 'WORK' },
  { id: 4, text: 'COMMONS', page: 'FILED' },
  { id: 5, text: 'CV', page: 'CV' },
  { id: 6, text: 'CONTACT', page: 'CONTACT' }
];

// 네비게이션 컴포넌트 - 원형 노드 + 아래 텍스트
function Navigation({ currentPage, onPageChange }: { currentPage: string; onPageChange: (page: string) => void }) {
  const allNavItems = [
    { id: 0, text: 'HOME', page: 'HOME' },
    ...NAV_ITEMS
  ];

  return (
    <nav className="fixed-navigation">
      <div className="nav-container">
        {allNavItems.map((item) => (
          <motion.div
            key={item.id}
            className={`nav-node ${currentPage === item.page ? 'active' : ''}`}
            onMouseEnter={playHoverSound}
            onClick={() => {
              playClickSound();
              onPageChange(item.page);
            }}
            whileTap={{ scale: 0.95 }}
          >
            <div className="nav-dot" />
            <span className="nav-label">{item.text}</span>
          </motion.div>
        ))}
      </div>
    </nav>
  );
}

// 배경음악 컴포넌트
function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [bgVolume, setBgVolumeState] = useState(getBgVolume());
  const [clickVolume, setClickVolumeState] = useState(getClickVolume());

  // 오디오 재생 (클릭/터치 시)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const tryPlay = () => {
      audio.volume = getBgVolume();
      audio.play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.log('Play failed:', e));
    };

    // 자동 재생 시도
    tryPlay();

    // 클릭/터치 시에도 재생 시도
    document.addEventListener('click', tryPlay);
    document.addEventListener('touchstart', tryPlay);

    return () => {
      document.removeEventListener('click', tryPlay);
      document.removeEventListener('touchstart', tryPlay);
    };
  }, []);

  // 볼륨 변경 시 적용
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = bgVolume;
    }
    setBgVolume(bgVolume);
  }, [bgVolume]);

  useEffect(() => {
    setClickVolume(clickVolume);
  }, [clickVolume]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  return (
    <>
      <audio ref={audioRef} src="/backsound.mp3" loop preload="auto" autoPlay />

      {/* 사운드 컨트롤 패널 */}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {/* 볼륨 슬라이더 (펼쳐졌을 때) */}
        {showControls && (
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.85)',
              borderRadius: '12px',
              padding: '14px 16px',
              minWidth: '180px',
            }}
          >
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ color: '#aaa', fontSize: '11px' }}>배경음</span>
                <span style={{ color: '#fff', fontSize: '11px', fontWeight: 500 }}>{Math.round(bgVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={bgVolume}
                onChange={(e) => setBgVolumeState(parseFloat(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: '#fff' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ color: '#aaa', fontSize: '11px' }}>클릭음</span>
                <span style={{ color: '#fff', fontSize: '11px', fontWeight: 500 }}>{Math.round(clickVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={clickVolume}
                onChange={(e) => setClickVolumeState(parseFloat(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: '#fff' }}
              />
            </div>
          </div>
        )}

        {/* 메인 컨트롤 바 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '20px',
            padding: '8px 14px',
          }}
        >
          {/* 재생/정지 버튼 */}
          <button
            onClick={togglePlay}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: 'none',
              background: isPlaying ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            title={isPlaying ? '음악 끄기' : '음악 켜기'}
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>

          {/* 상태 텍스트 */}
          <div style={{
            color: '#fff',
            fontSize: '11px',
            letterSpacing: '0.05em',
            minWidth: '70px',
          }}>
            <span style={{ opacity: isPlaying ? 1 : 0.5 }}>
              SOUND {isPlaying ? 'ON' : 'OFF'}
            </span>
            {isPlaying && (
              <span style={{ opacity: 0.6, marginLeft: '6px' }}>
                {Math.round(bgVolume * 100)}%
              </span>
            )}
          </div>

          {/* 설정 버튼 */}
          <button
            onClick={() => setShowControls(!showControls)}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: 'none',
              background: showControls ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
            title="볼륨 설정"
          >
            ⚙
          </button>
        </div>
      </div>
    </>
  );
}

// 메인 콘텐츠 컴포넌트
function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('HOME');

  // URL 경로에 따라 페이지 설정
  useEffect(() => {
    const path = location.pathname.toUpperCase().replace('/', '');
    if (path === '' || path === 'HOME') {
      setCurrentPage('HOME');
    } else if (path === 'LOGIN') {
      // 로그인 페이지는 별도 처리
    } else if (NAV_ITEMS.some(item => item.page === path)) {
      setCurrentPage(path);
    } else {
      // 알 수 없는 경로면 홈으로
      setCurrentPage('HOME');
    }
  }, [location.pathname]);

  // 페이지 변경 핸들러
  const handlePageChange = useCallback((page: string) => {
    setCurrentPage(page);
    navigate(page === 'HOME' ? '/' : `/${page.toLowerCase()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [navigate]);

  // 로그인 페이지일 때는 별도 렌더링
  if (location.pathname === '/login') {
    return <Login />;
  }

  const renderPageContent = () => {
    switch (currentPage) {
      case 'HOME':
        return <Home />;
      case 'LOCATION':
        return <Location3D />;
      case 'CONTACT':
        return <Contact />;
      case 'ABOUT':
        return <About />;
      case 'WORK':
        return <Work />;
      case 'FILED':
        return <Filed />;
      case 'CV':
        return <CV />;
      case 'LOCATION_SETTINGS':
        return <LocationVideoSettings />;
      default:
        return <Home />;
    }
  };

  return (
    <div className="App">
      {/* 배경음악 */}
      <BackgroundMusic />

      {/* 고정 네비게이션 */}
      <Navigation currentPage={currentPage} onPageChange={handlePageChange} />

      {/* 로그인/로그아웃 링크 */}
      <div className="auth-container">
        {!isAuthenticated ? (
          <motion.a
            href="/login"
            className="login-link"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            whileHover={{ opacity: 1 }}
          >
            로그인
          </motion.a>
        ) : (
          <motion.div
            className="logout-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            whileHover={{ opacity: 1 }}
          >
            <span className="user-info">{user?.username}님</span>
            <button
              onClick={() => handlePageChange('LOCATION_SETTINGS')}
              className="settings-button"
            >
              설정
            </button>
            <button onClick={logout} className="logout-button">
              로그아웃
            </button>
          </motion.div>
        )}
      </div>

      {/* 페이지 콘텐츠 */}
      <main className="main-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {renderPageContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// App 컴포넌트
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="loading-spinner">...</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<AppContent />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
