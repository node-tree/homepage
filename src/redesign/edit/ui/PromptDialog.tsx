import React, { useEffect, useState } from 'react';
import Modal from './Modal';

// ════════════════════════════════════════════════════════════════════════
// PromptDialog — window.prompt 대체(링크 URL 입력 등 한 줄 값).
// ════════════════════════════════════════════════════════════════════════

export interface PromptDialogProps {
  open: boolean;
  title: string;
  label: string;
  placeholder?: string;
  initial?: string;
  hint?: string;
  confirmLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

const PromptDialog: React.FC<PromptDialogProps> = ({
  open,
  title,
  label,
  placeholder,
  initial = '',
  hint,
  confirmLabel = '확인',
  onSubmit,
  onCancel,
}) => {
  const [value, setValue] = useState(initial);

  // 열릴 때마다 초기값으로 되돌린다(이전 입력 잔상 방지)
  useEffect(() => {
    if (open) setValue(initial);
  }, [open, initial]);

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onSubmit(v);
  };

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      labelId="nte-prompt-title"
      actions={
        <>
          <button type="button" className="nte-btn" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="nte-btn pri" onClick={submit} disabled={!value.trim()}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="nte-field" style={{ marginBottom: 0 }}>
        <label htmlFor="nte-prompt-input">{label}</label>
        <input
          id="nte-prompt-input"
          className="nte-input"
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
        {hint ? <div className="nte-hint">{hint}</div> : null}
      </div>
    </Modal>
  );
};

export default PromptDialog;
