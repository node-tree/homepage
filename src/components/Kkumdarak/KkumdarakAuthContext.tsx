import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { villageDiaryAPI } from '../../services/api';

// ═══════════════════════════════════════════════════════════════
// 꿈다락 편집 인증 — 최상위 공유 컨텍스트
//   · 마을일기뿐 아니라 꿈다락 전체의 향후 편집 섹션이 같은 인증을 공유한다.
//   · 사이트 관리자(useAuth / auth_token)와 완전히 분리 — kkumdarak_token 만 사용.
//   · 비밀번호 로그인 모달을 Provider 가 1회 렌더(VillageDiary 에서 이동).
//   · 백엔드(scope:'kkumdarak' 토큰, POST /api/village-diary/login)는 범용 — 변경 없음.
// ═══════════════════════════════════════════════════════════════

interface KkumdarakAuthValue {
  authed: boolean;
  requestLogin: () => void;
  logout: () => void;
}

const KkumdarakAuthContext = createContext<KkumdarakAuthValue>({
  authed: false,
  requestLogin: () => {},
  logout: () => {},
});

export const useKkumdarakAuth = (): KkumdarakAuthValue =>
  useContext(KkumdarakAuthContext);

export const KkumdarakAuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authed, setAuthed] = useState<boolean>(
    () => !!villageDiaryAPI.getKkumdarakToken(),
  );

  // 로그인 모달 상태
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const requestLogin = useCallback(() => {
    setPw('');
    setError('');
    setBusy(false);
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setPw('');
    setError('');
    setBusy(false);
  }, []);

  const logout = useCallback(() => {
    villageDiaryAPI.clearKkumdarakToken();
    setAuthed(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const ok = await villageDiaryAPI.login(pw);
      if (ok) {
        setAuthed(true);
        closeModal();
      } else {
        setError('비밀번호가 올바르지 않습니다.');
      }
    } catch (err: any) {
      setError(err?.message || '로그인 처리 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }, [busy, pw, closeModal]);

  const value = useMemo<KkumdarakAuthValue>(
    () => ({ authed, requestLogin, logout }),
    [authed, requestLogin, logout],
  );

  return (
    <KkumdarakAuthContext.Provider value={value}>
      {children}

      {/* ── 비밀번호 입력 모달 (꿈다락 전체 공통, 1회 렌더) ── */}
      {open && (
        <div
          className="kd-diary-login-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="꿈다락 관리자 로그인"
          onClick={closeModal}
        >
          <div
            className="kd-diary-login-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>꿈다락 관리자 로그인</h3>
            <p className="kd-diary-login-desc">관리자 비밀번호를 입력하세요.</p>
            <input
              type="password"
              className="diary-edit-input kd-diary-login-input"
              value={pw}
              autoFocus
              placeholder="비밀번호"
              onChange={(e) => {
                setPw(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  closeModal();
                }
              }}
            />
            {error && <p className="kd-diary-login-error">{error}</p>}
            <div className="kd-diary-login-actions">
              <button
                className="kd-diary-login-cancel"
                onClick={closeModal}
                disabled={busy}
              >
                취소
              </button>
              <button
                className="kd-diary-login-confirm"
                onClick={handleSubmit}
                disabled={busy}
              >
                {busy ? '확인 중…' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </KkumdarakAuthContext.Provider>
  );
};
