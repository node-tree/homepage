import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';

// ─────────────────────────────────────────────────────────────────────────────
// 서식6 기획·개발 결과보고서 작업창.
//   프로그램 선택 → 운영기관명·프로그램명·교육대상·참여인력 자동기입.
//   활동개요 5행(일시/주제/참석) 수동입력. 세부내용 4칸 「AI 초안」(KNUH, grounded — 5개 소제목
//   narrative를 4셀에 매핑·시제는 보고 기준월로 제어).
//   클라이언트가 32개 플레이스홀더 값을 조립해 POST → HWPX blob 다운로드.
// ─────────────────────────────────────────────────────────────────────────────

const AI_KEYS = ['내용_역할', '내용_과정', '내용_실행', '내용_평가'] as const;

interface ProgramStat {
  key: string;
  name: string;
  quota: number;
  targetGroup: string;
  주강사: string[];
}

const GyeolgwaForm: React.FC = () => {
  const { logout } = useKkumdarakAuth();
  const [programs, setPrograms] = useState<ProgramStat[]>([]);
  const [programKey, setProgramKey] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [키워드, set키워드] = useState('');
  const [reportMonth, setReportMonth] = useState('');

  const [f, setF] = useState({
    세부대상: '',
    교육인원: '',
    장르: '',
    주요내용: '',
    담당자: '',
    내용_역할: '',
    내용_과정: '',
    내용_실행: '',
    내용_평가: '',
  });
  // 활동개요 5행
  const [rows, setRows] = useState(
    Array.from({ length: 5 }, () => ({ 일시: '', 주제: '', 참석: '' })),
  );

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
      .getPrograms({ signal: c.signal })
      .then((rs) => setPrograms(rs as ProgramStat[]))
      .catch((err: any) => {
        if (err?.name === 'AbortError') return;
        if (onAuthErr(err)) return;
        setError(err?.message || '프로그램을 불러오지 못했습니다.');
      });
    return () => c.abort();
  }, [onAuthErr]);

  const program = useMemo(() => programs.find((p) => p.key === programKey) || null, [programs, programKey]);
  const setField = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setRow = (i: number, k: '일시' | '주제' | '참석', v: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  const ju = program ? program.주강사.map((n) => `${n}(기획)`).join(', ') : '';
  const hasContent = () => AI_KEYS.some((k) => f[k] && f[k].trim());

  const handleAiDraft = async () => {
    if (aiBusy) return;
    if (!program) {
      setError('AI 초안은 프로그램을 먼저 선택해야 합니다.');
      return;
    }
    if (hasContent() && typeof window !== 'undefined' && !window.confirm('기존 세부내용을 AI 초안으로 덮어쓸까요?')) return;
    setAiBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await kkumdarakAdminAPI.aiDraftForm({ docType: 'gyeolgwa', programKey, 키워드, reportMonth });
      if (res.data && typeof res.data === 'object') {
        setF((prev) => {
          const next = { ...prev };
          for (const k of AI_KEYS) {
            const v = (res.data as Record<string, unknown>)[k];
            if (typeof v === 'string') next[k] = v;
          }
          return next;
        });
        setNotice('AI 초안을 세부내용에 채웠습니다. 검토·수정하세요.');
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
    if (!program || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    const today = new Date();
    const body: Record<string, string> = {
      운영기관명: '노드트리',
      프로그램명: program.name,
      교육대상: program.targetGroup,
      세부대상: f.세부대상,
      교육인원: f.교육인원,
      참여인력수: `(총 ${program.주강사.length}명)`,
      참여인력: ju,
      장르: f.장르,
      주요내용: f.주요내용,
      내용_역할: f.내용_역할,
      내용_과정: f.내용_과정,
      내용_실행: f.내용_실행,
      내용_평가: f.내용_평가,
      확인년: `${today.getFullYear()}년`,
      확인월: String(today.getMonth() + 1),
      확인일: String(today.getDate()),
      담당자: f.담당자,
    };
    rows.forEach((r, i) => {
      body[`일시${i + 1}`] = r.일시;
      body[`주제${i + 1}`] = r.주제;
      body[`참석${i + 1}`] = r.참석;
    });
    try {
      const blob = await kkumdarakAdminAPI.downloadGyeolgwaForm(body);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `결과보고서_${program.name}.hwpx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '결과보고서 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kd-forms">
      <p className="kd-forms-hint">
        프로그램을 선택하면 운영기관·프로그램명·교육대상·참여인력이 자동 기입됩니다. 활동개요 5회차와
        세부내용을 입력하세요(세부내용은 「AI 초안」으로 생성 가능).
      </p>

      <div className="kd-forms-grid">
        <label className="kd-field">
          <span className="kd-field-label">프로그램</span>
          <select className="kd-field-input" value={programKey} onChange={(e) => setProgramKey(e.target.value)}>
            <option value="">선택…</option>
            {programs.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="kd-field">
          <span className="kd-field-label">참여인력 (자동)</span>
          <input className="kd-field-input" value={ju} readOnly placeholder="주강사" />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">교육대상 (자동)</span>
          <input className="kd-field-input" value={program?.targetGroup || ''} readOnly />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">세부대상</span>
          <input className="kd-field-input" value={f.세부대상} onChange={(e) => setField('세부대상', e.target.value)} />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">교육인원</span>
          <input className="kd-field-input" value={f.교육인원} onChange={(e) => setField('교육인원', e.target.value)} placeholder="총 00명" />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">장르(부장르)</span>
          <input className="kd-field-input" value={f.장르} onChange={(e) => setField('장르', e.target.value)} />
        </label>
        <label className="kd-field kd-field-wide">
          <span className="kd-field-label">프로그램 주요내용 (100자 이내)</span>
          <input className="kd-field-input" value={f.주요내용} onChange={(e) => setField('주요내용', e.target.value)} />
        </label>
        <label className="kd-field">
          <span className="kd-field-label">담당자</span>
          <input className="kd-field-input" value={f.담당자} onChange={(e) => setField('담당자', e.target.value)} />
        </label>
      </div>

      {/* 활동개요 5행 */}
      <div className="kd-forms-section-title">기획·개발 활동 개요 (5회차)</div>
      {rows.map((r, i) => (
        <div key={i} className="kd-forms-grid">
          <label className="kd-field">
            <span className="kd-field-label">{i + 1}회차 일시</span>
            <input className="kd-field-input" value={r.일시} onChange={(e) => setRow(i, '일시', e.target.value)} placeholder="6. 2.(월)" />
          </label>
          <label className="kd-field kd-field-wide">
            <span className="kd-field-label">활동주제</span>
            <input className="kd-field-input" value={r.주제} onChange={(e) => setRow(i, '주제', e.target.value)} />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">참석자</span>
            <input className="kd-field-input" value={r.참석} onChange={(e) => setRow(i, '참석', e.target.value)} />
          </label>
        </div>
      ))}

      {/* 세부내용 (AI) */}
      <div className="kd-forms-ai">
        <input
          className="kd-field-input"
          placeholder="보고 기준월 (예: 2026년 6월) — 시제(예정/완료) 판단용"
          value={reportMonth}
          onChange={(e) => setReportMonth(e.target.value)}
          aria-label="보고 기준월"
        />
        <input
          className="kd-field-input"
          placeholder="키워드를 쉼표로 나열 — 예: 대상분석, 커리큘럼 개발, 목공 워크숍, 오픈클래스 피드백"
          value={키워드}
          onChange={(e) => set키워드(e.target.value)}
        />
        <button type="button" className="kd-ledger-action kd-ledger-action--form" onClick={handleAiDraft} disabled={aiBusy}>
          {aiBusy ? 'AI 생성 중…' : 'AI 초안'}
        </button>
      </div>
      <div className="kd-forms-textareas">
        {([['내용_역할', '나의 역할'], ['내용_과정', '기획개발 과정'], ['내용_실행', '프로그램 실행'], ['내용_평가', '평가 및 성과']] as const).map(
          ([k, label]) => (
            <label key={k} className="kd-field kd-field-wide">
              <span className="kd-field-label">{label}</span>
              <textarea className="kd-field-input" rows={5} value={f[k]} onChange={(e) => setField(k, e.target.value)} />
            </label>
          ),
        )}
      </div>

      {error && <p className="kd-forms-error">{error}</p>}
      {notice && <p className="kd-forms-notice">{notice}</p>}

      <button type="button" className="kd-forms-submit" onClick={handleDownload} disabled={!program || busy}>
        {busy ? '생성 중…' : '결과보고서 HWPX 생성'}
      </button>
    </div>
  );
};

export default GyeolgwaForm;
