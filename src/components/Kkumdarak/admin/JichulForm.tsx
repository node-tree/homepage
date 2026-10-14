import React, { useCallback, useEffect, useState } from 'react';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';

// ─────────────────────────────────────────────────────────────────────────────
// 서식11 지출결의서 작업창 — 2026-10 최신판(5월 제출본 형식).
//   · 종류(용역비·기획개발활동비·행정인력비·회의식비·출장비)를 고르면 5월 제출본의 지출내용 틀과
//     항·목·세가 채워진다. 지출내용은 여러 줄 그대로 문서에 들어간다(「 - 」 들여쓰기 유지).
//   · 결재 칸: 담당자·결재자 이름 + 서명 그림(서버가 넣음, 서명 이미지가 없으면 「(서명)」).
//   · 금액 하나에서 한글·숫자 금액을 서버가 함께 만든다. 0원이면 막는다.
// ─────────────────────────────────────────────────────────────────────────────

interface BudgetLine {
  lineKey: string;
  majorCode: string;
  majorName: string;
  subCode: string;
  subName: string;
}

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: '계좌이체', label: '계좌이체' },
  { value: '전자계산서', label: '계좌이체(전자(세금)계산서)' },
  { value: '카드', label: '보조금카드결제' },
  { value: '기타', label: '기타' },
];

// 5월 제출본 지출내용 틀(값은 비워 둠)
const KINDS: { key: string; label: string; 목: string; 세: string; 파일명: string; 내용: string }[] = [
  {
    key: 'service',
    label: '일반용역비',
    목: '운영비(210)',
    세: '일반용역비(14)',
    파일명: '용역비',
    내용: '□ 추 진 명: 일반용역비 지급\n□ 용역내용\n - \n□ 필요예산: 원\n - (업체):원',
  },
  {
    key: 'plan',
    label: '기획개발활동비',
    목: '운영비(210)',
    세: '일반수용비(01)',
    파일명: '기획개발활동비',
    내용: '□ 내    용: 월 기획개발활동비 지급\n□ 기    간: 2026. \n□ 대    상:  총 명\n□ 필요예산: 원',
  },
  {
    key: 'admin',
    label: '행정인력비',
    목: '인건비(110)',
    세: '상용임금(03)',
    파일명: '행정인력비',
    내용: '□ 추 진 명: 월 행정인력비 지급\n□ 지 급 자: 이한희\n□ 필요예산: 원',
  },
  {
    key: 'meeting',
    label: '회의식비',
    목: '업무추진비(240)',
    세: '사업추진비(01)',
    파일명: '회의식비',
    내용: '□ 추 진 명: 월 운영진 회의식비 지급\n□ 참 여 자: \n□ 일    시: \n□ 필요예산: 원',
  },
  {
    key: 'travel',
    label: '출장비',
    목: '여비(220)',
    세: '국내여비(01)',
    파일명: '출장비 지급',
    내용: '□ 추 진 명: 출장비 지급\n□ 추진일시: \n□ 주요내용\n - 내  용: \n - 출장자: ',
  },
];

const toAmountNumber = (raw: string): number => {
  if (raw == null) return 0;
  const half = String(raw).replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
  const digits = half.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
};

const JichulForm: React.FC = () => {
  const { logout } = useKkumdarakAuth();
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [f, setF] = useState({
    단체명: '노드트리',
    담당자: '이한희',
    결재자: '이화영',
    결제일: '',
    결의일: '',
    관: '꿈다락 문화예술학교',
    항: '운영비',
    목: '',
    세: '',
    지출내용: '',
    amount: '',
    지급처: '',
    지출방법: '계좌이체',
    파일명: '',
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

  useEffect(() => {
    const c = new AbortController();
    kkumdarakAdminAPI
      .getBudgetSummary({ signal: c.signal })
      .then((s: any) => setLines((s?.lines as BudgetLine[]) || []))
      .catch((err: any) => {
        if (err?.name === 'AbortError') return;
        onAuthErr(err); // 비목 목록은 보조 기능 — 실패해도 직접 입력 가능
      });
    return () => c.abort();
  }, [onAuthErr]);

  const setField = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const onSelectKind = (key: string) => {
    const kind = KINDS.find((k) => k.key === key);
    if (!kind) return;
    if (f.지출내용.trim() && !window.confirm('지금 쓴 지출내용을 이 종류의 틀로 바꿀까요?')) return;
    setF((p) => ({ ...p, 목: kind.목, 세: kind.세, 지출내용: kind.내용, 파일명: kind.파일명 }));
  };

  const onSelectLine = (lineKey: string) => {
    const line = lines.find((l) => l.lineKey === lineKey);
    if (!line) return;
    setF((p) => ({ ...p, 목: `${line.majorName}(${line.majorCode})`, 세: `${line.subName}(${line.subCode})` }));
  };

  const handleDownload = async () => {
    if (busy) return;
    const amountValue = toAmountNumber(f.amount);
    if (amountValue <= 0) {
      setError('지출금액을 입력하세요.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const blob = await kkumdarakAdminAPI.downloadJichulForm({ ...f, 결재담당자: f.담당자, amount: amountValue });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `서식11_지출결의서_${(f.파일명 || f.세 || '지출결의서').replace(/[\\/:*?"<>|]/g, '')}.hwpx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotice('지출결의서를 만들었습니다.');
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '지출결의서 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const input = (k: keyof typeof f, label: string, opts: { type?: string; placeholder?: string } = {}) => (
    <label className="kd-field">
      <span className="kd-field-label">{label}</span>
      <input className="kd-field-input" type={opts.type || 'text'} value={f[k]} onChange={(e) => setField(k, e.target.value)} placeholder={opts.placeholder} />
    </label>
  );

  return (
    <div className="kd-forms">
      <p className="kd-forms-desc">
        5월 제출본과 같은 모양으로 만듭니다. 종류를 고르면 지출내용 틀과 항·목·세가 채워집니다. 결재 칸에는 담당자·결재자
        서명이 들어갑니다(서명 이미지가 등록돼 있지 않으면 「(서명)」으로 남습니다).
      </p>

      <div className="kd-forms-body">
        <div className="kd-ledger-grid">
          <label className="kd-field">
            <span className="kd-field-label">종류(지출내용 틀)</span>
            <select className="kd-field-input" defaultValue="" onChange={(e) => onSelectKind(e.target.value)}>
              <option value="">선택…</option>
              {KINDS.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="kd-field">
            <span className="kd-field-label">비목 직접 선택(목/세)</span>
            <select className="kd-field-input" defaultValue="" onChange={(e) => onSelectLine(e.target.value)}>
              <option value="">선택…</option>
              {lines.map((l) => (
                <option key={l.lineKey} value={l.lineKey}>
                  {l.majorName}({l.majorCode}) · {l.subName}({l.subCode})
                </option>
              ))}
            </select>
          </label>
          {input('단체명', '단체명')}
          {input('담당자', '담당자(결재 담당자)')}
          {input('결재자', '결재자')}
          {input('결의일', '결의일', { type: 'date' })}
          {input('결제일', '결제일', { type: 'date' })}
          {input('관', '관')}
          {input('항', '항', { placeholder: '운영비 / 관리비' })}
          {input('목', '목', { placeholder: '운영비(210)' })}
          {input('세', '세', { placeholder: '일반수용비(01)' })}
          {input('지급처', '지급처(상호)')}
          <label className="kd-field">
            <span className="kd-field-label">지출금액(원)</span>
            <input className="kd-field-input" inputMode="numeric" value={f.amount} onChange={(e) => setField('amount', e.target.value)} placeholder="6000000" />
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
          {input('파일명', '파일 이름 끝', { placeholder: '용역비' })}
          <label className="kd-field kd-field-wide">
            <span className="kd-field-label">지출내용 (줄바꿈 그대로, 「 - 」 항목은 앞에 한 칸 띄움)</span>
            <textarea
              className="kd-field-input kd-forms-textarea kd-forms-textarea--tall"
              rows={8}
              value={f.지출내용}
              onChange={(e) => setField('지출내용', e.target.value)}
              placeholder={'□ 추 진 명: 일반용역비 지급\n□ 용역내용\n - 인터렉티브 아카이브 개발/구축\n□ 필요예산: 6,000,000원'}
            />
          </label>
        </div>

        {notice && <div className="kd-ledger-notice" role="status">{notice}</div>}
        {error && <div className="kd-ledger-warning" role="status">{error}</div>}

        <div className="kd-ledger-form-actions">
          <button type="button" className="kd-ledger-submit" onClick={handleDownload} disabled={busy}>
            {busy ? '생성 중…' : 'HWPX 생성'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JichulForm;
