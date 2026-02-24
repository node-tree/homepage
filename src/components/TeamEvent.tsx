import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'nodetree.kr' || window.location.hostname === 'www.nodetree.kr')
    ? '/api'
    : process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api');

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
  const { isAuthenticated, isLoading: authLoading, token, user } = useAuth();
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

  // 세션 상태만 확인 (로그인 사용자용)
  const checkSession = useCallback(async () => {
    try {
      const sessionRes = await fetch(`${API_BASE_URL}/team-event/session`);
      const sessionData = await sessionRes.json();
      setSessionActive(sessionData.success && sessionData.active);
    } catch (err) {
      console.error('세션 확인 오류:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 색상 조회/배정 (비로그인 방문자 전용)
  const fetchColor = useCallback(async () => {
    try {
      const visitorId = getVisitorId();

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
      const res = await fetch(`${API_BASE_URL}/team-event/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        localStorage.removeItem('team_event_assignment');
        setColor(null);
        setStats([]);
        setTotalCount(0);
        setSessionActive(true);
        if (isAdmin) await fetchStats();
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
      // 로그인 사용자: 세션 상태만 확인, 팀 배정 안 함
      checkSession();
    } else {
      // 비로그인 방문자: 팀 색상 배정
      fetchColor();
    }
  }, [authLoading, isAuthenticated, checkSession, fetchColor]);

  // 관리자 통계 자동 갱신
  useEffect(() => {
    if (isAdmin && showStats) {
      fetchStats();
      const interval = setInterval(fetchStats, 5000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, showStats, fetchStats]);

  // auth 로딩 중이거나 데이터 로딩 중
  if (authLoading || loading) {
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

  // ─── 관리자 화면 ───
  if (isAdmin) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#111', color: '#fff',
        fontFamily: 'monospace', gap: '24px'
      }}>
        <div style={{ fontSize: '2rem', fontWeight: 900, opacity: 0.8 }}>TEAM EVENT</div>
        <div style={{ fontSize: '1rem', opacity: 0.5 }}>
          {sessionActive ? '이벤트 진행 중' : '이벤트 대기 중'}
        </div>

        {/* 버튼 영역 */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={handleReset}
            disabled={resetting}
            style={{
              padding: '16px 48px',
              fontSize: '1.1rem',
              background: sessionActive ? '#ff4444' : '#fff',
              color: sessionActive ? '#fff' : '#111',
              border: 'none',
              borderRadius: '8px',
              cursor: resetting ? 'not-allowed' : 'pointer',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              opacity: resetting ? 0.5 : 1
            }}
          >
            {resetting ? 'RESETTING...' : sessionActive ? 'RESET' : 'START EVENT'}
          </button>
          {sessionActive && (
            <button
              onClick={() => setShowStats(!showStats)}
              style={{
                padding: '16px 48px',
                fontSize: '1.1rem',
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: 'monospace'
              }}
            >
              {showStats ? 'HIDE STATS' : 'SHOW STATS'}
            </button>
          )}
        </div>

        {/* 통계 */}
        {showStats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px',
            width: '100%',
            maxWidth: '500px',
            padding: '0 16px'
          }}>
            {stats.map((s) => (
              <div key={s.teamIndex} style={{
                background: s.color.hex,
                borderRadius: '8px',
                padding: '12px 8px',
                textAlign: 'center',
                color: (s.color.name === 'YELLOW' || s.color.name === 'CYAN') ? '#000' : '#fff',
                fontFamily: 'monospace',
                fontSize: '0.85rem'
              }}>
                <div style={{ fontWeight: 'bold' }}>{s.color.name}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900 }}>{s.count}</div>
              </div>
            ))}
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.5)',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              paddingTop: '8px'
            }}>
              Total: {totalCount} / 130
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── 비로그인 방문자: 이벤트 미시작 ───
  if (!sessionActive) {
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

  // ─── 비로그인 방문자: 전체화면 색상 ───
  const bgColor = color?.hex || '#111';
  const isLightColor = color?.name === 'YELLOW' || color?.name === 'CYAN';
  const textColor = isLightColor ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)';

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
