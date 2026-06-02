import React, { useCallback, useEffect, useState } from 'react';
import './dashboardView.css';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';

// ═══════════════════════════════════════════════════════════════
// 대시보드 + 프로그램 관리 (프로그램·실적 슬라이스).
//   · 대시보드: 총 참여자 실적(Σ세션 attendance / Σ정원 228) + 프로그램별 회차 진척 바.
//   · 프로그램 관리: 회차 등록(POST, 실참여 attendance 포함)/목록/삭제(DELETE).
//     실참여는 회차 단위로 입력 → 프로그램 실참여 = 그 회차 attendance 합(읽기전용 표시).
//   · 비목현황·집행장부와 동일하게 조건부 마운트 → 탭 진입 시 자동 refetch.
//   · 쓰기 후 loadSummary({silent}) 로 즉시 invalidate — 초기 로드만 전체 "불러오는 중"
//     화면을 띄우고, 쓰기 후 갱신은 화면을 갈아엎지 않는다(Render 콜드스타트 깜빡임 방지).
// ═══════════════════════════════════════════════════════════════

interface ProgramStat {
  key: string;
  name: string;
  targetGroup: string;
  quota: number;
  totalSessions: number;
  totalHours: number;
  schedule: string;
  intro: string;
  주강사: string[];
  actualParticipants: number;
  registeredSessions: number;
  remainingSessions: number;
  sessionProgress: number;
}

interface DashboardSummary {
  totalQuota: number;
  totalActualParticipants: number;
  participantProgress: number;
  totalSessions: number;
  totalRegisteredSessions: number;
  totalRemainingSessions: number;
  sessionProgress: number;
  programs: ProgramStat[];
}

interface SessionRow {
  _id: string;
  programKey: string;
  sessionNo: number;
  date: string | null;
  title: string;
  attendance: number;
  status: '예정' | '완료';
}

const num = (n: number): string => `${(n ?? 0).toLocaleString('ko-KR')}`;
const pct = (n: number): string => `${(n ?? 0).toFixed(1)}%`;
const clampRatio = (r: number): number => Math.max(0, Math.min(1, r)); // 바 표시용

const SESSION_STATUSES = ['예정', '완료'] as const;

const DashboardView: React.FC = () => {
  const { logout } = useKkumdarakAuth();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // 회차 관리 — 펼친 프로그램 + 해당 세션 목록
  const [openProgram, setOpenProgram] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    sessionNo: '',
    date: '',
    title: '',
    attendance: '',
    status: '예정' as '예정' | '완료',
  });

  const onAuthErr = useCallback(
    (err: any): boolean => {
      if (err?.code === 'KKUM_AUTH_EXPIRED') {
        logout();
        return true;
      }
      return false;
    },
    [logout],
  );

  // 대시보드(프로그램 실적 포함) 로드.
  //   silent=true(쓰기 후 갱신)는 전체 로딩 화면을 띄우지 않고 데이터만 교체한다.
  const loadSummary = useCallback(
    async (signal?: AbortSignal, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError('');
      try {
        const data = await kkumdarakAdminAPI.getDashboardSummary({ signal });
        setSummary(data as DashboardSummary);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (onAuthErr(err)) return;
        setError(err?.message || '대시보드를 불러오지 못했습니다.');
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [onAuthErr],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadSummary(controller.signal); // 초기 로드 — 전체 로딩 화면 허용
    return () => controller.abort();
  }, [loadSummary]);

  // 회차 패널 토글 + 목록 로드
  const toggleProgram = async (key: string) => {
    if (openProgram === key) {
      setOpenProgram(null);
      return;
    }
    setOpenProgram(key);
    setSessionForm({ sessionNo: '', date: '', title: '', attendance: '', status: '예정' });
    setSessionsLoading(true);
    try {
      const rows = await kkumdarakAdminAPI.getSessions(key);
      setSessions(rows as SessionRow[]);
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '회차 목록을 불러오지 못했습니다.');
    } finally {
      setSessionsLoading(false);
    }
  };

  const reloadSessions = async (key: string) => {
    try {
      const rows = await kkumdarakAdminAPI.getSessions(key);
      setSessions(rows as SessionRow[]);
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '회차 목록을 불러오지 못했습니다.');
    }
  };

  // 회차 등록(POST, attendance 포함)
  const addSession = async (key: string) => {
    if (sessionForm.sessionNo === '') return;
    setNotice('');
    try {
      await kkumdarakAdminAPI.createSession({
        programKey: key,
        sessionNo: Number(sessionForm.sessionNo),
        date: sessionForm.date || null, // YYYY-MM-DD 그대로(TZ 시프트 방지)
        title: sessionForm.title.trim(),
        attendance: Number(sessionForm.attendance) || 0,
        status: sessionForm.status,
      });
      setSessionForm({ sessionNo: '', date: '', title: '', attendance: '', status: '예정' });
      await reloadSessions(key);
      await loadSummary(undefined, { silent: true }); // 등록회차수·실참여·진척 갱신(화면 유지)
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '회차 등록에 실패했습니다.');
    }
  };

  // 회차 삭제(DELETE)
  const removeSession = async (key: string, id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('이 회차를 삭제할까요?')) return;
    try {
      await kkumdarakAdminAPI.deleteSession(id);
      await reloadSessions(key);
      await loadSummary(undefined, { silent: true });
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '회차 삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="kd-admin-state">대시보드를 불러오는 중…</div>;
  }
  if (error && !summary) {
    return (
      <div className="kd-admin-state kd-admin-state--error">
        <p>{error}</p>
        <button type="button" className="kd-admin-retry" onClick={() => loadSummary()}>
          다시 시도
        </button>
      </div>
    );
  }
  if (!summary) {
    return <div className="kd-admin-state">표시할 데이터가 없습니다.</div>;
  }

  return (
    <div className="kd-admin-dashboard">
      {/* 총괄 카드 */}
      <div className="kd-admin-totals">
        <div className="kd-admin-total-card">
          <span className="kd-admin-total-label">총 정원</span>
          <strong className="kd-admin-total-value">{num(summary.totalQuota)}명</strong>
        </div>
        <div className="kd-admin-total-card">
          <span className="kd-admin-total-label">총 실참여</span>
          <strong className="kd-admin-total-value">{num(summary.totalActualParticipants)}명</strong>
        </div>
        <div className="kd-admin-total-card">
          <span className="kd-admin-total-label">참여 실적</span>
          <strong className="kd-admin-total-value">{pct(summary.participantProgress)}</strong>
        </div>
        <div className="kd-admin-total-card">
          <span className="kd-admin-total-label">회차 등록 / 총</span>
          <strong className="kd-admin-total-value">
            {num(summary.totalRegisteredSessions)} / {num(summary.totalSessions)}
          </strong>
        </div>
      </div>

      {notice && <div className="kd-ledger-notice" role="status">{notice}</div>}
      {error && <div className="kd-ledger-warning" role="status">{error}</div>}

      {/* 프로그램별 진척 + 관리 */}
      <h3 className="kd-ledger-form-title kd-dash-section-title">프로그램별 회차 진척</h3>
      <div className="kd-dash-programs">
        {summary.programs.map((p) => {
          const isOpen = openProgram === p.key;
          return (
            <div key={p.key} className="kd-dash-program">
              <div className="kd-dash-program-head">
                <div className="kd-dash-program-name">
                  {p.name}
                  <span className="kd-dash-program-target">{p.targetGroup} · 정원 {p.quota}명</span>
                </div>
                <button
                  type="button"
                  className="kd-ledger-action"
                  onClick={() => toggleProgram(p.key)}
                  aria-expanded={isOpen}
                >
                  {isOpen ? '회차 닫기' : '회차 관리'}
                </button>
              </div>

              {/* 진척 바 (등록/총) */}
              <div className="kd-dash-bar-row">
                <div className="kd-dash-bar-track">
                  <div
                    className="kd-dash-bar-fill"
                    style={{ width: `${clampRatio(p.totalSessions ? p.registeredSessions / p.totalSessions : 0) * 100}%` }}
                  />
                </div>
                <span className="kd-dash-bar-label">
                  {p.registeredSessions}/{p.totalSessions}회 · 잔여 {p.remainingSessions}회 · {p.totalHours}시수
                </span>
              </div>

              {/* 실참여(회차 attendance 합, 읽기전용) */}
              <div className="kd-dash-participant">
                <span className="kd-field-label">실참여(회차 합)</span>
                <strong className="kd-dash-participant-value">
                  {num(p.actualParticipants)}명
                </strong>
                <span className="kd-dash-participant-of">/ 정원 {p.quota}명</span>
              </div>

              {/* 회차 관리 패널 */}
              {isOpen && (
                <div className="kd-dash-sessions">
                  <div className="kd-dash-session-form">
                    <input
                      type="number"
                      min={1}
                      className="kd-field-input"
                      placeholder="회차번호"
                      value={sessionForm.sessionNo}
                      onChange={(e) => setSessionForm((f) => ({ ...f, sessionNo: e.target.value }))}
                      aria-label="회차번호"
                    />
                    <input
                      type="date"
                      className="kd-field-input"
                      value={sessionForm.date}
                      onChange={(e) => setSessionForm((f) => ({ ...f, date: e.target.value }))}
                      aria-label="회차 날짜"
                    />
                    <input
                      type="text"
                      className="kd-field-input"
                      placeholder="제목"
                      value={sessionForm.title}
                      onChange={(e) => setSessionForm((f) => ({ ...f, title: e.target.value }))}
                      aria-label="회차 제목"
                    />
                    <input
                      type="number"
                      min={0}
                      className="kd-field-input"
                      placeholder="실참여"
                      value={sessionForm.attendance}
                      onChange={(e) => setSessionForm((f) => ({ ...f, attendance: e.target.value }))}
                      aria-label="실참여 인원"
                    />
                    <select
                      className="kd-field-input"
                      value={sessionForm.status}
                      onChange={(e) =>
                        setSessionForm((f) => ({ ...f, status: e.target.value as '예정' | '완료' }))
                      }
                      aria-label="회차 상태"
                    >
                      {SESSION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="kd-ledger-submit kd-dash-session-add"
                      onClick={() => addSession(p.key)}
                      disabled={sessionForm.sessionNo === ''}
                    >
                      회차 등록
                    </button>
                  </div>

                  {sessionsLoading ? (
                    <div className="kd-admin-state">회차 목록 불러오는 중…</div>
                  ) : sessions.length === 0 ? (
                    <div className="kd-admin-state">등록된 회차가 없습니다.</div>
                  ) : (
                    <table className="kd-admin-table kd-dash-session-table">
                      <thead>
                        <tr>
                          <th className="kd-admin-th-name">회차</th>
                          <th className="kd-admin-th-name">날짜</th>
                          <th className="kd-admin-th-name">제목</th>
                          <th className="kd-admin-th-num">실참여</th>
                          <th className="kd-admin-th-name">상태</th>
                          <th className="kd-admin-th-name">관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s) => (
                          <tr key={s._id}>
                            <td className="kd-admin-td-name">{s.sessionNo}회</td>
                            <td className="kd-admin-td-name">{(s.date || '').slice(0, 10) || '—'}</td>
                            <td className="kd-admin-td-name">{s.title || '—'}</td>
                            <td className="kd-admin-td-num">{num(s.attendance)}명</td>
                            <td className="kd-admin-td-name">
                              <span className="kd-status-badge">{s.status}</span>
                            </td>
                            <td className="kd-admin-td-name">
                              <button
                                type="button"
                                className="kd-ledger-action kd-ledger-action--danger"
                                onClick={() => removeSession(p.key, s._id)}
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardView;
