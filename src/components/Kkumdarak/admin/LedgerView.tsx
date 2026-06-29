import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';

// ═══════════════════════════════════════════════════════════════
// 집행 장부 (흐름 A) — 집행 입력 폼 + 목록 + 필터 + 수정/삭제.
//   · 비목/세세목 드롭다운·예산 모니터는 GET /budget/summary 를 단일 상태(summary)로
//     들고 쓴다(별도 lineOpts/subItemOpts 중복 제거). 쓰기 후 summary 를 재조회해
//     모니터 바·세목 잔액·잔여% 가 즉시 갱신된다.
//   · 비목현황 탭은 탭 전환 시 자동 refetch(BusinessAdmin 조건부 마운트). 여기 summary 는
//     LedgerView 로컬 사본(독립 read-only) — 의도된 중복.
//   · 저장/수정/삭제 후 목록(loadRows)·예산(loadSummary) 모두 invalidate.
//   · status(예치형 6단계)는 UI 에서 제거 — 모델 기본값('지출결의')만 사용, 전송/표시 안 함.
// ═══════════════════════════════════════════════════════════════

const GENERAL_SUPPLY_KEY = '210-01';
const MATERIAL_SUBITEM = '교육재료비'; // 프로그램 태깅 입력경로(교육재료비에만 적용)
const BUSINESS_PROMO_KEY = '240-01'; // 업무추진비/사업추진비
const BUSINESS_PROMO_SUBITEMS = ['다과비', '회의식비']; // 회의식비 누계 ≤100만 검증 입력경로

// 교육재료비 프로그램 옵션 (value=programKey, ''=미분류/공통).
//   편성(programKey 별)은 참고치 — 초과해도 막지 않으며 한도는 교육재료비 총액만 적용.
const MATERIAL_PROGRAMS: { key: string; label: string }[] = [
  { key: 'jangam-chaekjeong', label: '장암책정' },
  { key: 'gieok-sunhwan', label: '기억순환' },
  { key: 'son-gieok', label: '손의기억' },
  { key: 'sori-ilgi', label: '소리일기' },
  { key: 'punggyeong-ilgi', label: '풍경일기' },
  { key: 'dasi-annyeong', label: '다시,안녕' },
];
const MATERIAL_PROGRAM_LABEL: Record<string, string> = MATERIAL_PROGRAMS.reduce(
  (m, p) => { m[p.key] = p.label; return m; }, {} as Record<string, string>,
);

// 백엔드 enum 과 1:1 (Korean 라벨은 표시용, value 는 enum 그대로 전송)
const PAYMENT_METHODS: { value: 'transfer' | 'card'; label: string }[] = [
  { value: 'transfer', label: '이체' },
  { value: 'card', label: '카드' },
];

type IncomeType = '근로' | '사업3.3' | '기타8.8' | '';
const INCOME_TYPES: { value: IncomeType; label: string }[] = [
  { value: '', label: '없음' },
  { value: '근로', label: '근로' },
  { value: '사업3.3', label: '사업소득 3.3%' },
  { value: '기타8.8', label: '기타소득 8.8%' },
];

// ── 타입 ──────────────────────────────────────────────────────
//   summary 구조는 BusinessAdmin.BudgetView 와 동일(GET /budget/summary). 동일 필드명 재사용.
interface BudgetLineRow {
  lineKey: string;
  majorCode: string;
  majorName: string;
  subCode: string;
  subName: string;
  budget: number;
  executed: number;
  balance: number;
  progress: number;
}
interface ProgramBreakdownRow {
  program: string;
  programKey: string | null;
  amount: number;
  detail: string;
  executed: number;
  balance: number;
  count: number;
}
interface SubItemRow {
  key: string;
  label: string;
  budget: number;
  executed: number;
  balance: number;
  breakdown?: ProgramBreakdownRow[] | null;
  unclassified?: { executed: number; count: number } | null;
}
interface BudgetSummary {
  totalBudget: number;
  totalExecuted: number;
  totalBalance: number;
  totalProgress: number;
  lines: BudgetLineRow[];
  generalSupplySubItems: SubItemRow[];
}
interface Warning {
  code: string;
  message: string;
}
interface Transaction {
  _id: string;
  date: string;
  majorCode: string;
  subCode: string;
  subItem: string | null;
  program: string | null;
  description: string;
  grossAmount: number;
  withholdingAmount: number;
  netAmount: number;
  payeeName: string;
  paymentMethod: 'transfer' | 'card';
  incomeType: IncomeType | null;
  evidenceMeta?: any[];
}

interface FormState {
  date: string;
  lineKey: string; // majorCode-subCode 선택 (UI용)
  subItem: string;
  program: string; // 교육재료비 프로그램 key ('' = 미분류/공통)
  description: string;
  paymentMethod: 'transfer' | 'card';
  payeeName: string;
  incomeType: IncomeType;
  grossAmount: string;
  withholdingAmount: string;
}

const emptyForm = (): FormState => ({
  date: '',
  lineKey: '',
  subItem: '',
  program: '',
  description: '',
  paymentMethod: 'transfer',
  payeeName: '',
  incomeType: '',
  grossAmount: '',
  withholdingAmount: '',
});

const won = (n: number): string => `${(n ?? 0).toLocaleString('ko-KR')}원`;
const pct1 = (n: number): string => `${(n ?? 0).toFixed(1)}%`;

// ── 원천징수 자동계산 ─────────────────────────────────────────
//   사업소득(3.3%)·기타소득(8.8%)은 총액×요율을 "원단위 절사"(Math.floor)로 자동 산정.
//   근로/없음은 수동 입력 허용(자동 0 제안).
//   ⚠️ 가정: 절사 = 정수 원 단위 내림(Math.floor). 회계 실무정리에 별도 라운딩 예시 없음.
//   (기타소득은 실무상 월125,000 초과분만 과세이나, MVP 필드셋은 총액 기준 단순계산으로 한정.)
const WITHHOLDING_RATE: Record<string, number> = {
  '사업3.3': 0.033,
  '기타8.8': 0.088,
};
function autoWithholding(incomeType: IncomeType, gross: number): number | null {
  const rate = WITHHOLDING_RATE[incomeType];
  if (!rate) return null; // 근로/없음 → 수동
  return Math.floor((gross || 0) * rate);
}

const WARNING_LABEL: Record<string, string> = {
  BUDGET_EXCEEDED: '잔액 초과',
  OUT_OF_PERIOD: '사업기간 외',
  UNKNOWN_LINE: '미편성 비목',
};

const LedgerView: React.FC = () => {
  const { logout } = useKkumdarakAuth();

  // 예산 요약(드롭다운 소스 + 모니터 바 + 세목 잔액의 단일 진실원천)
  const [summary, setSummary] = useState<BudgetSummary | null>(null);

  // 목록 + 상태
  const [rows, setRows] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');


  // 폼
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [notice, setNotice] = useState('');

  // 필터 (status 필터 제거)
  const [filters, setFilters] = useState({
    majorCode: '',
    month: '',
    paymentMethod: '',
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

  // 예산 요약 로드 — summary 상태만 건드린다(warnings/notice/loading 미접촉 → 배너 보존).
  const loadSummary = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await kkumdarakAdminAPI.getBudgetSummary({ signal });
        if (data) setSummary(data as BudgetSummary);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        onAuthErr(err); // 모니터 실패는 비치명(폼·목록은 그대로 사용 가능)
      }
    },
    [onAuthErr],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadSummary(controller.signal);
    return () => controller.abort();
  }, [loadSummary]);

  // 목록 로드(필터 반영)
  const loadRows = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const data = await kkumdarakAdminAPI.getTransactions(filters, { signal });
        setRows(data as Transaction[]);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (onAuthErr(err)) return;
        setError(err?.message || '집행 목록을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [filters, onAuthErr],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadRows(controller.signal);
    return () => controller.abort();
  }, [loadRows]);


  // 드롭다운/라벨 — summary 에서 파생(중복 상태 제거)
  const lineOpts = useMemo(() => summary?.lines || [], [summary]);
  const subItemOpts = useMemo(
    () => (summary?.generalSupplySubItems || []).map((s) => ({ key: s.key, label: s.label })),
    [summary],
  );
  const lineLabel = useMemo(() => {
    const map: Record<string, string> = {};
    lineOpts.forEach((l) => {
      map[l.lineKey] = `${l.majorName}(${l.majorCode}) · ${l.subName}(${l.subCode})`;
    });
    return map;
  }, [lineOpts]);
  const majorOpts = useMemo(() => {
    const seen = new Map<string, string>();
    lineOpts.forEach((l) => {
      if (!seen.has(l.majorCode)) seen.set(l.majorCode, `${l.majorName}(${l.majorCode})`);
    });
    return Array.from(seen.entries()).map(([code, label]) => ({ code, label }));
  }, [lineOpts]);

  // ── 폼 파생값 ──
  const grossNum = Number(form.grossAmount) || 0;
  const isGeneralSupply = form.lineKey === GENERAL_SUPPLY_KEY;
  const isMaterial = isGeneralSupply && form.subItem === MATERIAL_SUBITEM; // 프로그램 태깅 대상
  const isBusinessPromo = form.lineKey === BUSINESS_PROMO_KEY;
  const autoWh = autoWithholding(form.incomeType, grossNum);
  const isAutoWh = autoWh !== null; // 3.3/8.8 → 자동·잠금
  const effectiveWh = isAutoWh ? (autoWh as number) : Number(form.withholdingAmount) || 0;
  const netAmount = Math.max(0, grossNum - effectiveWh);

  // 선택한 세목의 현재 {편성·집행·잔액}(저장된 값 기준) — summary.lines 에서 조회
  const selectedLine = useMemo(
    () => (form.lineKey ? lineOpts.find((l) => l.lineKey === form.lineKey) || null : null),
    [form.lineKey, lineOpts],
  );
  // 선택한 세세목(일반수용비)의 잔액 — summary.generalSupplySubItems 에서 조회
  const selectedSubItem = useMemo(
    () =>
      isGeneralSupply && form.subItem && summary
        ? summary.generalSupplySubItems.find((s) => s.key === form.subItem) || null
        : null,
    [isGeneralSupply, form.subItem, summary],
  );
  // 선택한 프로그램의 편성(참고)·집행·차이 — 교육재료비 breakdown 에서 조회.
  //   편성은 참고일 뿐 상한 아님(한도는 교육재료비 총액). 초과해도 막지 않는다.
  const selectedProgramRef = useMemo(() => {
    if (!isMaterial || !form.program || !selectedSubItem || !selectedSubItem.breakdown) return null;
    return selectedSubItem.breakdown.find((b) => b.programKey === form.program) || null;
  }, [isMaterial, form.program, selectedSubItem]);

  // 소득유형/총액 변경 시 자동 원천세를 폼에 반영(자동 모드에서만)
  useEffect(() => {
    if (isAutoWh) {
      setForm((f) => ({ ...f, withholdingAmount: String(autoWh) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.incomeType, form.grossAmount]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  // resetForm 은 warnings 를 건드리지 않는다 — 저장 직후 setWarnings(res.warnings) 가
  // 마지막 쓰기로 유지되도록(같은 배치에서 []로 덮어쓰지 않도록). handleSubmit·beginEdit 가
  // 각자 시작 시 warnings 를 클리어한다. 취소 버튼은 cancelEdit 로 별도 클리어.
  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const cancelEdit = () => {
    resetForm();
    setWarnings([]);
    setNotice('');
  };

  const beginEdit = (tx: Transaction) => {
    setEditingId(tx._id);
    setWarnings([]);
    setNotice('');
    setForm({
      date: (tx.date || '').slice(0, 10),
      lineKey: `${tx.majorCode}-${tx.subCode}`,
      subItem: tx.subItem || '',
      program: tx.program || '',
      description: tx.description || '',
      paymentMethod: tx.paymentMethod,
      payeeName: tx.payeeName || '',
      incomeType: (tx.incomeType || '') as IncomeType,
      grossAmount: String(tx.grossAmount ?? ''),
      withholdingAmount: String(tx.withholdingAmount ?? ''),
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const buildPayload = () => {
    const [majorCode, subCode] = form.lineKey.split('-');
    // status 미전송 — 백엔드 모델 기본값('지출결의') 사용.
    return {
      date: form.date, // YYYY-MM-DD 그대로(TZ 시프트 방지)
      majorCode,
      subCode,
      subItem: (isGeneralSupply || isBusinessPromo) && form.subItem ? form.subItem : null,
      program: isMaterial && form.program ? form.program : null, // 교육재료비만; null=미분류
      description: form.description.trim(),
      grossAmount: grossNum,
      withholdingAmount: effectiveWh,
      payeeName: form.payeeName.trim(),
      paymentMethod: form.paymentMethod,
      incomeType: form.incomeType === '' ? null : form.incomeType, // 없음 → null
    };
  };

  const canSubmit =
    !!form.date && !!form.lineKey && !!form.description.trim() && form.grossAmount !== '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    setWarnings([]);
    setNotice('');
    try {
      const payload = buildPayload();
      const res = editingId
        ? await kkumdarakAdminAPI.updateTransaction(editingId, payload)
        : await kkumdarakAdminAPI.createTransaction(payload);
      resetForm(); // warnings 미접촉
      setNotice(editingId ? '집행 건이 수정되었습니다.' : '집행 건이 저장되었습니다.');
      setWarnings(res.warnings || []); // 마지막 warnings 쓰기 — 경고 배너 유지
      await loadRows(); // 목록 즉시 invalidate
      await loadSummary(); // 예산 모니터·세목 잔액·잔여% 즉시 갱신(summary 만 갱신)
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('이 집행 건을 삭제할까요?')) return;
    try {
      await kkumdarakAdminAPI.deleteTransaction(id);
      setNotice('집행 건이 삭제되었습니다.');
      setWarnings([]);
      if (editingId === id) resetForm();
      await loadRows(); // 목록 즉시 invalidate
      await loadSummary(); // 예산 모니터 갱신
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '삭제에 실패했습니다.');
    }
  };

  // 전체 예산 잔여% = 잔액 ÷ 편성 × 100 (집행% 인 totalProgress 의 보수)
  const remainPercent =
    summary && summary.totalBudget > 0
      ? (summary.totalBalance / summary.totalBudget) * 100
      : 0;
  const totalOver = !!summary && summary.totalBalance < 0;

  return (
    <div className="kd-admin-ledger">
      {/* ── 예산 모니터 바 (summary 있을 때만) ── */}
      {summary && (
        <div className="kd-ledger-monitor">
          <div className="kd-ledger-monitor-cell">
            <span className="kd-ledger-monitor-label">총 사업비</span>
            <strong className="kd-ledger-monitor-value">{won(summary.totalBudget)}</strong>
          </div>
          <div className="kd-ledger-monitor-cell">
            <span className="kd-ledger-monitor-label">집행 합계</span>
            <strong className="kd-ledger-monitor-value">{won(summary.totalExecuted)}</strong>
          </div>
          <div className="kd-ledger-monitor-cell">
            <span className="kd-ledger-monitor-label">잔액</span>
            <strong className={`kd-ledger-monitor-value${totalOver ? ' is-over' : ''}`}>
              {won(summary.totalBalance)}
            </strong>
          </div>
          <div className="kd-ledger-monitor-cell">
            <span className="kd-ledger-monitor-label">잔여 %</span>
            <strong className={`kd-ledger-monitor-value${totalOver ? ' is-over' : ''}`}>
              {pct1(remainPercent)}
            </strong>
          </div>
        </div>
      )}

      {/* ── 입력 폼 ── */}
      <form className="kd-ledger-form" onSubmit={handleSubmit}>
        <h3 className="kd-ledger-form-title">
          {editingId ? '집행 건 수정' : '새 집행 입력'}
        </h3>

        <div className="kd-ledger-grid">
          <label className="kd-field">
            <span className="kd-field-label">집행일자 (예탁계좌 출금일)</span>
            <input
              type="date"
              className="kd-field-input"
              value={form.date}
              onChange={(e) => setField('date', e.target.value)}
              required
            />
          </label>

          <label className="kd-field">
            <span className="kd-field-label">비목 / 세목</span>
            <select
              className="kd-field-input"
              value={form.lineKey}
              onChange={(e) => {
                setField('lineKey', e.target.value);
                if (e.target.value !== GENERAL_SUPPLY_KEY && e.target.value !== BUSINESS_PROMO_KEY)
                  setField('subItem', '');
              }}
              required
            >
              <option value="">선택…</option>
              {lineOpts.map((l) => (
                <option key={l.lineKey} value={l.lineKey}>
                  {l.majorName}({l.majorCode}) · {l.subName}({l.subCode})
                </option>
              ))}
            </select>
          </label>

          {isGeneralSupply && (
            <label className="kd-field">
              <span className="kd-field-label">세세목 (일반수용비)</span>
              <select
                className="kd-field-input"
                value={form.subItem}
                onChange={(e) => {
                  setField('subItem', e.target.value);
                  if (e.target.value !== MATERIAL_SUBITEM) setField('program', ''); // 교육재료비 외엔 프로그램 비움
                }}
              >
                <option value="">선택…</option>
                {subItemOpts.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {isMaterial && (
            <label className="kd-field">
              <span className="kd-field-label">프로그램 (교육재료비)</span>
              <select
                className="kd-field-input"
                value={form.program}
                onChange={(e) => setField('program', e.target.value)}
              >
                <option value="">미분류 / 공통</option>
                {MATERIAL_PROGRAMS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {isBusinessPromo && (
            <label className="kd-field">
              <span className="kd-field-label">세세목 (업무추진비)</span>
              <select
                className="kd-field-input"
                value={form.subItem}
                onChange={(e) => setField('subItem', e.target.value)}
              >
                <option value="">선택…</option>
                {BUSINESS_PROMO_SUBITEMS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="kd-field kd-field-wide">
            <span className="kd-field-label">집행내용</span>
            <input
              type="text"
              className="kd-field-input"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="예: 장암책정 5회차 강사비"
              required
            />
          </label>

          <label className="kd-field">
            <span className="kd-field-label">결제수단</span>
            <select
              className="kd-field-input"
              value={form.paymentMethod}
              onChange={(e) => setField('paymentMethod', e.target.value as 'transfer' | 'card')}
            >
              {PAYMENT_METHODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="kd-field">
            <span className="kd-field-label">수취인</span>
            <input
              type="text"
              className="kd-field-input"
              value={form.payeeName}
              onChange={(e) => setField('payeeName', e.target.value)}
              placeholder="이름"
            />
          </label>

          <label className="kd-field">
            <span className="kd-field-label">소득유형</span>
            <select
              className="kd-field-input"
              value={form.incomeType}
              onChange={(e) => setField('incomeType', e.target.value as IncomeType)}
            >
              {INCOME_TYPES.map((it) => (
                <option key={it.value || 'none'} value={it.value}>
                  {it.label}
                </option>
              ))}
            </select>
          </label>

          <label className="kd-field">
            <span className="kd-field-label">총액 (원천징수 전)</span>
            <input
              type="number"
              min={0}
              className="kd-field-input"
              value={form.grossAmount}
              onChange={(e) => setField('grossAmount', e.target.value)}
              placeholder="0"
              required
            />
            {grossNum >= 300000 && (
              <p className="kd-evidence-threshold">
                {grossNum >= 5000000
                  ? '⚠ 500만원↑ — 계약서 + 비교견적서 필요'
                  : grossNum >= 2000000
                    ? '⚠ 200만원↑ — 비교견적서 필요'
                    : '※ 30만원↑ — 적격증빙(세금계산서/계산서/카드/현금영수증) 필수'}
              </p>
            )}
          </label>

          <label className="kd-field">
            <span className="kd-field-label">
              원천징수액{isAutoWh ? ' (자동)' : ''}
            </span>
            <input
              type="number"
              min={0}
              className="kd-field-input"
              value={form.withholdingAmount}
              readOnly={isAutoWh}
              onChange={(e) => setField('withholdingAmount', e.target.value)}
              placeholder="0"
            />
          </label>

          <label className="kd-field">
            <span className="kd-field-label">실지급액 (자동)</span>
            <input
              type="text"
              className="kd-field-input kd-field-readonly"
              value={won(netAmount)}
              readOnly
            />
          </label>
        </div>

        {/* 선택 세목 잔액 인라인 표시(저장된 값 기준) */}
        {selectedLine && (
          <div className="kd-ledger-lineinfo">
            <span className="kd-ledger-lineinfo-name">
              {selectedLine.majorName}({selectedLine.majorCode}) · {selectedLine.subName}({selectedLine.subCode})
            </span>
            <span className="kd-ledger-lineinfo-stat">편성 {won(selectedLine.budget)}</span>
            <span className="kd-ledger-lineinfo-stat">집행 {won(selectedLine.executed)}</span>
            <span className={`kd-ledger-lineinfo-stat${selectedLine.balance < 0 ? ' is-over' : ''}`}>
              잔액 {won(selectedLine.balance)}
            </span>
            {selectedSubItem && (
              <span className={`kd-ledger-lineinfo-sub${selectedSubItem.balance < 0 ? ' is-over' : ''}`}>
                └ {selectedSubItem.label} 잔액 {won(selectedSubItem.balance)} (편성 {won(selectedSubItem.budget)})
              </span>
            )}
            {isMaterial && selectedProgramRef && (
              <span className="kd-ledger-lineinfo-sub">
                └ {MATERIAL_PROGRAM_LABEL[selectedProgramRef.programKey || ''] || selectedProgramRef.program} ·
                {' '}편성(참고) {won(selectedProgramRef.amount)} · 집행 {won(selectedProgramRef.executed)} · 차이 {won(selectedProgramRef.balance)}
                {' '}<em className="kd-ledger-ref-note">※ 편성은 참고치 · 한도는 교육재료비 총액</em>
              </span>
            )}
          </div>
        )}

        {/* 경고 배너 (차단 아님) */}
        {warnings.length > 0 && (
          <div className="kd-ledger-warnings" role="status">
            {warnings.map((w, i) => (
              <div key={i} className="kd-ledger-warning">
                <strong>{WARNING_LABEL[w.code] || '경고'}</strong> · {w.message}
              </div>
            ))}
          </div>
        )}
        {notice && <div className="kd-ledger-notice" role="status">{notice}</div>}

        <div className="kd-ledger-form-actions">
          {editingId && (
            <button type="button" className="kd-admin-retry" onClick={cancelEdit}>
              취소
            </button>
          )}
          <button type="submit" className="kd-ledger-submit" disabled={!canSubmit || saving}>
            {saving ? '저장 중…' : editingId ? '수정 저장' : '집행 저장'}
          </button>
        </div>
      </form>

      {/* ── 필터 ── */}
      <div className="kd-ledger-filters">
        <select
          className="kd-field-input"
          value={filters.majorCode}
          onChange={(e) => setFilters((f) => ({ ...f, majorCode: e.target.value }))}
          aria-label="비목 필터"
        >
          <option value="">전체 비목</option>
          {majorOpts.map((m) => (
            <option key={m.code} value={m.code}>
              {m.label}
            </option>
          ))}
        </select>
        <input
          type="month"
          className="kd-field-input"
          value={filters.month}
          onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}
          aria-label="월 필터"
        />
        <select
          className="kd-field-input"
          value={filters.paymentMethod}
          onChange={(e) => setFilters((f) => ({ ...f, paymentMethod: e.target.value }))}
          aria-label="결제수단 필터"
        >
          <option value="">전체 수단</option>
          {PAYMENT_METHODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── 목록 ── */}
      {error && (
        <div className="kd-admin-state kd-admin-state--error">
          <p>{error}</p>
          <button type="button" className="kd-admin-retry" onClick={() => loadRows()}>
            다시 시도
          </button>
        </div>
      )}

      {loading ? (
        <div
          className="kd-admin-table-wrap"
          role="status"
          aria-busy="true"
          aria-live="polite"
          aria-label="집행 내역을 불러오는 중"
        >
          <span className="kd-skel-sronly">집행 내역을 불러오는 중…</span>
          <table className="kd-admin-table kd-ledger-table kd-skel-table" aria-hidden="true">
            <tbody>
              {[0, 1, 2, 3, 4, 5].map((r) => (
                <tr key={r}>
                  <td className="kd-admin-td-name"><span className="kd-skel-bar" style={{ width: '70%' }} /></td>
                  <td className="kd-admin-td-name"><span className="kd-skel-bar" style={{ width: '60%' }} /></td>
                  <td className="kd-admin-td-name"><span className="kd-skel-bar" style={{ width: '85%' }} /></td>
                  <td className="kd-admin-td-num"><span className="kd-skel-bar" style={{ width: '55%' }} /></td>
                  <td className="kd-admin-td-num"><span className="kd-skel-bar" style={{ width: '55%' }} /></td>
                  <td className="kd-admin-td-name"><span className="kd-skel-bar" style={{ width: '50%' }} /></td>
                  <td className="kd-admin-td-name"><span className="kd-skel-bar" style={{ width: '60%' }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : rows.length === 0 ? (
        <div className="kd-admin-state">등록된 집행 건이 없습니다.</div>
      ) : (
        <div className="kd-admin-table-wrap">
          <table className="kd-admin-table kd-ledger-table">
            <thead>
              <tr>
                <th className="kd-admin-th-name">일자</th>
                <th className="kd-admin-th-name">비목</th>
                <th className="kd-admin-th-name">내용</th>
                <th className="kd-admin-th-num">총액</th>
                <th className="kd-admin-th-num">실지급</th>
                <th className="kd-admin-th-name">수취인</th>
                <th className="kd-admin-th-name">관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx) => (
                <tr key={tx._id}>
                  <td className="kd-admin-td-name">{(tx.date || '').slice(0, 10)}</td>
                  <td className="kd-admin-td-name">
                    {lineLabel[`${tx.majorCode}-${tx.subCode}`] || `${tx.majorCode}-${tx.subCode}`}
                  </td>
                  <td className="kd-admin-td-name">
                    {tx.description}
                    {tx.subItem && <span className="kd-admin-sub-tag">{tx.subItem}</span>}
                    {tx.program && (
                      <span className="kd-admin-sub-tag">
                        {MATERIAL_PROGRAM_LABEL[tx.program] || tx.program}
                      </span>
                    )}
                  </td>
                  <td className="kd-admin-td-num">{won(tx.grossAmount)}</td>
                  <td className="kd-admin-td-num">{won(tx.netAmount)}</td>
                  <td className="kd-admin-td-name">{tx.payeeName || '—'}</td>
                  <td className="kd-admin-td-name kd-ledger-actions">
                    <button type="button" className="kd-ledger-action" onClick={() => beginEdit(tx)}>
                      수정
                    </button>
                    <button
                      type="button"
                      className="kd-ledger-action kd-ledger-action--danger"
                      onClick={() => handleDelete(tx._id)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LedgerView;
