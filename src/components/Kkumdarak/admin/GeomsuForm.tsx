import React, { useCallback, useState } from 'react';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';
import PhotoUpload from './PhotoUpload';

// ─────────────────────────────────────────────────────────────────────────────
// 검수조서(일반용역비) 작업창.
//   jichul(서식11)·chulgang(서식5, 사진) 와 동일한 stateless 패턴 — 입력값이 곧 문서.
//   용역명·계약상대자·계약금액(숫자)·검수일자·산출물 링크(URL)·검수결과(3택)·검수의견 +
//   검수 사진 2슬롯(PhotoUpload 재사용 · BinData/geomsu_photo1·2.png 교체).
//   POST → hwpx blob 다운로드. DB 미사용. 보조사업명·수행기관·검수책임자(이화영)는 양식 리터럴.
//   단일 컴포넌트 + 반응형 CSS → 데스크톱·모바일 자동 동시 반영.
// ─────────────────────────────────────────────────────────────────────────────

type ResultKey = 'pass' | 'conditional' | 'fail';

const RESULT_OPTIONS: { id: ResultKey; label: string }[] = [
  { id: 'pass', label: '합격' },
  { id: 'conditional', label: '보완 후 합격' },
  { id: 'fail', label: '불합격' },
];

const GeomsuForm: React.FC = () => {
  const { logout } = useKkumdarakAuth();
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [photo1, setPhoto1] = useState('');
  const [photo2, setPhoto2] = useState('');

  const [f, setF] = useState({
    용역명: '',
    계약상대자: '',
    amount: '',
    검수일자: '',
    산출물링크: '',
    검수결과: 'pass' as ResultKey,
    검수의견: '',
  });

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

  const setField = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  // 검수의견 AI 초안(docType inspection). 용역명·산출물·검수결과 grounding. programKey 불필요.
  //   기존 의견이 있으면 덮어쓰기 확인. KNUH 실패·빈응답은 안내 후 직접 입력 유지.
  const handleAiDraft = async () => {
    if (aiBusy) return;
    if (!f.용역명.trim()) {
      setError('AI 초안은 용역명을 먼저 입력해야 합니다.');
      return;
    }
    if (
      f.검수의견.trim() &&
      typeof window !== 'undefined' &&
      !window.confirm('기존 검수의견을 AI 초안으로 덮어쓸까요?')
    ) {
      return;
    }
    setAiBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await kkumdarakAdminAPI.aiDraftForm({
        docType: 'inspection',
        용역명: f.용역명,
        산출물: f.산출물링크,
        검수결과: f.검수결과,
      });
      const v = res.data && typeof res.data === 'object' ? (res.data as Record<string, unknown>).검수의견 : undefined;
      if (typeof v === 'string' && v.trim()) {
        setField('검수의견', v);
        setNotice('AI 초안을 검수의견에 채웠습니다. 검토·수정하세요.');
      } else {
        setError(res.message || 'AI 응답을 해석하지 못했습니다. 직접 입력하세요.');
      }
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || 'AI 초안 생성에 실패했습니다.');
    } finally {
      setAiBusy(false);
    }
  };

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    const body: Record<string, unknown> = {
      용역명: f.용역명,
      계약상대자: f.계약상대자,
      amount: Number(f.amount) || 0,
      검수일자: f.검수일자,
      산출물링크: f.산출물링크,
      검수결과: f.검수결과,
      검수의견: f.검수의견,
    };
    if (photo1) body.photo1 = photo1; // 있으면만 포함(없으면 더미 유지 — 회귀 없음)
    if (photo2) body.photo2 = photo2;
    try {
      const blob = await kkumdarakAdminAPI.downloadGeomsuForm(body);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `검수조서_${f.용역명 || '일반용역비'}.hwpx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '검수조서 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kd-forms">
      <p className="kd-forms-hint">
        일반용역비 검수조서(표준 양식). 계약금액은 숫자만 입력하면 자동 천단위 표기됩니다. 산출물은
        링크(URL)로 기재하고, 검수 사진은 최대 2장 첨부할 수 있습니다(선택). 보조사업명·수행기관·검수책임자
        (이화영)는 양식에 고정되어 있으며, 다운로드 후 한글에서 서명 등 세부를 직접 채울 수 있습니다.
      </p>

      <div className="kd-forms-grid">
        <label className="kd-field kd-field-wide">
          <span className="kd-field-label">용역명</span>
          <input
            className="kd-field-input"
            value={f.용역명}
            onChange={(e) => setField('용역명', e.target.value)}
            placeholder="00 영상 제작 용역"
          />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">계약상대자(업체)</span>
          <input
            className="kd-field-input"
            value={f.계약상대자}
            onChange={(e) => setField('계약상대자', e.target.value)}
            placeholder="㈜○○스튜디오"
          />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">계약금액(원)</span>
          <input
            className="kd-field-input"
            inputMode="numeric"
            value={f.amount}
            onChange={(e) => setField('amount', e.target.value)}
            placeholder="2000000"
          />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">검수일자</span>
          <input
            className="kd-field-input"
            type="date"
            value={f.검수일자}
            onChange={(e) => setField('검수일자', e.target.value)}
          />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">검수결과</span>
          <select
            className="kd-field-input"
            value={f.검수결과}
            onChange={(e) => setField('검수결과', e.target.value)}
          >
            {RESULT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="kd-field kd-field-wide">
          <span className="kd-field-label">산출물 링크(URL)</span>
          <input
            className="kd-field-input"
            type="url"
            value={f.산출물링크}
            onChange={(e) => setField('산출물링크', e.target.value)}
            placeholder="https://drive.google.com/..."
          />
        </label>
        <label className="kd-field kd-field-wide">
          <span className="kd-field-label">검수의견</span>
          <div className="kd-forms-ai">
            <button
              type="button"
              className="kd-ledger-action kd-ledger-action--form"
              onClick={handleAiDraft}
              disabled={aiBusy}
            >
              {aiBusy ? 'AI 생성 중…' : 'AI 초안'}
            </button>
          </div>
          <textarea
            className="kd-field-input"
            rows={4}
            value={f.검수의견}
            onChange={(e) => setField('검수의견', e.target.value)}
            placeholder="계약 내용대로 산출물이 납품되었으며, 품질·규격이 적정함을 확인함. (용역명·산출물·검수결과 입력 후 「AI 초안」 가능)"
          />
        </label>
      </div>

      <div className="kd-forms-grid">
        <PhotoUpload label="검수 사진 1" onChange={setPhoto1} />
        <PhotoUpload label="검수 사진 2" onChange={setPhoto2} />
      </div>

      {error && <p className="kd-forms-error">{error}</p>}
      {notice && <p className="kd-forms-notice">{notice}</p>}

      <button type="button" className="kd-forms-submit" onClick={handleDownload} disabled={busy}>
        {busy ? '생성 중…' : '검수조서 HWPX 생성'}
      </button>
    </div>
  );
};

export default GeomsuForm;
