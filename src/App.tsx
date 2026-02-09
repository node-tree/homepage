import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Home from './components/Home';
import Location3D from './components/Location3D';
import StrudelSynth from './components/StrudelSynth';
import Contact from './components/Contact';
import Filed from './components/Filed';
import CV from './components/CV';
import LocationVideoSettings from './components/LocationVideoSettings';
import About from './components/About';
import Guestbook from './components/Guestbook';
import Work from './components/Work';
import { playHoverSound, playClickSound, playNavSound, initAudioContext } from './utils/sound';
import { prefetchAPI } from './services/api';

// 네비게이션 항목
const NAV_ITEMS = [
  { id: 1, text: 'NODE TREE', page: 'ABOUT' },
  { id: 2, text: 'CROSS CITY', page: 'LOCATION' },
  { id: 3, text: 'ART WORK', page: 'WORK' },
  { id: 4, text: 'COMMONS', page: 'FILED' },
  { id: 5, text: 'CV', page: 'CV' },
  { id: 6, text: 'CONTACT', page: 'CONTACT' }
];

// 데스크톱 네비게이션 컴포넌트 - 원형 노드 + 아래 텍스트
function Navigation({ currentPage, onPageChange }: { currentPage: string; onPageChange: (page: string) => void }) {
  const allNavItems = [
    { id: 0, text: 'HOME', page: 'HOME' },
    ...NAV_ITEMS
  ];

  return (
    <nav className="fixed-navigation desktop-nav">
      <div className="nav-container">
        {allNavItems.map((item) => (
          <motion.div
            key={item.id}
            className={`nav-node ${currentPage === item.page ? 'active' : ''}`}
            onMouseEnter={playHoverSound}
            onClick={() => {
              playNavSound(item.page);
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

// 모바일 햄버거 메뉴 컴포넌트
function MobileNavigation({ currentPage, onPageChange }: { currentPage: string; onPageChange: (page: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const allNavItems = [
    { id: 0, text: 'HOME', page: 'HOME' },
    ...NAV_ITEMS
  ];

  const handleItemClick = (page: string) => {
    playNavSound(page);
    onPageChange(page);
    setIsOpen(false);
  };

  return (
    <>
      {/* 햄버거 버튼 */}
      <motion.button
        className="hamburger-button"
        onClick={() => {
          playClickSound();
          setIsOpen(!isOpen);
        }}
        whileTap={{ scale: 0.95 }}
      >
        <motion.div
          className="hamburger-icon"
          animate={isOpen ? "open" : "closed"}
        >
          <span className={`hamburger-line ${isOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${isOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${isOpen ? 'open' : ''}`} />
        </motion.div>
      </motion.button>

      {/* 사이드바 오버레이 */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="sidebar-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
            <motion.nav
              className="mobile-sidebar"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
            >
              <div className="sidebar-header">
                <span>MENU</span>
              </div>
              <div className="sidebar-items">
                {allNavItems.map((item) => (
                  <motion.div
                    key={item.id}
                    className={`sidebar-item ${currentPage === item.page ? 'active' : ''}`}
                    onClick={() => handleItemClick(item.page)}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="sidebar-dot" />
                    <span>{item.text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}


// [async-parallel] 페이지별 프리페치 매핑
const prefetchMap: Record<string, () => void> = {
  HOME: prefetchAPI.home,
  WORK: prefetchAPI.work,
  FILED: prefetchAPI.filed,
  ABOUT: prefetchAPI.about,
  CV: prefetchAPI.cv,
  LOCATION: prefetchAPI.location,
};

// 메인 콘텐츠 컴포넌트
function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('HOME');

  // [async-parallel] 앱 마운트 시 중요 데이터 프리페칭
  useEffect(() => {
    // 초기 로드 시 자주 사용하는 데이터 병렬 프리페칭
    prefetchAPI.critical();
  }, []);

  // 모바일 브라우저를 위한 AudioContext 초기화
  // iOS Safari: touchend 사용 필수 (touchstart는 작동 안 함)
  useEffect(() => {
    const handleFirstInteraction = () => {
      initAudioContext();
      // 모든 리스너 제거
      document.removeEventListener('touchend', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('mousedown', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };

    // iOS 6-8: touchstart, iOS 9+: touchend
    document.addEventListener('touchend', handleFirstInteraction, false);
    document.addEventListener('touchstart', handleFirstInteraction, false);
    document.addEventListener('mousedown', handleFirstInteraction, false);
    document.addEventListener('keydown', handleFirstInteraction, false);

    return () => {
      document.removeEventListener('touchend', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('mousedown', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

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
    // [async-parallel] 페이지 전환 전 해당 페이지 데이터 프리페칭
    const prefetch = prefetchMap[page];
    if (prefetch) {
      prefetch();
    }
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
      {/* 데스크톱 네비게이션 */}
      <Navigation currentPage={currentPage} onPageChange={handlePageChange} />

      {/* 모바일 햄버거 메뉴 */}
      <MobileNavigation currentPage={currentPage} onPageChange={handlePageChange} />

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
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/guestbook" element={<Guestbook />} />
          <Route path="/synth" element={
            <div style={{
              minHeight: '100vh',
              background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)',
              paddingTop: '140px',
              paddingBottom: '40px'
            }}>
              <StrudelSynth />
            </div>
          } />
          <Route path="*" element={<AppContent />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
