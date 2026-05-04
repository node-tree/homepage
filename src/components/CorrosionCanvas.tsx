/**
 * CorrosionCanvas — Tidal Corrosion (조시 부식)
 *
 * Gray-Scott reaction-diffusion 시뮬레이션으로 부식·바이오필름·결정 패턴을
 * 동시에 자라나게 한다. 이케다·알바 노토 미학(미니멀, 모노크롬, 글리치)을
 * 부식 색조(rust, oxide)와 결합. 결정론적 시드 기반 — 같은 시드는 같은 패턴.
 *
 * 작품 《공생직조》의 컨셉적 DNA:
 * - 시간이 흐르며 부식이 자라난다 (진화)
 * - 두 화학물질의 상호작용으로 결정과 유기 패턴이 동시에 만들어진다 (공생)
 * - 무작위 시드 위에서 결정적 화학 법칙으로 매번 다른 직조가 형성된다 (직조)
 *
 * React useEffect + p5 instance mode로 안전하게 마운트/언마운트.
 */
import React, { useEffect, useRef } from 'react';
import p5 from 'p5';

interface CorrosionCanvasProps {
  height?: number;
  seed?: number;
  className?: string;
}

const CorrosionCanvas: React.FC<CorrosionCanvasProps> = ({
  height = 240,
  seed,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5Ref = useRef<p5 | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = (p: p5) => {
      // ── 시드 (날짜 기반 자동, prop 우선) ────────────────────────
      const today = new Date();
      const defaultSeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
      const SEED = seed ?? defaultSeed;

      // ── Reaction-Diffusion 격자 (성능 위해 소형) ──────────────
      const COLS = 180;
      let ROWS = 60;
      let cellSize = 4;

      // Gray-Scott 파라미터 (Coral pattern: 부식·바이오필름 융합)
      const dA = 1.0;
      const dB = 0.5;
      const feed = 0.0367;
      const kill = 0.0649;
      const dt = 1.0;

      // 더블 버퍼
      let gridA: Float32Array;
      let gridB: Float32Array;
      let nextA: Float32Array;
      let nextB: Float32Array;

      // 부식 색상 팔레트 (모노크롬 + 부식 색조)
      const palette = {
        bg: [10, 10, 10] as [number, number, number],
        rust: [184, 84, 15] as [number, number, number],
        oxideGreen: [74, 107, 93] as [number, number, number],
        oxideCyan: [42, 85, 96] as [number, number, number],
        bone: [232, 226, 211] as [number, number, number],
      };

      // 글리치 라인 (이케다)
      const glitches: { x: number; w: number; alpha: number; phase: number }[] = [];

      const idx = (x: number, y: number) => x + y * COLS;

      const initGrid = () => {
        gridA = new Float32Array(COLS * ROWS);
        gridB = new Float32Array(COLS * ROWS);
        nextA = new Float32Array(COLS * ROWS);
        nextB = new Float32Array(COLS * ROWS);

        // A로 가득 채우고
        for (let i = 0; i < gridA.length; i++) {
          gridA[i] = 1;
          gridB[i] = 0;
        }

        // 시드된 random에 따라 부식 핵 위치 생성 (4~7개)
        p.randomSeed(SEED);
        p.noiseSeed(SEED);
        const seedCount = Math.floor(p.random(4, 7));
        for (let s = 0; s < seedCount; s++) {
          const cx = Math.floor(p.random(8, COLS - 8));
          const cy = Math.floor(p.random(4, ROWS - 4));
          const r = Math.floor(p.random(2, 5));
          for (let y = -r; y <= r; y++) {
            for (let x = -r; x <= r; x++) {
              const xi = cx + x;
              const yi = cy + y;
              if (xi >= 0 && xi < COLS && yi >= 0 && yi < ROWS) {
                if (x * x + y * y <= r * r) {
                  gridB[idx(xi, yi)] = 1;
                }
              }
            }
          }
        }

        // 글리치 라인 — 미리 생성
        glitches.length = 0;
        const glitchCount = Math.floor(p.random(3, 7));
        for (let g = 0; g < glitchCount; g++) {
          glitches.push({
            x: p.random(),
            w: p.random(0.001, 0.008),
            alpha: p.random(40, 110),
            phase: p.random(p.TWO_PI),
          });
        }
      };

      const laplaceA = (x: number, y: number) => {
        let sum = 0;
        sum += gridA[idx(x, y)] * -1;
        sum += gridA[idx(x - 1, y)] * 0.2;
        sum += gridA[idx(x + 1, y)] * 0.2;
        sum += gridA[idx(x, y - 1)] * 0.2;
        sum += gridA[idx(x, y + 1)] * 0.2;
        sum += gridA[idx(x - 1, y - 1)] * 0.05;
        sum += gridA[idx(x + 1, y - 1)] * 0.05;
        sum += gridA[idx(x - 1, y + 1)] * 0.05;
        sum += gridA[idx(x + 1, y + 1)] * 0.05;
        return sum;
      };

      const laplaceB = (x: number, y: number) => {
        let sum = 0;
        sum += gridB[idx(x, y)] * -1;
        sum += gridB[idx(x - 1, y)] * 0.2;
        sum += gridB[idx(x + 1, y)] * 0.2;
        sum += gridB[idx(x, y - 1)] * 0.2;
        sum += gridB[idx(x, y + 1)] * 0.2;
        sum += gridB[idx(x - 1, y - 1)] * 0.05;
        sum += gridB[idx(x + 1, y - 1)] * 0.05;
        sum += gridB[idx(x - 1, y + 1)] * 0.05;
        sum += gridB[idx(x + 1, y + 1)] * 0.05;
        return sum;
      };

      const stepReaction = () => {
        for (let y = 1; y < ROWS - 1; y++) {
          for (let x = 1; x < COLS - 1; x++) {
            const i = idx(x, y);
            const a = gridA[i];
            const b = gridB[i];
            const lapA = laplaceA(x, y);
            const lapB = laplaceB(x, y);
            const reaction = a * b * b;
            nextA[i] = a + (dA * lapA - reaction + feed * (1 - a)) * dt;
            nextB[i] = b + (dB * lapB + reaction - (kill + feed) * b) * dt;
            // clamp [0,1]
            if (nextA[i] < 0) nextA[i] = 0;
            else if (nextA[i] > 1) nextA[i] = 1;
            if (nextB[i] < 0) nextB[i] = 0;
            else if (nextB[i] > 1) nextB[i] = 1;
          }
        }
        // swap
        const tmpA = gridA;
        const tmpB = gridB;
        gridA = nextA;
        gridB = nextB;
        nextA = tmpA;
        nextB = tmpB;
      };

      const corrosionColor = (a: number, b: number): [number, number, number] => {
        // 두 화학물질 차이로 색 결정 (부식 그라디언트)
        const diff = p.constrain(a - b, 0, 1);
        // diff가 1에 가까우면 배경(어두움), 0에 가까우면 부식 패턴
        const t = 1 - diff;
        if (t < 0.15) return palette.bg;
        // 0.15 ~ 0.4: cyan oxide
        // 0.4 ~ 0.7: green oxide
        // 0.7 ~ 1.0: rust
        let c1: [number, number, number], c2: [number, number, number], lt: number;
        if (t < 0.4) {
          c1 = palette.bg;
          c2 = palette.oxideCyan;
          lt = (t - 0.15) / 0.25;
        } else if (t < 0.7) {
          c1 = palette.oxideCyan;
          c2 = palette.oxideGreen;
          lt = (t - 0.4) / 0.3;
        } else {
          c1 = palette.oxideGreen;
          c2 = palette.rust;
          lt = (t - 0.7) / 0.3;
        }
        return [
          c1[0] + (c2[0] - c1[0]) * lt,
          c1[1] + (c2[1] - c1[1]) * lt,
          c1[2] + (c2[2] - c1[2]) * lt,
        ];
      };

      const drawGrid = () => {
        p.noStroke();
        for (let y = 0; y < ROWS; y++) {
          for (let x = 0; x < COLS; x++) {
            const i = idx(x, y);
            const [r, g, b] = corrosionColor(gridA[i], gridB[i]);
            p.fill(r, g, b);
            p.rect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      };

      const drawGlitches = (t: number) => {
        const W = p.width;
        const H = p.height;
        for (const g of glitches) {
          const x = g.x * W + Math.sin(t * 0.0008 + g.phase) * 6;
          const w = g.w * W;
          p.noStroke();
          p.fill(palette.bone[0], palette.bone[1], palette.bone[2], g.alpha);
          p.rect(x, 0, w, H);
        }

        // 가로 스캔라인 (이케다)
        const scanY = ((t * 0.04) % H);
        p.fill(palette.bone[0], palette.bone[1], palette.bone[2], 18);
        p.rect(0, scanY, W, 1);
      };

      const computeLayout = () => {
        const containerW = containerRef.current!.getBoundingClientRect().width;
        cellSize = Math.max(2, Math.floor(containerW / COLS));
        ROWS = Math.max(40, Math.floor(height / cellSize));
      };

      p.setup = () => {
        computeLayout();
        const w = COLS * cellSize;
        const h = ROWS * cellSize;
        p.createCanvas(w, h);
        p.pixelDensity(1);
        p.frameRate(24);
        initGrid();
        // 워밍업 — 미리 부식 진행
        for (let i = 0; i < 80; i++) stepReaction();
      };

      p.draw = () => {
        // 한 프레임에 여러 step (자라나는 속도)
        for (let i = 0; i < 4; i++) stepReaction();
        drawGrid();
        drawGlitches(p.millis());
      };

      p.windowResized = () => {
        const newW = containerRef.current!.getBoundingClientRect().width;
        const newCell = Math.max(2, Math.floor(newW / COLS));
        if (newCell !== cellSize) {
          cellSize = newCell;
          ROWS = Math.max(40, Math.floor(height / cellSize));
          p.resizeCanvas(COLS * cellSize, ROWS * cellSize);
          initGrid();
          for (let i = 0; i < 80; i++) stepReaction();
        }
      };
    };

    p5Ref.current = new p5(sketch, containerRef.current);

    return () => {
      p5Ref.current?.remove();
      p5Ref.current = null;
    };
  }, [seed, height]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height,
        overflow: 'hidden',
        background: '#0a0a0a',
        position: 'relative',
      }}
      aria-hidden="true"
    />
  );
};

export default CorrosionCanvas;
