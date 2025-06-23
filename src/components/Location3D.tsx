import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Sphere, Line } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import fontUrl from '../../assets/fonts/SCDream4.otf';

// Location 영상 데이터 타입 정의
interface LocationVideo {
  _id: string;
  cityName: string;
  videoUrl: string;
  videoTitle?: string;
  videoDescription?: string;
  isActive: boolean;
}

// 도시 데이터 타입 정의
interface City {
  name: string;
  lat: number;
  lng: number;
  x: number;
  y: number;
  z: number; // 3D용 z축 추가
}

// 3D 도시 구체 컴포넌트
function CityNode({ 
  city, 
  index, 
  isSelected, 
  isHovered, 
  onClick, 
  onHover,
  onPositionUpdate
}: {
  city: City;
  index: number;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHover: (hovered: boolean) => void;
  onPositionUpdate: (cityName: string, position: THREE.Vector3) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const nameTextRef = useRef<THREE.Mesh>(null);
  const coordTextRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  useFrame((state) => {
    if (meshRef.current) {
      // 부드러운 회전 애니메이션
      meshRef.current.rotation.y += 0.01;
      
      // 선택되거나 호버된 경우 위아래로 부드럽게 움직임
      let currentY = city.y;
      if (isSelected || isHovered) {
        currentY = city.y + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      }
      
      meshRef.current.position.y = currentY;
      
      // 실시간 위치를 부모 컴포넌트에 전달
      onPositionUpdate(city.name, new THREE.Vector3(city.x, currentY, city.z));
    }

    // 텍스트들이 카메라를 바라보도록 설정
    if (nameTextRef.current && camera) {
      nameTextRef.current.lookAt(camera.position);
    }
    if (coordTextRef.current && camera) {
      coordTextRef.current.lookAt(camera.position);
    }
  });

  const scale = isSelected ? 0.4 : isHovered ? 0.25 : 0.15; // 기본 크기를 0.15로 매우 작게, 선택 시 0.4로 확대
  const color = isSelected ? '#ff4444' : isHovered ? '#4444ff' : '#000000';

  return (
    <group>
      <Sphere
        ref={meshRef}
        position={[city.x, city.y, city.z]}
        scale={scale}
        onClick={onClick}
        onPointerOver={() => {
          onHover(true);
        }}
        onPointerOut={() => {
          onHover(false);
        }}
      >
        <meshStandardMaterial color={color} />
      </Sphere>
      
      {/* 도시 이름 텍스트 */}
      <Text
        ref={nameTextRef}
        position={[city.x, city.y + (isSelected ? 0.6 : 0.25), city.z]}
        fontSize={isSelected ? 0.18 : 0.08}
        color="#333333"
        anchorX="center"
        anchorY="middle"
        font={fontUrl}
      >
        {city.name}
      </Text>
      
      {/* 좌표 텍스트 */}
      <Text
        ref={coordTextRef}
        position={[city.x, city.y - (isSelected ? 0.6 : 0.25), city.z]}
        fontSize={isSelected ? 0.08 : 0.04}
        color="#666666"
        anchorX="center"
        anchorY="middle"
        font={fontUrl}
      >
        {city.lat.toFixed(2)}°, {city.lng.toFixed(2)}°
      </Text>
    </group>
  );
}

// 3D 연결선 컴포넌트
function ConnectionLine({ 
  from, 
  to, 
  cityPositions 
}: { 
  from: City; 
  to: City; 
  cityPositions: Map<string, THREE.Vector3>;
}) {
  const [points, setPoints] = useState<THREE.Vector3[]>([
    new THREE.Vector3(from.x, from.y, from.z),
    new THREE.Vector3(to.x, to.y, to.z)
  ]);

  useFrame(() => {
    const fromPos = cityPositions.get(from.name) || new THREE.Vector3(from.x, from.y, from.z);
    const toPos = cityPositions.get(to.name) || new THREE.Vector3(to.x, to.y, to.z);
    
    setPoints([fromPos, toPos]);
  });

  return (
    <Line
      points={points}
      color="#cccccc"
      lineWidth={2}
      transparent
      opacity={0.6}
    />
  );
}

// 3D 장면 컴포넌트
function Scene3D({ 
  cities, 
  connections, 
  selectedCity, 
  hoveredCity, 
  onCityClick, 
  onCityHover 
}: {
  cities: City[];
  connections: { from: string; to: string }[];
  selectedCity: string | null;
  hoveredCity: string | null;
  onCityClick: (cityName: string) => void;
  onCityHover: (cityName: string | null) => void;
}) {
  const { camera } = useThree();
  const [cityPositions, setCityPositions] = useState<Map<string, THREE.Vector3>>(new Map());
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    // 카메라 초기 위치 설정
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  // 선택된 도시로 카메라 이동
  useEffect(() => {
    if (controlsRef.current) {
      if (selectedCity) {
        // 도시가 선택된 경우 - 해당 도시로 이동
        const selectedCityData = cities.find(city => city.name === selectedCity);
        if (selectedCityData) {
          console.log(`🎯 ${selectedCity} 선택됨 - 카메라 이동 시작`);
          
          // 선택된 도시 위치로 카메라 이동 (3D 좌표 사용)
          const targetPosition = new THREE.Vector3(
            selectedCityData.x,
            selectedCityData.y + 2, // 도시 위에서 내려다보도록
            selectedCityData.z + 3  // 적절한 거리 유지
          );
          
          const lookAtTarget = new THREE.Vector3(
            selectedCityData.x,
            selectedCityData.y,
            selectedCityData.z
          );
          
          // 카메라 이동 애니메이션
          const startPosition = camera.position.clone();
          const startTarget = controlsRef.current.target.clone();
          const startTime = Date.now();
          const duration = 1500; // 1.5초 애니메이션
          
          const animateCamera = () => {
            if (!controlsRef.current) return;
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // easeInOutCubic 이징 함수
            const easeProgress = progress < 0.5 
              ? 4 * progress * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            
            // 카메라 위치 보간
            camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
            
            // 타겟 위치 보간
            const currentTarget = new THREE.Vector3();
            currentTarget.lerpVectors(startTarget, lookAtTarget, easeProgress);
            controlsRef.current.target.copy(currentTarget);
            controlsRef.current.update();
            
            if (progress < 1) {
              requestAnimationFrame(animateCamera);
            } else {
              console.log(`🗺️ ${selectedCity} 카메라 이동 완료`);
            }
          };
          
          requestAnimationFrame(animateCamera);
        }
      } else {
        // 도시 선택 해제된 경우 - 원래 위치로 복귀
        console.log(`🔄 원래 위치로 복귀 시작`);
        
        const originalPosition = new THREE.Vector3(0, 5, 10);
        const originalTarget = new THREE.Vector3(0, 0, 0);
        
        // 카메라 복귀 애니메이션
        const startPosition = camera.position.clone();
        const startTarget = controlsRef.current.target.clone();
        const startTime = Date.now();
        const duration = 1200; // 1.2초 애니메이션
        
        const animateCamera = () => {
          if (!controlsRef.current) return;
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // easeInOutCubic 이징 함수
          const easeProgress = progress < 0.5 
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          
          // 카메라 위치 보간
          camera.position.lerpVectors(startPosition, originalPosition, easeProgress);
          
          // 타겟 위치 보간
          const currentTarget = new THREE.Vector3();
          currentTarget.lerpVectors(startTarget, originalTarget, easeProgress);
          controlsRef.current.target.copy(currentTarget);
          controlsRef.current.update();
          
          if (progress < 1) {
            requestAnimationFrame(animateCamera);
          } else {
            console.log(`🗺️ 원래 위치 복귀 완료`);
          }
        };
        
        requestAnimationFrame(animateCamera);
      }
    }
  }, [selectedCity, cities, camera]);

  // 도시 위치 업데이트 핸들러
  const handlePositionUpdate = useCallback((cityName: string, position: THREE.Vector3) => {
    setCityPositions(prev => {
      const newMap = new Map(prev);
      newMap.set(cityName, position.clone());
      return newMap;
    });
  }, []);

  return (
    <>
      {/* 조명 설정 */}
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />

      {/* 도시 노드들 */}
      {cities.map((city, index) => (
        <CityNode
          key={city.name}
          city={city}
          index={index}
          isSelected={selectedCity === city.name}
          isHovered={hoveredCity === city.name}
          onClick={() => onCityClick(city.name)}
          onHover={(hovered) => onCityHover(hovered ? city.name : null)}
          onPositionUpdate={handlePositionUpdate}
        />
      ))}

      {/* 연결선들 */}
      {connections.map((connection, index) => {
        const fromCity = cities.find(city => city.name === connection.from);
        const toCity = cities.find(city => city.name === connection.to);
        
        if (!fromCity || !toCity) return null;
        
        return (
          <ConnectionLine
            key={index}
            from={fromCity}
            to={toCity}
            cityPositions={cityPositions}
          />
        );
      })}

      {/* 카메라 컨트롤 */}
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
}

const Location3D: React.FC = () => {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [currentVideo, setCurrentVideo] = useState<LocationVideo | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const videoSectionRef = useRef<HTMLDivElement>(null);
  const cityInfoRef = useRef<HTMLDivElement>(null);

  // 도시 데이터 (기존 Location 컴포넌트와 동일한 도시들을 3D 좌표로 변환, Y축 다양화)
  const cities: City[] = [
    { name: '서울', lat: 37.5665, lng: 126.9780, x: 0, y: 0.5, z: 2 },
    { name: '용인', lat: 37.2411, lng: 127.1776, x: 1, y: -0.3, z: 2.5 },
    { name: '부여', lat: 36.2756, lng: 126.9100, x: -0.5, y: 0, z: 1.5 },
    { name: '서산', lat: 36.7848, lng: 126.4503, x: -1.5, y: 0.8, z: 1 },
    { name: '태안', lat: 36.7456, lng: 126.2978, x: -2, y: -0.5, z: 0.5 },
    { name: '서천', lat: 36.0788, lng: 126.6919, x: -1, y: 0.3, z: 0.5 },
    { name: '강경', lat: 36.1619, lng: 126.7975, x: -0.5, y: -0.2, z: 0.8 },
    { name: '전주', lat: 35.8242, lng: 127.1480, x: 0.5, y: 0.6, z: 0 },
    { name: '칸타요프스', lat: 41.6167, lng: 1.4833, x: -4, y: 1.2, z: 3 },
    { name: '마인츠', lat: 50.0000, lng: 8.2711, x: -3, y: 1.5, z: 4 },
    { name: '야따마우까', lat: -32.5000, lng: -60.5000, x: -6, y: -1.0, z: -2 },
    { name: '울룰루', lat: -25.3444, lng: 131.0369, x: 5, y: -0.8, z: -3 },
    { name: '뉴욕', lat: 40.7128, lng: -74.0060, x: -5, y: 1.0, z: 2 }
  ];

  // 연결선 데이터 (기존 Location 컴포넌트와 동일)
  const connections = [
    // 한국 도시들 연결 (근접한 도시들끼리)
    { from: '서울', to: '부여' },
    { from: '부여', to: '서산' },
    { from: '서산', to: '태안' },
    { from: '용인', to: '부여' },
    { from: '부여', to: '서천' },
    { from: '부여', to: '강경' },
    { from: '부여', to: '전주' },
    
    // 대륙간 주요 연결 (부여를 중심으로)
    { from: '부여', to: '마인츠' },
    { from: '용인', to: '칸타요프스' },
    { from: '부여', to: '울룰루' },
    { from: '부여', to: '야따마우까' },
    { from: '부여', to: '뉴욕' }
  ];

  // 스크롤 이벤트 처리
  const handleScroll = useCallback(() => {
    setShowScrollToTop(window.scrollY > 500);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // 오디오 초기화 및 프리로딩
  useEffect(() => {
    const initializeAudio = () => {
      try {
        const audio = new Audio('/click02.wav');
        audio.volume = 0.3;
        audio.preload = 'auto';
        
        // 오디오 로드 완료 시
        audio.addEventListener('canplaythrough', () => {
          setAudioElement(audio);
          console.log('오디오 프리로딩 완료');
        });
        
        // 오디오 로드 에러 시
        audio.addEventListener('error', (e) => {
          console.log('오디오 로드 실패:', e);
        });
        
        // 오디오 로드 시작
        audio.load();
      } catch (error) {
        console.log('오디오 초기화 실패:', error);
      }
    };

    initializeAudio();
  }, []);

  // 사용자 첫 상호작용 감지 및 오디오 컨텍스트 활성화
  useEffect(() => {
    const enableAudio = async () => {
      if (audioInitialized) return;
      
      try {
        // HTTPS 체크 (배포 환경에서 중요)
        const isSecureContext = window.isSecureContext || window.location.protocol === 'https:';
        if (!isSecureContext) {
          console.log('HTTPS가 아닌 환경에서는 오디오 기능이 제한될 수 있습니다.');
        }

        // AudioContext 생성 및 활성화
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          console.log('이 브라우저는 Web Audio API를 지원하지 않습니다.');
          return;
        }

        const audioContext = new AudioContextClass();
        
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        
        // 더미 오디오 재생으로 브라우저 정책 우회
        if (audioElement) {
          // 볼륨을 0으로 설정하여 무음으로 테스트
          const originalVolume = audioElement.volume;
          audioElement.volume = 0;
          
          const playPromise = audioElement.play();
          if (playPromise !== undefined) {
            playPromise.then(() => {
              audioElement.pause();
              audioElement.currentTime = 0;
              audioElement.volume = originalVolume; // 원래 볼륨 복원
              setAudioInitialized(true);
              console.log('오디오 컨텍스트 활성화 완료');
            }).catch((error) => {
              console.log('오디오 활성화 실패:', error);
              // 실패해도 일단 초기화된 것으로 표시 (폴백 사용)
              setAudioInitialized(true);
            });
          }
        }
      } catch (error) {
        console.log('오디오 컨텍스트 생성 실패:', error);
        // 실패해도 일단 초기화된 것으로 표시 (폴백 사용)
        setAudioInitialized(true);
      }
    };

    // 다양한 사용자 상호작용 이벤트 리스너
    const handleFirstInteraction = (event: Event) => {
      console.log('사용자 첫 상호작용 감지:', event.type);
      enableAudio();
      // 이벤트 리스너 제거 (한 번만 실행)
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('touchend', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('mousedown', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction, { passive: true });
    document.addEventListener('touchstart', handleFirstInteraction, { passive: true });
    document.addEventListener('touchend', handleFirstInteraction, { passive: true });
    document.addEventListener('keydown', handleFirstInteraction, { passive: true });
    document.addEventListener('mousedown', handleFirstInteraction, { passive: true });

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      document.removeEventListener('touchend', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('mousedown', handleFirstInteraction);
    };
  }, [audioElement, audioInitialized]);

  // 개선된 클릭 사운드 재생 함수
  const playClickSound = async () => {
    if (!audioElement || !audioInitialized) {
      console.log('오디오가 아직 초기화되지 않았습니다.');
      return;
    }

    try {
      // 현재 재생 중인 사운드 정지
      audioElement.pause();
      audioElement.currentTime = 0;
      
      // 새로운 사운드 재생
      const playPromise = audioElement.play();
      
      if (playPromise !== undefined) {
        await playPromise;
        console.log('클릭 사운드 재생 성공');
      }
    } catch (error) {
      console.log('사운드 재생 실패:', error);
      
      // 폴백: 새로운 Audio 인스턴스로 재시도
      try {
        const fallbackAudio = new Audio('/click02.wav');
        fallbackAudio.volume = 0.3;
        await fallbackAudio.play();
      } catch (fallbackError) {
        console.log('폴백 사운드 재생도 실패:', fallbackError);
      }
    }
  };

  // 도시 클릭 핸들러
  const handleCityClick = (cityName: string) => {
    console.log(`🎯 ${cityName} 클릭됨! - 3D 카메라 이동 시작`);
    
    // 클릭 사운드 재생
    playClickSound();
    
    // 다른 도시를 클릭하면 이전 영상 닫기
    if (selectedCity !== cityName) {
      setCurrentVideo(null);
    }
    
    // 같은 도시를 다시 클릭하면 원래 위치로 복귀
    if (selectedCity === cityName) {
      setSelectedCity(null);
      console.log(`🔄 ${cityName} 선택 해제 - 원래 위치로 복귀`);
    } else {
      setSelectedCity(cityName);
    }
    
    setTimeout(() => {
      scrollToCityInfo();
    }, 300);
  };

  // 도시 호버 핸들러
  const handleCityHover = (cityName: string | null) => {
    setHoveredCity(cityName);
  };

  // 이동하기 버튼 클릭 핸들러
  const handleMoveClick = async (cityName: string) => {
    console.log(`${cityName}로 이동하기 클릭됨`);
    setIsVideoLoading(true);
    
    try {
      const response = await fetch(`/api/location-video/${encodeURIComponent(cityName)}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setCurrentVideo(data.data);
        setTimeout(() => {
          scrollToVideo();
        }, 100);
      } else {
        console.log('영상 데이터를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error('영상 데이터 가져오기 오류:', error);
    } finally {
      setIsVideoLoading(false);
    }
  };

  // 스크롤 함수들
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToCityInfo = () => {
    if (cityInfoRef.current) {
      const offset = -50;
      const elementPosition = cityInfoRef.current.offsetTop + offset;
      window.scrollTo({ top: elementPosition, behavior: 'smooth' });
    }
  };

  const scrollToVideo = () => {
    if (videoSectionRef.current) {
      videoSectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  // YouTube URL을 임베드 형식으로 변환하는 함수
  const convertToEmbedUrl = (url: string): string => {
    if (url.includes('youtube.com/embed/')) {
      return url;
    }
    
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(youtubeRegex);
    
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
    
    return url;
  };

  return (
    <div className="page-content">
      <div className="page-header">
      <h1 className="page-title">
        CROSS CITY
        <motion.div 
          className="page-subtitle-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1 }}
        >
          <div className="page-subtitle">서사 교차점의 기록장소 <br /> 
          <br />
        'Cross City'는 NODE TREE가 리서치를 진항하며 <br />
        도착한 도시들을 기록하는 카테고리로, <br />
        단순한 지리적 이동이 아닌 서사가 교차하고 <br />
        축적된 장소들을 의미한다.
          </div>
        </motion.div>
      </h1>
      
      {/* 3D 지도 영역 */}
      <div style={{ 
        width: '100%', 
        height: '600px', 
        margin: '2rem 0',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <Canvas>
          <Suspense fallback={null}>
            <Scene3D
              cities={cities}
              connections={connections}
              selectedCity={selectedCity}
              hoveredCity={hoveredCity}
              onCityClick={handleCityClick}
              onCityHover={handleCityHover}
            />
          </Suspense>
        </Canvas>
        
        {/* 조작 가이드 오버레이 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.95))',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '12px',
            color: '#4a5568',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            lineHeight: '1.5',
            minWidth: '140px'
          }}
        >
          <div style={{ 
            marginBottom: '8px', 
            fontWeight: '600', 
            color: '#2d3748',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ fontSize: '16px' }}>🎮</span>
            조작법
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '2px 0'
            }}>
              <span style={{ fontSize: '14px', width: '16px' }}>🖱️</span>
              <span style={{ fontSize: '11px' }}>드래그로 회전</span>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '2px 0'
            }}>
              <span style={{ fontSize: '14px', width: '16px' }}>🔍</span>
              <span style={{ fontSize: '11px' }}>휠로 줌</span>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '2px 0'
            }}>
              <span style={{ fontSize: '14px', width: '16px' }}>✋</span>
              <span style={{ fontSize: '11px' }}>우클릭으로 이동</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 원형 버튼들 */}
      <div className="location-controls">
        {cities.map((city, index) => (
          <motion.div
            key={city.name}
            className="location-button"
            onMouseEnter={() => setHoveredCity(city.name)}
            onMouseLeave={() => setHoveredCity(null)}
            onClick={() => handleCityClick(city.name)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            style={{
              backgroundColor: selectedCity === city.name ? '#000000' : '#ffffff',
              color: selectedCity === city.name ? '#ffffff' : '#000000',
              border: hoveredCity === city.name ? '3px solid #000000' : '2px solid #cccccc',
              fontSize: '9px',
              letterSpacing: city.name === 'node tree' ? '-3px' : '-2px'
            }}
          >
            {index + 1}
          </motion.div>
        ))}
      </div>

      {/* 선택된 도시 정보 */}
      {selectedCity && (
        <div ref={cityInfoRef} className="location-city-info" style={{ textAlign: 'center', marginTop: '1rem' }}>
          <h3 className="page-body-text" style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: '500' }}>선택된 위치</h3>
          <p className="page-body-text" style={{ margin: '0 0 1rem 0' }}>{selectedCity}</p>
          <motion.button
            className="location-move-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleMoveClick(selectedCity!)}
            disabled={isVideoLoading}
          >
            {isVideoLoading ? '로딩 중...' : '이동하기'}
          </motion.button>
        </div>
      )}

      {/* 영상 표시 영역 */}
      <div ref={videoSectionRef}>
        {currentVideo && (
          <motion.div 
            className="location-video-container"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ 
              marginTop: '2rem', 
              textAlign: 'center',
              maxWidth: '800px',
              margin: '2rem auto 0'
            }}
          >
            <h3 className="page-body-text" style={{ 
              margin: '0 0 1rem 0', 
              fontSize: '1.2rem', 
              fontWeight: '600' 
            }}>
              {currentVideo.videoTitle || `${currentVideo.cityName} 영상`}
            </h3>
            
            {currentVideo.videoDescription && (
              <p className="page-body-text" style={{ 
                margin: '0 0 1.5rem 0',
                color: '#666',
                fontSize: '0.9rem'
              }}>
                {currentVideo.videoDescription}
              </p>
            )}
            
            <div style={{ 
              position: 'relative', 
              paddingBottom: '56.25%', 
              height: 0, 
              overflow: 'hidden',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}>
              <iframe
                src={convertToEmbedUrl(currentVideo.videoUrl)}
                title={currentVideo.videoTitle || `${currentVideo.cityName} 영상`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none'
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* 위로 올라가기 버튼 */}
      <AnimatePresence>
        {showScrollToTop && (
          <motion.button
            className="scroll-to-top-button"
            onClick={scrollToTop}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            ↑
          </motion.button>
        )}
      </AnimatePresence>
    </div>
    </div>
  );
};

export default Location3D; 