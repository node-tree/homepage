import React, { useCallback, useState } from 'react';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';

// ─────────────────────────────────────────────────────────────────────────────
// 서식 제4-1호 「일반수용비 사례비 지급내역서」 작업창 (월별 xlsx).
//   chulgang/hoeuirok/gyeolgwa 와 동일한 stateless 패턴 — 편집 가능한 표가 진실원천.
//   월 선택 + 지급 행 추가/삭제 + 행별(지급구분·이름·은행·계좌·주민번호·세금구분·단가·
//   교통보조금·대표여부) + 회차별(일자·시간). POST → exceljs 채운 xlsx blob 다운로드.
//   ⚠️ 대표(이화영 등)는 「대표(원천징수 없음)」 체크 → 백엔드가 소득세·주민세 0, 실지급=세전.
//   DB 미사용 — 입력값이 곧 문서. 다운로드 후 엑셀에서 직접 추가 수정 가능.
// ─────────────────────────────────────────────────────────────────────────────

type Session = { date: string; hours: string };

interface PayRow {
  category: string; // 지급구분 (교육강사비(주강사) 등)
  name: string;
  bank: string;
  account: string;
  residentNo: string;
  taxType: string; // 사업소득(3.3%) | 기타소득(8.8%)
  unitPrice: string; // 단가
  distanceKm: string; // 왕복거리
  transportPay: string; // 교통보조금(비과세)
  isRepresentative: boolean;
  note: string;
  sessions: Session[];
}

const CATEGORY_OPTIONS = [
  '교육강사비\n(주강사)',
  '교육강사비\n(보조강사)',
  '행정인력비',
  '기획개발비',
  '특별강의비',
  '원고료',
];

const TAX_OPTIONS = ['사업소득(3.3%)', '기타소득(8.8%)'];

const MONTHS = [5, 6, 7, 8, 9, 10, 11, 12];

const emptySession = (): Session => ({ date: '', hours: '' });

const emptyRow = (): PayRow => ({
  category: '교육강사비\n(주강사)',
  name: '',
  bank: '',
  account: '',
  residentNo: '',
  taxType: '사업소득(3.3%)',
  unitPrice: '',
  distanceKm: '',
  transportPay: '',
  isRepresentative: false,
  note: '',
  sessions: [emptySession()],
});

// 화면 표시용 지급구분 라벨(줄바꿈 제거)
const labelOf = (c: string) => c.replace(/\n/g, ' ');

const SarebiForm: React.FC = () => {
  const { logout } = useKkumdarakAuth();
  const [month, setMonth] = useState<number>(5);
  const [rows, setRows] = useState<PayRow[]>([emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onAuthErr = useCallback(
    (err: any): boolean => {
      if (err?.code === 'KKUM_AUTH_EXPIRED') {
        logout();
        return true;
      }
      return false;
    },
    [logout],
  );

  const setRow = (i: number, patch: Partial<PayRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));

  const addSession = (i: number) =>
    setRow(i, { sessions: [...rows[i].sessions, emptySession()] });
  const removeSession = (i: number, si: number) => {
    const next = rows[i].sessions.filter((_, idx) => idx !== si);
    setRow(i, { sessions: next.length ? next : [emptySession()] });
  };
  const setSession = (i: number, si: number, patch: Partial<Session>) =>
    setRow(i, {
      sessions: rows[i].sessions.map((s, idx) => (idx === si ? { ...s, ...patch } : s)),
    });

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const body = {
      month,
      rows: rows.map((r) => ({
        category: r.category,
        name: r.name,
        bank: r.bank,
        account: r.account,
        residentNo: r.residentNo,
        taxType: r.taxType,
        unitPrice: Number(r.unitPrice) || 0,
        distanceKm: Number(r.distanceKm) || 0,
        transportPay: Number(r.transportPay) || 0,
        isRepresentative: r.isRepresentative,
        note: r.note,
        sessions: r.sessions.map((s) => ({ date: s.date, hours: Number(s.hours) || 0 })),
      })),
    };
    try {
      const blob = await kkumdarakAdminAPI.downloadSarebiForm(body);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `[서식 제4-1호] 일반수용비 사례비 지급내역서_${month}월.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '사례비 지급내역서 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kd-forms kd-sarebi">
      <p className="kd-forms-hint">
        해당 월의 사례비 지급 대상을 행으로 추가하세요. 주·보조강사는 회차별 일자·시간을 추가하면
        한 묶음으로 합산됩니다(소득세·주민세·실지급 자동 수식). 대표는 「대표(원천징수 없음)」를
        체크하면 소득세·주민세 0, 실지급 = 세전으로 처리됩니다. 생성된 xlsx는 엑셀에서 직접 수정할 수 있습니다.
      </p>

      <div className="kd-forms-grid">
        <label className="kd-field">
          <span className="kd-field-label">지급월</span>
          <select
            className="kd-field-input"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </label>
      </div>

      {rows.map((r, i) => (
        <div key={i} className="kd-sarebi-row">
          <div className="kd-sarebi-row-head">
            <span className="kd-sarebi-row-no">#{i + 1}</span>
            <label className="kd-sarebi-rep">
              <input
                type="checkbox"
                checked={r.isRepresentative}
                onChange={(e) => setRow(i, { isRepresentative: e.target.checked })}
              />
              대표(원천징수 없음)
            </label>
            <button
              type="button"
              className="kd-ledger-action kd-sarebi-del"
              onClick={() => removeRow(i)}
              disabled={rows.length <= 1}
              aria-label={`${i + 1}번 지급 행 삭제`}
            >
              행 삭제
            </button>
          </div>

          <div className="kd-forms-grid">
            <label className="kd-field">
              <span className="kd-field-label">지급구분</span>
              <select
                className="kd-field-input"
                value={r.category}
                onChange={(e) => setRow(i, { category: e.target.value })}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {labelOf(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="kd-field">
              <span className="kd-field-label">이름</span>
              <input className="kd-field-input" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} />
            </label>
            <label className="kd-field">
              <span className="kd-field-label">은행명</span>
              <input className="kd-field-input" value={r.bank} onChange={(e) => setRow(i, { bank: e.target.value })} />
            </label>
            <label className="kd-field">
              <span className="kd-field-label">계좌번호</span>
              <input className="kd-field-input" value={r.account} onChange={(e) => setRow(i, { account: e.target.value })} />
            </label>
            <label className="kd-field">
              <span className="kd-field-label">주민등록번호</span>
              <input className="kd-field-input" value={r.residentNo} onChange={(e) => setRow(i, { residentNo: e.target.value })} placeholder="000000-0000000" />
            </label>
            <label className="kd-field">
              <span className="kd-field-label">세금구분</span>
              <select
                className="kd-field-input"
                value={r.taxType}
                onChange={(e) => setRow(i, { taxType: e.target.value })}
                disabled={r.isRepresentative}
              >
                {TAX_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="kd-field">
              <span className="kd-field-label">단가(원)</span>
              <input className="kd-field-input" inputMode="numeric" value={r.unitPrice} onChange={(e) => setRow(i, { unitPrice: e.target.value })} />
            </label>
            <label className="kd-field">
              <span className="kd-field-label">왕복거리(km)</span>
              <input className="kd-field-input" inputMode="numeric" value={r.distanceKm} onChange={(e) => setRow(i, { distanceKm: e.target.value })} />
            </label>
            <label className="kd-field">
              <span className="kd-field-label">교통보조금(비과세)</span>
              <input className="kd-field-input" inputMode="numeric" value={r.transportPay} onChange={(e) => setRow(i, { transportPay: e.target.value })} />
            </label>
            <label className="kd-field kd-field-wide">
              <span className="kd-field-label">비고</span>
              <input className="kd-field-input" value={r.note} onChange={(e) => setRow(i, { note: e.target.value })} placeholder="(최초 1회 첨부서류 등)" />
            </label>
          </div>

          <div className="kd-sarebi-sessions">
            <div className="kd-forms-section-title">참석 회차 ({r.sessions.length})</div>
            {r.sessions.map((s, si) => (
              <div key={si} className="kd-forms-grid kd-sarebi-session">
                <label className="kd-field">
                  <span className="kd-field-label">{si + 1}회 일자</span>
                  <input className="kd-field-input" value={s.date} onChange={(e) => setSession(i, si, { date: e.target.value })} placeholder="8/6(화) 또는 8월" />
                </label>
                <label className="kd-field">
                  <span className="kd-field-label">시간</span>
                  <input className="kd-field-input" inputMode="numeric" value={s.hours} onChange={(e) => setSession(i, si, { hours: e.target.value })} />
                </label>
                <button
                  type="button"
                  className="kd-ledger-action kd-sarebi-del"
                  onClick={() => removeSession(i, si)}
                  disabled={r.sessions.length <= 1}
                  aria-label={`${si + 1}회차 삭제`}
                >
                  회차 삭제
                </button>
              </div>
            ))}
            <button type="button" className="kd-ledger-action kd-ledger-action--form" onClick={() => addSession(i)}>
              + 회차 추가
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="kd-ledger-action kd-ledger-action--form kd-sarebi-addrow" onClick={addRow}>
        + 지급 대상 추가
      </button>

      {error && <p className="kd-forms-error">{error}</p>}

      <button type="button" className="kd-forms-submit" onClick={handleDownload} disabled={busy}>
        {busy ? '생성 중…' : `${month}월 사례비 지급내역서 xlsx 생성`}
      </button>
    </div>
  );
};

export default SarebiForm;
