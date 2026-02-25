import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'nodetree.kr' || window.location.hostname === 'www.nodetree.kr')
    ? '/api'
    : process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api');

const EVENT_URL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'nodetree.kr' || window.location.hostname === 'www.nodetree.kr')
    ? 'https://nodetree.kr/team-event'
    : `${window.location.origin}/team-event`;

interface TeamColor {
  name: string;
  nameKo: string;
  hex: string;
}

interface TeamStat {
  teamIndex: number;
  color: TeamColor;
  count: number;
}

function getVisitorId(): string {
  const key = 'team_event_visitor_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    localStorage.setItem(key, id);
  }
  return id;
}

export default function TeamEvent() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const [color, setColor] = useState<TeamColor | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [stats, setStats] = useState<TeamStat[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error('풀스크린 전환 실패:', err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error('풀스크린 해제 실패:', err);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 세션 상태 확인
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/team-event/session`);
      const data = await res.json();
      setSessionActive(data.success && data.active);
    } catch (err) {
      console.error('세션 확인 오류:', err);
      setSessionActive(false);
    } finally {
      setSessionLoaded(true);
    }
  }, []);

  // 비로그인 방문자: 색상 배정
  const fetchColor = useCallback(async () => {
    try {
      const visitorId = getVisitorId();
      const sessionRes = await fetch(`${API_BASE_URL}/team-event/session`);
      const sessionData = await sessionRes.json();

      if (!sessionData.success || !sessionData.active) {
        setSessionActive(false);
        setSessionLoaded(true);
        return;
      }
      setSessionActive(true);

      const saved = localStorage.getItem('team_event_assignment');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.sessionId === sessionData.sessionId && parsed.color) {
            setColor(parsed.color);
            setSessionLoaded(true);
            return;
          }
        } catch {}
      }

      const colorRes = await fetch(`${API_BASE_URL}/team-event/color/${visitorId}`);
      const colorData = await colorRes.json();
      if (colorData.success && colorData.assigned) {
        setColor(colorData.color);
        localStorage.setItem('team_event_assignment',
          JSON.stringify({ sessionId: sessionData.sessionId, color: colorData.color }));
      }
    } catch (err) {
      console.error('팀 색상 조회 오류:', err);
    } finally {
      setSessionLoaded(true);
    }
  }, []);

  // 통계 조회
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/team-event/stats`);
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setTotalCount(data.total);
      }
    } catch (err) {
      console.error('통계 조회 오류:', err);
    }
  }, []);

  // 이벤트 시작/리셋
  const handleStartOrReset = async () => {
    if (resetting) return;
    if (sessionActive && !window.confirm('정말 리셋하시겠습니까? 모든 팀 배정이 초기화됩니다.')) return;

    setResetting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/team-event/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        localStorage.removeItem('team_event_assignment');
        setColor(null);
        setStats([]);
        setTotalCount(0);
        setSessionActive(true);
        await fetchStats();
      }
    } catch (err) {
      console.error('리셋 오류:', err);
    } finally {
      setResetting(false);
    }
  };

  // auth 로딩 완료 후 데이터 fetch
  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) {
      checkSession();
    } else {
      fetchColor();
    }
  }, [authLoading, isAuthenticated, checkSession, fetchColor]);

  // 관리자: 통계 자동 갱신 (이벤트 진행 중일 때)
  useEffect(() => {
    if (isAuthenticated && sessionActive) {
      fetchStats();
      const interval = setInterval(fetchStats, 3000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, sessionActive, fetchStats]);

  // ─── auth 로딩 중 ───
  if (authLoading) {
    return (
      <div style={fullScreenStyle}>
        <FullscreenButton isFullscreen={isFullscreen} onClick={toggleFullscreen} />
        <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: '1.2rem' }}>Loading...</span>
      </div>
    );
  }

  // ─── 로그인 사용자 (관리자) 화면 ───
  if (isAuthenticated) {
    return (
      <div style={{
        ...fullScreenStyle,
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
        justifyContent: 'stretch'
      }}>
        <FullscreenButton isFullscreen={isFullscreen} onClick={toggleFullscreen} />

        {/* 컨트롤 오버레이 (좌상단) */}
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <button
            onClick={handleStartOrReset}
            disabled={resetting || !sessionLoaded}
            style={{
              padding: '8px 24px',
              fontSize: '0.85rem',
              background: sessionActive ? 'rgba(255,68,68,0.9)' : 'rgba(255,255,255,0.9)',
              color: sessionActive ? '#fff' : '#111',
              border: 'none',
              borderRadius: '6px',
              cursor: (resetting || !sessionLoaded) ? 'not-allowed' : 'pointer',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              opacity: (resetting || !sessionLoaded) ? 0.5 : 1,
              backdropFilter: 'blur(4px)'
            }}
          >
            {resetting ? 'RESETTING...' : sessionActive ? 'RESET' : 'START EVENT'}
          </button>
        </div>

        {/* QR 코드 오버레이 (우하단) */}
        <div style={{
          position: 'absolute',
          bottom: '60px',
          right: '24px',
          zIndex: 100,
          background: 'rgba(255,255,255,0.97)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <QRCodeSVG
            value={EVENT_URL}
            size={240}
            level="M"
            bgColor="#ffffff"
            fgColor="#000000"
          />
          <div style={{
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            color: '#555',
            textAlign: 'center',
            wordBreak: 'break-all',
            maxWidth: '240px'
          }}>
            {EVENT_URL}
          </div>
        </div>

        {/* 팀별 색상 현황 — 화면 가득 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${stats.length || 4}, 1fr)`,
          width: '100%',
          height: '100%',
          flex: 1,
          gap: 0
        }}>
          {stats.map((s) => {
            const isLight = s.color.name === 'YELLOW' || s.color.name === 'CYAN';
            const textClr = isLight ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)';
            return (
              <div key={s.teamIndex} style={{
                background: s.color.hex,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: textClr,
                fontFamily: 'monospace',
                gap: '0.2em',
                padding: '16px'
              }}>
                {/* 팀 인원 수 */}
                <div style={{
                  fontSize: 'clamp(4rem, 12vw, 14rem)',
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: '-0.02em'
                }}>
                  {s.count}
                </div>
                {/* 한글 이름 */}
                <div style={{
                  fontSize: 'clamp(1.2rem, 3vw, 3.5rem)',
                  fontWeight: 700,
                  letterSpacing: '0.05em'
                }}>
                  {s.color.nameKo}
                </div>
                {/* 영문 이름 */}
                <div style={{
                  fontSize: 'clamp(0.7rem, 1.5vw, 1.5rem)',
                  fontWeight: 500,
                  opacity: 0.55,
                  letterSpacing: '0.15em'
                }}>
                  {s.color.name}
                </div>
              </div>
            );
          })}
        </div>

        {/* 총 접속 인원 — 하단 바 */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5em',
          padding: '12px 300px 12px 16px',
          fontFamily: 'monospace',
          color: '#fff',
          zIndex: 50
        }}>
          <span style={{ fontSize: 'clamp(0.8rem, 1.5vw, 1.1rem)', opacity: 0.55 }}>접속 인원</span>
          <span style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', fontWeight: 900, lineHeight: 1 }}>{totalCount}</span>
          <span style={{ fontSize: 'clamp(0.8rem, 1.5vw, 1.1rem)', opacity: 0.4 }}>/ 130</span>
        </div>
      </div>
    );
  }

  // ─── 비로그인: 로딩 중 ───
  if (!sessionLoaded) {
    return (
      <div style={fullScreenStyle}>
        <FullscreenButton isFullscreen={isFullscreen} onClick={toggleFullscreen} />
        <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: '1.2rem' }}>Loading...</span>
      </div>
    );
  }

  // ─── 비로그인: 이벤트 미시작 ───
  if (!sessionActive) {
    return (
      <div style={fullScreenStyle}>
        <FullscreenButton isFullscreen={isFullscreen} onClick={toggleFullscreen} />
        <span style={{ color: '#666', fontFamily: 'monospace', fontSize: '1.2rem' }}>이벤트 준비 중</span>
      </div>
    );
  }

  // ─── 비로그인: 전체화면 색상 ───
  const bgColor = color?.hex || '#111';
  const isLightColor = color?.name === 'YELLOW' || color?.name === 'CYAN';
  const textColor = isLightColor ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';

  return (
    <div style={{
      ...fullScreenStyle,
      background: bgColor,
      transition: 'background 0.6s ease'
    }}>
      <FullscreenButton isFullscreen={isFullscreen} onClick={toggleFullscreen} />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.2em',
        userSelect: 'none'
      }}>
        <div style={{
          fontSize: 'clamp(3rem, 15vw, 10rem)',
          fontWeight: 900,
          color: textColor,
          fontFamily: 'monospace',
          letterSpacing: '0.05em',
          textAlign: 'center',
          lineHeight: 1
        }}>
          {color?.nameKo || ''}
        </div>
        <div style={{
          fontSize: 'clamp(1rem, 4vw, 2.5rem)',
          fontWeight: 600,
          color: textColor,
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          textAlign: 'center',
          opacity: 0.6
        }}>
          {color?.name || ''}
        </div>
      </div>
    </div>
  );
}

const fullScreenStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: '#111',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden'
};

function FullscreenButton({ isFullscreen, onClick }: { isFullscreen: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={isFullscreen ? '창 모드' : '전체 화면'}
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 9999,
        width: '40px',
        height: '40px',
        background: 'rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: '8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: '1.1rem',
        backdropFilter: 'blur(4px)',
        transition: 'background 0.2s'
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
    >
      {isFullscreen ? '⊟' : '⊞'}
    </button>
  );
}
