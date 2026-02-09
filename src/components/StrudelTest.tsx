import React, { useEffect, useRef, useState } from 'react';

// Strudel 모듈 참조 저장
let strudelModule: any = null;

const StrudelTest: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [code, setCode] = useState('note("c a f e").sound("sawtooth")');
  const [log, setLog] = useState<string[]>([]);
  const initialized = useRef(false);

  const addLog = (msg: string) => {
    setLog(prev => [...prev.slice(-4), msg]);
    console.log(msg);
  };

  useEffect(() => {
    const loadStrudel = async () => {
      if (initialized.current) return;

      try {
        addLog('Loading @strudel/web...');
        strudelModule = await import('@strudel/web');
        addLog('Module loaded, initializing...');

        await strudelModule.initStrudel();
        initialized.current = true;
        setIsReady(true);
        addLog('Strudel ready! Click Play.');

        // 전역 함수 확인
        addLog(`evaluate: ${typeof (window as any).evaluate}`);
      } catch (error) {
        addLog(`Error: ${error}`);
        console.error('Failed to initialize Strudel:', error);
      }
    };

    loadStrudel();
  }, []);

  const handlePlay = async () => {
    if (!isReady) {
      addLog('Not ready yet');
      return;
    }

    try {
      // AudioContext resume (브라우저 Autoplay 정책)
      const audioCtx = (window as any).getAudioContext?.();
      if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
        addLog('AudioContext resumed');
      }

      addLog(`Playing: ${code}`);

      // 방법 1: 전역 evaluate 사용
      if (typeof (window as any).evaluate === 'function') {
        const result = await (window as any).evaluate(code);
        setIsPlaying(true);
        addLog('Playing via evaluate()');
        console.log('evaluate result:', result);
      }
      // 방법 2: 모듈에서 직접 호출
      else if (strudelModule?.evaluate) {
        await strudelModule.evaluate(code);
        setIsPlaying(true);
        addLog('Playing via module.evaluate()');
      }
      else {
        addLog('No evaluate function found');
      }
    } catch (error) {
      addLog(`Play error: ${error}`);
      console.error('Play error:', error);
    }
  };

  const handleStop = () => {
    try {
      if (typeof (window as any).hush === 'function') {
        (window as any).hush();
      } else if (strudelModule?.hush) {
        strudelModule.hush();
      }
      setIsPlaying(false);
      addLog('Stopped');
    } catch (error) {
      addLog(`Stop error: ${error}`);
      console.error('Stop error:', error);
    }
  };

  return (
    <div style={{
      padding: '20px',
      background: '#1a1a1a',
      borderRadius: '8px',
      maxWidth: '600px',
      margin: '20px auto',
      fontFamily: 'monospace'
    }}>
      <h3 style={{ color: '#fff', marginBottom: '15px' }}>
        Strudel Test {isReady ? '✓' : '(Loading...)'}
      </h3>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        style={{
          width: '100%',
          height: '100px',
          background: '#2a2a2a',
          color: '#0f0',
          border: '1px solid #444',
          borderRadius: '4px',
          padding: '10px',
          fontFamily: 'monospace',
          fontSize: '14px',
          resize: 'vertical'
        }}
        placeholder="Enter Strudel code..."
      />

      <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
        <button
          onClick={handlePlay}
          disabled={!isReady}
          style={{
            padding: '10px 20px',
            background: isPlaying ? '#444' : '#4CAF50',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isReady ? 'pointer' : 'not-allowed',
            fontSize: '14px'
          }}
        >
          ▶ Play
        </button>

        <button
          onClick={handleStop}
          style={{
            padding: '10px 20px',
            background: '#f44336',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ■ Stop
        </button>
      </div>

      {/* 로그 표시 */}
      <div style={{
        marginTop: '15px',
        padding: '10px',
        background: '#0a0a0a',
        borderRadius: '4px',
        fontSize: '11px',
        color: '#0f0',
        fontFamily: 'monospace',
        maxHeight: '100px',
        overflow: 'auto'
      }}>
        {log.map((l, i) => (
          <div key={i}>&gt; {l}</div>
        ))}
      </div>

      <div style={{ marginTop: '20px', color: '#888', fontSize: '12px' }}>
        <p>예제 패턴 (내장 신디사이저):</p>
        <ul style={{ paddingLeft: '20px' }}>
          <li><code>note("c a f e").sound("sawtooth")</code></li>
          <li><code>note("c e g b").sound("sine").lpf(800)</code></li>
          <li><code>note("c3 e3 g3").sound("square").gain(0.3)</code></li>
          <li><code>note("c2").sound("triangle").slow(2)</code></li>
        </ul>
        <p style={{ marginTop: '10px' }}>사용 가능한 사운드: sine, sawtooth, square, triangle</p>
      </div>
    </div>
  );
};

export default StrudelTest;
