import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// 영상 데이터 타입 정의
interface LocationVideo {
  _id: string;
  cityName: string;
  videoUrl: string;
  videoTitle?: string;
  videoDescription?: string;
  isActive: boolean;
}

const Location: React.FC = () => {
  // 인증 상태 가져오기
  // useAuth는 더 이상 사용하지 않음 (설정 버튼이 App.tsx로 이동됨)
  

  
  // SVG 참조를 위한 ref
  const svgRef = useRef<SVGSVGElement>(null);
  
  // 영상 영역 참조를 위한 ref
  const videoSectionRef = useRef<HTMLDivElement>(null);

  // 선택된 도시 정보 영역 참조를 위한 ref
  const cityInfoRef = useRef<HTMLDivElement>(null);

  // 뷰포트 크기를 추적하는 상태
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  // 모바일 여부를 확인하는 상태
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  // 스크롤 위치를 추적하는 상태
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // GPS 좌표를 SVG 좌표로 변환하는 함수
  const convertCoordinates = (lat: number, lng: number, region: string) => {
    // SVG 화면 크기 (페이지 전체 공간 활용)
    const svgWidth = 2000;  // 더 넓게 확장
    const svgHeight = 900;  // 더 높게 확장
    const padding = 100;
    
    if (region === 'korea') {
      // 한국 지역만 특별히 확대 처리
      const koreaMinLat = 36.0;  // 한국 남단
      const koreaMaxLat = 38.0;  // 한국 북단
      const koreaMinLng = 126.0; // 한국 서단
      const koreaMaxLng = 128.0; // 한국 동단
      
      // 한국 지역을 지도 중앙에 더 크게 배치
      const koreaWidth = 600;   // 한국 영역 폭
      const koreaHeight = 400;  // 한국 영역 높이
      const koreaStartX = 800;  // 한국 영역 시작 X 좌표
      const koreaStartY = 200;  // 한국 영역 시작 Y 좌표
      
      const x = ((lng - koreaMinLng) / (koreaMaxLng - koreaMinLng)) * koreaWidth + koreaStartX;
      const y = ((koreaMaxLat - lat) / (koreaMaxLat - koreaMinLat)) * koreaHeight + koreaStartY;
      
      return { x: Math.round(x), y: Math.round(y) };
    } else {
      // 해외 도시들은 기존 방식으로 배치
      const minLat = -60; // 남위 60도
      const maxLat = 80;  // 북위 80도
      const minLng = -180; // 서경 180도
      const maxLng = 180;  // 동경 180도
      
      // 기본 좌표 변환 (메르카토르 투영법 단순화) - 왼쪽으로 이동
      const x = ((lng - minLng) / (maxLng - minLng)) * (svgWidth - padding * 2) + padding - 300; // 왼쪽으로 300px 이동
      const y = ((maxLat - lat) / (maxLat - minLat)) * (svgHeight - padding * 2) + padding;
      
      return { x: Math.round(x), y: Math.round(y) };
    }
  };

  // GPS 좌표 (위도, 경도) - 한국 도시들 더 넓게 분산
  const cities = [
    { name: '서울', lat: 37.5665, lng: 126.9780, region: 'korea' },
    { name: '용인', lat: 37.2411, lng: 127.1776, region: 'korea' },
    { name: '부여', lat: 36.2756, lng: 126.9100, region: 'korea' },
    { name: '서산', lat: 36.7848, lng: 126.4503, region: 'korea' },
    { name: '태안', lat: 36.7456, lng: 126.2978, region: 'korea' },
    { name: '서천', lat: 36.0788, lng: 126.6919, region: 'korea' },
    { name: '강경', lat: 36.1619, lng: 126.7975, region: 'korea' },
    { name: '전주', lat: 35.8242, lng: 127.1480, region: 'korea' },
    { name: '칸타요프스', lat: 41.6167, lng: 1.4833, region: 'europe' },
    { name: '마인츠', lat: 50.0000, lng: 8.2711, region: 'europe' },
    { name: '야따마우까', lat: -32.5000, lng: -60.5000, region: 'southamerica' },
    { name: '울룰루', lat: -25.3444, lng: 131.0369, region: 'oceania' },
    { name: '뉴욕', lat: 40.7128, lng: -74.0060, region: 'northamerica' }
  ].map(city => ({
    ...city,
    ...convertCoordinates(city.lat, city.lng, city.region)
  }));

  // 지역별 연결 정의
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
    { from: '부여', to: '뉴욕' },
  ];

  // 각 원의 현재 위치를 추적하는 상태
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentPositions, setCurrentPositions] = useState(
    cities.map(city => ({ x: city.x, y: city.y }))
  );

  // 클릭된 도시를 추적하는 상태
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // 호버된 도시를 추적하는 상태 (버튼 호버용)
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);

  // 지도 중심점을 추적하는 상태 (클릭된 원이 중심이 되도록)
  const [mapCenter, setMapCenter] = useState({ x: 1000, y: 450 }); // 기본 중심점
  const [mapScale, setMapScale] = useState(1); // 지도 확대/축소 상태
  const [isTransitioning, setIsTransitioning] = useState(false); // 애니메이션 진행 상태
  const [forceUpdate, setForceUpdate] = useState(0); // 강제 리렌더링용

  // selectedCity 변경 시 강제 리렌더링
  useEffect(() => {
    console.log(`selectedCity 변경됨: ${selectedCity}`);
    setForceUpdate(prev => prev + 1);
  }, [selectedCity]);

  // 영상 데이터 상태
  // locationVideos 상태는 더 이상 사용하지 않음
  const [currentVideo, setCurrentVideo] = useState<LocationVideo | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);

  // 영상 데이터 가져오기 함수 (현재는 사용하지 않음)
  const fetchLocationVideos = async () => {
    try {
      const response = await fetch('/api/location-video');
      const data = await response.json();
      
      if (data.success) {
        // setLocationVideos(data.data); // 더 이상 사용하지 않음
        console.log('영상 데이터 로드됨:', data.data.length, '개');
      } else {
        console.error('영상 데이터 가져오기 실패:', data.message);
      }
    } catch (error) {
      console.error('영상 데이터 가져오기 오류:', error);
    }
  };

  // 특정 도시의 영상 가져오기 함수
  const fetchCityVideo = async (cityName: string) => {
    setIsVideoLoading(true);
    try {
      const response = await fetch(`/api/location-video/${encodeURIComponent(cityName)}`);
      const data = await response.json();
      
      if (data.success) {
        setCurrentVideo(data.data);
      } else {
        setCurrentVideo(null);
        console.log(`${cityName}에 대한 영상이 없습니다.`);
      }
    } catch (error) {
      console.error('영상 가져오기 오류:', error);
      setCurrentVideo(null);
    } finally {
      setIsVideoLoading(false);
    }
  };

  // 스크롤 이벤트 핸들러
  const handleScroll = () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    setShowScrollToTop(scrollTop > 500); // 500px 이상 스크롤하면 버튼 표시
  };

  // 위로 스크롤하는 함수
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // 선택된 도시 정보 영역으로 스크롤하는 함수
  const scrollToCityInfo = () => {
    if (cityInfoRef.current) {
      // 모바일에서는 더 부드러운 스크롤을 위해 약간의 오프셋 추가
      const offset = isMobile ? -50 : 0;
      const elementPosition = cityInfoRef.current.offsetTop + offset;
      
      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      });
    }
  };

  // 영상 영역으로 스크롤하는 함수
  const scrollToVideo = () => {
    if (videoSectionRef.current) {
      videoSectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  // 뷰포트 크기 업데이트 및 초기 데이터 로드
  useEffect(() => {
    const updateViewport = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setViewport({ width: rect.width, height: rect.height });
      }
      setIsMobile(window.innerWidth <= 768);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('scroll', handleScroll);
    
    // 초기 영상 데이터 로드
    fetchLocationVideos();
    
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // 지도 3D 변환 계산 함수 (클릭된 도시를 중심으로)
  const getMapTransform = () => {
    console.log(`🗺️ getMapTransform 호출됨 - selectedCity: ${selectedCity}`);
    
    // 클릭된 도시가 없으면 기본 상태
    if (!selectedCity) {
      console.log(`🗺️ 변환 없음 - selectedCity 없음`);
      return 'perspective(1000px) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1) translate3d(0px, 0px, 0px)';
    }
    
    const selectedCityData = cities.find(city => city.name === selectedCity);
    if (!selectedCityData) {
      console.log(`🗺️ 도시 데이터 없음: ${selectedCity}`);
      return 'perspective(1000px) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1) translate3d(0px, 0px, 0px)';
    }
    
    // 확대 비율 (3D 효과와 함께)
    const scale = isMobile ? 2.5 : 3.0;
    
    // SVG viewBox 크기 (2000 x 900)
    const viewBoxWidth = 2000;
    const viewBoxHeight = 900;
    
    // 화면의 중심점 (viewBox 좌표계에서)
    const centerX = viewBoxWidth / 2;  // 1000
    const centerY = viewBoxHeight / 2; // 450
    
    // 선택된 도시를 중심으로 이동할 거리 계산
    const translateX = centerX - selectedCityData.x;
    const translateY = centerY - selectedCityData.y;
    
    // 3D 효과를 위한 Z축 이동 (앞으로 나오는 효과)
    const translateZ = isTransitioning ? 200 : 150;
    
    // 3D 회전 효과 (X, Y, Z축)
    const rotateX = isTransitioning ? -5 : -2; // 약간 위에서 내려다보는 각도
    const rotateY = isTransitioning ? Math.sin(Date.now() * 0.001) * 3 : 0; // 좌우 흔들림
    const rotateZ = isTransitioning ? Math.sin(Date.now() * 0.002) * 1 : 0; // 미세한 회전
    
    console.log(`🗺️ 3D 지도 변환: ${selectedCity}`);
    console.log(`🗺️ - 도시 위치: (${selectedCityData.x}, ${selectedCityData.y})`);
    console.log(`🗺️ - 중심점: (${centerX}, ${centerY})`);
    console.log(`🗺️ - 이동거리: (${translateX}, ${translateY}, ${translateZ})`);
    console.log(`🗺️ - 확대: ${scale}x`);
    console.log(`🗺️ - 3D 회전: X${rotateX}° Y${rotateY.toFixed(1)}° Z${rotateZ.toFixed(1)}°`);
    
    return `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) scale(${scale}) translate3d(${translateX}px, ${translateY}px, ${translateZ}px)`;
  };

  // 도시 클릭 핸들러 (중심 이동 애니메이션 포함)
  const handleCityClick = (cityName: string) => {
    console.log(`🎯 ${cityName} 클릭됨!`);
    
    // 애니메이션 시작
    setIsTransitioning(true);
    
    // 같은 도시를 다시 클릭하면 원래 상태로 돌아가기
    if (selectedCity === cityName) {
      console.log(`🔄 ${cityName} 선택 해제 - 원래 상태로 복귀`);
      setSelectedCity(null);
      setMapCenter({ x: 1000, y: 450 }); // 기본 중심점으로 복귀
      setMapScale(1);
    } else {
      // 새로운 도시 선택
      console.log(`🎯 ${cityName} 새로 선택 - 중심으로 이동 시작`);
      setSelectedCity(cityName);
      const clickedCity = cities.find(city => city.name === cityName);
      if (clickedCity) {
        setMapCenter({ x: clickedCity.x, y: clickedCity.y });
        setMapScale(isMobile ? 2.5 : 3.0);
        console.log(`📍 중심점 설정: (${clickedCity.x}, ${clickedCity.y}), 확대: ${isMobile ? 2.5 : 3.0}x`);
      }
    }
    
    // 애니메이션 완료 후 처리
    setTimeout(() => {
      setIsTransitioning(false);
      console.log(`✅ ${cityName} 애니메이션 완료`);
      
      // 새로운 도시가 선택된 경우에만 스크롤
      if (selectedCity !== cityName) {
        const scrollDelay = isMobile ? 200 : 50;
        setTimeout(() => {
          scrollToCityInfo();
        }, scrollDelay);
      }
    }, isMobile ? 800 : 600); // 애니메이션 시간을 더 길게
  };

  // 이동하기 버튼 클릭 핸들러
  const handleMoveClick = (cityName: string) => {
    console.log(`${cityName}로 이동하기 클릭됨`);
    fetchCityVideo(cityName);
    
    // 영상이 로드된 후 스크롤하기 위해 약간의 지연 추가
    setTimeout(() => {
      scrollToVideo();
    }, 100);
  };

  // handleVideoSettings는 더 이상 사용하지 않음 (App.tsx의 설정 버튼으로 이동됨)

  // YouTube URL을 임베드 형식으로 변환하는 함수
  const convertToEmbedUrl = (url: string): string => {
    // 이미 임베드 URL인 경우 그대로 반환
    if (url.includes('youtube.com/embed/')) {
      return url;
    }
    
    // 일반 YouTube URL을 임베드 형식으로 변환
    const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(youtubeRegex);
    
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
    
    // YouTube URL이 아닌 경우 원본 URL 반환
    return url;
  };

  // 연결선 그리기 함수
  const renderConnections = () => {
    return connections.map((connection, index) => {
      const fromCity = cities.find(city => city.name === connection.from);
      const toCity = cities.find(city => city.name === connection.to);
      
      if (!fromCity || !toCity) return null;
      
      return (
        <line
          key={index}
          x1={fromCity.x}
          y1={fromCity.y}
          x2={toCity.x}
          y2={toCity.y}
          stroke="#CCCCCC"
          strokeWidth="1"
          opacity="0.6"
        />
      );
    });
  };

  return (
    <div className="page-content">
      <h1 className="page-title">
        LOCATION
        <div className="page-subtitle" style={{position: 'relative', top: 'auto', left: 'auto', transform: 'none', marginTop: '0'}}>위치와 공간</div>
      </h1>
      
            
      {/* 지도 영역 - 3D 변환 지원 */}
      <div className="location-map-container location-map-desktop-offset" style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', // 오른쪽 정렬로 변경
        alignItems: 'center', 
        width: '100%', 
        overflow: 'hidden',
        paddingRight: '300px', // 오른쪽 여백을 더 늘림
        marginLeft: 'auto', // 추가: 왼쪽 마진 자동
        perspective: '1000px', // 3D 원근감 추가
        transformStyle: 'preserve-3d' // 3D 변환 유지
      }}>
        <svg 
          ref={svgRef}
          width="2000" 
          height="900" 
          className="location-map" 
          viewBox="0 0 2000 900" 
          style={{ 
            backgroundColor: '#ffffff', 
            transform: getMapTransform(),
            transformStyle: 'preserve-3d', // 3D 변환 유지
            backfaceVisibility: 'visible', // 뒷면도 보이게
            transition: isTransitioning 
              ? (isMobile ? 'transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)')
              : (isMobile ? 'transform 0.25s ease-out' : 'transform 0.1s ease-in-out'),
            boxShadow: selectedCity ? '0 20px 40px rgba(0,0,0,0.3)' : '0 5px 15px rgba(0,0,0,0.1)', // 3D 그림자 효과
            borderRadius: '8px' // 모서리 둥글게
          }}
        >
          {/* 격자 배경 */}
          <defs>
            <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#f0f0f0" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="2000" height="900" fill="#ffffff" />
          
          {/* 지역별 연결선들 */}
          {renderConnections()}
          
          {/* 도시 점과 라벨 */}
          {cities.map((city, index) => (
            <g key={city.name}>
              {/* 선택된 도시 주변의 펄스 효과 */}
              {selectedCity === city.name && (
                <motion.circle
                  cx={city.x}
                  cy={city.y}
                  r="15"
                  fill="none"
                  stroke="#ff6b6b"
                  strokeWidth="2"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: [0, 1.5, 2],
                    opacity: [0, 0.8, 0],
                    strokeWidth: [2, 1, 0]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeOut"
                  }}
                />
              )}
              <motion.circle
                cx={city.x}
                cy={city.y}
                r={city.name === '부여' ? "8" : "5"}
                fill={selectedCity === city.name ? "#ff6b6b" : "#000000"} // 선택된 원은 빨간색
                initial={{ scale: 1 }}
                animate={
                  selectedCity === city.name ? {
                    // 선택된 도시는 특별한 3D 애니메이션
                    scale: [1, 1.4, 1.2],
                    opacity: [1, 0.8, 1],
                    fill: ["#ff6b6b", "#ff8e8e", "#ff6b6b"]
                  } : isMobile ? {
                    // 모바일에서는 단순한 애니메이션만
                    scale: hoveredCity === city.name ? 1.3 : 1,
                    opacity: hoveredCity === city.name ? [1, 0.4, 1] : 1
                  } : {
                    // 데스크톱에서는 복잡한 애니메이션
                    scale: hoveredCity === city.name ? [1, 1.5, 1] : [1, 1.1, 1],
                    x: [0, Math.sin(index * 0.7) * 2.5, 0],
                    y: [0, Math.cos(index * 0.7) * 2.5, 0],
                    opacity: hoveredCity === city.name ? [1, 0.2, 1, 0.2, 1, 0.2, 1] : 1
                  }
                }
                whileHover={selectedCity === city.name ? {
                  scale: 1.3,
                  fill: "#ff4757"
                } : isMobile ? {} : {
                  scale: 1.5,
                  opacity: [1, 0.05, 1, 0.02, 1, 0.08, 1, 0.03, 1],
                }}
                whileTap={{ scale: 0.8 }}
                transition={
                  selectedCity === city.name ? {
                    // 선택된 도시는 부드러운 전환
                    duration: 1.0,
                    repeat: Infinity,
                    ease: "easeInOut"
                  } : isMobile ? {
                    // 모바일에서는 빠르고 단순한 전환
                    duration: 0.2,
                    ease: "easeOut"
                  } : {
                    // 데스크톱에서는 복잡한 전환
                    duration: hoveredCity === city.name ? 0.8 : 4 + index * 0.3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: hoveredCity === city.name ? 0 : index * 0.15,
                    opacity: { 
                      duration: hoveredCity === city.name ? 0.5 : 1.2, 
                      repeat: Infinity,
                      ease: "easeInOut"
                    },
                    hover: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                  }
                }
                style={{ 
                  cursor: 'pointer',
                  // 3D 효과: 선택된 원은 Z축으로 앞으로 나오고 그림자 효과
                  filter: selectedCity === city.name 
                    ? 'drop-shadow(0 15px 25px rgba(255, 107, 107, 0.5)) drop-shadow(0 5px 10px rgba(255, 107, 107, 0.3))' 
                    : 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
                  transformOrigin: 'center',
                  transition: 'filter 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                }}
                onClick={() => handleCityClick(city.name)}
                onUpdate={isMobile ? undefined : (latest) => {
                  // 모바일에서는 onUpdate 비활성화로 성능 향상
                  setCurrentPositions(prev => {
                    const newPositions = [...prev];
                    newPositions[index] = {
                      x: city.x + (Number(latest.x) || 0),
                      y: city.y + (Number(latest.y) || 0)
                    };
                    return newPositions;
                  });
                }}
              />
              <motion.text
                x={city.x}
                y={city.y - 20}
                textAnchor="middle"
                fontSize={selectedCity === city.name ? "15" : "13"}
                fontWeight={selectedCity === city.name ? "700" : "500"}
                fill={selectedCity === city.name ? "#ff6b6b" : "#666666"}
                fontFamily="Arial, sans-serif"
                animate={
                  selectedCity === city.name ? {
                    // 선택된 도시 텍스트 애니메이션
                    scale: [1, 1.1, 1],
                    fill: ["#ff6b6b", "#ff4757", "#ff6b6b"]
                  } : isMobile ? {} : {
                    x: [0, Math.sin(index * 0.7) * 2.5, 0],
                    y: [0, Math.cos(index * 0.7) * 2.5, 0]
                  }
                }
                transition={
                  selectedCity === city.name ? {
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  } : isMobile ? {} : {
                    duration: 4 + index * 0.3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.15
                  }
                }
              >
                {city.name}
              </motion.text>
              <motion.text
                x={city.x}
                y={city.y + 35}
                textAnchor="middle"
                fontSize={selectedCity === city.name ? "11" : "10"}
                fill={selectedCity === city.name ? "#ff6b6b" : "#999999"}
                fontFamily="Arial, sans-serif"
                fontWeight={selectedCity === city.name ? "500" : "400"}
                animate={
                  selectedCity === city.name ? {
                    // 선택된 도시 좌표 텍스트 애니메이션
                    opacity: [0.8, 1, 0.8],
                    fill: ["#ff6b6b", "#ff8e8e", "#ff6b6b"]
                  } : isMobile ? {} : {
                    x: [0, Math.sin(index * 0.7) * 2.5, 0],
                    y: [0, Math.cos(index * 0.7) * 2.5, 0]
                  }
                }
                transition={
                  selectedCity === city.name ? {
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  } : isMobile ? {} : {
                    duration: 4 + index * 0.3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: index * 0.15
                  }
                }
              >
                {city.lat.toFixed(2)}°, {city.lng.toFixed(2)}°
              </motion.text>
            </g>
          ))}
        </svg>
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
            whileHover={isMobile ? {} : { scale: 1.1 }} // 모바일에서는 확대 효과 제거
            whileTap={isMobile ? { scale: 0.98 } : { scale: 0.95 }} // 모바일에서는 미세한 축소 효과만
            animate={isMobile && hoveredCity === city.name ? {
              opacity: [1, 0.5, 1] // 모바일에서는 단순한 깜박이 효과
            } : {}}
            transition={isMobile && hoveredCity === city.name ? {
              duration: 0.3,
              repeat: Infinity,
              ease: "easeOut"
            } : {}}
            style={{
              backgroundColor: selectedCity === city.name ? '#ff6b6b' : '#ffffff',
              color: selectedCity === city.name ? '#ffffff' : '#000000',
              border: selectedCity === city.name 
                ? '3px solid #ff6b6b' 
                : hoveredCity === city.name 
                  ? '3px solid #000000' 
                  : '2px solid #cccccc',
              fontSize: '9px',
              letterSpacing: city.name === 'node tree' ? '-3px' : '-2px',
              boxShadow: selectedCity === city.name ? '0 0 10px rgba(255, 107, 107, 0.3)' : 'none'
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
            
            <div className="video-wrapper" style={{
              position: 'relative',
              paddingBottom: '56.25%', // 16:9 비율
              height: 0,
              overflow: 'hidden',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
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
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
            
            <motion.button
              className="location-close-video-button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentVideo(null)}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#f5f5f5',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              영상 닫기
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* 위로 올라가기 버튼 */}
      <AnimatePresence>
        {showScrollToTop && (
          <motion.button
            className="scroll-to-top-button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={scrollToTop}
            style={{
              position: 'fixed',
              right: '30px',
              bottom: '30px',
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: '#000000',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              zIndex: 1000
            }}
          >
            ↑
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Location; 