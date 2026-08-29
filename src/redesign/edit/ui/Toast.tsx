import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// ════════════════════════════════════════════════════════════════════════
// Toast — 성공/실패 한 줄. 자동 소멸(4초). aria-live 로 읽어 준다.
//   alert() 대체물이다. 아이콘·색 강조 없음(실패만 주서색 계선).
// ════════════════════════════════════════════════════════════════════════

export type ToastKind = 'ok' | 'err';

interface ToastRow {
  id: number;
  text: string;
  kind: ToastKind;
}

export interface ToastApi {
  ok: (text: string) => void;
  err: (text: string) => void;
  push: (text: string, kind?: ToastKind) => void;
}

const NOOP: ToastApi = { ok: () => undefined, err: () => undefined, push: () => undefined };
const Ctx = createContext<ToastApi>(NOOP);

export function useToast(): ToastApi {
  return useContext(Ctx);
}

const LIFE = 4000;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rows, setRows] = useState<ToastRow[]>([]);
  const seq = useRef(0);
  const timers = useRef<number[]>([]);

  // 언마운트 시 남은 타이머 전부 정리(누수 방지)
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    },
    [],
  );

  const push = useCallback((text: string, kind: ToastKind = 'ok') => {
    seq.current += 1;
    const id = seq.current;
    setRows((prev) => [...prev, { id, text, kind }]);
    const t = window.setTimeout(() => {
      setRows((prev) => prev.filter((r) => r.id !== id));
      timers.current = timers.current.filter((x) => x !== t);
    }, LIFE);
    timers.current.push(t);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      ok: (text: string) => push(text, 'ok'),
      err: (text: string) => push(text, 'err'),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="nte-toasts" role="status" aria-live="polite" aria-atomic="false">
        {rows.map((r) => (
          <div key={r.id} className={`nte-toast${r.kind === 'err' ? ' err' : ''}`}>
            {r.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
};

export default ToastProvider;
