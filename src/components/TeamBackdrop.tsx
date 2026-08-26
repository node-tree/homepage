/**
 * TeamBackdrop — /NODETREECorpus 배경 p5 스케치 (Corrosive Weaving)
 *
 * [perf] p5 는 gzip 331 kB 로 프로젝트 최대 단일 의존성이다.
 * Team.tsx 가 이 모듈을 React.lazy 로 불러오므로 p5 는 별도 청크로 분리되고,
 * 배경이 실제로 뷰포트에 들어올 때(IntersectionObserver)에만 네트워크 요청이 발생한다.
 */
import React, { useEffect, useRef } from 'react';
import p5 from 'p5';

// ═══════════════════════════════════════════════════════════════
// Corrosive Weaving — p5 background sketch (perpetual, fluid)
// ═══════════════════════════════════════════════════════════════
function corrosiveSketch(p: p5) {
  const MINERAL_PALETTE = [
    [61, 139, 110],   // malachite
    [139, 58, 42],    // hematite
    [196, 149, 58],   // goethite
    [42, 74, 123],    // azurite
    [212, 207, 192],  // calcite
  ];

  const SEED = 2026;
  const PILLAR_COUNT = 5;
  const FILAMENT_COUNT = 1800;

  let filaments: any[] = [];
  let pillars: any[] = [];
  let frameAge = 0;
  let _seed = SEED;
  let scrollY = 0;

  function seededRandom() {
    _seed = (_seed * 9301 + 49297) % 233280;
    return _seed / 233280;
  }

  p.setup = () => {
    const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
    canvas.style('display', 'block');
    canvas.style('position', 'fixed');
    canvas.style('top', '0');
    canvas.style('left', '0');
    canvas.style('z-index', '0');
    canvas.style('pointer-events', 'none');

    p.randomSeed(SEED);
    p.noiseSeed(SEED);
    _seed = SEED;

    initPillars();
    initFilaments();
    p.background(11, 11, 13);
  };

  function initPillars() {
    pillars = [];
    const margin = p.width * 0.08;
    const spacing = (p.width - margin * 2) / Math.max(PILLAR_COUNT - 1, 1);
    for (let i = 0; i < PILLAR_COUNT; i++) {
      pillars.push({
        x: margin + i * spacing,
        mineralIdx: i % MINERAL_PALETTE.length,
        width: p.width / PILLAR_COUNT * 0.65,
        noiseOff: i * 1000 + SEED * 0.1,
        grade: 0.3 + seededRandom() * 0.7,
        // Each pillar breathes at its own frequency
        breathFreq: 0.008 + seededRandom() * 0.012,
        breathAmp: 15 + seededRandom() * 25,
      });
    }
  }

  function initFilaments() {
    filaments = [];
    const perPillar = Math.floor(FILAMENT_COUNT / PILLAR_COUNT);
    for (const pil of pillars) {
      for (let i = 0; i < perPillar; i++) {
        filaments.push(createFilament(pil, true));
      }
    }
  }

  function createFilament(pil: any, scatter: boolean) {
    const baseColor = MINERAL_PALETTE[pil.mineralIdx];
    const secIdx = (pil.mineralIdx + 1 + Math.floor(seededRandom() * 3)) % MINERAL_PALETTE.length;
    const secondary = MINERAL_PALETTE[secIdx];
    const mix = seededRandom() * 0.4;

    return {
      pillar: pil,
      x: pil.x + (seededRandom() - 0.5) * pil.width,
      y: scatter ? seededRandom() * p.height : p.height + seededRandom() * 30,
      life: scatter ? Math.floor(seededRandom() * 200) : 0,
      maxLife: 180 + seededRandom() * 400,
      vy: -(0.3 + seededRandom() * 0.8),
      r: p.lerp(baseColor[0], secondary[0], mix) + (seededRandom() - 0.5) * 25,
      g: p.lerp(baseColor[1], secondary[1], mix) + (seededRandom() - 0.5) * 25,
      b: p.lerp(baseColor[2], secondary[2], mix) + (seededRandom() - 0.5) * 25,
      sw: 0.5 + seededRandom() * 1.5 * pil.grade,
      prevX: 0,
      prevY: 0,
      // Individual noise phase for fluid variation
      phase: seededRandom() * 1000,
    };
  }

  p.draw = () => {
    // Track scroll for parallax offset
    scrollY = window.scrollY || 0;

    // Slow fade — trails accumulate into patina
    p.noStroke();
    p.fill(11, 11, 13, 8);
    p.rect(0, 0, p.width, p.height);

    frameAge++;

    // Time-based evolution: the whole field slowly morphs
    const timeShift = frameAge * 0.0008;
    const scrollFactor = scrollY * 0.0003;

    for (let i = filaments.length - 1; i >= 0; i--) {
      const f = filaments[i];
      f.prevX = f.x;
      f.prevY = f.y;

      // Pillar breathing — center oscillates
      const breathOffset = Math.sin(frameAge * f.pillar.breathFreq) * f.pillar.breathAmp;

      // Multi-octave noise for fluid, organic motion
      const n1 = p.noise(
        f.x * 0.006 + f.pillar.noiseOff,
        f.y * 0.003 + timeShift,
        f.phase * 0.01
      );
      const n2 = p.noise(
        f.x * 0.015 + f.phase,
        f.y * 0.008,
        timeShift * 2
      );

      // Combine: large drift + fine jitter
      const angle = (n1 - 0.5) * p.TWO_PI * 0.7 + (n2 - 0.5) * 0.8;
      f.x += Math.cos(angle) * 1.1;
      f.y += f.vy - scrollFactor * 0.3;

      // Attract back to breathing pillar center
      const pillarCenter = f.pillar.x + breathOffset;
      f.x += (pillarCenter - f.x) * 0.0025;

      f.life++;

      // Draw with layered opacity
      const ageFactor = Math.min(f.life / 40, 1.0);
      const fadeFactor = f.life > f.maxLife * 0.75
        ? 1.0 - (f.life - f.maxLife * 0.75) / (f.maxLife * 0.25)
        : 1.0;
      const alpha = 50 * ageFactor * fadeFactor;

      p.stroke(f.r, f.g, f.b, alpha);
      p.strokeWeight(f.sw);
      p.line(f.prevX, f.prevY, f.x, f.y);

      // Reset dead filaments
      if (f.life > f.maxLife || f.y < -30) {
        filaments[i] = createFilament(f.pillar, false);
      }
    }

    // Horizontal weave — fishing net threads connecting pillars
    if (frameAge % 7 === 0) {
      const ny = seededRandom() * p.height;
      const mineralIdx = Math.floor(seededRandom() * MINERAL_PALETTE.length);
      const c = MINERAL_PALETTE[mineralIdx];
      p.stroke(c[0], c[1], c[2], 15 + seededRandom() * 20);
      p.strokeWeight(0.4 + seededRandom() * 0.6);
      p.noFill();
      p.beginShape();
      for (let x = 0; x < p.width; x += 8) {
        const yn = ny +
          p.noise(x * 0.004 + timeShift, frameAge * 0.005, SEED * 0.01) * 50 - 25 +
          Math.sin(x * 0.01 + frameAge * 0.02) * 8;
        p.vertex(x, yn);
      }
      p.endShape();
    }

    // Occasional bright mineral flare — simulates XRF spectral flash
    if (frameAge % 120 === 0) {
      const flarePillar = pillars[Math.floor(seededRandom() * pillars.length)];
      const flareC = MINERAL_PALETTE[flarePillar.mineralIdx];
      const fy = seededRandom() * p.height;
      p.noStroke();
      for (let r = 80; r > 0; r -= 5) {
        p.fill(flareC[0], flareC[1], flareC[2], (80 - r) * 0.5);
        p.ellipse(flarePillar.x, fy, r, r * 0.6);
      }
    }
  };

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    initPillars();
    // Reassign pillar references for existing filaments
    filaments.forEach((f, i) => {
      f.pillar = pillars[i % pillars.length];
    });
  };
}

const TeamBackdrop: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const p5Ref = useRef<p5 | null>(null);

  useEffect(() => {
    if (canvasRef.current && !p5Ref.current) {
      p5Ref.current = new p5(corrosiveSketch, canvasRef.current);
    }
    return () => {
      if (p5Ref.current) {
        p5Ref.current.remove();
        p5Ref.current = null;
      }
    };
  }, []);

  return <div ref={canvasRef} className="team-bg-canvas" />;
};

export default TeamBackdrop;
