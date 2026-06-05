import React, { useCallback, useEffect, useState } from 'react';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';

// ─────────────────────────────────────────────────────────────────────────────
// 서식11 지출결의서 작업창.
//   chulgang/hoeuirok/gyeolgwa 와 동일한 stateless 패턴 — 입력값이 곧 문서.
//   비목을 선택하면 항/목/세가 자동 기입(편집 가능). 금액(amount) 하나에서
//   한글·숫자 금액을 백엔드가 함께 산출. POST → hwpx blob 다운로드.
//   지출내용(주요내용)·지출방법(4택)도 입력값으로 문서에 반영.
//   DB 미사용. 다운로드 후 한글에서 직접 수정 가능(하단 임차물품 반납표 등).
// ─────────────────────────────────────────────────────────────────────────────

interface BudgetLine {
  lineKey: string;
  majorCode: string;
  majorName: string;
  subCode: string;
  subName: string;
}

// 지출방법 4택 — 원본 양식 라벨/키 그대로(백엔드 PAYMENT_METHOD_KEYS 와 일치).
const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: '계좌이체', label: '계좌이체' },
  { value: '전자계산서', label: '계좌이체(전자(세금)계산서)' },
  { value: '카드', label: '보조금카드결제' },
  { value: '기타', label: '기타' },
];

const JichulForm: React.FC = () => {
  const { logout } = useKkumdarakAuth();
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [f, setF] = useState({
    단체명: '노드트리',
    담당자: '',
    결제일: '',
    결의일: '',
    항: '꿈다락 문화예술학교',
    목: '',
    세: '',
    추진명: '',
    추진일시: '',
    주요내용: '',
    amount: '',
    지급처: '',
    지출방법: '계좌이체',
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

  // 비목 목록(항/목/세 자동기입용) — budget summary 재사용.
  useEffect(() => {
    const c = new AbortController();
    kkumdarakAdminAPI
      .getBudgetSummary({ signal: c.signal })
      .then((s: any) => setLines((s?.lines as BudgetLine[]) || []))
      .catch((err: any) => {
        if (err?.name === 'AbortError') return;
        if (onAuthErr(err)) return;
        // 비목 자동기입은 보조 기능 — 실패해도 수동 입력 가능. 조용히 무시.
      });
    return () => c.abort();
  }, [onAuthErr]);

  const setField = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const onSelectLine = (lineKey: string) => {
    const line = lines.find((l) => l.lineKey === lineKey);
    if (!line) return;
    setF((p) => ({
      ...p,
      목: `${line.majorName}(${line.majorCode})`,
      세: `${line.subName}(${line.subCode})`,
    }));
  };

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const body = {
      ...f,
      amount: Number(f.amount) || 0,
    };
    try {
      const blob = await kkumdarakAdminAPI.downloadJichulForm(body);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `서식11_지출결의서_${f.추진명 || '지출결의서'}.hwpx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '지출결의서 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kd-forms">
      <p className="kd-forms-hint">
        비목을 선택하면 목/세가 자동 기입됩니다(수정 가능). 금액은 숫자만 입력하면 한글 금액이
        자동 산출됩니다. 하단 임차물품 반납표 등 세부는 다운로드 후 한글에서 직접 채울 수 있습니다.
      </p>

      <div className="kd-forms-grid">
        <label className="kd-field">
          <span className="kd-field-label">비목 선택(목/세 자동)</span>
          <select className="kd-field-input" defaultValue="" onChange={(e) => onSelectLine(e.target.value)}>
            <option value="">선택…</option>
            {lines.map((l) => (
              <option key={l.lineKey} value={l.lineKey}>
                {l.majorName}({l.majorCode}) · {l.subName}({l.subCode})
              </option>
            ))}
          </select>
        </label>
        <label className="kd-field">
          <span className="kd-field-label">단체명</span>
          <input className="kd-field-input" value={f.단체명} onChange={(e) => setField('단체명', e.target.value)} />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">담당자</span>
          <input className="kd-field-input" value={f.담당자} onChange={(e) => setField('담당자', e.target.value)} />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">결의일</span>
          <input className="kd-field-input" type="date" value={f.결의일} onChange={(e) => setField('결의일', e.target.value)} />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">결제일</span>
          <input className="kd-field-input" type="date" value={f.결제일} onChange={(e) => setField('결제일', e.target.value)} />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">항</span>
          <input className="kd-field-input" value={f.항} onChange={(e) => setField('항', e.target.value)} />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">목</span>
          <input className="kd-field-input" value={f.목} onChange={(e) => setField('목', e.target.value)} placeholder="운영비(210)" />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">세</span>
          <input className="kd-field-input" value={f.세} onChange={(e) => setField('세', e.target.value)} placeholder="일반수용비(01)" />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">지급처(상호)</span>
          <input className="kd-field-input" value={f.지급처} onChange={(e) => setField('지급처', e.target.value)} />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">지출금액(원)</span>
          <input className="kd-field-input" inputMode="numeric" value={f.amount} onChange={(e) => setField('amount', e.target.value)} placeholder="129000" />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">지출방법</span>
          <select className="kd-field-input" value={f.지출방법} onChange={(e) => setField('지출방법', e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="kd-field kd-field-wide">
          <span className="kd-field-label">추진명</span>
          <input className="kd-field-input" value={f.추진명} onChange={(e) => setField('추진명', e.target.value)} placeholder="소리일기 4회차 강사비" />
        </label>
        <label className="kd-field kd-field-wide">
          <span className="kd-field-label">추진일시</span>
          <input className="kd-field-input" value={f.추진일시} onChange={(e) => setField('추진일시', e.target.value)} placeholder="2026. 8. 20.(목) 14:00~17:00 (3시간)" />
        </label>
        <label className="kd-field kd-field-wide">
          <span className="kd-field-label">지출내용(주요내용)</span>
          <input className="kd-field-input" value={f.주요내용} onChange={(e) => setField('주요내용', e.target.value)} placeholder="강사비 지급 (소리일기 4회차)" />
        </label>
      </div>

      {error && <p className="kd-forms-error">{error}</p>}

      <button type="button" className="kd-forms-submit" onClick={handleDownload} disabled={busy}>
        {busy ? '생성 중…' : '지출결의서 HWPX 생성'}
      </button>
    </div>
  );
};

export default JichulForm;
