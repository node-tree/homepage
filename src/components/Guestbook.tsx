import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { guestbookAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './Guestbook.css';

// [js-hoist-regexp] 상수를 컴포넌트 외부로 호이스팅
const PARTICLE_COUNT = 2000;
const FORMATION_PARTICLE_COUNT = 1200;

const STATE_DURATION = {
  free: 300,
  text: 900,
  shape: 1600
} as const;

const FLASH_DURATION = 16;

const VIEW_CONFIGS = [
  { rx: 0, ry: 0, rz: 0, zoom: 2.5 },
  { rx: 0.6, ry: 0.3, rz: 0, zoom: 12.0 },
  { rx: -0.4, ry: -0.5, rz: 0.1, zoom: 5.0 },
  { rx: 0.2, ry: 1.2, rz: 0, zoom: 18.0 },
  { rx: 0.1, ry: -0.8, rz: -0.1, zoom: 8.0 },
  { rx: 0.9, ry: 0.6, rz: 0.2, zoom: 15.0 },
] as const;

const GOOD_SHAPES = [3, 5, 6, 7, 8, 9, 10, 11, 12] as const;

// [rerender-lazy-state-init] 날짜 포맷 옵션 호이스팅
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
};

// [rendering-hoist-jsx] 정적 JSX 호이스팅
const LoadingOrb = <div className="loading-orb" />;
const EmptyIcon = <div className="empty-icon">&#9734;</div>;

interface GuestbookEntry {
  id: string;
  name: string;
  message: string;
  seed: number;
  colorIndex: number;
  createdAt: string;
}

// 파티클 인터페이스
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
}

// [rerender-memo] 방명록 카드 컴포넌트 메모이제이션
interface GuestbookCardProps {
  entry: GuestbookEntry;
  index: number;
  isAuthenticated: boolean;
  deleting: string | null;
  onSelect: (entry: GuestbookEntry) => void;
  onDelete: (id: string, name: string) => void;
}

const GuestbookCard = memo<GuestbookCardProps>(({
  entry,
  index,
  isAuthenticated,
  deleting,
  onSelect,
  onDelete
}) => (
  <motion.article
    className="guestbook-card clickable"
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{
      delay: index * 0.03,
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1]
    }}
    whileHover={{
      scale: 1.08,
      transition: { duration: 0.2 }
    }}
    onClick={() => onSelect(entry)}
  >
    <span className="card-name">{entry.name}</span>
    {isAuthenticated && (
      <button
        className="card-delete-btn"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(entry.id, entry.name);
        }}
        disabled={deleting === entry.id}
        title="삭제"
      >
        {deleting === entry.id ? '...' : '×'}
      </button>
    )}
  </motion.article>
));

GuestbookCard.displayName = 'GuestbookCard';

const Guestbook: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<GuestbookEntry | null>(null);

  // 풀스크린 토글
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('풀스크린 전환 실패:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.error('풀스크린 해제 실패:', err);
      });
    }
  };

  // 풀스크린 상태 감지
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);


  // 방명록 불러오기
  useEffect(() => {
    const loadEntries = async () => {
      try {
        const response = await guestbookAPI.getAll();
        if (response.success) {
          setEntries(response.data);
        }
      } catch (error) {
        console.error('방명록 로딩 오류:', error);
      } finally {
        setLoading(false);
      }
    };
    loadEntries();
  }, []);

  // Reconnect 컨셉 배경 애니메이션 - 파티클이 텍스트와 도형을 형성
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 상태: 'free' | 'text' | 'shape'
    type FormationState = 'free' | 'text' | 'shape';
    let currentState: FormationState = 'free';
    let stateTimer = 0;
    let currentShapeIndex = 0;
    let textTargets: { x: number; y: number }[] = [];
    let currentTextIndex = 0; // 0: Reconnect, 1: 낙원식당
    let flashTimer = 0;

    // 텍스트에서 좌표 추출 (번갈아가며 표시)
    const getTextCoordinates = (centerX: number, centerY: number, textIndex: number) => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return [];

      tempCtx.fillStyle = 'white';
      tempCtx.textAlign = 'center';
      tempCtx.textBaseline = 'middle';

      if (textIndex === 0) {
        // Reconnect
        const fontSize = Math.min(canvas.width / 6, 150);
        tempCtx.font = `bold ${fontSize}px "IBM Plex Mono", monospace`;
        tempCtx.fillText('Reconnect', centerX, centerY);
      } else {
        // 낙원식당
        const fontSize = Math.min(canvas.width / 8, 120);
        tempCtx.font = `bold ${fontSize}px "Noto Sans KR", sans-serif`;
        tempCtx.fillText('낙원식당', centerX, centerY);
      }

      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const coords: { x: number; y: number }[] = [];
      const gap = 4;

      for (let y = 0; y < tempCanvas.height; y += gap) {
        for (let x = 0; x < tempCanvas.width; x += gap) {
          const index = (y * tempCanvas.width + x) * 4;
          if (imageData.data[index + 3] > 128) {
            coords.push({ x, y });
          }
        }
      }
      return coords;
    };

    // VIEW_CONFIGS는 컴포넌트 외부에 호이스팅됨

    // 3D 회전만 적용 (투영 전)
    const rotate3D = (x: number, y: number, z: number, rotX: number, rotY: number, rotZ: number) => {
      // X축 회전
      let y1 = y * Math.cos(rotX) - z * Math.sin(rotX);
      let z1 = y * Math.sin(rotX) + z * Math.cos(rotX);
      // Y축 회전
      let x2 = x * Math.cos(rotY) + z1 * Math.sin(rotY);
      let z2 = -x * Math.sin(rotY) + z1 * Math.cos(rotY);
      // Z축 회전
      let x3 = x2 * Math.cos(rotZ) - y1 * Math.sin(rotZ);
      let y3 = x2 * Math.sin(rotZ) + y1 * Math.cos(rotZ);
      return { x: x3, y: y3, z: z2 };
    };

    // 3D 좌표를 2D로 투영 (회전 후)
    const projectTo2D = (x: number, y: number, z: number, centerX: number, centerY: number) => {
      // z값을 앞으로 제한
      const z2 = Math.max(z, -100);
      const perspective = 600;
      const factor = perspective / (perspective + z2);
      return {
        x: centerX + x * factor,
        y: centerY + y * factor
      };
    };

    // 특정 뷰포트용 좌표 생성 (카메라가 항상 도형 중심을 바라봄)
    const getShapeForView = (shapeType: number, centerX: number, centerY: number, size: number, time: number, viewIndex: number) => {
      const raw3DCoords: { x: number; y: number; z: number }[] = [];
      const pointCount = FORMATION_PARTICLE_COUNT;

      // 기본 회전 + 뷰별 추가 회전
      const view = VIEW_CONFIGS[viewIndex];
      const rotX = time * 0.15 + view.rx;
      const rotY = time * 0.2 + view.ry;
      const rotZ = time * 0.1 + view.rz;
      const zoomedSize = size * view.zoom;

      // 1단계: 3D 좌표 생성 (원점 중심)
      const baseCoords: { x: number; y: number; z: number }[] = [];
      switch (shapeType) {
        case 0: // 뒤틀린 메쉬
          for (let i = 0; i < pointCount; i++) {
            const u = (i % 25) / 25;
            const v = Math.floor(i / 25) / (pointCount / 25);
            const twist = Math.sin(v * Math.PI * 2 + time * 0.5) * 0.5;
            const x = (u - 0.5) * zoomedSize * 0.8;
            const y = (v - 0.5) * zoomedSize * 0.8;
            const z = Math.sin(u * Math.PI * 3 + time * 0.3) * Math.cos(v * Math.PI * 2) * zoomedSize * 0.2;
            const rx = x * Math.cos(twist) - z * Math.sin(twist);
            const rz = x * Math.sin(twist) + z * Math.cos(twist);
            baseCoords.push({ x: rx, y, z: rz });
          }
          break;
        case 1: // 파동 표면
          for (let i = 0; i < pointCount; i++) {
            const u = (i % 20) / 20 * Math.PI * 2;
            const v = Math.floor(i / 20) / (pointCount / 20) * Math.PI * 2;
            const r = zoomedSize * 0.35 * (1 + 0.2 * Math.sin(u * 3 + time * 0.4) * Math.sin(v * 2));
            const x = r * Math.cos(u) * Math.sin(v);
            const y = r * Math.cos(v);
            const z = r * Math.sin(u) * Math.sin(v) * 0.5;
            baseCoords.push({ x, y, z });
          }
          break;
        case 2: // 나선형
          for (let i = 0; i < pointCount; i++) {
            const t = i / pointCount;
            const angle = t * Math.PI * 2 * 4;
            const r = zoomedSize * 0.25 * (0.3 + t * 0.7);
            const x = Math.cos(angle) * r;
            const y = (t - 0.5) * zoomedSize * 0.6;
            const z = Math.sin(angle) * r * 0.5;
            baseCoords.push({ x, y, z });
          }
          break;
        case 3: // 클러스터
          for (let i = 0; i < pointCount; i++) {
            const seed = i * 1.618033988749;
            const theta = seed * Math.PI * 2;
            const phi = Math.acos(2 * ((seed * 0.618) % 1) - 1);
            const r = zoomedSize * 0.3 * (0.7 + 0.3 * Math.sin(theta * 5 + time * 0.3));
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi) * 0.5;
            baseCoords.push({ x, y, z });
          }
          break;
        case 4: // 토러스
          for (let i = 0; i < pointCount; i++) {
            const u = (i % 30) / 30 * Math.PI * 2;
            const v = Math.floor(i / 30) / (pointCount / 30) * Math.PI * 2;
            const R = zoomedSize * 0.3;
            const r = zoomedSize * 0.12;
            const x = (R + r * Math.cos(v)) * Math.cos(u);
            const y = (R + r * Math.cos(v)) * Math.sin(u);
            const z = r * Math.sin(v) * 0.5;
            baseCoords.push({ x, y, z });
          }
          break;
        case 5: // 구
          for (let i = 0; i < pointCount; i++) {
            const theta = i * 1.618033988749 * Math.PI * 2;
            const phi = Math.acos(2 * (i / pointCount) - 1);
            const r = zoomedSize * 0.35;
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi) * 0.5;
            baseCoords.push({ x, y, z });
          }
          break;
        case 6: // 큐브
          for (let i = 0; i < pointCount; i++) {
            const face = Math.floor((i / pointCount) * 6);
            const idx = i % Math.ceil(pointCount / 6);
            const gridN = Math.ceil(Math.sqrt(pointCount / 6));
            const u = (idx % gridN) / gridN - 0.5;
            const v = Math.floor(idx / gridN) / gridN - 0.5;
            const s = zoomedSize * 0.3;
            let x = 0, y = 0, z = 0;
            switch (face) {
              case 0: x = u * s; y = v * s; z = s * 0.5; break;
              case 1: x = u * s; y = v * s; z = -s * 0.5; break;
              case 2: x = s * 0.5; y = u * s; z = v * s * 0.5; break;
              case 3: x = -s * 0.5; y = u * s; z = v * s * 0.5; break;
              case 4: x = u * s; y = s * 0.5; z = v * s * 0.5; break;
              case 5: x = u * s; y = -s * 0.5; z = v * s * 0.5; break;
            }
            baseCoords.push({ x, y, z });
          }
          break;
        case 7: // 하트 곡선
          for (let i = 0; i < pointCount; i++) {
            const t = (i / pointCount) * Math.PI * 2;
            const scale = zoomedSize * 0.018;
            const x = 16 * Math.pow(Math.sin(t), 3) * scale;
            const y = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) * scale;
            const z = Math.sin(t * 3) * zoomedSize * 0.1;
            baseCoords.push({ x, y, z });
          }
          break;
        case 8: // 꽃 모양 (로즈 커브)
          for (let i = 0; i < pointCount; i++) {
            const t = (i / pointCount) * Math.PI * 2 * 3;
            const k = 5;
            const r = zoomedSize * 0.35 * Math.cos(k * t);
            const x = r * Math.cos(t);
            const y = r * Math.sin(t);
            const z = Math.sin(t * 2) * zoomedSize * 0.15;
            baseCoords.push({ x, y, z });
          }
          break;
        case 9: // 물결 구체
          for (let i = 0; i < pointCount; i++) {
            const theta = i * 1.618033988749 * Math.PI * 2;
            const phi = Math.acos(2 * (i / pointCount) - 1);
            const wave = 1 + 0.2 * Math.sin(phi * 8 + time * 0.5);
            const r = zoomedSize * 0.32 * wave;
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi) * 0.5;
            baseCoords.push({ x, y, z });
          }
          break;
        case 10: // DNA 이중나선
          for (let i = 0; i < pointCount; i++) {
            const t = (i / pointCount) * Math.PI * 4;
            const strand = i % 2;
            const offset = strand * Math.PI;
            const r = zoomedSize * 0.2;
            const x = Math.cos(t + offset) * r;
            const y = (i / pointCount - 0.5) * zoomedSize * 0.7;
            const z = Math.sin(t + offset) * r * 0.5;
            baseCoords.push({ x, y, z });
          }
          break;
        case 11: // 별 모양
          for (let i = 0; i < pointCount; i++) {
            const t = (i / pointCount) * Math.PI * 2;
            const spikes = 5;
            const innerR = zoomedSize * 0.15;
            const outerR = zoomedSize * 0.35;
            const r = (i % 2 === 0) ? outerR : innerR;
            const angle = t * spikes;
            const x = Math.cos(angle) * r * (0.5 + 0.5 * Math.cos(t * spikes));
            const y = Math.sin(angle) * r * (0.5 + 0.5 * Math.cos(t * spikes));
            const z = Math.sin(t * 3) * zoomedSize * 0.1;
            baseCoords.push({ x, y, z });
          }
          break;
        case 12: // 소용돌이
          for (let i = 0; i < pointCount; i++) {
            const t = i / pointCount;
            const angle = t * Math.PI * 6;
            const r = t * zoomedSize * 0.35;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            const z = (t - 0.5) * zoomedSize * 0.3;
            baseCoords.push({ x, y, z });
          }
          break;
      }

      // 2단계: 3D 회전 적용
      for (const coord of baseCoords) {
        raw3DCoords.push(rotate3D(coord.x, coord.y, coord.z, rotX, rotY, rotZ));
      }

      // 3단계: 회전된 3D 좌표의 중심점 계산
      let sumX = 0, sumY = 0, sumZ = 0;
      for (const coord of raw3DCoords) {
        sumX += coord.x;
        sumY += coord.y;
        sumZ += coord.z;
      }
      const centroid3D = {
        x: sumX / raw3DCoords.length,
        y: sumY / raw3DCoords.length,
        z: sumZ / raw3DCoords.length
      };

      // 4단계: 중심점을 원점으로 이동 후 2D 투영
      return raw3DCoords.map(coord => {
        const centered = {
          x: coord.x - centroid3D.x,
          y: coord.y - centroid3D.y,
          z: coord.z - centroid3D.z
        };
        return projectTo2D(centered.x, centered.y, centered.z, centerX, centerY);
      });
    };

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
      updateTargets();
    };

    const updateTargets = () => {
      // 텍스트 타겟 업데이트 (현재 텍스트 인덱스 사용)
      textTargets = getTextCoordinates(
        canvas.width / 2,
        canvas.height / 2,
        currentTextIndex
      );
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const initParticles = () => {
      particlesRef.current = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          size: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.6 + 0.2,
          life: Math.random() * 1000
        });
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      if (!ctx || !canvas) return;

      frameRef.current += 1;
      const time = frameRef.current * 0.01;
      stateTimer++;

      // 상태 전환
      if (stateTimer > STATE_DURATION[currentState]) {
        stateTimer = 0;
        if (currentState === 'free') {
          currentState = Math.random() > 0.5 ? 'text' : 'shape';
          if (currentState === 'shape') {
            // GOOD_SHAPES는 컴포넌트 외부에 호이스팅됨
            currentShapeIndex = GOOD_SHAPES[Math.floor(Math.random() * GOOD_SHAPES.length)];
            flashTimer = FLASH_DURATION; // 도형 형성 시 플래시!
          } else {
            // 텍스트 번갈아 표시 (Reconnect <-> 낙원식당)
            currentTextIndex = (currentTextIndex + 1) % 2;
            textTargets = getTextCoordinates(canvas.width / 2, canvas.height / 2, currentTextIndex);
            flashTimer = FLASH_DURATION; // 텍스트 형성 시 플래시!
          }
        } else {
          currentState = 'free';
          flashTimer = FLASH_DURATION; // 배경으로 돌아올 때도 플래시!
          particlesRef.current.forEach((p, i) => {
            if (i < FORMATION_PARTICLE_COUNT) {
              const angle = Math.random() * Math.PI * 2;
              const speed = 1 + Math.random() * 2;
              p.vx = Math.cos(angle) * speed;
              p.vy = Math.sin(angle) * speed;
            }
          });
        }
      }

      // 플래시 효과 감소
      if (flashTimer > 0) {
        flashTimer--;
      }

      // 플래시 강도 계산 (두 번 깜박임: 켜-꺼-켜-꺼)
      // 16-13: 켜 (1), 12-9: 꺼 (0), 8-5: 켜 (1), 4-1: 꺼 (0)
      let flashIntensity = 0;
      if (flashTimer > 12) {
        flashIntensity = 1; // 첫 번째 깜박임 ON
      } else if (flashTimer > 8) {
        flashIntensity = 0; // 첫 번째 깜박임 OFF
      } else if (flashTimer > 4) {
        flashIntensity = 1; // 두 번째 깜박임 ON
      } else {
        flashIntensity = 0; // 두 번째 깜박임 OFF
      }

      // 배경 클리어 (플래시 시 어두워짐) - 잔상 효과 제거
      const bgBrightness = Math.round(250 - flashIntensity * 230); // 250 -> 20
      ctx.fillStyle = `rgba(${bgBrightness}, ${bgBrightness}, ${bgBrightness}, 1)`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const particleColor = Math.round(flashIntensity * 255);

      // 텍스트 상태: 전체 화면에 렌더링 (뷰포트 분할 없음)
      if (currentState === 'text') {
        // 파티클 업데이트
        particles.forEach((p, i) => {
          const isFormationParticle = i < FORMATION_PARTICLE_COUNT;
          if (isFormationParticle && textTargets.length > 0) {
            // 텍스트 좌표를 파티클 수에 맞게 균등 분배
            const targetIndex = Math.floor((i / FORMATION_PARTICLE_COUNT) * textTargets.length);
            const target = textTargets[Math.min(targetIndex, textTargets.length - 1)];
            const oscillation = 3;
            const offsetX = Math.sin(time * 2 + i * 0.5) * oscillation;
            const offsetY = Math.cos(time * 2.5 + i * 0.3) * oscillation;
            const finalX = target.x + offsetX;
            const finalY = target.y + offsetY;
            p.x += (finalX - p.x) * 0.06;
            p.y += (finalY - p.y) * 0.06;
          } else {
            p.vx += Math.sin(time + i * 0.1) * 0.01;
            p.vy += Math.cos(time + i * 0.15) * 0.01;
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
          }
          p.life += 1;
        });

        // 스피어 그리기 헬퍼 함수 (투명도 없음)
        const drawSphere = (x: number, y: number, radius: number, baseColor: number) => {
          const gradient = ctx.createRadialGradient(
            x - radius * 0.3, y - radius * 0.3, radius * 0.1,
            x, y, radius
          );
          const highlightColor = Math.min(baseColor + 80, 255);
          const shadowColor = Math.max(baseColor - 40, 0);
          gradient.addColorStop(0, `rgb(${highlightColor}, ${highlightColor}, ${highlightColor})`);
          gradient.addColorStop(0.5, `rgb(${baseColor}, ${baseColor}, ${baseColor})`);
          gradient.addColorStop(1, `rgb(${shadowColor}, ${shadowColor}, ${shadowColor})`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        };

        // 파티클 렌더링
        particles.forEach((p, i) => {
          const isFormationParticle = i < FORMATION_PARTICLE_COUNT;
          const pulse = Math.sin(time * 2 + p.life * 0.01) * 0.3 + 0.7;
          if (isFormationParticle && textTargets.length > 0) {
            // 검정색 스피어 (플래시 시에만 흰색)
            const color = particleColor > 0 ? particleColor : 30;
            drawSphere(p.x, p.y, p.size * 1.5, color);
          } else {
            drawSphere(p.x, p.y, p.size * pulse, 40);
          }
        });

        // 텍스트 연결선 그리기
        const formationParticles = particles.slice(0, FORMATION_PARTICLE_COUNT);
        const lineColor = particleColor > 0 ? particleColor : 0;

        // 먼 거리 연결
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${lineColor}, ${lineColor}, ${lineColor}, 0.15)`;
        ctx.lineWidth = 0.15;
        for (let i = 0; i < formationParticles.length; i += 4) {
          for (let j = i + 1; j < formationParticles.length; j += 4) {
            const dx = formationParticles[i].x - formationParticles[j].x;
            const dy = formationParticles[i].y - formationParticles[j].y;
            const distSq = dx * dx + dy * dy;
            if (distSq < 8000 && distSq > 2000) {
              ctx.moveTo(formationParticles[i].x, formationParticles[i].y);
              ctx.lineTo(formationParticles[j].x, formationParticles[j].y);
            }
          }
        }
        ctx.stroke();

        // 가까운 연결
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${lineColor}, ${lineColor}, ${lineColor}, 0.3)`;
        ctx.lineWidth = 0.25;
        for (let i = 0; i < formationParticles.length; i += 2) {
          for (let j = i + 1; j < formationParticles.length; j += 2) {
            const dx = formationParticles[i].x - formationParticles[j].x;
            const dy = formationParticles[i].y - formationParticles[j].y;
            const distSq = dx * dx + dy * dy;
            if (distSq < 2000) {
              ctx.moveTo(formationParticles[i].x, formationParticles[i].y);
              ctx.lineTo(formationParticles[j].x, formationParticles[j].y);
            }
          }
        }
        ctx.stroke();

        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      // 도형/자유 상태: 6개 뷰포트 분할 렌더링
      const cols = 3;
      const rows = 2;
      const cellW = canvas.width / cols;
      const cellH = canvas.height / rows;
      const gap = 2;

      for (let viewIdx = 0; viewIdx < 6; viewIdx++) {
        const col = viewIdx % cols;
        const row = Math.floor(viewIdx / cols);
        const vpX = col * cellW + gap;
        const vpY = row * cellH + gap;
        const vpW = cellW - gap * 2;
        const vpH = cellH - gap * 2;
        const vpCenterX = vpX + vpW / 2;
        const vpCenterY = vpY + vpH / 2;

        // 뷰포트별 도형 타겟 생성 (텍스트는 위에서 별도 처리됨)
        let targets: { x: number; y: number }[] | null = null;
        if (currentState === 'shape') {
          // 줌이 클수록 기본 크기를 작게 해서 뷰포트 안에 맞춤
          const baseSize = Math.min(vpW, vpH) * 0.35;
          targets = getShapeForView(currentShapeIndex, vpCenterX, vpCenterY, baseSize, time, viewIdx);
        }

        // 클리핑 영역 설정
        ctx.save();
        ctx.beginPath();
        ctx.rect(vpX, vpY, vpW, vpH);
        ctx.clip();

        // 뷰포트 배경 (약간의 구분)
        ctx.fillStyle = viewIdx === 0 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(245, 245, 245, 0.03)';
        ctx.fillRect(vpX, vpY, vpW, vpH);

        // 뷰포트별 줌 설정
        const viewZoom = VIEW_CONFIGS[viewIdx].zoom;

        // 파티클 업데이트 (첫 번째 뷰포트에서만)
        const stateSnapshot = currentState;
        if (viewIdx === 0) {
          // eslint-disable-next-line no-loop-func
          particles.forEach((p, i) => {
            const isFormationParticle = i < FORMATION_PARTICLE_COUNT;
            if (isFormationParticle && targets && targets.length > 0 && stateSnapshot !== 'free') {
              const targetIndex = i % targets.length;
              const target = targets[targetIndex];
              const oscillation = 3;
              const offsetX = Math.sin(time * 2 + i * 0.5) * oscillation;
              const offsetY = Math.cos(time * 2.5 + i * 0.3) * oscillation;
              const finalX = target.x + offsetX;
              const finalY = target.y + offsetY;
              p.x += (finalX - p.x) * 0.06;
              p.y += (finalY - p.y) * 0.06;
              p.vx = (finalX - p.x) * 0.02;
              p.vy = (finalY - p.y) * 0.02;
            } else {
              p.vx += Math.sin(time + i * 0.1) * 0.01;
              p.vy += Math.cos(time + i * 0.15) * 0.01;
              const mdx = mouseRef.current.x - p.x;
              const mdy = mouseRef.current.y - p.y;
              const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
              if (mDist < 120 && mDist > 0) {
                const force = (120 - mDist) / 120 * 0.02;
                p.vx -= (mdx / mDist) * force;
                p.vy -= (mdy / mDist) * force;
              }
              p.vx *= 0.98;
              p.vy *= 0.98;
              p.x += p.vx;
              p.y += p.vy;
              if (p.x < 0) { p.x = canvas.width; }
              if (p.x > canvas.width) { p.x = 0; }
              if (p.y < 0) { p.y = canvas.height; }
              if (p.y > canvas.height) { p.y = 0; }
            }
            p.life += 1;
          });
        }

        // 스피어 그리기 헬퍼 함수 (뷰포트용, 투명도 없음)
        const drawSphereVP = (x: number, y: number, radius: number, baseColor: number) => {
          const gradient = ctx.createRadialGradient(
            x - radius * 0.3, y - radius * 0.3, radius * 0.1,
            x, y, radius
          );
          const highlightColor = Math.min(baseColor + 80, 255);
          const shadowColor = Math.max(baseColor - 40, 0);
          gradient.addColorStop(0, `rgb(${highlightColor}, ${highlightColor}, ${highlightColor})`);
          gradient.addColorStop(0.5, `rgb(${baseColor}, ${baseColor}, ${baseColor})`);
          gradient.addColorStop(1, `rgb(${shadowColor}, ${shadowColor}, ${shadowColor})`);
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        };

        // 파티클 렌더링 - 모든 뷰포트에서
        // eslint-disable-next-line no-loop-func
        particles.forEach((p, i) => {
          const isFormationParticle = i < FORMATION_PARTICLE_COUNT;
          const pulse = Math.sin(time * 2 + p.life * 0.01) * 0.3 + 0.7;

          // 도형 상태: 각 뷰포트별로 다른 각도로 렌더링
          if (stateSnapshot === 'shape' && isFormationParticle && targets && targets.length > 0) {
            const targetIndex = i % targets.length;
            const target = targets[targetIndex];
            const oscillation = 2;
            const drawX = target.x + Math.sin(time * 2 + i * 0.5) * oscillation;
            const drawY = target.y + Math.cos(time * 2.5 + i * 0.3) * oscillation;

            const color = particleColor > 0 ? particleColor : 30;
            drawSphereVP(drawX, drawY, p.size * 1.5, color);
          } else {
            // 자유 상태: 모든 뷰포트에 파티클 표시
            const relX = (p.x - canvas.width / 2) * viewZoom;
            const relY = (p.y - canvas.height / 2) * viewZoom;
            const drawX = vpCenterX + relX;
            const drawY = vpCenterY + relY;

            const radius = p.size * pulse * (viewIdx === 0 ? 1 : viewZoom * 0.5);
            drawSphereVP(drawX, drawY, radius, 40);
          }
        });

        // 연결선 그리기 (도형 상태에서만)
        if (currentState === 'shape' && targets && targets.length > 0) {
          // 플래시 시 연결선 색상 반전
          const lineColor = particleColor;

          // 샘플링하여 전체 도형에 걸쳐 균등하게 점 선택
          const samplePoints = (count: number) => {
            const step = Math.max(1, Math.floor(targets!.length / count));
            const sampled: { x: number; y: number }[] = [];
            for (let i = 0; i < targets!.length && sampled.length < count; i += step) {
              sampled.push(targets![i]);
            }
            return sampled;
          };

          const farSample = samplePoints(400);
          const midSample = samplePoints(350);
          const closeSample = samplePoints(300);

          // 먼 거리 연결 (매우 희미한 선)
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${lineColor}, ${lineColor}, ${lineColor}, 0.12)`;
          ctx.lineWidth = 0.15;
          for (let i = 0; i < farSample.length; i += 2) {
            for (let j = i + 1; j < farSample.length; j += 2) {
              const dx = farSample[i].x - farSample[j].x;
              const dy = farSample[i].y - farSample[j].y;
              const distSq = dx * dx + dy * dy;
              if (distSq < 160000 && distSq > 10000) { // 100-400px
                ctx.moveTo(farSample[i].x, farSample[i].y);
                ctx.lineTo(farSample[j].x, farSample[j].y);
              }
            }
          }
          ctx.stroke();

          // 중간 거리 연결
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${lineColor}, ${lineColor}, ${lineColor}, 0.2)`;
          ctx.lineWidth = 0.2;
          for (let i = 0; i < midSample.length; i += 2) {
            for (let j = i + 1; j < midSample.length; j += 2) {
              const dx = midSample[i].x - midSample[j].x;
              const dy = midSample[i].y - midSample[j].y;
              const distSq = dx * dx + dy * dy;
              if (distSq < 25000 && distSq > 3000) { // 55-160px
                ctx.moveTo(midSample[i].x, midSample[i].y);
                ctx.lineTo(midSample[j].x, midSample[j].y);
              }
            }
          }
          ctx.stroke();

          // 가까운 연결
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${lineColor}, ${lineColor}, ${lineColor}, 0.35)`;
          ctx.lineWidth = 0.3;
          for (let i = 0; i < closeSample.length; i++) {
            for (let j = i + 1; j < closeSample.length; j++) {
              const dx = closeSample[i].x - closeSample[j].x;
              const dy = closeSample[i].y - closeSample[j].y;
              const distSq = dx * dx + dy * dy;
              if (distSq < 6000) { // 0-77px
                ctx.moveTo(closeSample[i].x, closeSample[i].y);
                ctx.lineTo(closeSample[j].x, closeSample[j].y);
              }
            }
          }
          ctx.stroke();
        }

        ctx.restore();

        // 뷰포트 테두리
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(vpX, vpY, vpW, vpH);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // 방명록 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await guestbookAPI.create({
        name: name.trim(),
        message: message.trim()
      });

      if (response.success) {
        setEntries(prev => [response.data, ...prev]);
        setName('');
        setMessage('');
        setFormSuccess(true);
        setTimeout(() => {
          setFormSuccess(false);
          setShowForm(false);
        }, 2000);
      }
    } catch (error) {
      console.error('방명록 저장 오류:', error);
      alert('방명록 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  // 방명록 삭제 (관리자 전용)
  const handleDelete = async (id: string, authorName: string) => {
    if (!window.confirm(`"${authorName}"님의 방명록을 삭제하시겠습니까?`)) {
      return;
    }

    setDeleting(id);
    try {
      const response = await guestbookAPI.delete(id);
      if (response.success) {
        setEntries(prev => prev.filter(entry => entry.id !== id));
      }
    } catch (error) {
      console.error('방명록 삭제 오류:', error);
      alert('방명록 삭제에 실패했습니다.');
    } finally {
      setDeleting(null);
    }
  };

  // [rerender-memo] 날짜 포맷 - useCallback으로 메모이제이션
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', DATE_FORMAT_OPTIONS);
  }, []);

  return (
    <div className="guestbook-container">
      {/* 배경 캔버스 */}
      <canvas ref={canvasRef} className="guestbook-canvas" />

      {/* 오버레이 그라데이션 */}
      <div className="guestbook-overlay" />

      {/* 헤더 */}
      <header className={`guestbook-header ${isFullscreen ? 'fullscreen-mode' : ''}`}>
        <motion.button
          className="guestbook-back-btn"
          onClick={isFullscreen ? toggleFullscreen : () => navigate(-1)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="back-arrow">{isFullscreen ? '✕' : '←'}</span>
          <span>{isFullscreen ? '닫기' : '돌아가기'}</span>
        </motion.button>

        <motion.div
          className="guestbook-title-area"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="guestbook-title">
            <span className="title-glyph">&#9679;</span>
            GUESTBOOK
            <span className="title-glyph">&#9679;</span>
          </h1>
          <p className="guestbook-subtitle">Reconnect: 낙원식당 전시 방명록</p>
        </motion.div>

        <div className="header-right-buttons">
          <motion.button
            className="guestbook-fullscreen-btn"
            onClick={toggleFullscreen}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={isFullscreen ? '창 모드' : '전체 화면'}
          >
            <span>{isFullscreen ? '⊟' : '⊞'}</span>
          </motion.button>

          <motion.button
            className="guestbook-write-btn"
            onClick={() => setShowForm(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <span className="write-icon">+</span>
            <span>방명록 남기기</span>
          </motion.button>
        </div>
      </header>

      {/* 방명록 입력 폼 모달 */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="guestbook-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !submitting && setShowForm(false)}
          >
            <motion.div
              className="guestbook-modal"
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {formSuccess ? (
                <motion.div
                  className="form-success"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring' }}
                >
                  <div className="success-icon">&#10003;</div>
                  <p>감사합니다!</p>
                  <p className="success-sub">방명록이 등록되었습니다</p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="guestbook-form">
                  <h2 className="form-title">방명록 남기기</h2>

                  <div className="form-field">
                    <label htmlFor="name">이름</label>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="이름을 입력하세요"
                      maxLength={50}
                      disabled={submitting}
                      autoComplete="off"
                    />
                    <span className="char-count">{name.length}/50</span>
                  </div>

                  <div className="form-field">
                    <label htmlFor="message">메시지</label>
                    <textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="전시에 대한 소감을 남겨주세요"
                      maxLength={500}
                      rows={5}
                      disabled={submitting}
                    />
                    <span className="char-count">{message.length}/500</span>
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setShowForm(false)}
                      disabled={submitting}
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="btn-submit"
                      disabled={!name.trim() || !message.trim() || submitting}
                    >
                      {submitting ? (
                        <span className="loading-dots">
                          <span>.</span><span>.</span><span>.</span>
                        </span>
                      ) : (
                        '등록하기'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 방명록 상세 보기 모달 */}
      <AnimatePresence>
        {selectedEntry && (
          <motion.div
            className="guestbook-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedEntry(null)}
          >
            <motion.div
              className="guestbook-detail-modal"
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="detail-close-btn"
                onClick={() => setSelectedEntry(null)}
              >
                ×
              </button>
              <div className="detail-header">
                <div className="detail-author">
                  <span className="author-dot" />
                  <span className="author-name">{selectedEntry.name}</span>
                </div>
                <time className="detail-date">{formatDate(selectedEntry.createdAt)}</time>
              </div>
              <p className="detail-message">{selectedEntry.message}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 방명록 목록 */}
      <main className="guestbook-main">
        {loading ? (
          <motion.div
            className="guestbook-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {LoadingOrb}
            <p>Loading...</p>
          </motion.div>
        ) : entries.length === 0 ? (
          <motion.div
            className="guestbook-empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {EmptyIcon}
            <p>아직 방명록이 없습니다</p>
            <p className="empty-sub">첫 번째 방문 기록을 남겨주세요</p>
          </motion.div>
        ) : (
          <motion.div
            className="guestbook-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {entries.map((entry, index) => (
              <GuestbookCard
                key={entry.id}
                entry={entry}
                index={index}
                isAuthenticated={isAuthenticated}
                deleting={deleting}
                onSelect={setSelectedEntry}
                onDelete={handleDelete}
              />
            ))}
          </motion.div>
        )}
      </main>

      {/* 푸터 */}
      <footer className="guestbook-footer">
        <p>Reconnect: 낙원식당</p>
      </footer>
    </div>
  );
};

export default Guestbook;
