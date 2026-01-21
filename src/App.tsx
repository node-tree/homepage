import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
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
import { playHoverSound, playClickSound } from './utils/sound';

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
