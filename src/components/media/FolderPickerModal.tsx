// ═══════════════════════════════════════════════════════════════
// FolderPickerModal — 이동 대상 폴더 선택 모달
//   · FolderTree 재사용 + 경로 직접 입력. 폴더 이동 시 자기 자신/하위는 선택 불가.
//   · URL 변경 경고를 상시 노출한다(ImageKit URL 은 경로 기반 — 이동하면 즉시 무효).
//   · 데스크톱은 중앙 모달, 모바일(≤600px)은 하단 시트로 떨어진다(CSS).
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import FolderTree from './FolderTree';
import { normalizePath } from '../../utils/ikPath';

export interface FolderPickerModalProps {
  open: boolean;
  title: string;
  /** 선택 대상 설명(예: "파일 3개") */
  subject: string;
  /** 초기 선택 경로 */
  initialPath?: string;
  /** 이 경로와 하위는 선택 불가(폴더를 자기 안으로 이동 방지) */
  disabledRoot?: string | null;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (destinationPath: string) => void;
}

const FolderPickerModal: React.FC<FolderPickerModalProps> = ({
  open,
  title,
  subject,
  initialPath = '/',
  disabledRoot = null,
  confirmLabel = '이동',
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}) => {
  const [dest, setDest] = useState(normalizePath(initialPath));
  const [manual, setManual] = useState(normalizePath(initialPath));

  useEffect(() => {
    if (open) {
      const p = normalizePath(initialPath);
      setDest(p);
      setManual(p);
    }
  }, [open, initialPath]);

  // ESC 로 닫기 — 모달 표준 동작.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const pick = (p: string) => {
    const norm = normalizePath(p);
    setDest(norm);
    setManual(norm);
  };

  return (
    <div className="ma-modal-overlay" onMouseDown={() => !busy && onCancel()}>
      <div
        className="ma-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ma-modal-head">
          <h3>{title}</h3>
          <span className="ma-modal-subject">{subject}</span>
        </div>

        <p className="ma-modal-warn">
          이동하면 <strong>기존 URL이 즉시 바뀝니다.</strong> 이미 게시된 글·페이지가 예전 URL을
          참조하고 있으면 이미지가 깨질 수 있습니다.
        </p>

        <div className="ma-modal-tree">
          <FolderTree currentPath={dest} onSelect={pick} disabledRoot={disabledRoot} />
        </div>

        <form
          className="ma-modal-manual"
          onSubmit={(e) => {
            e.preventDefault();
            pick(manual);
          }}
        >
          <label htmlFor="ma-dest-input">대상 경로</label>
          <div className="ma-modal-manual-row">
            <input
              id="ma-dest-input"
              type="text"
              value={manual}
              disabled={busy}
              onChange={(e) => setManual(e.target.value)}
              placeholder="/uploads"
            />
            <button type="submit" className="ma-btn" disabled={busy}>
              적용
            </button>
          </div>
        </form>

        {error && <p className="ma-error">{error}</p>}

        <div className="ma-modal-actions">
          <button type="button" className="ma-btn ghost" onClick={onCancel} disabled={busy}>
            취소
          </button>
          <button
            type="button"
            className="ma-btn primary"
            onClick={() => onConfirm(dest)}
            disabled={busy}
          >
            {busy ? '처리 중…' : `${confirmLabel} → ${dest}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FolderPickerModal;
