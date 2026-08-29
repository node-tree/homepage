import React, { useCallback, useEffect, useRef } from 'react';

// ════════════════════════════════════════════════════════════════════════
// Modal — 확인·입력 대화상자의 공통 껍데기.
//   포커스 트랩(Tab 순환) · Esc 닫기 · 열기 전 포커스 복원 · 스크림 클릭 취소.
//   window.confirm/prompt 를 대체하기 위한 최소 구현이다(라이브러리 추가 없음).
// ════════════════════════════════════════════════════════════════════════

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
  /** 대화상자 안 액션 줄 */
  actions: React.ReactNode;
  labelId?: string;
}

const Modal: React.FC<ModalProps> = ({ open, title, onCancel, children, actions, labelId = 'nte-dialog-title' }) => {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const beforeRef = useRef<HTMLElement | null>(null);

  const focusables = useCallback((): HTMLElement[] => {
    const box = boxRef.current;
    if (!box) return [];
    return Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
  }, []);

  // 열릴 때 첫 포커스, 닫힐 때 원래 자리로 복원
  useEffect(() => {
    if (!open) return undefined;
    beforeRef.current = document.activeElement as HTMLElement | null;
    const items = focusables();
    (items[0] ?? boxRef.current)?.focus();
    return () => {
      beforeRef.current?.focus?.();
    };
  }, [open, focusables]);

  // Esc · Tab 트랩
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !boxRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onCancel, focusables]);

  if (!open) return null;

  return (
    <div
      className="nte-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="nte-dialog" role="dialog" aria-modal="true" aria-labelledby={labelId} ref={boxRef} tabIndex={-1}>
        <h2 id={labelId}>{title}</h2>
        {children}
        <div className="nte-acts">{actions}</div>
      </div>
    </div>
  );
};

export default Modal;
