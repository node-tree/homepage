import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// ════════════════════════════════════════════════════════════════════════
// EditModeProvider — v5 페이지 **안에서** 편집한다(레거시 앱으로 튕기지 않는다).
//   켜지는 조건: 로그인(isAuthenticated) 이고, 그리고
//     · URL 에 ?edit=1 이 있거나
//     · 전역 토글이 켜져 있거나(sessionStorage 로 새로고침·라우트 이동에도 유지)
//   비로그인이면 언제나 false — 저장 API 는 어차피 401 이지만 UI 부터 내보이지 않는다.
//   ※ 탭을 닫으면 사라진다(sessionStorage). 읽는 사람에게 편집 UI 가 남지 않게.
// ════════════════════════════════════════════════════════════════════════

const KEY = 'nt_edit_mode';

function readFlag(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function writeFlag(on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(KEY, '1');
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* 프라이빗 모드 등 — 세션 저장 실패는 무시(그 탭에서만 유지) */
  }
}

export interface EditModeValue {
  /** 편집 UI 를 실제로 내보일지 — 로그인 + 토글 */
  editing: boolean;
  /** 로그인 상태(토글 버튼 자체의 노출 판정) */
  canEdit: boolean;
  setEditing: (on: boolean) => void;
  toggle: () => void;
}

const FALLBACK: EditModeValue = {
  editing: false,
  canEdit: false,
  setEditing: () => undefined,
  toggle: () => undefined,
};

const Ctx = createContext<EditModeValue>(FALLBACK);

/** 제공자 밖(레거시 트리)에서도 터지지 않는다 — 그 경우 항상 편집 꺼짐. */
export function useEditMode(): EditModeValue {
  return useContext(Ctx);
}

export const EditModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { search } = useLocation();
  const [on, setOn] = useState<boolean>(() => (typeof window === 'undefined' ? false : readFlag()));

  // ?edit=1 로 들어오면 켠 채로 기억한다(공유 링크·북마크 진입).
  useEffect(() => {
    if (new URLSearchParams(search).get('edit') === '1' && !on) {
      writeFlag(true);
      setOn(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // 로그아웃하면 흔적을 지운다.
  //   ⚠️ isLoading(=localStorage 에서 토큰 복원 중)에는 판정하지 않는다 —
  //      복원 전 한 프레임의 '비로그인'을 로그아웃으로 오해해 방금 켠 편집 모드를
  //      지워 버린다(실측: ?edit=1 로 들어가도 패널이 안 뜨던 원인).
  useEffect(() => {
    if (!isLoading && !isAuthenticated && on) {
      writeFlag(false);
      setOn(false);
    }
  }, [isLoading, isAuthenticated, on]);

  const setEditing = useCallback((next: boolean) => {
    writeFlag(next);
    setOn(next);
  }, []);

  const value = useMemo<EditModeValue>(
    () => ({
      editing: isAuthenticated && on,
      canEdit: isAuthenticated,
      setEditing,
      toggle: () => setEditing(!on),
    }),
    [isAuthenticated, on, setEditing],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export default EditModeProvider;
