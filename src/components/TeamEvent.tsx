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
        padding: '24px 16px',
        overflowY: 'auto',
        justifyContent: 'flex-start',
        paddingTop: '40px'
      }}>
        {/* 상단: RESET 버튼 */}
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={handleStartOrReset}
            disabled={resetting || !sessionLoaded}
            style={{
              padding: '12px 40px',
              fontSize: '1rem',
              background: sessionActive ? '#ff4444' : '#fff',
              color: sessionActive ? '#fff' : '#111',
              border: 'none',
              borderRadius: '8px',
              cursor: (resetting || !sessionLoaded) ? 'not-allowed' : 'pointer',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              opacity: (resetting || !sessionLoaded) ? 0.5 : 1
            }}
          >
            {resetting ? 'RESETTING...' : sessionActive ? 'RESET' : 'START EVENT'}
          </button>
        </div>

        {/* QR 코드 */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px'
        }}>
          <QRCodeSVG
            value={EVENT_URL}
            size={Math.min(280, typeof window !== 'undefined' ? window.innerWidth - 100 : 280)}
            level="M"
            bgColor="#ffffff"
            fgColor="#000000"
          />
          <div style={{
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            color: '#666',
            textAlign: 'center',
            wordBreak: 'break-all'
          }}>
            {EVENT_URL}
          </div>
        </div>

        {/* 팀별 색상 현황 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          width: '100%',
          maxWidth: '500px',
          marginBottom: '16px'
        }}>
          {stats.map((s) => {
            const isLight = s.color.name === 'YELLOW' || s.color.name === 'CYAN';
            return (
              <div key={s.teamIndex} style={{
                background: s.color.hex,
                borderRadius: '10px',
                padding: '12px 6px',
                textAlign: 'center',
                color: isLight ? '#000' : '#fff',
                fontFamily: 'monospace'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', opacity: 0.8 }}>{s.color.name}</div>
                <div style={{ fontSize: '2rem', fontWeight: 900, lineHeight: 1.2 }}>{s.count}</div>
              </div>
            );
          })}
        </div>

        {/* 총 접속 인원 */}
        <div style={{
          fontFamily: 'monospace',
          textAlign: 'center',
          color: '#fff',
          marginBottom: '24px'
        }}>
          <div style={{ fontSize: '0.9rem', opacity: 0.5, marginBottom: '4px' }}>접속 인원</div>
          <div style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1 }}>{totalCount}</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.4, marginTop: '4px' }}>/ 130</div>
        </div>
      </div>
    );
  }

  // ─── 비로그인: 로딩 중 ───
  if (!sessionLoaded) {
    return (
      <div style={fullScreenStyle}>
        <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: '1.2rem' }}>Loading...</span>
      </div>
    );
  }

  // ─── 비로그인: 이벤트 미시작 ───
  if (!sessionActive) {
    return (
      <div style={fullScreenStyle}>
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
      <div style={{
        fontSize: 'clamp(3rem, 15vw, 10rem)',
        fontWeight: 900,
        color: textColor,
        fontFamily: 'monospace',
        letterSpacing: '0.05em',
        textAlign: 'center',
        userSelect: 'none',
        lineHeight: 1
      }}>
        {color?.name || ''}
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
