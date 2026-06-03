import React, { useCallback, useEffect, useState } from 'react';
import './businessAdmin.css';
import './ledgerMonitor.css';
import './formsView.css';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';
import LedgerView from './LedgerView';
import DashboardView from './DashboardView';
import FormsView from './FormsView';
import ChecklistView from './ChecklistView';
import EvidenceLibrary from './EvidenceLibrary';

// ═══════════════════════════════════════════════════════════════
// 꿈다락 사업관리 셸 — 로그인(kkumdarak scope) 전용.
//   이 컴포넌트는 KkumdarakAuthProvider 의 자식이므로 useKkumdarakAuth() 가
//   실제 authed 값을 읽는다(Kkumdarak 본문에서 직접 읽으면 default false 트랩).
//   하위 탭: 비목현황 / 집행장부 / 대시보드(프로그램·실적) / 문서·서식 — 모두 구현.
//   탭은 조건부 "마운트"라, 탭 전환 시 각 뷰가 리마운트되며 자동 재조회
//   → 한 탭의 쓰기 결과가 다른 탭 복귀 시 즉시 반영(별도 invalidate 불필요).
// ═══════════════════════════════════════════════════════════════

type AdminTab = 'budget' | 'ledger' | 'evidence' | 'dashboard' | 'forms' | 'personnel' | 'settlement';

const TABS: { id: AdminTab; label: string; ready: boolean }[] = [
  { id: 'budget', label: '비목 현황', ready: true },
  { id: 'ledger', label: '집행 장부', ready: true },
  { id: 'evidence', label: '증빙 관리', ready: true },
  { id: 'dashboard', label: '대시보드', ready: true },
  { id: 'forms', label: '문서/서식', ready: true },
  { id: 'personnel', label: '인건비·4대보험', ready: true },
  { id: 'settlement', label: '정산', ready: true },
];

// ── 백엔드 GET /api/kkumdarak/budget/summary 응답 타입 ──
interface BudgetLineRow {
  lineKey: string;
  majorCode: string;
  majorName: string;
  subCode: string;
  subName: string;
  paymentHint: string;
  budget: number;
  executed: number;
  balance: number;
  progress: number;
  count: number;
}

interface SubItemRow {
  key: string;
  label: string;
  budget: number;
  executed: number;
  balance: number;
  progress: number;
  count: number;
  isPersonnelActivity: boolean;
}

interface ConstraintBlock {
  total: number;
  limit: number;
  exceeded: boolean;
  ratioPercent?: number;
  limitPercent?: number;
}

interface BudgetSummary {
  totalBudget: number;
  totalExecuted: number;
  totalBalance: number;
  totalProgress: number;
  lines: BudgetLineRow[];
  generalSupplySubItems: SubItemRow[];
  constraints: {
    personnelActivity: ConstraintBlock;
    meetingMeal: ConstraintBlock;
  };
  projectPeriod: { start: string; end: string };
}

const won = (n: number): string => `${(n ?? 0).toLocaleString('ko-KR')}원`;
const pct = (n: number): string => `${(n ?? 0).toFixed(2)}%`;

// 일반수용비 라인 식별자(세세목 펼침 대상)
const GENERAL_SUPPLY_KEY = '210-01';

// ── 로딩 스켈레톤 (블로킹 전체화면 "불러오는 중…" 대체) ──────────────────────
//   레이아웃(총괄 카드 그리드 + 표 골격)은 즉시 그려지고 데이터만 비워둔다.
//   색·반짝임은 businessAdmin.css 의 --kd-* 토큰/ink-with-alpha 만 사용(임의 컬러 금지).
//   총괄 카드는 .kd-admin-totals 반응형 그리드를 재사용 → 데스크톱·모바일 공통.
const SkelBar: React.FC<{ w?: string; h?: number }> = ({ w = '100%', h = 14 }) => (
  <span className="kd-skel-bar" style={{ width: w, height: h }} aria-hidden="true" />
);

const SkelTotals: React.FC = () => (
  <div className="kd-admin-totals" aria-hidden="true">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="kd-admin-total-card">
        <SkelBar w="52%" h={12} />
        <SkelBar w="78%" h={20} />
      </div>
    ))}
  </div>
);

const BudgetSkeleton: React.FC = () => (
  <div
    className="kd-admin-budget kd-skel"
    role="status"
    aria-busy="true"
    aria-live="polite"
    aria-label="예산 현황을 불러오는 중"
  >
    <span className="kd-skel-sronly">예산 현황을 불러오는 중…</span>
    <SkelTotals />
    <div className="kd-admin-badges" aria-hidden="true">
      <span className="kd-skel-badge" />
      <span className="kd-skel-badge" />
    </div>
    <div className="kd-admin-table-wrap" aria-hidden="true">
      <table className="kd-admin-table kd-skel-table">
        <tbody>
          {[0, 1, 2, 3, 4, 5, 6].map((r) => (
            <tr key={r}>
              <td className="kd-admin-td-name"><SkelBar w="70%" /></td>
              <td className="kd-admin-td-num"><SkelBar w="60%" /></td>
              <td className="kd-admin-td-num"><SkelBar w="60%" /></td>
              <td className="kd-admin-td-num"><SkelBar w="60%" /></td>
              <td className="kd-admin-td-num"><SkelBar w="40%" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const BudgetView: React.FC = () => {
  const { logout } = useKkumdarakAuth();
  const [data, setData] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const summary = await kkumdarakAdminAPI.getBudgetSummary({ signal });
        setData(summary as BudgetSummary);
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // 언마운트 — 무시
        if (err?.code === 'KKUM_AUTH_EXPIRED') {
          // 토큰 만료/무효 → 로그아웃(나브 메뉴·셸이 자동으로 비로그인 상태로 복귀)
          logout();
          return;
        }
        setError(err?.message || '예산 현황을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [logout],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (loading) {
    return <BudgetSkeleton />;
  }

  if (error) {
    return (
      <div className="kd-admin-state kd-admin-state--error">
        <p>{error}</p>
        <button type="button" className="kd-admin-retry" onClick={() => load()}>
          다시 시도
        </button>
      </div>
    );
  }

  if (!data) {
    return <div className="kd-admin-state">표시할 예산 데이터가 없습니다.</div>;
  }

  const { personnelActivity, meetingMeal } = data.constraints;

  return (
    <div className="kd-admin-budget">
      {/* 총괄 요약 */}
      <div className="kd-admin-totals">
        <div className="kd-admin-total-card">
          <span className="kd-admin-total-label">총사업비</span>
          <strong className="kd-admin-total-value">{won(data.totalBudget)}</strong>
        </div>
        <div className="kd-admin-total-card">
          <span className="kd-admin-total-label">집행액</span>
          <strong className="kd-admin-total-value">{won(data.totalExecuted)}</strong>
        </div>
        <div className="kd-admin-total-card">
          <span className="kd-admin-total-label">잔액</span>
          <strong className="kd-admin-total-value">{won(data.totalBalance)}</strong>
        </div>
        <div className="kd-admin-total-card">
          <span className="kd-admin-total-label">진척률</span>
          <strong className="kd-admin-total-value">{pct(data.totalProgress)}</strong>
        </div>
      </div>

      {/* 편성제한 배지 */}
      <div className="kd-admin-badges">
        <span
          className={`kd-admin-badge${personnelActivity.exceeded ? ' is-over' : ' is-ok'}`}
        >
          인력활동비 {pct(personnelActivity.ratioPercent ?? 0)} / 한도{' '}
          {personnelActivity.limitPercent ?? 40}%
          {personnelActivity.exceeded ? ' · 초과!' : ' · 충족'}
        </span>
        <span className={`kd-admin-badge${meetingMeal.exceeded ? ' is-over' : ' is-ok'}`}>
          회의식비 누계 {won(meetingMeal.total)} / 한도 {won(meetingMeal.limit)}
          {meetingMeal.exceeded ? ' · 초과!' : ' · 충족'}
        </span>
      </div>

      {/* 비목 라인 표 */}
      <div className="kd-admin-table-wrap">
        <table className="kd-admin-table">
          <thead>
            <tr>
              <th className="kd-admin-th-name">비목 / 세목</th>
              <th className="kd-admin-th-num">편성액</th>
              <th className="kd-admin-th-num">집행액</th>
              <th className="kd-admin-th-num">잔액</th>
              <th className="kd-admin-th-num">진척%</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => {
              const isGeneralSupply = line.lineKey === GENERAL_SUPPLY_KEY;
              return (
                <React.Fragment key={line.lineKey}>
                  <tr className={isGeneralSupply ? 'kd-admin-row-expandable' : undefined}>
                    <td className="kd-admin-td-name">
                      {isGeneralSupply ? (
                        <button
                          type="button"
                          className="kd-admin-expand-btn"
                          onClick={() => setExpanded((v) => !v)}
                          aria-expanded={expanded}
                        >
                          <span className="kd-admin-expand-caret" aria-hidden="true">
                            {expanded ? '▾' : '▸'}
                          </span>
                          {line.majorName}({line.majorCode}) · {line.subName}({line.subCode})
                        </button>
                      ) : (
                        <span>
                          {line.majorName}({line.majorCode}) · {line.subName}({line.subCode})
                        </span>
                      )}
                    </td>
                    <td className="kd-admin-td-num">{won(line.budget)}</td>
                    <td className="kd-admin-td-num">{won(line.executed)}</td>
                    <td className="kd-admin-td-num">{won(line.balance)}</td>
                    <td className="kd-admin-td-num">{pct(line.progress)}</td>
                  </tr>

                  {/* 일반수용비 세세목 펼침 */}
                  {isGeneralSupply &&
                    expanded &&
                    data.generalSupplySubItems.map((si) => (
                      <tr key={si.key} className="kd-admin-subrow">
                        <td className="kd-admin-td-name kd-admin-td-sub">
                          <span className="kd-admin-sub-dot" aria-hidden="true" />
                          {si.label}
                          {si.isPersonnelActivity && (
                            <span className="kd-admin-sub-tag">인력활동비</span>
                          )}
                        </td>
                        <td className="kd-admin-td-num">{won(si.budget)}</td>
                        <td className="kd-admin-td-num">{won(si.executed)}</td>
                        <td className="kd-admin-td-num">{won(si.balance)}</td>
                        <td className="kd-admin-td-num">{pct(si.progress)}</td>
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="kd-admin-td-name">합계</td>
              <td className="kd-admin-td-num">{won(data.totalBudget)}</td>
              <td className="kd-admin-td-num">{won(data.totalExecuted)}</td>
              <td className="kd-admin-td-num">{won(data.totalBalance)}</td>
              <td className="kd-admin-td-num">{pct(data.totalProgress)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="kd-admin-period">
        사업기간 {data.projectPeriod.start} ~ {data.projectPeriod.end}
      </p>
    </div>
  );
};

const BusinessAdmin: React.FC = () => {
  const { authed, requestLogin } = useKkumdarakAuth();
  const [tab, setTab] = useState<AdminTab>('budget');

  // 셸 자체 로그인 게이트 (renderSection 은 default 컨텍스트라 여기서 가드)
  if (!authed) {
    return (
      <section className="kd-section kd-admin">
        <div className="kd-admin-state kd-admin-gate">
          <h2 className="kd-admin-title">사업관리</h2>
          <p>이 화면은 꿈다락 관리자 로그인 후 이용할 수 있습니다.</p>
          <button type="button" className="kd-admin-retry" onClick={requestLogin}>
            관리자 로그인
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="kd-section kd-admin">
      <header className="kd-admin-head">
        <h2 className="kd-admin-title">사업관리</h2>
        <p className="kd-admin-subtitle">꿈다락 문화예술학교 · 예산 집행 현황</p>
      </header>

      <nav className="kd-admin-tabs" aria-label="사업관리 탭">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`kd-admin-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {!t.ready && <span className="kd-admin-tab-soon">준비중</span>}
          </button>
        ))}
      </nav>

      <div className="kd-admin-panel">
        {tab === 'budget' && <BudgetView />}
        {tab === 'ledger' && <LedgerView />}
        {tab === 'evidence' && <EvidenceLibrary />}
        {tab === 'dashboard' && <DashboardView />}
        {tab === 'forms' && <FormsView />}
        {tab === 'personnel' && <ChecklistView kind="personnel" />}
        {tab === 'settlement' && <ChecklistView kind="settlement" />}
      </div>
    </section>
  );
};

export default BusinessAdmin;
