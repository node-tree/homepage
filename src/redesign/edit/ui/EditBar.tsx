import React, { useEffect } from 'react';

// ════════════════════════════════════════════════════════════════════════
// EditBar — 화면 **하단** 고정 저장/취소 바.
//   상단에 두지 않는 이유: v5 헤더가 position:fixed(z-index 50)라
//   상단 절대배치 요소는 헤더 뒤로 숨는다(reference_nodetreehome_fixed_header).
//   바가 마지막 글줄(그리고 푸터)을 덮지 않도록, 떠 있는 동안 body 에 아래 여백을 준다 —
//   main 안의 여백만으로는 뒤따르는 계선·푸터가 바 밑으로 들어간다.
// ════════════════════════════════════════════════════════════════════════

export interface EditBarProps {
  /** 좌단 Mono 표찰 — 무엇을 고치는 중인지 */
  label: string;
  busy?: boolean;
  dirty?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  onSave: () => void;
  onCancel: () => void;
  /** 저장·취소 앞에 끼워 넣을 보조 단추 */
  extra?: React.ReactNode;
}

const EditBar: React.FC<EditBarProps> = ({
  label,
  busy = false,
  dirty = true,
  saveLabel = '저장',
  cancelLabel = '취소',
  onSave,
  onCancel,
  extra,
}) => {
  // 바가 떠 있는 동안만 문서 아래에 자리를 낸다(언마운트 시 원상복구).
  useEffect(() => {
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = '104px';
    return () => {
      document.body.style.paddingBottom = prev;
    };
  }, []);

  return (
  <div className="nte-bar">
    <div className="nte-barlab">
      {label}
      {dirty ? ' · 저장하지 않은 변경 있음' : ' · 변경 없음'}
    </div>
    <div className="nte-acts">
      {extra}
      <button type="button" className="nte-btn" onClick={onCancel} disabled={busy}>
        {cancelLabel}
      </button>
      <button type="button" className="nte-btn pri" onClick={onSave} disabled={busy}>
        {busy ? '저장 중…' : saveLabel}
      </button>
    </div>
  </div>
  );
};

export default EditBar;
