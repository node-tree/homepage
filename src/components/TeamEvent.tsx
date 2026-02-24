import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'nodetree.kr' || window.location.hostname === 'www.nodetree.kr')
    ? '/api'
    : process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api');

const TEAM_COLORS = [
  { name: 'RED',    hex: '#E53935' },
  { name: 'BLUE',   hex: '#1E88E5' },
  { name: 'GREEN',  hex: '#43A047' },
  { name: 'YELLOW', hex: '#FDD835' },
  { name: 'PURPLE', hex: '#8E24AA' },
  { name: 'ORANGE', hex: '#FB8C00' },
  { name: 'PINK',   hex: '#D81B60' },
  { name: 'CYAN',   hex: '#00ACC1' }
];

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
  const { isAuthenticated, token, user } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'admin';

  const [color, setColor] = useState<TeamColor | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [stats, setStats] = useState<TeamStat[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [showStats, setShowStats] = useState(false);

  // 저장된 세션과 색상 확인 (새로고침 대응)
  const getSavedAssignment = useCallback(() => {
    const saved = localStorage.getItem('team_event_assignment');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  }, []);

  const saveAssignment = (sessionId: string, teamColor: TeamColor) => {
    localStorage.setItem('team_event_assignment', JSON.stringify({ sessionId, color: teamColor }));
  };

  // 색상 조회/배정
  const fetchColor = useCallback(async () => {
    try {
      const visitorId = getVisitorId();

      // 먼저 현재 세션 확인
      const sessionRes = await fetch(`${API_BASE_URL}/team-event/session`);
      const sessionData = await sessionRes.json();

      if (!sessionData.success || !sessionData.active) {
        setSessionActive(false);
        setColor(null);
        setLoading(false);
        return;
      }

      setSessionActive(true);

      // 로컬에 저장된 배정이 현재 세션과 같은지 확인
      const saved = getSavedAssignment();
      if (saved && saved.sessionId === sessionData.sessionId && saved.color) {
        setColor(saved.color);
        setLoading(false);
        return;
      }

      // 서버에서 색상 조회/배정
      const colorRes = await fetch(`${API_BASE_URL}/team-event/color/${visitorId}`);
      const colorData = await colorRes.json();

      if (colorData.success && colorData.assigned) {
        setColor(colorData.color);
        saveAssignment(sessionData.sessionId, colorData.color);
      } else {
        setColor(null);
      }
    } catch (err) {
      console.error('팀 색상 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  }, [getSavedAssignment]);

  // 통계 조회
  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/team-event/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setTotalCount(data.total);
      }
    } catch (err) {
      console.error('통계 조회 오류:', err);
    }
  }, [token]);

  // 리셋 (새 세션 시작)
  const handleReset = async () => {
    if (!token || resetting) return;
    if (!window.confirm('정말 리셋하시겠습니까? 모든 팀 배정이 초기화됩니다.')) return;

    setResetting(true);
    try {
      // 새 세션 시작
      const res = await fetch(`${API_BASE_URL}/team-event/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        // 로컬 저장 제거
        localStorage.removeItem('team_event_assignment');
        setColor(null);
        setStats([]);
        setTotalCount(0);
        // 다시 색상 배정 받기
        await fetchColor();
        if (isAdmin) await fetchStats();
      }
    } catch (err) {
      console.error('리셋 오류:', err);
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    fetchColor();
  }, [fetchColor]);

  useEffect(() => {
    if (isAdmin && showStats) {
      fetchStats();
      const interval = setInterval(fetchStats, 5000); // 5초마다 갱신
      return () => clearInterval(interval);
    }
  }, [isAdmin, showStats, fetchStats]);

  // 로딩
  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#111', color: '#fff',
        fontSize: '1.2rem', fontFamily: 'monospace'
      }}>
        Loading...
      </div>
    );
  }

  // 이벤트 미시작
  if (!sessionActive && !isAdmin) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#111', color: '#666',
        fontSize: '1.2rem', fontFamily: 'monospace'
      }}>
        이벤트 준비 중
      </div>
    );
  }

  // 관리자: 이벤트 미시작 시 시작 버튼
  if (!sessionActive && isAdmin) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#111', color: '#fff',
        fontFamily: 'monospace', gap: '24px'
      }}>
        <div style={{ fontSize: '1.5rem', opacity: 0.7 }}>TEAM EVENT</div>
        <button
          onClick={handleReset}
          disabled={resetting}
          style={{
            padding: '16px 48px',
            fontSize: '1.2rem',
            background: '#fff',
            color: '#111',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontWeight: 'bold'
          }}
        >
          {resetting ? '시작 중...' : '이벤트 시작'}
        </button>
      </div>
    );
  }

  const bgColor = color?.hex || '#111';
  // 밝은 색상(YELLOW, CYAN)일 때 텍스트를 어둡게
  const isLightColor = color?.name === 'YELLOW' || color?.name === 'CYAN';
  const textColor = isLightColor ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';
  const textColorDim = isLightColor ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: bgColor,
      transition: 'background 0.6s ease',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    }}>
      {/* 팀 이름 - 비로그인 사용자에게도 보임 */}
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

      {/* 관리자 패널 */}
      {isAdmin && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          zIndex: 100
        }}>
          {/* 버튼 영역 */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={handleReset}
              disabled={resetting}
              style={{
                padding: '12px 32px',
                fontSize: '1rem',
                background: '#ff4444',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: resetting ? 'not-allowed' : 'pointer',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                opacity: resetting ? 0.5 : 1
              }}
            >
              {resetting ? 'RESETTING...' : 'RESET'}
            </button>
            <button
              onClick={() => setShowStats(!showStats)}
              style={{
                padding: '12px 32px',
                fontSize: '1rem',
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: 'monospace'
              }}
            >
              {showStats ? 'HIDE STATS' : 'SHOW STATS'}
            </button>
          </div>

          {/* 통계 */}
          {showStats && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              width: '100%',
              maxWidth: '600px'
            }}>
              {stats.map((s) => (
                <div key={s.teamIndex} style={{
                  background: s.color.hex,
                  borderRadius: '6px',
                  padding: '8px',
                  textAlign: 'center',
                  color: (s.color.name === 'YELLOW' || s.color.name === 'CYAN') ? '#000' : '#fff',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem'
                }}>
                  <div style={{ fontWeight: 'bold' }}>{s.color.name}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{s.count}</div>
                </div>
              ))}
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.7)',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                paddingTop: '4px'
              }}>
                Total: {totalCount} / 130
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
