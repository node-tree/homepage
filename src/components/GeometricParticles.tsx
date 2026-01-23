import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
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

type ShapeType = 'network' | 'sphere' | 'torus' | 'helix' | 'sierpinski' | 'symmetricWave' | 'fractalTree' | 'sacredGeometry';

const PARTICLE_COUNT = 180;
const SHAPE_CHANGE_INTERVAL = 10000; // 10초마다 변경 (더 여유롭게)
const ANIMATION_SPEED = 0.035;
const CONNECTION_DISTANCE = 1.8;
const SHAPE_RADIUS = 2.0;

// ═══════════════════════════════════════════════════════════════════════
// 형태 생성 함수들
// ═══════════════════════════════════════════════════════════════════════

// 네트워크 형태 (도시 중심) - 화면 내 유지를 위해 스케일 조정
function generateNetworkPoints(count: number, cities: CityData[]): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const scale = 0.7; // 전체 크기 축소
  for (let i = 0; i < count; i++) {
    const city = cities[i % cities.length];
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 1.2,
      (Math.random() - 0.5) * 1.2,
      (Math.random() - 0.5) * 1.2
    );
    points.push(new THREE.Vector3(
      (city.position[0] + offset.x) * scale,
      (city.position[1] + offset.y) * scale,
      (city.position[2] + offset.z) * scale
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

// 토러스 (도넛)
function generateTorusPoints(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const R = radius * 0.8;
  const r = radius * 0.35;
  for (let i = 0; i < count; i++) {
    const u = (i / count) * Math.PI * 2;
    const v = Math.random() * Math.PI * 2;
    const noise = (Math.random() - 0.5) * 0.15;
    points.push(new THREE.Vector3(
      (R + r * Math.cos(v)) * Math.cos(u) + noise,
      r * Math.sin(v) + noise,
      (R + r * Math.cos(v)) * Math.sin(u) + noise
    ));
  }
  return points;
}

// ═══════════════════════════════════════════════════════════════════════
// 새로운 기하학적 형태들
// ═══════════════════════════════════════════════════════════════════════

// 이중 나선 (Double Helix) - DNA 구조
function generateHelixPoints(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const turns = 3;
  const height = radius * 2;

  for (let i = 0; i < count; i++) {
    const t = (i / count) * turns * Math.PI * 2;
    const y = (i / count - 0.5) * height;
    const noise = (Math.random() - 0.5) * 0.08;

    // 첫 번째 나선
    if (i % 2 === 0) {
      points.push(new THREE.Vector3(
        radius * 0.6 * Math.cos(t) + noise,
        y + noise,
        radius * 0.6 * Math.sin(t) + noise
      ));
    } else {
      // 두 번째 나선 (180도 위상차)
      points.push(new THREE.Vector3(
        radius * 0.6 * Math.cos(t + Math.PI) + noise,
        y + noise,
        radius * 0.6 * Math.sin(t + Math.PI) + noise
      ));
    }
  }
  return points;
}

// 시어핀스키 피라미드 (3D 프랙탈)
function generateSierpinskiPoints(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];

  // 기본 정사면체 꼭짓점
  const vertices = [
    new THREE.Vector3(0, radius, 0),
    new THREE.Vector3(-radius * 0.9, -radius * 0.5, radius * 0.5),
    new THREE.Vector3(radius * 0.9, -radius * 0.5, radius * 0.5),
    new THREE.Vector3(0, -radius * 0.5, -radius * 0.8),
  ];

  // 카오스 게임으로 시어핀스키 점 생성
  let current = new THREE.Vector3(0, 0, 0);

  for (let i = 0; i < count; i++) {
    const target = vertices[Math.floor(Math.random() * 4)];
    current = new THREE.Vector3(
      (current.x + target.x) / 2,
      (current.y + target.y) / 2,
      (current.z + target.z) / 2
    );

    const noise = (Math.random() - 0.5) * 0.05;
    points.push(new THREE.Vector3(
      current.x + noise,
      current.y + noise,
      current.z + noise
    ));
  }

  return points;
}

// 대칭 파동 (Symmetric Wave) - 중앙 대칭 + 파동
function generateSymmetricWavePoints(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const halfCount = Math.floor(count / 2);

  for (let i = 0; i < halfCount; i++) {
    const angle = (i / halfCount) * Math.PI * 2;
    const r = radius * (0.3 + Math.random() * 0.7);
    const waveHeight = Math.sin(angle * 3) * 0.5;
    const noise = (Math.random() - 0.5) * 0.1;

    // 원점 기준 대칭 쌍
    const x = r * Math.cos(angle) + noise;
    const y = waveHeight + noise;
    const z = r * Math.sin(angle) + noise;

    points.push(new THREE.Vector3(x, y, z));
    points.push(new THREE.Vector3(-x, -y, -z)); // 점대칭
  }

  return points;
}

// 프랙탈 트리 (3D Fractal Tree) - 컴팩트하게 조정
function generateFractalTreePoints(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const scale = 0.8; // 전체 크기 축소

  function addBranch(
    start: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
    depth: number,
    maxDepth: number
  ) {
    if (depth > maxDepth || points.length >= count) return;

    const end = start.clone().add(direction.clone().multiplyScalar(length));

    // 가지에 점들 추가
    const branchPoints = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < branchPoints && points.length < count; i++) {
      const t = i / branchPoints;
      const noise = (Math.random() - 0.5) * 0.08;
      points.push(new THREE.Vector3(
        (start.x + (end.x - start.x) * t + noise) * scale,
        (start.y + (end.y - start.y) * t + noise) * scale,
        (start.z + (end.z - start.z) * t + noise) * scale
      ));
    }

    // 분기
    const branches = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < branches; i++) {
      const newDir = direction.clone();
      newDir.applyAxisAngle(new THREE.Vector3(1, 0, 0), (Math.random() - 0.5) * 0.7);
      newDir.applyAxisAngle(new THREE.Vector3(0, 0, 1), (Math.random() - 0.5) * 0.7);
      addBranch(end, newDir, length * 0.65, depth + 1, maxDepth);
    }
  }

  // 여러 방향에서 시작
  const directions = [
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
  ];

  directions.forEach(dir => {
    addBranch(new THREE.Vector3(0, 0, 0), dir, radius * 0.4, 0, 4);
  });

  // 부족한 점 채우기
  while (points.length < count) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius * 0.25;
    points.push(new THREE.Vector3(
      r * Math.cos(angle) * scale,
      (Math.random() - 0.5) * radius * scale,
      r * Math.sin(angle) * scale
    ));
  }

  return points.slice(0, count);
}

// 신성 기하학 (Sacred Geometry) - 플라워 오브 라이프 기반
function generateSacredGeometryPoints(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];

  // 중앙 원 + 6개의 주변 원 (플라워 오브 라이프)
  const centers = [
    new THREE.Vector3(0, 0, 0),
  ];

  // 첫 번째 레이어
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    centers.push(new THREE.Vector3(
      radius * 0.5 * Math.cos(angle),
      radius * 0.5 * Math.sin(angle),
      0
    ));
  }

  // 두 번째 레이어
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
    centers.push(new THREE.Vector3(
      radius * 0.87 * Math.cos(angle),
      radius * 0.87 * Math.sin(angle),
      0
    ));
  }

  // 각 중심 주위에 점 배치
  const pointsPerCenter = Math.floor(count / centers.length);

  centers.forEach((center, ci) => {
    for (let i = 0; i < pointsPerCenter; i++) {
      const angle = (i / pointsPerCenter) * Math.PI * 2;
      const r = radius * 0.25 * (0.8 + Math.random() * 0.4);
      const zOffset = (Math.random() - 0.5) * radius * 0.3;
      const noise = (Math.random() - 0.5) * 0.05;

      points.push(new THREE.Vector3(
        center.x + r * Math.cos(angle) + noise,
        center.y + r * Math.sin(angle) + noise,
        zOffset + noise
      ));
    }
  });

  // 부족한 점 채우기
  while (points.length < count) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * radius;
    points.push(new THREE.Vector3(
      r * Math.cos(angle),
      r * Math.sin(angle),
      (Math.random() - 0.5) * radius * 0.3
    ));
  }

  return points.slice(0, count);
}

// ═══════════════════════════════════════════════════════════════════════
// 형태 생성 분기
// ═══════════════════════════════════════════════════════════════════════

function generateShapePoints(shape: ShapeType, count: number, radius: number, cities: CityData[]): THREE.Vector3[] {
  switch (shape) {
    case 'network': return generateNetworkPoints(count, cities);
    case 'sphere': return generateSpherePoints(count, radius);
    case 'torus': return generateTorusPoints(count, radius);
    case 'helix': return generateHelixPoints(count, radius);
    case 'sierpinski': return generateSierpinskiPoints(count, radius);
    case 'symmetricWave': return generateSymmetricWavePoints(count, radius);
    case 'fractalTree': return generateFractalTreePoints(count, radius);
    case 'sacredGeometry': return generateSacredGeometryPoints(count, radius);
    default: return generateNetworkPoints(count, cities);
  }
}

const SHAPES: ShapeType[] = ['network', 'sphere', 'torus', 'helix', 'sierpinski', 'symmetricWave', 'fractalTree', 'sacredGeometry'];

// ═══════════════════════════════════════════════════════════════════════
// 파티클 시스템 (대칭 움직임 + 파동 전파 적용)
// ═══════════════════════════════════════════════════════════════════════

function ParticleSystem({
  mousePosition,
  cities,
  currentShape,
  isInverted,
  wavePhase,
  showLines,
  isPointCloudMode
}: {
  mousePosition: React.MutableRefObject<{ x: number; y: number }>;
  cities: CityData[];
  currentShape: ShapeType;
  isInverted: boolean;
  wavePhase: number;
  showLines: boolean;
  isPointCloudMode: boolean;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const groupRef = useRef<THREE.Group>(null);

  const { viewport } = useThree();

  const currentPositions = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  const targetPositions = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  const displayPositions = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));

  const MAX_LINES = 2500;
  const linePositions = useRef(new Float32Array(MAX_LINES * 6));
  const lineGeometryRef = useRef<THREE.BufferGeometry>(null);
  const lineGeometryInitialized = useRef(false);

  const sizes = useMemo(() => {
    const initialPoints = generateShapePoints('network', PARTICLE_COUNT, SHAPE_RADIUS, cities);
    initialPoints.forEach((point, i) => {
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
      sizes[i] = 0.035 + Math.random() * 0.025;
    }
    return sizes;
  }, [cities]);

  // 형태 변경 시 타겟 위치 업데이트
  useEffect(() => {
    const newPoints = generateShapePoints(currentShape, PARTICLE_COUNT, SHAPE_RADIUS, cities);
    newPoints.forEach((point, i) => {
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

    const vw = viewport.width || 1;
    const vh = viewport.height || 1;
    const mouseX = (mousePosition.current.x / vw) * 4;
    const mouseY = (mousePosition.current.y / vh) * 4;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const tx = targetPositions.current[i * 3] || 0;
      const ty = targetPositions.current[i * 3 + 1] || 0;
      const tz = targetPositions.current[i * 3 + 2] || 0;

      // 모핑 (이징)
      currentPositions.current[i * 3] += (tx - currentPositions.current[i * 3]) * ANIMATION_SPEED;
      currentPositions.current[i * 3 + 1] += (ty - currentPositions.current[i * 3 + 1]) * ANIMATION_SPEED;
      currentPositions.current[i * 3 + 2] += (tz - currentPositions.current[i * 3 + 2]) * ANIMATION_SPEED;

      // NaN 체크
      if (!isFinite(currentPositions.current[i * 3])) currentPositions.current[i * 3] = tx;
      if (!isFinite(currentPositions.current[i * 3 + 1])) currentPositions.current[i * 3 + 1] = ty;
      if (!isFinite(currentPositions.current[i * 3 + 2])) currentPositions.current[i * 3 + 2] = tz;

      const cx = currentPositions.current[i * 3];
      const cy = currentPositions.current[i * 3 + 1];
      const cz = currentPositions.current[i * 3 + 2];

      // ═══════════════════════════════════════════════════════════════
      // 파동 전파 효과 (중심에서 퍼져나감)
      // ═══════════════════════════════════════════════════════════════
      const distFromCenter = Math.sqrt(cx * cx + cy * cy + cz * cz) || 0.001;
      // wavePhase를 안전한 범위로 유지
      const safeWavePhase = wavePhase % (Math.PI * 2);
      const waveOffset = Math.sin(time * 2 - distFromCenter * 1.5 + safeWavePhase) * 0.06;
      const radialPush = Math.min(Math.max(waveOffset * 0.3, -0.1), 0.1);

      // ═══════════════════════════════════════════════════════════════
      // 대칭 움직임 (중앙 기준 반사)
      // ═══════════════════════════════════════════════════════════════
      const symmetryFactor = Math.sin(time * 0.5) * 0.02;
      const mirrorX = cx > 0 ? symmetryFactor : -symmetryFactor;
      const mirrorY = cy > 0 ? symmetryFactor : -symmetryFactor;

      // 호흡 효과
      const breathe = 1 + Math.sin(time * 0.4 + i * 0.05) * 0.012;

      // 미세 진동
      const vibrationX = Math.sin(time * 1.5 + i * 0.3) * 0.006;
      const vibrationY = Math.cos(time * 1.2 + i * 0.4) * 0.006;

      // 마우스 인터랙션
      const dx = cx - mouseX;
      const dy = cy - mouseY;
      const distToMouse = Math.sqrt(dx * dx + dy * dy) || 1;
      const mouseInfluence = Math.max(0, 1 - distToMouse / 2.5) * 0.1;
      const pushX = dx * mouseInfluence * 0.2;
      const pushY = dy * mouseInfluence * 0.2;

      // 최종 위치 계산 (안전한 범위로 클램핑)
      let finalX = cx * breathe + vibrationX + pushX + mirrorX + radialPush;
      let finalY = cy * breathe + vibrationY + pushY + mirrorY + radialPush;
      let finalZ = cz * breathe + radialPush * 0.5;

      // NaN/Infinity 방지
      if (!isFinite(finalX)) finalX = cx;
      if (!isFinite(finalY)) finalY = cy;
      if (!isFinite(finalZ)) finalZ = cz;

      displayPositions.current[i * 3] = finalX;
      displayPositions.current[i * 3 + 1] = finalY;
      displayPositions.current[i * 3 + 2] = finalZ;

      positionAttribute.setXYZ(i, finalX, finalY, finalZ);

      // 크기 맥동 (파동과 연동)
      const sizePulse = 1 + Math.sin(time * 1.5 - distFromCenter * 0.8) * 0.25;
      sizeAttribute.setX(i, sizes[i] * sizePulse * (1 + mouseInfluence * 0.15));
    }

    positionAttribute.needsUpdate = true;
    sizeAttribute.needsUpdate = true;

    // 연결선 업데이트
    if (!lineGeometryRef.current) return;
    const lineGeometry = lineGeometryRef.current;

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

    // 천천히 회전 (카메라 이동이 있으므로 최소화)
    groupRef.current.rotation.y += 0.0004;
  });

  return (
    <group ref={groupRef}>
      {/* 점을 먼저 렌더링 (뒤에) */}
      <points ref={pointsRef} frustumCulled={false} renderOrder={1}>
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
          key={`${isInverted}-${isPointCloudMode}`}
          transparent
          depthWrite={false}
          depthTest={false}
          uniforms={{
            uColor: { value: new THREE.Color(isInverted ? '#dddddd' : '#222222') },
            uColorSmall: { value: new THREE.Color(isInverted ? '#888888' : '#666666') },
            uColorLarge: { value: new THREE.Color(isInverted ? '#ffffff' : '#000000') },
            uPointCloudMode: { value: isPointCloudMode ? 1.0 : 0.0 }
          }}
          vertexShader={`
            attribute float size;
            uniform float uPointCloudMode;
            varying float vSize;
            void main() {
              vSize = size;
              vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
              gl_Position = projectionMatrix * mvPosition;
              // 포인트 클라우드 모드에서는 작은 점 크기 증가
              float sizeMultiplier = uPointCloudMode > 0.5 ? 900.0 : 650.0;
              gl_PointSize = size * sizeMultiplier / -mvPosition.z;
            }
          `}
          fragmentShader={`
            uniform vec3 uColor;
            uniform vec3 uColorSmall;
            uniform vec3 uColorLarge;
            uniform float uPointCloudMode;
            varying float vSize;
            void main() {
              float dist = length(gl_PointCoord - vec2(0.5));
              if (dist > 0.5) discard;

              // 포인트 클라우드 모드: 큰 점은 숨기고 작은 점만 표시
              float sizeFactor = smoothstep(0.035, 0.06, vSize);
              if (uPointCloudMode > 0.5 && sizeFactor > 0.35) discard;

              float alpha = 1.0 - smoothstep(0.0, 0.5, dist);

              // 색상 설정
              vec3 finalColor = uColor;
              if (uPointCloudMode > 0.5) {
                finalColor = uColorSmall;
                alpha *= 1.2; // 더 진하게
              }

              gl_FragColor = vec4(finalColor, alpha * 0.85);
            }
          `}
        />
      </points>

      {/* 선을 나중에 렌더링 (앞에) - showLines에 따라 표시 */}
      <lineSegments ref={linesRef} frustumCulled={false} renderOrder={2} visible={showLines}>
        <bufferGeometry ref={lineGeometryRef} />
        <lineBasicMaterial
          color={isInverted ? "#666666" : "#888888"}
          transparent
          opacity={0.5}
          depthWrite={false}
          depthTest={false}
        />
      </lineSegments>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 카메라 컨트롤러 - 3D 각도 변화 (곡선 움직임)
// ═══════════════════════════════════════════════════════════════════════

// 이징 함수 - ease in out cubic
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// 3차 베지어 곡선 보간
function bezierInterpolate(
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
  control1: { x: number; y: number; z: number },
  control2: { x: number; y: number; z: number },
  t: number
): { x: number; y: number; z: number } {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;

  return {
    x: mt3 * start.x + 3 * mt2 * t * control1.x + 3 * mt * t2 * control2.x + t3 * end.x,
    y: mt3 * start.y + 3 * mt2 * t * control1.y + 3 * mt * t2 * control2.y + t3 * end.y,
    z: mt3 * start.z + 3 * mt2 * t * control1.z + 3 * mt * t2 * control2.z + t3 * end.z,
  };
}

function CameraController({ cameraAngle, onMoving, isPointCloudMode }: { cameraAngle: number; onMoving: (moving: boolean) => void; isPointCloudMode: boolean }) {
  const { camera } = useThree();

  // 카메라 상태
  const startPosition = useRef({ x: 0, y: 0, z: 8 });
  const targetPosition = useRef({ x: 0, y: 0, z: 8 });
  const controlPoint1 = useRef({ x: 0, y: 0, z: 8 });
  const controlPoint2 = useRef({ x: 0, y: 0, z: 8 });
  const progress = useRef(1); // 0~1 애니메이션 진행도
  const isFirstRender = useRef(true);

  // 카메라 각도에 따른 위치 계산
  useEffect(() => {
    // 포인트 클라우드 모드에서는 훨씬 더 가까이
    const radius = isPointCloudMode ? 3.5 : 8;
    const angleIndex = cameraAngle % 8;

    // 8가지 부드러운 카메라 앵글
    const angles = [
      { x: 0, y: 0, z: radius },                               // 정면
      { x: radius * 0.5, y: radius * 0.3, z: radius * 0.75 },  // 우상단
      { x: -radius * 0.4, y: radius * 0.35, z: radius * 0.8 }, // 좌상단
      { x: 0, y: radius * 0.5, z: radius * 0.7 },              // 위에서
      { x: radius * 0.45, y: -radius * 0.25, z: radius * 0.8 },// 우하단
      { x: -radius * 0.5, y: -radius * 0.2, z: radius * 0.75 },// 좌하단
      { x: -radius * 0.35, y: 0, z: radius * 0.9 },            // 좌측
      { x: radius * 0.4, y: 0.1, z: radius * 0.85 },           // 우측
    ];

    const newTarget = angles[angleIndex];

    // 첫 렌더링이 아닐 때만 애니메이션 시작
    if (!isFirstRender.current) {
      // 현재 위치를 시작점으로
      startPosition.current = { ...targetPosition.current };

      // 새 타겟 설정
      targetPosition.current = newTarget;

      // 제어점 계산 - 부드러운 곡선 경로
      const midX = (startPosition.current.x + newTarget.x) / 2;
      const midY = (startPosition.current.y + newTarget.y) / 2;
      const midZ = (startPosition.current.z + newTarget.z) / 2;

      // 적당히 휘어지는 경로
      const swingAmount = radius * 0.3;
      const swingAngle = Math.random() * Math.PI * 2;

      controlPoint1.current = {
        x: midX + Math.cos(swingAngle) * swingAmount * 0.5,
        y: midY + Math.sin(swingAngle) * swingAmount * 0.5,
        z: midZ + swingAmount * 0.4,
      };

      controlPoint2.current = {
        x: midX + Math.cos(swingAngle + Math.PI * 0.2) * swingAmount * 0.3,
        y: midY + Math.sin(swingAngle + Math.PI * 0.2) * swingAmount * 0.3,
        z: midZ + swingAmount * 0.2,
      };

      // 애니메이션 리셋
      progress.current = 0;
    } else {
      isFirstRender.current = false;
      targetPosition.current = newTarget;
      startPosition.current = newTarget;
    }
  }, [cameraAngle, isPointCloudMode]);

  const wasMoving = useRef(false);

  useFrame(() => {
    // 애니메이션 진행
    const isMoving = progress.current < 1;

    if (isMoving) {
      progress.current = Math.min(progress.current + 0.008, 1); // 더 천천히

      // 이징 적용된 진행도
      const easedProgress = easeInOutCubic(progress.current);

      // 베지어 곡선으로 위치 계산
      const pos = bezierInterpolate(
        startPosition.current,
        targetPosition.current,
        controlPoint1.current,
        controlPoint2.current,
        easedProgress
      );

      camera.position.set(pos.x, pos.y, pos.z);
    }

    // 움직임 상태 변경 시 콜백
    if (wasMoving.current !== isMoving) {
      wasMoving.current = isMoving;
      onMoving(isMoving);
    }

    camera.lookAt(0, 0, 0);
  });

  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// Scene 컴포넌트
// ═══════════════════════════════════════════════════════════════════════

function Scene({
  cities,
  mousePosition,
  currentShape,
  isInverted,
  wavePhase,
  cameraAngle,
  onCameraMoving,
  showLines
}: {
  cities: CityData[];
  mousePosition: React.MutableRefObject<{ x: number; y: number }>;
  currentShape: ShapeType;
  isInverted: boolean;
  wavePhase: number;
  cameraAngle: number;
  onCameraMoving: (moving: boolean) => void;
  showLines: boolean;
}) {
  const isPointCloudMode = !showLines;
  return (
    <>
      <CameraController cameraAngle={cameraAngle} onMoving={onCameraMoving} isPointCloudMode={isPointCloudMode} />
      <ParticleSystem
        mousePosition={mousePosition}
        cities={cities}
        currentShape={currentShape}
        isInverted={isInverted}
        wavePhase={wavePhase}
        showLines={showLines}
        isPointCloudMode={!showLines}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════════════════════════════════════

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
  const [isInverted, setIsInverted] = useState(false);
  const [wavePhase, setWavePhase] = useState(0);
  const [cameraAngle, setCameraAngle] = useState(0);
  const [isBlurred, setIsBlurred] = useState(false);
  const [showLines, setShowLines] = useState(true);
  const shapeChangeCount = useRef(0);

  // 카메라 움직임에 따른 블러 콜백
  const handleCameraMoving = useCallback((moving: boolean) => {
    setIsBlurred(moving);
  }, []);

  useEffect(() => {
    setIsLoaded(true);

    // 모든 변화를 동기화 - 형태 변경과 함께 카메라도 이동
    const mainInterval = setInterval(() => {
      shapeChangeCount.current++;
      const count = shapeChangeCount.current;

      // 형태 변경 시 파동 트리거
      setWavePhase(prev => prev + Math.PI);

      // 형태 변경
      setCurrentShape(prev => {
        if (prev === 'network') {
          const others = SHAPES.filter(s => s !== 'network');
          return others[Math.floor(Math.random() * others.length)];
        }
        return 'network';
      });

      // 카메라 각도도 함께 변경
      setCameraAngle(prev => prev + 1);

      // 색상 반전 (5번에 한 번만)
      if (count % 5 === 0) {
        setIsInverted(prev => !prev);
      }

      // 포인트 클라우드 모드 (4번에 한 번만, 25% 확률)
      if (count % 4 === 0) {
        setShowLines(false);
      } else {
        setShowLines(true);
      }

    }, SHAPE_CHANGE_INTERVAL);

    return () => {
      clearInterval(mainInterval);
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
        background: isInverted ? '#080808' : '#fafafa',
        position: 'relative',
        overflow: 'hidden',
        opacity: isLoaded ? 1 : 0,
        transition: 'opacity 1s ease-in-out, background 1.8s ease-in-out'
      }}
    >
      {/* 노이즈 텍스처 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        opacity: 0.018,
        pointerEvents: 'none',
        zIndex: 1
      }} />

      <div style={{
        filter: isBlurred ? 'blur(3px)' : 'blur(0px)',
        transition: 'filter 0.3s ease-out',
        width: '100%',
        height: '100%',
      }}>
        <Canvas
          camera={{ position: [0, 0, 8], fov: 45 }}
          style={{ background: 'transparent' }}
          gl={{ antialias: true, alpha: true }}
        >
          <Scene
            cities={cities}
            mousePosition={mousePosition}
            currentShape={currentShape}
            isInverted={isInverted}
            wavePhase={wavePhase}
            cameraAngle={cameraAngle}
            onCameraMoving={handleCameraMoving}
            showLines={showLines}
          />
        </Canvas>
      </div>

      {/* 비네팅 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: isInverted
          ? 'radial-gradient(ellipse at center, transparent 25%, rgba(8,8,8,0.9) 100%)'
          : 'radial-gradient(ellipse at center, transparent 25%, rgba(250,250,250,0.9) 100%)',
        pointerEvents: 'none',
        zIndex: 2,
        transition: 'background 1.8s ease-in-out'
      }} />
    </div>
  );
};

export default GeometricParticles;
