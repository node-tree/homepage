import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { REVEAL_CAP_MS, onArrive } from './walkerBus';

/**
 * useReveal — 삼베가 새 페이지 자리에 **도착한 뒤** 콘텐츠를 연다(설계 §4.1·4.3).
 *   보행 속도는 1정간/9.508 s 로 느리므로, 도착이 늦으면 2 tick(594 ms) 에서 자동으로 연다
 *   — 로딩이 서사가 되되 페이지가 인질이 되지는 않게.
 *   reduced-motion 은 즉시 열린다.
 */
export function useReveal(): boolean {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOpen(true);
      return;
    }
    setOpen(false);
    const off = onArrive((p) => {
      if (p === pathname) setOpen(true);
    });
    const cap = window.setTimeout(() => setOpen(true), REVEAL_CAP_MS);
    return () => {
      off();
      window.clearTimeout(cap);
    };
  }, [pathname]);

  return open;
}
