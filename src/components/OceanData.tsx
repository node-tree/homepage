import React, { useState, useEffect, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
// TIDAL METABOLISM — Ryoji Ikeda treatment
// Pure black. White data. Clinical precision.
// Numbers are the material. The grid is the architecture.
// ═══════════════════════════════════════════════════════════════

interface StationData {
  station: string; code: string; lat: string; lon: string;
  data: Record<string, string>[];
}

const OceanData: React.FC = () => {
  const [stations, setStations] = useState<StationData[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch('/api/ocean/tide-realtime');
      const d = await res.json();
      if (d.stations?.length > 0) setStations(d.stations);
    } catch {}
    setLastUpdate(new Date());
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { const iv = setInterval(fetchAll, 60000); return () => clearInterval(iv); }, [fetchAll]);

  return (
    <div style={{
      minHeight: '100vh', background: '#000', color: '#fff',
      fontFamily: "'Courier New', 'Menlo', monospace",
      cursor: 'crosshair', overflow: 'hidden',
    }}>
      {/* Micro header — Ikeda-style minimal info bar */}
      <div style={{
        height: 28, borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', fontSize: 9, color: '#444',
        fontVariantNumeric: 'tabular-nums', letterSpacing: '0.05em',
      }}>
        <span>KHOA.REALTIME.BUSAN.4ST</span>
        <span>{lastUpdate.toLocaleTimeString('ko-KR', { hour12: false })}.{String(lastUpdate.getMilliseconds()).padStart(3, '0')}</span>
      </div>

      {/* Three data panels */}
      <DataBarcode stations={stations} />
      <NumberMatrix stations={stations} />
      <ScanField stations={stations} />

      {/* Bottom data ticker */}
      <DataTicker stations={stations} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// 01 — OSCILLOSCOPE
// Horizontal waveform per station — tide as amplitude
// Like Ikeda's test pattern: precise, clinical, white on black
// ═══════════════════════════════════════════════════════════════

function DataBarcode({ stations }: { stations: StationData[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tRef = useRef(0);
  const bufRef = useRef<Float32Array[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const r = canvas.parentElement!.getBoundingClientRect();
      canvas.width = r.width * 2; canvas.height = r.height * 2;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
    };
    resize();

    // Ring buffer per station for waveform history
    const bufLen = 800;
    if (bufRef.current.length === 0) {
      for (let i = 0; i < 4; i++) bufRef.current.push(new Float32Array(bufLen));
    }

    let animId: number;
    const draw = () => {
      tRef.current += 1;
      const t = tRef.current;
      const w = canvas.width / 2, h = canvas.height / 2;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);

      const n = Math.max(stations.length, 1);
      const bandH = h / n;

      stations.forEach((s, si) => {
        const latest = s.data[s.data.length - 1];
        if (!latest) return;

        const tide = parseFloat(latest.tide_level) || 50;
        const temp = parseFloat(latest.water_temp) || 13;
        const sal = parseFloat(latest.salinity) || 34;

        const yCenter = si * bandH + bandH / 2;
        const amplitude = (tide / 150) * (bandH * 0.35);

        // Push new sample into ring buffer
        const buf = bufRef.current[si];
        if (buf) {
          buf.copyWithin(0, 1);
          // Composite waveform from tide data — like tidal harmonics
          const sample =
            Math.sin(t * 0.02 + si * 1.5) * amplitude +
            Math.sin(t * 0.047 + si * 0.8) * amplitude * 0.4 +
            Math.sin(t * 0.011 + si * 2.1) * amplitude * 0.6 +
            (Math.random() - 0.5) * amplitude * 0.05; // noise floor
          buf[bufLen - 1] = sample;
        }

        // Grid lines
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(0, yCenter); ctx.lineTo(w, yCenter); ctx.stroke();
        ctx.strokeStyle = '#0a0a0a';
        ctx.beginPath(); ctx.moveTo(0, yCenter - bandH * 0.3); ctx.lineTo(w, yCenter - bandH * 0.3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, yCenter + bandH * 0.3); ctx.lineTo(w, yCenter + bandH * 0.3); ctx.stroke();

        // Waveform
        if (buf) {
          ctx.beginPath();
          const step = w / bufLen;
          for (let i = 0; i < bufLen; i++) {
            const x = i * step;
            const y = yCenter + buf[i];
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(255,255,255,0.85)`;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Glow line
          ctx.strokeStyle = `rgba(255,255,255,0.15)`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Station label — left
        ctx.fillStyle = '#888';
        ctx.font = '10px "Courier New", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(s.station, 8, si * bandH + 14);

        // Data values — right side, stacked
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.font = '18px "Courier New", monospace';
        ctx.fillText(`${tide.toFixed(0)}`, w - 10, yCenter + 6);
        ctx.fillStyle = '#555';
        ctx.font = '8px "Courier New", monospace';
        ctx.fillText(`cm`, w - 10, yCenter + 16);
        ctx.fillText(`${temp}° ${sal}‰`, w - 10, si * bandH + 14);
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, [stations]);

  return (
    <section style={{ borderBottom: '1px solid #1a1a1a' }}>
      <MicroLabel text="01  TIDE.SCOPE  조위(cm) → 파형 진폭  |  수온(°C) · 염분(‰) → 파형 주파수 합성" />
      <div style={{ height: 300 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// 02 — NUMBER MATRIX
// Ikeda-style scrolling number grid
// Temperature values rendered as pure data streams
// ═══════════════════════════════════════════════════════════════

function NumberMatrix({ stations }: { stations: StationData[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const r = canvas.parentElement!.getBoundingClientRect();
      canvas.width = r.width * 2; canvas.height = r.height * 2;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
    };
    resize();

    // Pre-generate number columns
    const cols: { x: number; speed: number; chars: string[]; stationIdx: number }[] = [];
    const colW = 36;
    const w = canvas.width / 2;
    const numCols = Math.floor(w / colW);

    for (let i = 0; i < numCols; i++) {
      cols.push({
        x: i * colW,
        speed: 0.3 + Math.random() * 0.7,
        chars: [],
        stationIdx: i % 4,
      });
    }

    let animId: number;
    const draw = () => {
      frameRef.current++;
      const h = canvas.height / 2;
      const w2 = canvas.width / 2;

      // Fade effect
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, 0, w2, h);

      if (stations.length === 0) {
        animId = requestAnimationFrame(draw);
        return;
      }

      ctx.font = '9px "Courier New", monospace';
      ctx.textAlign = 'left';

      cols.forEach(col => {
        const s = stations[col.stationIdx % stations.length];
        const latest = s?.data[s.data.length - 1];
        if (!latest) return;

        const temp = latest.water_temp || '0.00';
        const sal = latest.salinity || '0.00';
        const tide = latest.tide_level || '0';
        const pressure = latest.air_pressure || '0';

        // Scroll position
        const scrollY = (frameRef.current * col.speed) % h;

        // Generate data characters from actual measurements
        const dataValues = [temp, sal, tide, pressure, temp, sal];
        const rowH = 12;

        for (let row = 0; row < Math.floor(h / rowH) + 1; row++) {
          const y = (row * rowH + scrollY) % h;
          const dataStr = dataValues[row % dataValues.length];

          // Brightness based on position — brighter near center
          const centerDist = Math.abs(y - h / 2) / (h / 2);
          const alpha = Math.max(0.03, (1 - centerDist) * 0.5);

          // Every nth row is bright (data emphasis)
          const isBright = row % 6 === 0;

          ctx.fillStyle = isBright
            ? `rgba(255,255,255,${Math.min(0.9, alpha * 2)})`
            : `rgba(255,255,255,${alpha})`;

          ctx.fillText(dataStr, col.x + 2, y);
        }

        // Station label at top of each column group
        if (col.x % (colW * Math.ceil(numCols / stations.length)) < colW) {
          ctx.fillStyle = '#666';
          ctx.font = '7px "Courier New", monospace';
          ctx.fillText(s.station, col.x + 2, 10);
          ctx.font = '9px "Courier New", monospace';
        }
      });

      // Horizontal scan line
      const scanY = (frameRef.current * 0.8) % h;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, scanY, w2, 1);

      animId = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, [stations]);

  return (
    <section style={{ borderBottom: '1px solid #1a1a1a' }}>
      <MicroLabel text="02  TEMP.MATRIX  수온(°C) · 염분(‰) · 조위(cm) · 기압(hPa) → 숫자 스트림" />
      <div style={{ height: 300 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// 03 — DATA RAIN
// 1px dots falling at wind-direction angle
// Wind speed = density, wind direction = fall angle
// Like Ikeda's data.tron — pure white pixels streaming
// ═══════════════════════════════════════════════════════════════

interface Drop {
  x: number; y: number; speed: number; len: number; si: number;
}

function ScanField({ stations }: { stations: StationData[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropsRef = useRef<Drop[]>([]);
  const initRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const r = canvas.parentElement!.getBoundingClientRect();
      canvas.width = r.width * 2; canvas.height = r.height * 2;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
    };
    resize();

    const dw = () => canvas.width / 2;
    const dh = () => canvas.height / 2;

    if (!initRef.current) {
      const w = dw(), h = dh();
      for (let i = 0; i < 1200; i++) {
        dropsRef.current.push({
          x: Math.random() * w,
          y: Math.random() * h,
          speed: 1 + Math.random() * 3,
          len: 2 + Math.random() * 8,
          si: Math.floor(Math.random() * 4),
        });
      }
      initRef.current = true;
    }

    let animId: number;
    const draw = () => {
      const w = dw(), h = dh();

      // Fade
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, 0, w, h);

      if (stations.length === 0) {
        // Default vertical rain
        dropsRef.current.forEach(d => {
          d.y += d.speed;
          if (d.y > h) { d.y = -d.len; d.x = Math.random() * w; }
          ctx.fillStyle = `rgba(255,255,255,0.15)`;
          ctx.fillRect(d.x, d.y, 0.5, d.len);
        });
        animId = requestAnimationFrame(draw);
        return;
      }

      // Compute wind vectors per station zone
      const zoneW = w / stations.length;

      dropsRef.current.forEach(d => {
        // Which station zone is this drop in?
        const zoneIdx = Math.min(stations.length - 1, Math.floor(d.x / zoneW));
        const s = stations[zoneIdx];
        const latest = s?.data[s.data.length - 1];

        let angle = Math.PI / 2; // default: straight down
        let spd = 2;

        if (latest) {
          const windDir = (parseFloat(latest.wind_dir) || 180) * Math.PI / 180;
          const windSpd = parseFloat(latest.wind_speed) || 2;
          angle = windDir;
          spd = 1 + windSpd * 0.4;
        }

        // Move along wind direction
        d.x += Math.sin(angle) * d.speed * spd * 0.3;
        d.y += Math.cos(angle) * d.speed * spd * 0.3;

        // Wrap
        if (d.y > h + 10) { d.y = -d.len; d.x = Math.random() * w; }
        if (d.y < -20) { d.y = h + d.len; d.x = Math.random() * w; }
        if (d.x > w + 10) d.x = 0;
        if (d.x < -10) d.x = w;

        // Draw streak
        const endX = d.x - Math.sin(angle) * d.len;
        const endY = d.y - Math.cos(angle) * d.len;
        const alpha = 0.1 + d.speed * 0.12;

        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Bright head pixel
        ctx.fillStyle = `rgba(255,255,255,${alpha * 1.5})`;
        ctx.fillRect(d.x, d.y, 1, 1);
      });

      // Station zone labels at top
      stations.forEach((s, i) => {
        const latest = s.data[s.data.length - 1];
        if (!latest) return;
        const zx = i * zoneW + zoneW / 2;

        // Zone divider
        if (i > 0) {
          ctx.strokeStyle = '#1a1a1a';
          ctx.lineWidth = 0.5;
          ctx.beginPath(); ctx.moveTo(i * zoneW, 0); ctx.lineTo(i * zoneW, h); ctx.stroke();
        }

        // Label
        ctx.fillStyle = '#888';
        ctx.font = '10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(s.station, zx, 16);
        ctx.fillStyle = '#555';
        ctx.font = '9px "Courier New", monospace';
        ctx.fillText(`${latest.wind_dir}°`, zx - 20, 28);
        ctx.fillText(`${latest.wind_speed}m/s`, zx + 20, 28);

        // Large wind speed at bottom
        ctx.fillStyle = '#fff';
        ctx.font = '22px "Courier New", monospace';
        ctx.fillText(`${parseFloat(latest.wind_speed).toFixed(1)}`, zx, h - 20);
        ctx.fillStyle = '#444';
        ctx.font = '8px "Courier New", monospace';
        ctx.fillText('m/s', zx, h - 8);
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, [stations]);

  return (
    <section style={{ borderBottom: '1px solid #1a1a1a' }}>
      <MicroLabel text="03  WIND.RAIN  풍향(°) → 낙하 각도  |  풍속(m/s) → 입자 속도  |  1200 particles" />
      <div style={{ height: 300 }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// DATA TICKER — bottom raw stream
// ═══════════════════════════════════════════════════════════════

function DataTicker({ stations }: { stations: StationData[] }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 100); return () => clearInterval(iv); }, []);

  if (stations.length === 0) return null;

  return (
    <div style={{
      height: 24, borderTop: '1px solid #1a1a1a',
      display: 'flex', alignItems: 'center',
      padding: '0 12px', fontSize: 8, color: '#444',
      fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', gap: 24, whiteSpace: 'nowrap',
        transform: `translateX(-${(tick * 0.5) % 800}px)`,
        transition: 'none',
      }}>
        {[...stations, ...stations, ...stations].map((s, i) => {
          const d = s.data[s.data.length - 1];
          if (!d) return null;
          return (
            <span key={i}>
              <span style={{ color: '#666' }}>{s.station}</span>
              {' '}
              {d.water_temp}° {d.tide_level}cm {d.salinity}‰ {d.wind_dir}°/{d.wind_speed}ms {d.air_pressure}hPa
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Micro label — Ikeda-style section divider
// ═══════════════════════════════════════════════════════════════

function MicroLabel({ text }: { text: string }) {
  // Split "01  TITLE  description" into parts
  const parts = text.split('  ');
  const num = parts[0] || '';
  const title = parts[1] || '';
  const desc = parts.slice(2).join('  ');

  return (
    <div style={{
      height: 32, borderBottom: '1px solid #151515',
      display: 'flex', alignItems: 'center',
      padding: '0 12px', gap: 12,
      letterSpacing: '0.06em',
    }}>
      <span style={{ fontSize: 9, color: '#555' }}>{num}</span>
      <span style={{ fontSize: 12, color: '#aaa', letterSpacing: '0.12em' }}>{title}</span>
      <span style={{ fontSize: 9, color: '#444' }}>{desc}</span>
    </div>
  );
}

export default OceanData;
