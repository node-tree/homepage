import React, { useState, useEffect, useCallback, lazy, Suspense, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import './App.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Location3D from './components/Location3D';
import Human from './components/Human';
import Filed from './components/Filed';
import CV from './components/CV';
import LocationVideoSettings from './components/LocationVideoSettings';

const Work = lazy(() => import('./components/Work'));
const About = lazy(() => import('./components/About'));

// 이 컴포넌트는 App 내부의 라우팅과 상태 관리를 담당합니다.
function AppContent() {
  const location = useLocation();
  // 모든 상태를 최상위에서 선언
  const [currentStep, setCurrentStep] = useState(0); // 0: 초기, 1: 메뉴 펼침, 2: 페이지 표시
  const [currentPage, setCurrentPage] = useState<string | null>(null); // 현재 페이지
  const [showLabels, setShowLabels] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [hoveredCircle, setHoveredCircle] = useState<number | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // 초기 로드 추적
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768); // 모바일 감지
  const [isSmallMobile, setIsSmallMobile] = useState(window.innerWidth <= 480); // 소형 모바일 감지
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const { isAuthenticated, logout, user } = useAuth();

  // 오디오 초기화 및 프리로딩
  useEffect(() => {
    const initializeAudio = () => {
      try {
        // 배포 환경에서 더 안전한 오디오 초기화
        const isNodeTreeSite = window.location.hostname === 'nodetree.kr' || window.location.hostname === 'www.nodetree.kr';
        const audioPath = isNodeTreeSite ? '/click.wav' : '/click.wav';
        
        const audio = new Audio(audioPath);
        audio.volume = 0.3;
        audio.preload = 'auto';
        audio.crossOrigin = 'anonymous'; // CORS 문제 방지
        
        // 오디오 로드 완료 시
        audio.addEventListener('canplaythrough', () => {
          setAudioElement(audio);
          console.log('App 오디오 프리로딩 완료');
        });
        
        // 오디오 로드 에러 시
        audio.addEventListener('error', (e) => {
          console.log('App 오디오 로드 실패:', e);
          // 폴백으로 상대 경로 시도
          if (isNodeTreeSite) {
            const fallbackAudio = new Audio('/click.wav');
            fallbackAudio.volume = 0.3;
            fallbackAudio.preload = 'auto';
            fallbackAudio.addEventListener('canplaythrough', () => {
              setAudioElement(fallbackAudio);
              console.log('App 폴백 오디오 프리로딩 완료');
            });
            fallbackAudio.load();
          }
        });
        
        // 오디오 로드 시작
        audio.load();
      } catch (error) {
        console.log('App 오디오 초기화 실패:', error);
      }
    };

    initializeAudio();
  }, []);

  // 사용자 첫 상호작용 감지 및 오디오 컨텍스트 활성화
  useEffect(() => {
    const enableAudio = async () => {
      if (audioInitialized || !audioElement) return;
      
      try {
        // HTTPS 체크 (배포 환경에서 중요)
        const isSecureContext = window.isSecureContext || window.location.protocol === 'https:';
        if (!isSecureContext && window.location.hostname !== 'localhost') {
          console.log('HTTPS가 아닌 환경에서는 오디오 기능이 제한될 수 있습니다.');
        }

        // AudioContext 생성 및 활성화
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          console.log('이 브라우저는 Web Audio API를 지원하지 않습니다.');
          setAudioInitialized(true); // 오디오 없이도 계속 진행
          return;
        }

        const audioContext = new AudioContextClass();
        
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        
        // 더미 오디오 재생으로 브라우저 정책 우회
        const originalVolume = audioElement.volume;
        audioElement.volume = 0;
        
        try {
          const playPromise = audioElement.play();
          if (playPromise !== undefined) {
            await playPromise;
            audioElement.pause();
            audioElement.currentTime = 0;
            audioElement.volume = originalVolume; // 원래 볼륨 복원
            setAudioInitialized(true);
            console.log('App 오디오 컨텍스트 활성화 완료');
          }
        } catch (playError) {
          console.log('App 오디오 활성화 실패:', playError);
          // 실패해도 일단 초기화된 것으로 표시 (폴백 사용)
          audioElement.volume = originalVolume;
          setAudioInitialized(true);
        }
      } catch (error) {
        console.log('App 오디오 컨텍스트 생성 실패:', error);
        // 실패해도 일단 초기화된 것으로 표시 (폴백 사용)
        setAudioInitialized(true);
      }
    };

    // 다양한 사용자 상호작용 이벤트 리스너
    const handleFirstInteraction = (event: Event) => {
      console.log('App 사용자 첫 상호작용 감지:', event.type);
      enableAudio();
      // 이벤트 리스너 제거 (한 번만 실행)
      removeEventListeners();
    };

    const removeEventListeners = () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('touchend', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('mousedown', handleFirstInteraction);
      document.removeEventListener('pointerdown', handleFirstInteraction);
    };

    // 더 많은 이벤트 타입 등록
    document.addEventListener('click', handleFirstInteraction, { passive: true, once: true });
    document.addEventListener('touchstart', handleFirstInteraction, { passive: true, once: true });
    document.addEventListener('touchend', handleFirstInteraction, { passive: true, once: true });
    document.addEventListener('keydown', handleFirstInteraction, { passive: true, once: true });
    document.addEventListener('mousedown', handleFirstInteraction, { passive: true, once: true });
    document.addEventListener('pointerdown', handleFirstInteraction, { passive: true, once: true });

    return removeEventListeners;
  }, [audioElement, audioInitialized]);

  // 개선된 클릭 사운드 재생 함수
  const playClickSound = useCallback(async () => {
    // 배포 환경에서 추가 체크
    const isProduction = process.env.NODE_ENV === 'production';
    const isSecureContext = window.isSecureContext || window.location.protocol === 'https:';
    
    if (isProduction && !isSecureContext) {
      console.log('배포 환경에서는 HTTPS가 필요합니다. 사운드를 재생할 수 없습니다.');
      return;
    }

    // 오디오가 초기화되지 않았어도 시도해보기
    if (!audioElement) {
      console.log('App 오디오 엘리먼트가 없습니다.');
      // 폴백으로 새로운 Audio 인스턴스 생성
      try {
        const fallbackAudio = new Audio('/click.wav');
        fallbackAudio.volume = 0.3;
        
        // 배포 환경에서는 사용자 제스처가 필요
        if (isProduction) {
          // 사용자 제스처 없이는 재생하지 않음
          fallbackAudio.muted = false;
        }
        
        await fallbackAudio.play();
        console.log('App 폴백 사운드 재생 성공');
      } catch (fallbackError) {
        console.log('App 폴백 사운드 재생 실패:', fallbackError);
        // 배포 환경에서는 조용히 실패
        if (!isProduction) {
          console.warn('사운드 재생 실패, 사용자 상호작용이 필요할 수 있습니다.');
        }
      }
      return;
    }

    try {
      // 현재 재생 중인 사운드 정지
      audioElement.pause();
      audioElement.currentTime = 0;
      
      // 배포 환경에서 추가 체크
      if (isProduction && audioElement.muted) {
        audioElement.muted = false;
      }
      
      // 새로운 사운드 재생
      const playPromise = audioElement.play();
      
      if (playPromise !== undefined) {
        await playPromise;
        console.log('App 클릭 사운드 재생 성공');
      }
    } catch (error) {
      console.log('App 사운드 재생 실패:', error);
      
      // 폴백: 새로운 Audio 인스턴스로 재시도
      try {
        const fallbackAudio = new Audio('/click.wav');
        fallbackAudio.volume = 0.3;
        
        // 배포 환경에서는 더 신중하게
        if (isProduction) {
          fallbackAudio.muted = false;
          // 사용자 제스처 체크
          if (!document.hasFocus()) {
            console.log('페이지가 포커스되지 않아 사운드를 재생할 수 없습니다.');
            return;
          }
        }
        
        await fallbackAudio.play();
        console.log('App 폴백 사운드 재생 성공');
      } catch (fallbackError) {
        console.log('App 폴백 사운드 재생도 실패:', fallbackError);
        // 배포 환경에서는 사용자에게 알리지 않음
      }
    }
  }, [audioElement]);

  // 안정적인 핸들러 함수들 - 컴포넌트 최상위에서 선언
  const handleMouseEnter = useCallback((index: number) => {
    setHoveredCircle(prev => prev !== index ? index : prev);
  }, []);

  const handleMouseLeave = useCallback((index: number) => {
    setHoveredCircle(prev => prev === index ? null : prev);
  }, []);

  const handleCircleClickStable = useCallback((page: string) => {
    // 클릭 사운드 재생
    playClickSound();
    
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
  }, [playClickSound]); // playClickSound 의존성 추가

  // URL 경로 확인
  const currentPath = window.location.pathname;
  
  const circles = useMemo(() => [
    { id: 1, text: 'CROSS CITY', delay: 0, page: 'LOCATION' },
    { id: 2, text: 'ART NETWORK', delay: 0.1, page: 'HUMAN' },
    { id: 3, text: 'NODE TREE', delay: 0.2, page: 'ABOUT' },
    { id: 4, text: 'ART WORK', delay: 0.3, page: 'WORK' },
    { id: 5, text: 'COMMONS', delay: 0.4, page: 'FILED' },
    { id: 6, text: 'CV', delay: 0.5, page: 'CV' }
  ], []);

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

  // 페이지 변경 시 스크롤 위치 리셋
  useEffect(() => {
    if (currentPage) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

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

  // URL 경로에 따라 초기 상태를 설정하는 useEffect
  useEffect(() => {
    const path = location.pathname.toUpperCase().replace('/', '');
    if (path && circles.some(c => c.page === path)) {
      setCurrentPage(path);
      setCurrentStep(2);
    } else if (path === 'LOGIN') {
      // 로그인 페이지는 별도 처리
    } else {
      setCurrentPage(null);
      setCurrentStep(0);
    }
  }, [location.pathname, circles]);

  // 로그인 페이지일 때는 별도 렌더링
  if (currentPath === '/login') {
    return <Login />;
  }

  const handleCenterClick = () => {
    if (currentStep === 0) {
      console.log('중앙 원 클릭: currentStep 0 → 1로 변경');
      // 클릭 사운드 재생
      playClickSound();
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
          ? [-175, -105, -35, 35, 105, 175] // 소형 모바일에서 6개 원 간격
          : isMobile 
          ? [-225, -135, -45, 45, 135, 225] // 모바일에서 6개 원 간격
          : [-500, -300, -100, 100, 300, 500]; // 데스크탑 6개 원 간격
        const menuScale = isSmallMobile ? 0.7 : isMobile ? 0.8 : 1; // 메뉴 상태에서 모바일 스케일 조정
        const result = { x: menuPositions[index], y: 0, scale: menuScale };
        console.log(`메뉴 상태 - index ${index}, 계산된 위치:`, result);
        return result;
      case 2: // 페이지 상태: 작아지며 상단으로 (모든 페이지 공통)
        // 화면 크기에 따라 간격 조정
        const pagePositions = isSmallMobile 
          ? [-150, -90, -30, 30, 90, 150] // 소형 모바일에서 6개 원 간격
          : isMobile 
          ? [-200, -120, -40, 40, 120, 200] // 모바일에서 6개 원 간격
          : [-350, -210, -70, 70, 210, 350]; // 데스크톱에서 6개 원 간격
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

  // 공용 트랜지션
  const springTransition = {
    type: "spring" as const, // 타입을 명시적으로 지정
    damping: 20,
    stiffness: 150,
    mass: 0.5
  };

  const renderPageContent = () => {
    if (!currentPage) return null;

    switch (currentPage.toUpperCase()) {
      case 'LOCATION':
      case 'LOCATION3D':
        return <Location3D />;
      case 'HUMAN':
        return <Human />;
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
        {/* {!isAuthenticated && (
          <Popup 
            open={true}
            message="NODE TREE
            홈페이지 리뉴얼중입니다. 곧 새로운 모습으로 찾아뵙겠습니다!"
          />
        )} */}
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
                  layout: { // layout 관련 transition을 별도 객체로 분리
                    type: "spring",
                    damping: 30,
                    stiffness: 200
                  }
                }}
                style={{
                  // 모바일에서 첫 페이지(step 0)에서만 NODE TREE가 아닌 원들을 숨김 (index 2가 NODE TREE)
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

// App 컴포넌트는 라우터와 인증 공급자만 설정합니다.
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
