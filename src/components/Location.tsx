import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

const Location: React.FC = () => {
  // SVG 참조를 위한 ref
  const svgRef = useRef<SVGSVGElement>(null);

  // 뷰포트 크기를 추적하는 상태
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  // 모바일 여부를 확인하는 상태
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // GPS 좌표를 SVG 좌표로 변환하는 함수
  const convertCoordinates = (lat: number, lng: number, region: string) => {
    // SVG 화면 크기 (페이지 전체 공간 활용)
    const svgWidth = 2000;  // 더 넓게 확장
    const svgHeight = 900;  // 더 높게 확장
    const padding = 100;    // 패딩 늘림
    
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

  // 뷰포트 크기 업데이트
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
    
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  // 지도 확대 변환 계산 함수 (모바일 대응)
  const getMapTransform = () => {
    if (!hoveredCity || !svgRef.current) {
      return 'scale(1) translate(0px, 0px)';
    }
    
    const hoveredCityData = cities.find(city => city.name === hoveredCity);
    if (!hoveredCityData) {
      return 'scale(1) translate(0px, 0px)';
    }
    
    // 확대 비율
    const scale = 2.5;
    
    // SVG의 실제 렌더링 크기 가져오기
    const rect = svgRef.current.getBoundingClientRect();
    const svgWidth = rect.width;
    const svgHeight = rect.height;
    
    // SVG viewBox 크기 (2000 x 900)
    const viewBoxWidth = 2000;
    const viewBoxHeight = 900;
    
    // 실제 화면에서의 중심점 계산
    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;
    
    // viewBox 좌표를 실제 화면 좌표로 변환
    const scaleX = svgWidth / viewBoxWidth;
    const scaleY = svgHeight / viewBoxHeight;
    
    // 도시의 실제 화면 좌표
    const cityScreenX = hoveredCityData.x * scaleX;
    const cityScreenY = hoveredCityData.y * scaleY;
    
    // 해당 도시를 중심으로 이동할 좌표 계산
    const translateX = (centerX - cityScreenX) / scale;
    const translateY = (centerY - cityScreenY) / scale;
    
    return `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
  };

  // 도시 클릭 핸들러
  const handleCityClick = (cityName: string) => {
    setSelectedCity(cityName);
    console.log(`${cityName} 클릭됨!`);
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
      {/* 지도 영역 - 오른쪽으로 이동 */}
      <div className="location-map-container location-map-desktop-offset" style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', // 오른쪽 정렬로 변경
        alignItems: 'center', 
        width: '100%', 
        overflow: 'hidden',
        paddingRight: '300px', // 오른쪽 여백을 더 늘림
        marginLeft: 'auto' // 추가: 왼쪽 마진 자동
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
            transition: 'transform 0.1s ease-in-out'
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
              <motion.circle
                cx={city.x}
                cy={city.y}
                r={city.name === '부여' ? "8" : "5"}
                fill="#000000"
                initial={{ scale: 1 }}
                animate={{
                  scale: hoveredCity === city.name ? [1, 1.5, 1] : [1, 1.1, 1],
                  x: [0, Math.sin(index * 0.7) * 2.5, 0],
                  y: [0, Math.cos(index * 0.7) * 2.5, 0],
                  opacity: hoveredCity === city.name ? [1, 0.2, 1, 0.2, 1, 0.2, 1] : 1
                }}
                whileHover={{
                  scale: 1.5,
                  opacity: [1, 0.05, 1, 0.02, 1, 0.08, 1, 0.03, 1],
                }}
                whileTap={{ scale: 0.9 }}
                transition={{
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
                }}
                style={{ cursor: 'pointer' }}
                onClick={() => handleCityClick(city.name)}
                onUpdate={(latest) => {
                  // 원의 현재 위치를 업데이트
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
                fontSize="13"
                fontWeight="500"
                fill="#666666"
                fontFamily="Arial, sans-serif"
                animate={{
                  x: [0, Math.sin(index * 0.7) * 2.5, 0],
                  y: [0, Math.cos(index * 0.7) * 2.5, 0]
                }}
                transition={{
                  duration: 4 + index * 0.3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.15
                }}
              >
                {city.name}
              </motion.text>
              <motion.text
                x={city.x}
                y={city.y + 35}
                textAnchor="middle"
                fontSize="10"
                fill="#999999"
                fontFamily="Arial, sans-serif"
                fontWeight="400"
                animate={{
                  x: [0, Math.sin(index * 0.7) * 2.5, 0],
                  y: [0, Math.cos(index * 0.7) * 2.5, 0]
                }}
                transition={{
                  duration: 4 + index * 0.3,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.15
                }}
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
            whileTap={isMobile ? {} : { scale: 0.95 }} // 모바일에서는 축소 효과 제거
            animate={isMobile && hoveredCity === city.name ? {
              opacity: [1, 0.3, 1, 0.3, 1] // 모바일에서는 깜박이 효과만
            } : {}}
            transition={isMobile && hoveredCity === city.name ? {
              duration: 0.5,
              repeat: Infinity,
              ease: "easeInOut"
            } : {}}
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
        <div className="location-city-info" style={{ textAlign: 'center', marginTop: '1rem' }}>
          <h3 className="page-body-text" style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: '500' }}>선택된 위치</h3>
          <p className="page-body-text" style={{ margin: '0 0 1rem 0' }}>{selectedCity}</p>
          <motion.button
            className="location-move-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              console.log(`${selectedCity}로 이동하기 클릭됨`);
              // 여기에 실제 이동 로직을 추가할 수 있습니다
            }}
          >
            이동하기
          </motion.button>
        </div>
      )}
    </div>
  );
};

export default Location; 