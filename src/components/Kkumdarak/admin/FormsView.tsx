import React, { useState } from 'react';
import './formsView.css';
import ChulgangForm from './ChulgangForm';
import HoeuirokForm from './HoeuirokForm';
import GyeolgwaForm from './GyeolgwaForm';
import SarebiForm from './SarebiForm';
import JichulForm from './JichulForm';

// ═══════════════════════════════════════════════════════════════
// 문서/서식 — 문서 종류 토글 셸. 선택에 따라 작업창을 조건부 마운트.
//   · 출강확인서(서식5) — ChulgangForm
//   · 회의록(서식7) — HoeuirokForm
//   · 결과보고서(서식6) — GyeolgwaForm
//   · 사례비 지급내역서(서식4-1) — SarebiForm (월별 xlsx)
//   · 지출결의서(서식11) — JichulForm
//   각 작업창은 자신의 프로그램/회차를 마운트 시 독립 fetch(상태 lift 없음).
//   단일 컴포넌트 + 반응형 CSS라 데스크톱·모바일 자동 동시 반영.
// ═══════════════════════════════════════════════════════════════

type DocType = 'chulgang' | 'hoeuirok' | 'gyeolgwa' | 'sarebi' | 'jichul';

const DOC_TYPES: { id: DocType; label: string }[] = [
  { id: 'chulgang', label: '출강확인서 (서식5)' },
  { id: 'hoeuirok', label: '회의록 (서식7)' },
  { id: 'gyeolgwa', label: '결과보고서 (서식6)' },
  { id: 'sarebi', label: '사례비 지급내역서 (서식4-1)' },
  { id: 'jichul', label: '지출결의서 (서식11)' },
];

const FormsView: React.FC = () => {
  const [docType, setDocType] = useState<DocType>('chulgang');

  return (
    <div className="kd-forms-shell">
      <div className="kd-forms-doctype" role="tablist" aria-label="문서 종류">
        {DOC_TYPES.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={docType === d.id}
            className={`kd-forms-doctype-btn${docType === d.id ? ' active' : ''}`}
            onClick={() => setDocType(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>

      {docType === 'chulgang' && <ChulgangForm />}
      {docType === 'hoeuirok' && <HoeuirokForm />}
      {docType === 'gyeolgwa' && <GyeolgwaForm />}
      {docType === 'sarebi' && <SarebiForm />}
      {docType === 'jichul' && <JichulForm />}
    </div>
  );
};

export default FormsView;
