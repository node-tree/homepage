import React from 'react';
import Modal from './Modal';

// ════════════════════════════════════════════════════════════════════════
// ConfirmDialog — window.confirm 대체(삭제·되돌리기 등 되돌릴 수 없는 행위).
// ════════════════════════════════════════════════════════════════════════

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = '삭제',
  cancelLabel = '취소',
  busy = false,
  onConfirm,
  onCancel,
}) => (
  <Modal
    open={open}
    title={title}
    onCancel={busy ? () => undefined : onCancel}
    actions={
      <>
        <button type="button" className="nte-btn" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button type="button" className="nte-btn warn" onClick={onConfirm} disabled={busy}>
          {busy ? '처리 중…' : confirmLabel}
        </button>
      </>
    }
  >
    <p>{message}</p>
  </Modal>
);

export default ConfirmDialog;
