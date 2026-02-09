import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './StrudelSynth.css';

let strudelModule: any = null;

// Moog 스타일 프리셋
const PRESETS = [
  { name: 'PAD', code: 'note("c3 e3 g3 b3").sound("sine").lpf(400).gain(0.4).slow(2)' },
  { name: 'ARP', code: 'note("c4 e4 g4 b4 g4 e4").sound("sawtooth").lpf(1200).gain(0.3).fast(2)' },
  { name: 'BASS', code: 'note("c2").sound("triangle").gain(0.5).slow(4)' },
  { name: 'LEAD', code: 'note("c4 [e4 g4] <a4 b4>").sound("square").gain(0.2).fast(1.5)' },
  { name: 'SYNC', code: 'note("c5 ~ e5 ~").sound("sine").gain(0.3)' },
];

// 오실레이터 타입
const OSCILLATORS = ['sine', 'sawtooth', 'square', 'triangle'];

interface KnobProps {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
}

const Knob: React.FC<KnobProps> = ({ value, min, max, label, onChange }) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const rotation = ((value - min) / (max - min)) * 270 - 135;

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startValue.current = value;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const delta = (startY.current - e.clientY) / 100;
    const range = max - min;
    const newValue = Math.max(min, Math.min(max, startValue.current + delta * range));
    onChange(newValue);
  }, [min, max, onChange]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  return (
    <div className="moog-knob-container">
      <div
        ref={knobRef}
        className="moog-knob"
        onMouseDown={handleMouseDown}
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <div className="knob-indicator" />
      </div>
      <span className="knob-label">{label}</span>
    </div>
  );
};

const StrudelSynth: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [code, setCode] = useState(PRESETS[0].code);
  const [volume, setVolume] = useState(0.7);
  const [cutoff, setCutoff] = useState(0.5);
  const [resonance, setResonance] = useState(0.3);
  const [attack, setAttack] = useState(0.1);
  const [release, setRelease] = useState(0.5);
  const [activePreset, setActivePreset] = useState(0);
  const [oscType, setOscType] = useState(0);
  const [showEditor, setShowEditor] = useState(false);
  const initialized = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const loadStrudel = async () => {
      if (initialized.current) return;
      try {
        strudelModule = await import('@strudel/web');
        await strudelModule.initStrudel();
        initialized.current = true;
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize Strudel:', error);
      }
    };
    loadStrudel();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // 오실로스코프 시각화
  const drawOscilloscope = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 그리드 라인
    ctx.strokeStyle = '#1a3a1a';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < canvas.width; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    if (isPlaying) {
      // 파형 그리기
      ctx.strokeStyle = '#00ff41';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00ff41';
      ctx.shadowBlur = 10;
      ctx.beginPath();

      const time = Date.now() / 1000;
      for (let x = 0; x < canvas.width; x++) {
        const frequency = 2 + oscType;
        const y = canvas.height / 2 +
          Math.sin((x / 30 + time * 3) * frequency) * 30 * volume +
          Math.sin((x / 15 + time * 5) * frequency * 0.5) * 15 * cutoff;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    animationRef.current = requestAnimationFrame(drawOscilloscope);
  }, [isPlaying, volume, cutoff, oscType]);

  useEffect(() => {
    drawOscilloscope();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [drawOscilloscope]);

  const buildCode = useCallback(() => {
    const osc = OSCILLATORS[oscType];
    const lpfValue = Math.round(200 + cutoff * 3800);
    const gainValue = (volume * 0.8).toFixed(2);
    return `note("c3 e3 g3 b3").sound("${osc}").lpf(${lpfValue}).gain(${gainValue})`;
  }, [oscType, cutoff, volume]);

  const handlePlay = async () => {
    if (!isReady) return;
    try {
      const audioCtx = (window as any).getAudioContext?.();
      if (audioCtx?.state === 'suspended') await audioCtx.resume();

      const playCode = showEditor ? code : buildCode();
      if (typeof (window as any).evaluate === 'function') {
        await (window as any).evaluate(playCode);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Play error:', error);
    }
  };

  const handleStop = () => {
    try {
      if (typeof (window as any).hush === 'function') (window as any).hush();
      setIsPlaying(false);
    } catch (error) {
      console.error('Stop error:', error);
    }
  };

  const handlePresetSelect = (index: number) => {
    setActivePreset(index);
    setCode(PRESETS[index].code);
    if (isPlaying) handleStop();
  };

  return (
    <div className="moog-synth">
      {/* 우드 사이드 패널 */}
      <div className="wood-panel left" />

      {/* 메인 패널 */}
      <div className="main-panel">
        {/* 헤더 */}
        <div className="moog-header">
          <div className="logo-section">
            <span className="brand">NODE</span>
            <span className="model">SYNTH-1</span>
          </div>
          <div className="status-leds">
            <div className={`led ${isReady ? 'on' : ''}`} />
            <span>POWER</span>
            <div className={`led red ${isPlaying ? 'on blink' : ''}`} />
            <span>ACTIVE</span>
          </div>
        </div>

        {/* 오실로스코프 디스플레이 */}
        <div className="oscilloscope">
          <div className="scope-bezel">
            <canvas ref={canvasRef} width={360} height={120} className="scope-screen" />
          </div>
          <div className="scope-label">WAVEFORM MONITOR</div>
        </div>

        {/* 오실레이터 섹션 */}
        <div className="synth-section">
          <div className="section-label">OSCILLATOR</div>
          <div className="osc-selector">
            {OSCILLATORS.map((osc, index) => (
              <motion.button
                key={osc}
                className={`osc-btn ${oscType === index ? 'active' : ''}`}
                onClick={() => setOscType(index)}
                whileTap={{ scale: 0.95 }}
              >
                <div className="osc-icon">
                  {osc === 'sine' && '∿'}
                  {osc === 'sawtooth' && '⩘'}
                  {osc === 'square' && '⊓'}
                  {osc === 'triangle' && '△'}
                </div>
                <span>{osc.toUpperCase().slice(0, 3)}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* 노브 섹션 */}
        <div className="synth-section">
          <div className="section-label">FILTER / AMP</div>
          <div className="knobs-row">
            <Knob value={cutoff} min={0} max={1} label="CUTOFF" onChange={setCutoff} />
            <Knob value={resonance} min={0} max={1} label="RES" onChange={setResonance} />
            <Knob value={attack} min={0} max={1} label="ATTACK" onChange={setAttack} />
            <Knob value={release} min={0} max={1} label="RELEASE" onChange={setRelease} />
            <Knob value={volume} min={0} max={1} label="VOLUME" onChange={setVolume} />
          </div>
        </div>

        {/* 프리셋 섹션 */}
        <div className="synth-section">
          <div className="section-label">PRESETS</div>
          <div className="presets-row">
            {PRESETS.map((preset, index) => (
              <motion.button
                key={index}
                className={`preset-switch ${activePreset === index ? 'active' : ''}`}
                onClick={() => handlePresetSelect(index)}
                whileTap={{ y: 2 }}
              >
                <div className="switch-led" />
                <span>{preset.name}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* 메인 컨트롤 */}
        <div className="main-controls">
          <motion.button
            className={`main-btn play-btn ${isPlaying ? 'active' : ''}`}
            onClick={isPlaying ? handleStop : handlePlay}
            disabled={!isReady}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="btn-led" />
            {isPlaying ? 'STOP' : 'PLAY'}
          </motion.button>

          <motion.button
            className={`main-btn code-btn ${showEditor ? 'active' : ''}`}
            onClick={() => setShowEditor(!showEditor)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="btn-led" />
            CODE
          </motion.button>
        </div>

        {/* 코드 에디터 */}
        <AnimatePresence>
          {showEditor && (
            <motion.div
              className="code-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div className="code-header">
                <span>PATTERN EDITOR</span>
                <div className="code-led on" />
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                spellCheck={false}
                className="code-input"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 우드 사이드 패널 */}
      <div className="wood-panel right" />
    </div>
  );
};

export default StrudelSynth;
