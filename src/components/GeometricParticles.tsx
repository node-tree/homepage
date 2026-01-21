import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// 도시 데이터 타입
export interface CityData {
  name: string;
  position: [number, number, number];
}

// 기본 도시 데이터
export const DEFAULT_CITIES: CityData[] = [
  { name: '서울', position: [0, 0.8, 0] },
  { name: '부여', position: [-1.2, -0.3, 0.8] },
  { name: '용인', position: [1.0, 0.2, 0.5] },
  { name: '서산', position: [-1.8, 0.5, -0.5] },
  { name: '태안', position: [-2.0, -0.2, 0.3] },
  { name: '서천', position: [-0.8, -0.8, 1.0] },
  { name: '강경', position: [-0.5, -0.5, 0.5] },
  { name: '전주', position: [0.3, -1.0, 0.8] },
  { name: '마인츠', position: [2.0, 1.0, -1.0] },
  { name: '울룰루', position: [1.5, -1.2, -1.5] },
  { name: '뉴욕', position: [-2.2, 0.8, 1.2] },
];

type ShapeType = 'network' | 'sphere' | 'torus' | 'mobius' | 'trefoil' | 'blob' | 'ribbon' | 'figure8';

const PARTICLE_COUNT = 150;
const SHAPE_CHANGE_INTERVAL = 6000; // 형태 변경 주기
const ZOOM_DURATION = 1200; // 줌 지속 시간
const ANIMATION_SPEED = 0.06; // 줌과 모핑의 동일한 속도
const CONNECTION_DISTANCE = 2.5;

// 네트워크 형태 (도시 중심)
function generateNetworkPoints(count: number, cities: CityData[]): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];

  for (let i = 0; i < count; i++) {
    const city = cities[i % cities.length];
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5
    );
    points.push(new THREE.Vector3(
      city.position[0] + offset.x,
      city.position[1] + offset.y,
      city.position[2] + offset.z
    ));
  }

  return points;
}

// 구체 형태
function generateSpherePoints(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius * (0.7 + Math.random() * 0.6);
    points.push(new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    ));
  }
  return points;
}

// 뫼비우스 띠 (Möbius strip) - 부드러운 곡선
function generateMobiusPoints(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const u = (i / count) * Math.PI * 2;
    const v = (Math.random() - 0.5) * 0.8;
    const noise = (Math.random() - 0.5) * 0.1;
    const R = radius * 0.9;
    points.push(new THREE.Vector3(
      (R + v * Math.cos(u / 2)) * Math.cos(u) + noise,
      (R + v * Math.cos(u / 2)) * Math.sin(u) + noise,
      v * Math.sin(u / 2) + noise
    ));
  }
  return points;
}

// 트레포일 노트 (Trefoil knot) - 매듭 곡선
function generateTrefoilPoints(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const noise = (Math.random() - 0.5) * 0.15;
    const scale = radius * 0.5;
    points.push(new THREE.Vector3(
      scale * (Math.sin(t) + 2 * Math.sin(2 * t)) + noise,
      scale * (Math.cos(t) - 2 * Math.cos(2 * t)) + noise,
      scale * (-Math.sin(3 * t)) + noise
    ));
  }
  return points;
}

// 유기적 블롭 (Organic blob) - 부드럽게 변형된 구
function generateBlobPoints(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    // 유기적인 변형을 위한 노이즈
    const blobFactor = 0.7 + 0.3 * (
      Math.sin(theta * 3) * Math.sin(phi * 2) +
      Math.cos(theta * 2) * Math.cos(phi * 3)
    );
    const r = radius * blobFactor;
    const noise = (Math.random() - 0.5) * 0.1;
    points.push(new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta) + noise,
      r * Math.sin(phi) * Math.sin(theta) + noise,
      r * Math.cos(phi) + noise
    ));
  }
  return points;
}

// 리본 (Ribbon) - 흐르는 곡선 띠
function generateRibbonPoints(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 4;
    const width = (Math.random() - 0.5) * 0.4;
    const noise = (Math.random() - 0.5) * 0.08;
    const wave = Math.sin(t * 0.5) * 0.3;
    points.push(new THREE.Vector3(
      radius * Math.sin(t) * (0.8 + wave) + noise,
      (t / (Math.PI * 4) - 0.5) * radius * 2 + width + noise,
      radius * Math.cos(t) * Math.sin(t * 0.5) * 0.8 + noise
    ));
  }
  return points;
}

// 8자 매듭 (Figure-8 knot) - 복잡한 곡선
function generateFigure8Points(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const noise = (Math.random() - 0.5) * 0.12;
    const scale = radius * 0.6;
    // Figure-8 knot parametric equations
    const cost = Math.cos(t);
    const sint = Math.sin(t);
    const cos2t = Math.cos(2 * t);
    const sin2t = Math.sin(2 * t);
    points.push(new THREE.Vector3(
      scale * (2 + cos2t) * cost + noise,
      scale * (2 + cos2t) * sint + noise,
      scale * sin2t * 1.5 + noise
    ));
  }
  return points;
}

// 토러스 (도넛)
function generateTorusPoints(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const R = radius * 0.8; // 메인 반지름
  const r = radius * 0.35; // 튜브 반지름
  for (let i = 0; i < count; i++) {
    const u = (i / count) * Math.PI * 2;
    const v = Math.random() * Math.PI * 2;
    const noise = (Math.random() - 0.5) * 0.2;
    points.push(new THREE.Vector3(
      (R + r * Math.cos(v)) * Math.cos(u) + noise,
      r * Math.sin(v) + noise,
      (R + r * Math.cos(v)) * Math.sin(u) + noise
    ));
  }
  return points;
}

function generateShapePoints(shape: ShapeType, count: number, radius: number, cities: CityData[]): THREE.Vector3[] {
  switch (shape) {
    case 'network': return generateNetworkPoints(count, cities);
    case 'sphere': return generateSpherePoints(count, radius);
    case 'torus': return generateTorusPoints(count, radius);
    case 'mobius': return generateMobiusPoints(count, radius);
    case 'trefoil': return generateTrefoilPoints(count, radius);
    case 'blob': return generateBlobPoints(count, radius);
    case 'ribbon': return generateRibbonPoints(count, radius);
    case 'figure8': return generateFigure8Points(count, radius);
    default: return generateNetworkPoints(count, cities);
  }
}

const SHAPES: ShapeType[] = ['network', 'sphere', 'torus', 'mobius', 'trefoil', 'blob', 'ribbon', 'figure8'];

// 파티클 시스템 (워프 효과 제거 - 안정성)
function ParticleSystem({
  mousePosition,
  cities,
  currentShape,
  isInverted
}: {
  mousePosition: React.MutableRefObject<{ x: number; y: number }>;
  cities: CityData[];
  currentShape: ShapeType;
  isInverted: boolean;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const groupRef = useRef<THREE.Group>(null);

  const { viewport } = useThree();

  const currentPositions = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  const targetPositions = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  const displayPositions = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));

  const MAX_LINES = 2000;
  const linePositions = useRef(new Float32Array(MAX_LINES * 6));
  const lineGeometryRef = useRef<THREE.BufferGeometry>(null);
  const lineGeometryInitialized = useRef(false);

  const sizes = useMemo(() => {
    const initialPoints = generateShapePoints('network', PARTICLE_COUNT, 2.5, cities);
    initialPoints.forEach((point, i) => {
      // NaN/Infinity 방지
      const x = isFinite(point.x) ? point.x : 0;
      const y = isFinite(point.y) ? point.y : 0;
      const z = isFinite(point.z) ? point.z : 0;
      currentPositions.current[i * 3] = x;
      currentPositions.current[i * 3 + 1] = y;
      currentPositions.current[i * 3 + 2] = z;
      targetPositions.current[i * 3] = x;
      targetPositions.current[i * 3 + 1] = y;
      targetPositions.current[i * 3 + 2] = z;
      displayPositions.current[i * 3] = x;
      displayPositions.current[i * 3 + 1] = y;
      displayPositions.current[i * 3 + 2] = z;
    });

    const sizes = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      sizes[i] = 0.04 + Math.random() * 0.03;
    }
    return sizes;
  }, [cities]);

  // 형태 변경 시 타겟 위치 업데이트
  useEffect(() => {
    const newPoints = generateShapePoints(currentShape, PARTICLE_COUNT, 2.5, cities);
    newPoints.forEach((point, i) => {
      // NaN/Infinity 방지
      const x = isFinite(point.x) ? point.x : 0;
      const y = isFinite(point.y) ? point.y : 0;
      const z = isFinite(point.z) ? point.z : 0;
      targetPositions.current[i * 3] = x;
      targetPositions.current[i * 3 + 1] = y;
      targetPositions.current[i * 3 + 2] = z;
    });
  }, [currentShape, cities]);

  useFrame((state) => {
    if (!pointsRef.current || !linesRef.current || !groupRef.current) return;

    const time = state.clock.elapsedTime;
    const positionAttribute = pointsRef.current.geometry.attributes.position;
    const sizeAttribute = pointsRef.current.geometry.attributes.size;

    // NaN 방지를 위한 안전한 마우스 좌표 계산
    const vw = viewport.width || 1;
    const vh = viewport.height || 1;
    const mouseX = (mousePosition.current.x / vw) * 4;
    const mouseY = (mousePosition.current.y / vh) * 4;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const tx = targetPositions.current[i * 3] || 0;
      const ty = targetPositions.current[i * 3 + 1] || 0;
      const tz = targetPositions.current[i * 3 + 2] || 0;

      // 모핑 속도 - 줌과 동일
      currentPositions.current[i * 3] += (tx - currentPositions.current[i * 3]) * ANIMATION_SPEED;
      currentPositions.current[i * 3 + 1] += (ty - currentPositions.current[i * 3 + 1]) * ANIMATION_SPEED;
      currentPositions.current[i * 3 + 2] += (tz - currentPositions.current[i * 3 + 2]) * ANIMATION_SPEED;

      // NaN 체크 및 복구
      if (!isFinite(currentPositions.current[i * 3])) currentPositions.current[i * 3] = tx;
      if (!isFinite(currentPositions.current[i * 3 + 1])) currentPositions.current[i * 3 + 1] = ty;
      if (!isFinite(currentPositions.current[i * 3 + 2])) currentPositions.current[i * 3 + 2] = tz;

      const cx = currentPositions.current[i * 3];
      const cy = currentPositions.current[i * 3 + 1];
      const cz = currentPositions.current[i * 3 + 2];

      const breathe = 1 + Math.sin(time * 0.5 + i * 0.1) * 0.02;
      const vibrationX = Math.sin(time * 1.2 + i * 0.5) * 0.01;
      const vibrationY = Math.cos(time * 1.0 + i * 0.4) * 0.01;

      const dx = cx - mouseX;
      const dy = cy - mouseY;
      const distToMouse = Math.sqrt(dx * dx + dy * dy) || 1;
      const mouseInfluence = Math.max(0, 1 - distToMouse / 2.5) * 0.15;
      const pushX = dx * mouseInfluence * 0.3;
      const pushY = dy * mouseInfluence * 0.3;

      const finalX = cx * breathe + vibrationX + pushX;
      const finalY = cy * breathe + vibrationY + pushY;
      const finalZ = cz * breathe;

      displayPositions.current[i * 3] = finalX;
      displayPositions.current[i * 3 + 1] = finalY;
      displayPositions.current[i * 3 + 2] = finalZ;

      positionAttribute.setXYZ(i, finalX, finalY, finalZ);

      const pulse = 1 + Math.sin(time * 2 + i * 0.3) * 0.2;
      sizeAttribute.setX(i, sizes[i] * pulse * (1 + mouseInfluence * 0.2));
    }

    positionAttribute.needsUpdate = true;
    sizeAttribute.needsUpdate = true;

    // 연결선 업데이트
    if (!lineGeometryRef.current) return;
    const lineGeometry = lineGeometryRef.current;

    // 지오메트리 초기화 (한 번만)
    if (!lineGeometryInitialized.current) {
      lineGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(linePositions.current, 3)
      );
      lineGeometryInitialized.current = true;
    }

    const linePositionAttr = lineGeometry.attributes.position as THREE.BufferAttribute;
    if (!linePositionAttr) return;

    let lineCount = 0;
    for (let i = 0; i < PARTICLE_COUNT && lineCount < MAX_LINES; i++) {
      const x1 = displayPositions.current[i * 3];
      const y1 = displayPositions.current[i * 3 + 1];
      const z1 = displayPositions.current[i * 3 + 2];

      for (let j = i + 1; j < PARTICLE_COUNT && lineCount < MAX_LINES; j++) {
        const x2 = displayPositions.current[j * 3];
        const y2 = displayPositions.current[j * 3 + 1];
        const z2 = displayPositions.current[j * 3 + 2];

        const ddx = x2 - x1;
        const ddy = y2 - y1;
        const ddz = z2 - z1;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);

        if (dist < CONNECTION_DISTANCE) {
          linePositionAttr.setXYZ(lineCount * 2, x1, y1, z1);
          linePositionAttr.setXYZ(lineCount * 2 + 1, x2, y2, z2);
          lineCount++;
        }
      }
    }

    for (let k = lineCount; k < MAX_LINES; k++) {
      linePositionAttr.setXYZ(k * 2, 0, 0, 0);
      linePositionAttr.setXYZ(k * 2 + 1, 0, 0, 0);
    }

    linePositionAttr.needsUpdate = true;
    lineGeometry.setDrawRange(0, lineCount * 2);

    groupRef.current.rotation.y += 0.001;
  });

  return (
    <group ref={groupRef}>
      <lineSegments ref={linesRef} frustumCulled={false}>
        <bufferGeometry ref={lineGeometryRef} />
        <lineBasicMaterial color={isInverted ? "#666666" : "#999999"} transparent opacity={0.4} />
      </lineSegments>

      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={PARTICLE_COUNT}
            array={displayPositions.current}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
          />
          <bufferAttribute
            attach="attributes-size"
            count={sizes.length}
            array={sizes}
            itemSize={1}
          />
        </bufferGeometry>
        <shaderMaterial
          key={isInverted ? 'inverted' : 'normal'}
          transparent
          depthWrite={false}
          uniforms={{ uColor: { value: new THREE.Color(isInverted ? '#cccccc' : '#333333') } }}
          vertexShader={`
            attribute float size;
            void main() {
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              gl_Position = projectionMatrix * mvPosition;
              gl_PointSize = size * 600.0 / -mvPosition.z;
            }
          `}
          fragmentShader={`
            uniform vec3 uColor;
            void main() {
              float dist = length(gl_PointCoord - vec2(0.5));
              if (dist > 0.5) discard;
              float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
              gl_FragColor = vec4(uColor, alpha * 0.9);
            }
          `}
        />
      </points>
    </group>
  );
}

// 카메라 줌 컨트롤러 - 형태 변경과 동기화
function CameraController({ isZooming }: { isZooming: boolean }) {
  const { camera } = useThree();
  const targetZ = useRef(7);
  const currentZ = useRef(7);

  useEffect(() => {
    targetZ.current = isZooming ? 3.5 : 7; // 확대 시 카메라를 가깝게
  }, [isZooming]);

  useFrame(() => {
    // 모핑과 동일한 속도
    currentZ.current += (targetZ.current - currentZ.current) * ANIMATION_SPEED;
    camera.position.z = currentZ.current;
  });

  return null;
}

// Scene 컴포넌트
function Scene({
  cities,
  mousePosition,
  currentShape,
  isZooming,
  isInverted
}: {
  cities: CityData[];
  mousePosition: React.MutableRefObject<{ x: number; y: number }>;
  currentShape: ShapeType;
  isZooming: boolean;
  isInverted: boolean;
}) {
  return (
    <>
      <CameraController isZooming={isZooming} />
      <ParticleSystem
        mousePosition={mousePosition}
        cities={cities}
        currentShape={currentShape}
        isInverted={isInverted}
      />
    </>
  );
}

// 메인 컴포넌트
interface GeometricParticlesProps {
  height?: string;
  cities?: CityData[];
}

const GeometricParticles: React.FC<GeometricParticlesProps> = ({
  height = '600px',
  cities = DEFAULT_CITIES
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePosition = useRef({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentShape, setCurrentShape] = useState<ShapeType>('network');
  const [isZooming, setIsZooming] = useState(false);
  const [isInverted, setIsInverted] = useState(false);
  const shapeChangeCount = useRef(0);

  useEffect(() => {
    setIsLoaded(true);

    // 형태 변경과 줌이 동시에 진행
    const shapeInterval = setInterval(() => {
      shapeChangeCount.current++;

      // 줌 인과 형태 변경을 동시에 시작
      setIsZooming(true);
      setCurrentShape(prev => {
        if (prev === 'network') {
          const others = SHAPES.filter(s => s !== 'network');
          return others[Math.floor(Math.random() * others.length)];
        }
        return 'network';
      });

      // 3~4번에 한 번씩 색상 반전 (줌 인과 동시에)
      const shouldInvert = shapeChangeCount.current % 3 === 0 || Math.random() < 0.3;
      if (shouldInvert) {
        setIsInverted(prev => !prev);
      }

      // 형태 변경 완료 후 줌 아웃 (동기화된 타이밍)
      setTimeout(() => {
        setIsZooming(false);
      }, ZOOM_DURATION);

    }, SHAPE_CHANGE_INTERVAL);

    return () => {
      clearInterval(shapeInterval);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mousePosition.current = {
      x: e.clientX - rect.left - rect.width / 2,
      y: -(e.clientY - rect.top - rect.height / 2)
    };
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => mousePosition.current = { x: 0, y: 0 }}
      style={{
        width: '100%',
        height,
        background: isInverted ? '#0a0a0a' : '#fafafa',
        position: 'relative',
        overflow: 'hidden',
        opacity: isLoaded ? 1 : 0,
        transition: 'opacity 1s ease-in-out, background 1.5s ease-in-out'
      }}
    >
      {/* 노이즈 텍스처 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        opacity: 0.02,
        pointerEvents: 'none',
        zIndex: 1
      }} />

      <Canvas
        camera={{ position: [0, 0, 7], fov: 50 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene
          cities={cities}
          mousePosition={mousePosition}
          currentShape={currentShape}
          isZooming={isZooming}
          isInverted={isInverted}
        />
      </Canvas>

      {/* 비네팅 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: isInverted
          ? 'radial-gradient(ellipse at center, transparent 30%, rgba(10,10,10,0.85) 100%)'
          : 'radial-gradient(ellipse at center, transparent 30%, rgba(250,250,250,0.85) 100%)',
        pointerEvents: 'none',
        zIndex: 2,
        transition: 'background 1.5s ease-in-out'
      }} />
    </div>
  );
};

export default GeometricParticles;
