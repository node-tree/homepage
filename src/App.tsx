import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Location from './components/Location';
import Human from './components/Human';
import About from './components/About';
import Work from './components/Work';
import Filed from './components/Filed';
import Popup from './components/Popup';

function AppContent() {
  // 모든 상태를 최상위에서 선언
  const [currentStep, setCurrentStep] = useState(0); // 0: 초기, 1: 메뉴 펼침, 2: 페이지 표시
  const [currentPage, setCurrentPage] = useState<string | null>(null); // 현재 페이지
  const [showLabels, setShowLabels] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [hoveredCircle, setHoveredCircle] = useState<number | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // 초기 로드 추적
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768); // 모바일 감지
  const [isSmallMobile, setIsSmallMobile] = useState(window.innerWidth <= 480); // 소형 모바일 감지
  const { isAuthenticated, logout, user } = useAuth();

  // 안정적인 핸들러 함수들 - 컴포넌트 최상위에서 선언
  const handleMouseEnter = useCallback((index: number) => {
    setHoveredCircle(prev => prev !== index ? index : prev);
  }, []);

  const handleMouseLeave = useCallback((index: number) => {
    setHoveredCircle(prev => prev === index ? null : prev);
  }, []);

  const handleCircleClickStable = useCallback((page: string) => {
    setCurrentStep((prevStep) => {
      if (prevStep === 1) {
        setCurrentPage(page);
        return 2;
      } else if (prevStep === 2) {
        setCurrentPage(page);
        return 2;
      }
      return prevStep;
    });
  }, []); // 의존성 배열을 비워서 함수 재생성 방지

  // MongoDB에서 로드된 포스트 처리 - useCallback으로 메모화
  const handlePostsLoaded = useCallback((count: number) => {
    // 포스트 수 업데이트 처리
    console.log(`총 ${count}개의 포스트가 로드되었습니다.`);
  }, []);

  // URL 경로 확인
  const currentPath = window.location.pathname;
  
  const circles = [
    { id: 1, text: 'LOCATION', delay: 0, page: 'LOCATION' },
    { id: 2, text: 'HUMAN', delay: 0.1, page: 'HUMAN' },
    { id: 3, text: 'NODE TREE', delay: 0.2, page: 'ABOUT' },
    { id: 4, text: 'WORK', delay: 0.3, page: 'WORK' },
    { id: 5, text: 'FIELD', delay: 0.4, page: 'FILED' }
  ];

  useEffect(() => {
    if (currentStep === 2) {
      // 페이지로 전환 후 1.5초 뒤에 라벨 표시
      const timer = setTimeout(() => {
        setShowLabels(true);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setShowLabels(false);
    }
  }, [currentStep]);

  // 페이지 변경 시 라벨 상태 유지
  useEffect(() => {
    if (currentStep === 2 && currentPage) {
      setShowLabels(true);
    }
  }, [currentPage, currentStep]);

  useEffect(() => {
    if (isInitialLoad) {
      // 첫 로드 이후 상태 변경
      const timer = setTimeout(() => {
        setIsInitialLoad(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isInitialLoad]);

  // 화면 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsSmallMobile(window.innerWidth <= 480);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 로그인 페이지일 때는 별도 렌더링
  if (currentPath === '/login') {
    return <Login />;
  }

  const handleCenterClick = () => {
    if (currentStep === 0) {
      console.log('중앙 원 클릭: currentStep 0 → 1로 변경');
      setCurrentStep(1); // 메뉴 펼침
    }
  };

  const getCirclePosition = (index: number) => {
    console.log(`getCirclePosition - currentStep: ${currentStep}, index: ${index}`);
    switch(currentStep) {
      case 0: // 초기 상태: 모든 원이 중앙 (화면 중간)
        return { x: 0, y: 0, scale: 1 }; // 완전히 중앙에 위치
      case 1: // 메뉴 상태: 가로로 펼쳐짐 (중간) - 모바일 반응형 적용
        const menuPositions = isSmallMobile 
          ? [-140, -70, 0, 70, 140] // 소형 모바일에서 간격 약간 증가
          : isMobile 
          ? [-180, -90, 0, 90, 180] // 모바일에서 간격 약간 증가
          : [-400, -200, 0, 200, 400]; // 데스크탑 간격 유지
        const menuScale = isSmallMobile ? 0.7 : isMobile ? 0.8 : 1; // 메뉴 상태에서 모바일 스케일 조정
        const result = { x: menuPositions[index], y: 0, scale: menuScale };
        console.log(`메뉴 상태 - index ${index}, 계산된 위치:`, result);
        return result;
      case 2: // 페이지 상태: 작아지며 상단으로 (모든 페이지 공통)
        // 화면 크기에 따라 간격 조정
        const pagePositions = isSmallMobile 
          ? [-120, -60, 0, 60, 120] // 소형 모바일에서 간격 대폭 확대
          : isMobile 
          ? [-160, -80, 0, 80, 160] // 모바일에서 간격 대폭 확대
          : [-280, -140, 0, 140, 280]; // 데스크톱에서는 기존 간격
        const mobileScale = isSmallMobile ? 0.45 : isMobile ? 0.35 : 0.23; // 화면 크기별 스케일
        
        // y축 위치도 화면 크기에 따라 조정
        const yPosition = isSmallMobile 
          ? -80 // 소형 모바일에서 더 위로 올림
          : isMobile 
          ? -100 // 모바일에서 더 위로 올림
          : -120; // 데스크톱에서 더 위로 올림
        
        return { x: pagePositions[index], y: yPosition, scale: mobileScale };
      default:
        return { x: 0, y: 0, scale: 1 };
    }
  };

  const springTransition = {
    type: "spring",
    damping: 35,
    stiffness: 80,
    mass: 1.2
  };

  const renderPageContent = () => {
    switch(currentPage) {
      case 'LOCATION':
        return <Location />;
      case 'HUMAN':
        return <Human />;
      case 'ABOUT':
        return <About />;
      case 'WORK':
        return <Work onPostsLoaded={handlePostsLoaded} />;
      case 'FILED':
        return <Filed onPostsLoaded={handlePostsLoaded} />;
      default:
        return null;
    }
  };

  return (
    <div className={`App ${currentStep === 2 ? 'page-mode' : ''}`}>
      <div className={`main-container ${currentStep === 2 ? 'page-mode' : ''}`}>
        {/* 로그인/로그아웃 링크 */}
        {!isAuthenticated ? (
          <motion.a
            href="/login"
            className="login-link"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            whileHover={{ opacity: 1, scale: 1.05 }}
            transition={{ duration: 0.2 }}
          >
            로그인
          </motion.a>
        ) : (
          <motion.div
            className="logout-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <span className="user-info">{user?.username}님</span>
            <button
              onClick={logout}
              className="logout-button"
            >
              로그아웃
            </button>
          </motion.div>
        )}
        
        {/* 홈페이지 리뉴얼중 팝업: 로그인 안 된 경우만 */}
        {!isAuthenticated && (
          <Popup 
            open={true}
            message="NODE TREE
            홈페이지 리뉴얼중입니다. 곧 새로운 모습으로 찾아뵙겠습니다!"
          />
        )}
        <div 
          className="circle-container-motion"
          style={currentStep === 2 ? {
            position: 'absolute',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            zIndex: 1000
          } : currentStep === 0 ? {
            // 첫 페이지: 모든 기기에서 강력한 중앙 정렬
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: '0',
            padding: '0',
            zIndex: 2000
          } : {
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            height: '100vh',
            margin: '0 auto'
          }}
        >
          {circles.map((circle, index) => {
            const position = getCirclePosition(index);
            return (
              <motion.div
                key={circle.id}
                layoutId={`circle-${circle.id}`}
                layout
                className="circle-motion"
                data-step={currentStep.toString()}
                initial={isInitialLoad ? { opacity: 0, scale: 0 } : false}
                animate={currentStep === 0 ? {
                  // 첫 페이지에서는 CSS가 위치를 완전히 제어하므로 Framer Motion 변환 최소화
                  opacity: 1,
                  scale: 1,
                  x: 0,
                  y: 0
                } : {
                  // 다른 페이지에서는 Framer Motion이 위치 제어
                  opacity: 1,
                  scale: position.scale,
                  x: position.x,
                  y: position.y
                }}
                transition={{
                  ...springTransition,
                  delay: currentStep === 2 ? 0 : circle.delay,
                  layout: {
                    type: "spring",
                    damping: 25,
                    stiffness: 120
                  }
                }}
                style={{
                  // 모바일에서 첫 페이지에서 NODE TREE가 아닌 원들은 완전히 숨김
                  display: currentStep === 0 && (isMobile || isSmallMobile) && index !== 2 ? 'none' : 'block'
                }}
                onClick={
                  currentStep === 0 && index === 2 
                    ? handleCenterClick 
                    : () => handleCircleClickStable(circle.page)
                }
                whileHover={{
                  scale: currentStep === 2 ? position.scale * 1.05 : position.scale * 1.1,
                  transition: { type: "spring", damping: 20, stiffness: 150 }
                }}
                whileTap={{ scale: position.scale * 0.95 }}
                onMouseEnter={() => handleMouseEnter(index)}
                onMouseLeave={() => handleMouseLeave(index)}
              >
                <span 
                  className={`circle-text-motion ${currentStep === 2 && showLabels ? 'label-mode' : ''} ${currentStep === 1 ? 'small-text' : ''} ${isSmallMobile ? 'small-mobile' : isMobile ? 'mobile' : 'desktop'}`}
                >
                  {circle.text}
                </span>
              </motion.div>
            );
          })}
        </div>
        
        <AnimatePresence mode="wait" initial={false}>
          {currentStep === 2 && currentPage && (
            <motion.div 
              key={currentPage}
              className="page-content-wrapper"
              style={{
                paddingTop: isSmallMobile ? '260px' : isMobile ? '250px' : '200px'
              }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ 
                duration: 0.4,
                delay: 0.2,
                ease: "easeOut"
              }}
            >
              {renderPageContent()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
