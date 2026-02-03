import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ReconnectAnimationProps {
  width?: number;
  height?: number;
}

const ReconnectAnimation: React.FC<ReconnectAnimationProps> = ({ width = 300, height = 300 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const EXPLODE_DURATION = 2;
    const RANDOM_DURATION = 5;
    const VORTEX_DURATION = 2;
    const TRANSITION_DURATION = 8;
    const HOLD_DURATION = 5;
    const TOTAL_DURATION = EXPLODE_DURATION + RANDOM_DURATION + VORTEX_DURATION + TRANSITION_DURATION + HOLD_DURATION;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 2000);
    camera.position.z = 500;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    function createCircleTexture(size = 64) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const center = size / 2;
      const radius = size / 2 - 2;
      ctx.beginPath();
      ctx.arc(center, center, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
      return new THREE.CanvasTexture(canvas);
    }

    const circleTexture = createCircleTexture();

    function getTextPositions() {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = 1400;
      canvas.height = 1400;

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = 'bold 90px Arial, sans-serif';
      ctx.fillText('Reconnect', canvas.width / 2, 130);

      const verticalText = '낙원식당樂源識䣊';
      ctx.font = 'bold 130px Arial, sans-serif';
      const startY = 280;
      const charSpacing = 130;

      for (let i = 0; i < verticalText.length; i++) {
        ctx.fillText(verticalText[i], canvas.width / 2, startY + i * charSpacing);
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const positions: { x: number; y: number; z: number }[] = [];
      const density = 4;
      const scale = 0.35;

      for (let y = 0; y < canvas.height; y += density) {
        for (let x = 0; x < canvas.width; x += density) {
          const i = (y * canvas.width + x) * 4;
          if (imageData.data[i] < 128) {
            positions.push({
              x: (x - canvas.width / 2) * scale,
              y: (canvas.height / 2 - y) * scale,
              z: (Math.random() - 0.5) * 10
            });
          }
        }
      }
      return positions;
    }

    const targetPositions = getTextPositions();
    const particleCount = targetPositions.length;

    const particlesGeometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);

    const particleData: any[] = [];
    for (let i = 0; i < particleCount; i++) {
      const targetX = (Math.random() - 0.5) * 400;
      const targetY = (Math.random() - 0.5) * 400;
      const targetZ = (Math.random() - 0.5) * 400;

      particleData.push({
        x: 0, y: 0, z: 0,
        targetX, targetY, targetZ,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        vz: (Math.random() - 0.5) * 3,
        freq: 1 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2
      });

      posArray[i * 3] = 0;
      posArray[i * 3 + 1] = 0;
      posArray[i * 3 + 2] = 0;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const particlesMaterial = new THREE.PointsMaterial({
      color: 0x000000,
      size: 4,
      sizeAttenuation: true,
      map: circleTexture,
      transparent: true,
      alphaTest: 0.5,
      depthTest: false,
      depthWrite: false,
    });

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    particlesMesh.renderOrder = 2;
    scene.add(particlesMesh);

    // Lines
    const MAX_LINES = 5000;
    const linesGeometry = new THREE.BufferGeometry();
    const linePositions = new Float32Array(MAX_LINES * 6);
    linesGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

    const linesMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.15,
      depthTest: false,
      depthWrite: false,
    });

    const linesMesh = new THREE.LineSegments(linesGeometry, linesMaterial);
    linesMesh.renderOrder = 1;
    scene.add(linesMesh);

    const sampleIndices: number[] = [];
    for (let i = 0; i < particleCount; i++) sampleIndices.push(i);
    for (let i = sampleIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sampleIndices[i], sampleIndices[j]] = [sampleIndices[j], sampleIndices[i]];
    }
    const sampled = sampleIndices.slice(0, Math.min(1500, particleCount));

    function updateLines(particlePositions: Float32Array, zOffset = 0, maxDistOverride: number | null = null) {
      const linePos = linesGeometry.attributes.position.array as Float32Array;
      const maxDist = maxDistOverride || 50;
      let lineCount = 0;

      for (let a = 0; a < sampled.length && lineCount < MAX_LINES; a++) {
        const i = sampled[a];
        const x1 = particlePositions[i * 3];
        const y1 = particlePositions[i * 3 + 1];
        const z1 = particlePositions[i * 3 + 2];

        for (let b = a + 1; b < sampled.length && lineCount < MAX_LINES; b++) {
          const j = sampled[b];
          const x2 = particlePositions[j * 3];
          const y2 = particlePositions[j * 3 + 1];
          const z2 = particlePositions[j * 3 + 2];

          const dist = Math.sqrt((x1-x2)**2 + (y1-y2)**2 + (z1-z2)**2);

          if (dist < maxDist) {
            const i6 = lineCount * 6;
            linePos[i6] = x1;
            linePos[i6 + 1] = y1;
            linePos[i6 + 2] = z1 + zOffset;
            linePos[i6 + 3] = x2;
            linePos[i6 + 4] = y2;
            linePos[i6 + 5] = z2 + zOffset;
            lineCount++;
          }
        }
      }

      for (let i = lineCount * 6; i < MAX_LINES * 6; i++) {
        linePos[i] = 0;
      }

      linesGeometry.setDrawRange(0, lineCount * 2);
      linesGeometry.attributes.position.needsUpdate = true;
    }

    function easeInOutQuad(t: number) {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    // 베지어 커브 이징 (cubic-bezier 스타일)
    function cubicBezier(t: number, p1x: number, p1y: number, p2x: number, p2y: number): number {
      // Newton-Raphson으로 t에 대한 x 값 찾기
      let x = t;
      for (let i = 0; i < 8; i++) {
        const currentX = 3 * p1x * x * (1 - x) * (1 - x) + 3 * p2x * x * x * (1 - x) + x * x * x;
        const currentSlope = 3 * p1x * (1 - x) * (1 - x) - 6 * p1x * x * (1 - x) + 6 * p2x * x * (1 - x) - 3 * p2x * x * x + 3 * x * x;
        if (Math.abs(currentSlope) < 1e-6) break;
        x = x - (currentX - t) / currentSlope;
      }
      // y 값 계산
      return 3 * p1y * x * (1 - x) * (1 - x) + 3 * p2y * x * x * (1 - x) + x * x * x;
    }

    // 휘몰아치는 느낌의 이징 (천천히 시작 -> 빠르게 -> 천천히 끝)
    function easeVortex(t: number): number {
      return cubicBezier(t, 0.4, 0, 0.2, 1);
    }

    const startTime = Date.now();
    let rotationAtVortexStart = 0;
    let targetRotationAtVortexEnd = 0;
    let lastPhase = '';

    function animate() {
      animationRef.current = requestAnimationFrame(animate);

      const elapsed = (Date.now() - startTime) / 1000;
      const cycleTime = elapsed % TOTAL_DURATION;
      const positions = particlesGeometry.attributes.position.array as Float32Array;

      // 현재 단계 파악
      let currentPhase = '';
      if (cycleTime < EXPLODE_DURATION) {
        currentPhase = 'explode';
      } else if (cycleTime < EXPLODE_DURATION + RANDOM_DURATION) {
        currentPhase = 'random';
      } else if (cycleTime < EXPLODE_DURATION + RANDOM_DURATION + VORTEX_DURATION) {
        currentPhase = 'vortex';
      } else if (cycleTime < EXPLODE_DURATION + RANDOM_DURATION + VORTEX_DURATION + TRANSITION_DURATION) {
        currentPhase = 'transition';
      } else {
        currentPhase = 'hold';
      }

      // random -> vortex 전환 시 시작 회전값과 목표 회전값 계산
      if (lastPhase === 'random' && currentPhase === 'vortex') {
        rotationAtVortexStart = particlesMesh.rotation.y;
        // vortex 끝에서 정확히 정면(2π의 배수)에서 멈추도록 목표 설정
        const twoPi = Math.PI * 2;
        const nearestMultiple = Math.ceil(rotationAtVortexStart / twoPi) * twoPi;
        targetRotationAtVortexEnd = nearestMultiple + twoPi * 2; // 추가로 2바퀴
      }

      // 새 사이클 시작 시 회전 리셋
      if (lastPhase === 'hold' && currentPhase === 'explode') {
        particlesMesh.rotation.y = 0;
        linesMesh.rotation.y = 0;
        rotationAtVortexStart = 0;
        targetRotationAtVortexEnd = 0;
      }

      lastPhase = currentPhase;

      if (cycleTime < EXPLODE_DURATION) {
        const explodeProgress = cycleTime / EXPLODE_DURATION;
        const easedExplode = easeInOutQuad(explodeProgress);
        linesMaterial.opacity = 0.15 * easedExplode;

        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          const p = particleData[i];
          p.x = p.targetX * easedExplode;
          p.y = p.targetY * easedExplode;
          p.z = p.targetZ * easedExplode;
          positions[i3] = p.x;
          positions[i3 + 1] = p.y;
          positions[i3 + 2] = p.z;
        }

        particlesGeometry.attributes.position.needsUpdate = true;
        updateLines(positions, 0, 50 * easedExplode + 10);

      } else if (cycleTime < EXPLODE_DURATION + RANDOM_DURATION) {
        particlesMesh.rotation.y += 0.001;
        linesMesh.rotation.y += 0.001;
        linesMaterial.opacity = 0.15;

        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          const p = particleData[i];
          p.x += p.vx;
          p.y += p.vy;
          p.z += p.vz;

          if (p.x > 400 || p.x < -400) p.vx *= -1;
          if (p.y > 400 || p.y < -400) p.vy *= -1;
          if (p.z > 400 || p.z < -400) p.vz *= -1;

          const turbX = Math.sin(elapsed * p.freq + p.phase) * 2;
          const turbY = Math.cos(elapsed * p.freq * 0.8 + p.phase) * 2;

          positions[i3] = p.x + turbX;
          positions[i3 + 1] = p.y + turbY;
          positions[i3 + 2] = p.z;
        }

        particlesGeometry.attributes.position.needsUpdate = true;
        updateLines(positions);

      } else if (cycleTime < EXPLODE_DURATION + RANDOM_DURATION + VORTEX_DURATION) {
        // vortex 끝에서 정확히 정면(2π의 배수)에서 멈추도록 회전 (베지어 이징)
        const vortexTime = cycleTime - EXPLODE_DURATION - RANDOM_DURATION;
        const vortexProgress = vortexTime / VORTEX_DURATION;
        const easedVortex = easeVortex(vortexProgress);
        particlesMesh.rotation.y = rotationAtVortexStart + (targetRotationAtVortexEnd - rotationAtVortexStart) * easedVortex;
        linesMesh.rotation.y = particlesMesh.rotation.y;
        linesMaterial.opacity = 0.2;

        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          const p = particleData[i];
          const angle = Math.atan2(p.y, p.x) + 0.1;
          const dist = Math.sqrt(p.x * p.x + p.y * p.y) * (1 - 0.01);
          p.x = Math.cos(angle) * dist;
          p.y = Math.sin(angle) * dist;
          p.z += Math.sin(elapsed * 5 + i * 0.1) * 3;
          positions[i3] = p.x;
          positions[i3 + 1] = p.y;
          positions[i3 + 2] = p.z;
        }

        particlesGeometry.attributes.position.needsUpdate = true;
        updateLines(positions);

      } else if (cycleTime < EXPLODE_DURATION + RANDOM_DURATION + VORTEX_DURATION + TRANSITION_DURATION) {
        const transitionTime = cycleTime - EXPLODE_DURATION - RANDOM_DURATION - VORTEX_DURATION;
        const progress = transitionTime / TRANSITION_DURATION;
        const easedProgress = easeInOutQuad(progress);

        // vortex 끝에서 이미 정면이므로 0 유지
        particlesMesh.rotation.y = 0;
        linesMesh.rotation.y = 0;

        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          const p = particleData[i];
          positions[i3] = p.x + (targetPositions[i].x - p.x) * easedProgress;
          positions[i3 + 1] = p.y + (targetPositions[i].y - p.y) * easedProgress;
          positions[i3 + 2] = p.z + (targetPositions[i].z - p.z) * easedProgress;
        }

        particlesGeometry.attributes.position.needsUpdate = true;
        const textMaxDist = 35 + easedProgress * 45;
        linesMaterial.opacity = 0.15 - easedProgress * 0.12;
        updateLines(positions, 0, textMaxDist);

      } else {
        // hold 상태에서는 이미 회전이 0
        particlesMesh.rotation.y = 0;
        linesMesh.rotation.y = 0;

        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          const subtle = Math.sin(elapsed * 2 + i * 0.05) * 0.3;
          positions[i3] = targetPositions[i].x + subtle;
          positions[i3 + 1] = targetPositions[i].y + subtle;
          positions[i3 + 2] = targetPositions[i].z;
        }

        particlesGeometry.attributes.position.needsUpdate = true;
        linesMaterial.opacity = 0.03;
        updateLines(positions, 0, 80);
      }

      if (cycleTime < 0.016 && elapsed > 0.1) {
        for (let i = 0; i < particleCount; i++) {
          particleData[i].x = 0;
          particleData[i].y = 0;
          particleData[i].z = 0;
          particleData[i].targetX = (Math.random() - 0.5) * 400;
          particleData[i].targetY = (Math.random() - 0.5) * 400;
          particleData[i].targetZ = (Math.random() - 0.5) * 400;
          particleData[i].vx = (Math.random() - 0.5) * 3;
          particleData[i].vy = (Math.random() - 0.5) * 3;
          particleData[i].vz = (Math.random() - 0.5) * 3;
        }
      }

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      linesGeometry.dispose();
      linesMaterial.dispose();
      circleTexture.dispose();
    };
  }, [width, height]);

  return (
    <div
      ref={containerRef}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        margin: '0 auto 2rem auto',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      }}
    />
  );
};

export default ReconnectAnimation;
