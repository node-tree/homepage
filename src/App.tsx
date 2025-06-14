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
import LocationVideoSettings from './components/LocationVideoSettings';

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
      if (prevStep === 0) {
        // 첫 번째 클릭: 원들만 펼치기 (y축 이동 없음)
        return 1;
      } else if (prevStep === 1) {
        // 두 번째 클릭: 해당 페이지로 이동 (navbar 위치로 y축 이동)
        setCurrentPage(page);
        return 2;
      } else if (prevStep === 2) {
        // 이미 페이지 상태에서 다른 원 클릭: 페이지만 변경
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

  // Location 컴포넌트에서 영상 설정 페이지로 이동하는 커스텀 이벤트 리스너
  useEffect(() => {
    const handleNavigateToLocationSettings = () => {
      handleCircleClickStable('LOCATION_SETTINGS');
    };

    window.addEventListener('navigateToLocationSettings', handleNavigateToLocationSettings);
    
    return () => {
      window.removeEventListener('navigateToLocationSettings', handleNavigateToLocationSettings);
    };
  }, [handleCircleClickStable]);

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
        
        // y축 위치도 화면 크기에 따라 조정 - 원들을 아래로 내림
        const yPosition = isSmallMobile 
          ? 0 // 소형 모바일에서 중앙 위치
          : isMobile 
          ? 0 // 모바일에서 중앙 위치
          : -20; // 데스크톱에서만 위로 올림
        
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
      case 'LOCATION_SETTINGS':
        return <LocationVideoSettings />;
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
              onClick={() => handleCircleClickStable('LOCATION_SETTINGS')}
              className="settings-button"
              style={{
                marginRight: '10px',
                padding: '5px 10px',
                backgroundColor: '#ff4444',
                color: 'white',
                border: '1px solid #000',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              🎬 설정
            </button>
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
          style={currentStep === 0 || currentStep === 1 ? {
            // 첫 페이지와 메뉴 펼침 상태: 모든 기기에서 강력한 중앙 정렬
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
            zIndex: 2000,
            background: 'transparent',
            backdropFilter: 'none',
            border: 'none'
          } : currentStep === 2 ? {
            // 페이지 상태: navbar가 잘 보이도록 적절한 위치에 고정
            position: 'fixed',
            top: '0px', // 화면 제일 위에 붙임
            left: '0',
            right: '0',
            width: '100%',
            height: '80px',
            zIndex: 1000,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderBottom: 'none'
          } : {}}
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
                  // 모바일에서 첫 페이지(step 0)에서만 NODE TREE가 아닌 원들을 숨김
                  display: currentStep === 0 && (isMobile || isSmallMobile) && index !== 2 ? 'none' : 'block'
                }}
                onClick={() => {
                  if (currentStep === 0) {
                    // 첫 번째 페이지에서는 어떤 원을 클릭해도 먼저 펼치기만
                    handleCenterClick();
                  } else {
                    // 펼쳐진 상태 이후에는 페이지 이동
                    handleCircleClickStable(circle.page);
                  }
                }}
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
