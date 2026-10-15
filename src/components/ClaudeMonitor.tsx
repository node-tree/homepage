import React, { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// NODE TREE AGENTS MONITOR
// 데이터는 공개 저장소 github.com/node-tree/claude-code-logs 에서 읽는다.
//   teams.json · agents.json          ← 맥의 ~/.claude/hooks/sync-agents.py (에이전트·스킬이 바뀔 때)
//   index.json · agent-activity.json  ← ~/.claude/hooks/session-parser.py (세션 요약만, 질문 원문은 올리지 않음)
//   recommendations.json              ← 클라우드 루틴 「팀별 AI 도구 추천」 매일 09:05
//   grants.json                       ← 클라우드 루틴 「공모 레이더」 매주 월 09:00
// 화면에 고정 데이터를 두지 않는다. 비어 있으면 비어 있다고 보여 준다.
// ═══════════════════════════════════════════════════════════════════════════════

const GITHUB_RAW = 'https://raw.githubusercontent.com/node-tree/claude-code-logs/main';
const REFRESH_MS = 60_000;
const RECENT_DAYS = 7;
const MONO = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace";
const SANS = "-apple-system, BlinkMacSystemFont, 'Noto Sans KR', sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AgentMember { id: string; name: string; desc: string; }
interface TeamDef { id: string; name: string; emoji: string; color: string; desc: string; agents: AgentMember[]; }
interface SkillDef {
  id: string; type: 'skill' | 'plugin' | 'mcp' | 'agent'; category: string;
  name: string; desc: string; version?: string; parentPlugin?: string;
}
interface SessionSummary {
  sessionId: string; date: string; startTime: string; durationSeconds: number;
  modelTier: string; projectName: string; toolCallCount: number; agentsUsed?: string[];
}
interface AgentActivity { [agentId: string]: { lastActive: string; lastProject: string; sessionId: string; }; }
interface RecommendItem { name: string; type: string; desc: string; reason: string; trend: 'hot' | 'rising' | 'stable'; url?: string; }
interface TeamRecommendation { teamId: string; teamName: string; items: RecommendItem[]; }
interface RecommendationsData { lastUpdated: string; recommendations: TeamRecommendation[]; }
interface GrantItem {
  id: string; title: string; organization: string;
  region: 'domestic' | 'international';
  category: '현대예술' | '문화예술교육' | '미디어콘텐츠';
  deadline: string | null; // "YYYY-MM-DD"
  openDate?: string; url: string; amount?: string; notes?: string;
}
type Tab = 'teams' | 'sessions' | 'skills' | 'grants';

// ── Constants ─────────────────────────────────────────────────────────────────
const C = {
  bg: '#ffffff', bgSub: '#fafafa', border: '#e8e8e8', borderStrong: '#222',
  text: '#0a0a0a', textMid: '#555', textDim: '#9a9a9a',
  pulse: '#22c55e', hot: '#dc2626', rising: '#d97706',
};

const MODEL_META: Record<string, { label: string; symbol: string; col: string }> = {
  fable:   { label: 'FABLE',  symbol: '◆', col: '#0a0a0a' },
  opus:    { label: 'OPUS',   symbol: '▲', col: '#3a3a3a' },
  sonnet:  { label: 'SONNET', symbol: '■', col: '#777' },
  haiku:   { label: 'HAIKU',  symbol: '●', col: '#a3a3a3' },
  other:   { label: 'OTHER',  symbol: '○', col: '#c4c4c4' },
  unknown: { label: '기록 없음', symbol: '·', col: '#e2e2e2' },
};
const MODEL_ORDER = ['fable', 'opus', 'sonnet', 'haiku', 'other', 'unknown'];

const SKILL_CATS: Record<string, { label: string; symbol: string }> = {
  art: { label: 'ART', symbol: '●' }, audio: { label: 'AUDIO', symbol: '◇' },
  document: { label: 'DOC', symbol: '□' }, dev: { label: 'DEV', symbol: '■' },
  research: { label: 'RESEARCH', symbol: '○' }, meta: { label: 'SYSTEM', symbol: '◆' },
};

const TREND_COL: Record<string, string> = { hot: C.hot, rising: C.rising, stable: C.textDim };

const GRANT_CAT_COLOR: Record<string, string> = {
  '현대예술': '#6d28d9', '문화예술교육': '#047857', '미디어콘텐츠': '#0e7490',
};

// 운영 원칙 — ~/.claude/CLAUDE.md · ~/.nodetree-collab/PROTOCOL.md 의 바뀌지 않는 뼈대만.
const PRINCIPLES = [
  { k: 'LEAD', v: '메인 Claude 세션이 직접 수행하고, 독립 작업이나 별도 검토가 필요할 때만 위임' },
  { k: 'REVIEW', v: 'evaluator 한 명이 lens code · design · doc 으로 판정' },
  { k: 'CLAUDE + CODEX', v: '첫 리서치 → 뼈대 → 결과물, 단계마다 두 모델이 의견을 내고 한 담당이 통합' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function pad2(n: number) { return String(n).padStart(2, '0'); }
function fmtDur(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h${pad2(Math.floor((s % 3600) / 60))}m`;
}
function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return '--:--'; }
}
function ageDays(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Infinity : Math.floor((Date.now() - t) / 86400000);
}
function fmtRelDate(iso: string): string {
  const d = ageDays(iso);
  if (!Number.isFinite(d)) return '';
  if (d <= 0) return 'TODAY';
  if (d === 1) return 'YESTERDAY';
  return `${d}D AGO`;
}
function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const end = new Date(`${deadline}T23:59:59+09:00`).getTime();
  return Math.floor((end - Date.now()) / 86400000);
}
function urgencyColor(days: number | null): string {
  if (days === null) return C.textDim;
  if (days <= 6) return C.hot;
  if (days <= 13) return C.rising;
  if (days <= 29) return '#a16207';
  return C.textDim;
}
async function getJson<T>(file: string): Promise<T | null> {
  try {
    const r = await fetch(`${GITHUB_RAW}/${file}?t=${Date.now()}`, { cache: 'no-store' });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}

// ── Styles ────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
  @keyframes pulse-line { 0%,100%{opacity:0.3} 50%{opacity:1} }
  @keyframes skeleton { 0%,100%{opacity:0.45} 50%{opacity:1} }
  .ikeda-row { transition: background 0.1s; }
  .ikeda-row:hover { background: #f5f5f5; }
  .ikeda-btn { cursor:pointer; background:transparent; border:1px solid #222; color:#0a0a0a; font-family:${MONO}; font-size:10px; padding:5px 10px; letter-spacing:0.08em; transition:background 0.1s, color 0.1s, transform 0.1s; }
  .ikeda-btn:hover, .ikeda-btn.active { background:#0a0a0a; color:#fff; }
  .ikeda-btn:active { transform: translateY(1px); }
  .ikeda-tab { cursor:pointer; background:transparent; border:none; border-bottom:2px solid transparent; color:#9a9a9a; font-family:${MONO}; font-size:11px; padding:12px 16px; letter-spacing:0.1em; transition:color 0.1s; white-space:nowrap; }
  .ikeda-tab:hover { color:#0a0a0a; }
  .ikeda-tab.active { color:#0a0a0a; border-bottom-color:#0a0a0a; }
  .mon-link { color: inherit; text-decoration: none; }
  .mon-link:hover { text-decoration: underline; }
  .mon-clamp2 { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }

  .monitor-header { padding: 0 32px; }
  .monitor-container { padding: 20px 24px 48px; }
  .monitor-stats-grid { display:grid; grid-template-columns: repeat(6, 1fr); }
  .monitor-principles { display:grid; grid-template-columns: repeat(3, 1fr); }
  .monitor-teams-grid { display:grid; grid-template-columns: repeat(3, 1fr); }
  .monitor-rec-row { display:grid; grid-template-columns: 150px 1fr; }
  .monitor-rec-items { display:grid; grid-template-columns: repeat(3, 1fr); }
  .monitor-grants-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .monitor-session-row { display:grid; grid-template-columns: 24px 1fr 130px 64px 56px; align-items:center; gap:12px; }
  .monitor-tabs { display:flex; overflow-x:auto; -webkit-overflow-scrolling:touch; }

  @media (max-width: 900px) {
    .monitor-teams-grid { grid-template-columns: repeat(2, 1fr); }
    .monitor-rec-items { grid-template-columns: 1fr; }
  }
  @media (max-width: 768px) {
    .monitor-header { padding: 0 16px; }
    .monitor-container { padding: 16px 16px 40px; }
    .monitor-stats-grid { grid-template-columns: repeat(3, 1fr); }
    .monitor-principles, .monitor-teams-grid, .monitor-grants-grid { grid-template-columns: 1fr; }
    .monitor-rec-row { grid-template-columns: 1fr; }
    .monitor-session-row { grid-template-columns: 18px 1fr 74px 44px; gap:8px; }
    .monitor-session-row .col-dur { display:none; }
    .monitor-hide-sm { display:none !important; }
    .ikeda-tab { padding: 12px 12px; }
  }
  @media (max-width: 480px) {
    .monitor-stats-grid { grid-template-columns: repeat(2, 1fr); }
  }
`;

// ── Small pieces ──────────────────────────────────────────────────────────────
function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span style={{ fontFamily: MONO, fontSize: 10, color: C.textDim, letterSpacing: '0.1em', ...style }}>{children}</span>;
}

function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', borderTop: `2px solid ${C.text}`, paddingTop: 12, marginBottom: 14 }}>
      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', color: C.text }}>{title}</span>
      {sub && <Label>{sub}</Label>}
      {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: `1px dashed ${C.border}`, padding: '28px 18px', fontFamily: SANS, fontSize: 13, color: C.textMid, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ height: 14, margin: '12px 0', background: '#f0f0f0', width: `${92 - i * 9}%`, animation: 'skeleton 1.4s ease-in-out infinite', animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  );
}

function StatusDot({ recent }: { recent: boolean }) {
  return (
    <span style={{
      width: 6, height: 6, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
      background: recent ? C.pulse : '#d6d6d6', animation: recent ? 'pulse-line 2s infinite' : 'none',
    }} />
  );
}

function SessionRow({ s }: { s: SessionSummary }) {
  const m = MODEL_META[s.modelTier] || MODEL_META.other;
  const agents = (s.agentsUsed || []).filter(a => a !== 'general-purpose');
  return (
    <div className="ikeda-row monitor-session-row" style={{ padding: '9px 16px', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontFamily: MONO, fontSize: 14, color: m.col === '#e2e2e2' ? '#bbb' : m.col, textAlign: 'center' }} title={m.label}>{m.symbol}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {s.projectName}
          <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 8, color: C.textDim, letterSpacing: '0.08em' }}>{m.label}</span>
        </div>
        {agents.length > 0 && (
          <div style={{ fontFamily: MONO, fontSize: 10, color: C.textMid, marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            → {agents.join(' · ')}
          </div>
        )}
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: C.textMid }}>{s.date.slice(5)} {fmtTime(s.startTime)}</span>
      <span className="col-dur" style={{ fontFamily: MONO, fontSize: 10, color: C.textDim, textAlign: 'right' }}>{fmtDur(s.durationSeconds)}</span>
      <span style={{ fontFamily: MONO, fontSize: 10, color: C.textDim, textAlign: 'right' }}>T {s.toolCallCount}</span>
    </div>
  );
}

function GrantRow({ g }: { g: GrantItem }) {
  const days = daysUntil(g.deadline);
  const col = urgencyColor(days);
  return (
    <div className="ikeda-row" style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 5 }}>
        <span style={{
          fontFamily: MONO, fontSize: 10, fontWeight: 700, color: '#fff', background: col,
          padding: '2px 6px', flexShrink: 0, marginTop: 1, letterSpacing: '0.04em', minWidth: 44, textAlign: 'center',
        }}>
          {days === null ? '상시' : days === 0 ? 'D-DAY' : `D-${days}`}
        </span>
        <a className="mon-link" href={g.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.45 }}>
          {g.title}
        </a>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingLeft: 54 }}>
        <Label style={{ letterSpacing: '0.02em' }}>{g.organization}</Label>
        <span style={{ fontFamily: MONO, fontSize: 10, padding: '1px 6px', border: `1px solid ${GRANT_CAT_COLOR[g.category] || C.border}55`, color: GRANT_CAT_COLOR[g.category] || C.textMid }}>
          {g.category}
        </span>
        {g.amount && <Label style={{ letterSpacing: '0.02em' }}>{g.amount}</Label>}
        {g.deadline && <span style={{ fontFamily: MONO, fontSize: 10, color: col, fontWeight: days !== null && days <= 6 ? 700 : 400 }}>{g.deadline} 마감</span>}
      </div>
      {g.notes && <div style={{ paddingLeft: 54, marginTop: 4, fontFamily: SANS, fontSize: 12, color: C.textMid, lineHeight: 1.5 }}>{g.notes}</div>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const ClaudeMonitor: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [lastSync, setLastSync] = useState('');
  const [teams, setTeams] = useState<TeamDef[]>([]);
  const [skills, setSkills] = useState<SkillDef[]>([]);
  const [activity, setActivity] = useState<AgentActivity>({});
  const [recs, setRecs] = useState<RecommendationsData | null>(null);
  const [grants, setGrants] = useState<GrantItem[]>([]);
  const [grantsUpdated, setGrantsUpdated] = useState('');
  const [tab, setTab] = useState<Tab>('teams');
  const [skillCat, setSkillCat] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const fetchAll = useCallback(async () => {
    const [index, agents, teamsData, act, rec, grantData] = await Promise.all([
      getJson<{ lastUpdated: string; sessions: SessionSummary[] }>('index.json'),
      getJson<{ agents: SkillDef[] }>('agents.json'),
      getJson<{ teams: TeamDef[] }>('teams.json'),
      getJson<AgentActivity>('agent-activity.json'),
      getJson<RecommendationsData>('recommendations.json'),
      getJson<{ lastUpdated: string; grants: GrantItem[] }>('grants.json'),
    ]);
    if (index) { setSessions(index.sessions || []); setLastSync(index.lastUpdated || ''); }
    if (agents) setSkills(agents.agents || []);
    if (teamsData) setTeams(teamsData.teams || []);
    if (act) setActivity(act);
    if (rec) setRecs(rec);
    if (grantData) { setGrants(grantData.grants || []); setGrantsUpdated(grantData.lastUpdated || ''); }
    setStatus(index || agents || teamsData || rec || grantData ? 'ready' : 'error');
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, REFRESH_MS);
    return () => clearInterval(iv);
  }, [fetchAll]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const agentCount = teams.reduce((n, t) => n + t.agents.length, 0);
  const skillCount = skills.filter(s => s.type === 'skill').length;
  const pluginCount = skills.filter(s => s.type === 'plugin').length;
  const mcpCount = skills.filter(s => s.type === 'mcp').length;
  const totalTools = sessions.reduce((n, s) => n + (s.toolCallCount || 0), 0);
  const totalHours = (sessions.reduce((n, s) => n + (s.durationSeconds || 0), 0) / 3600).toFixed(1);
  const projectCount = new Set(sessions.map(s => s.projectName)).size;
  const since = sessions.length ? sessions[sessions.length - 1].date : '';

  const modelCounts: Record<string, number> = {};
  sessions.forEach(s => { const k = MODEL_META[s.modelTier] ? s.modelTier : 'other'; modelCounts[k] = (modelCounts[k] || 0) + 1; });

  const activeGrants = grants
    .filter(g => { const d = daysUntil(g.deadline); return d === null || d >= 0; })
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
  const urgentGrants = activeGrants.filter(g => { const d = daysUntil(g.deadline); return d !== null && d <= 13; }).length;

  const listedSkills = skills.filter(s => s.type !== 'agent');
  const catCounts: Record<string, number> = {};
  listedSkills.forEach(s => { catCounts[s.category] = (catCounts[s.category] || 0) + 1; });
  const filteredSkills = skillCat ? listedSkills.filter(s => s.category === skillCat) : listedSkills;

  // 추천은 teams.json 순서로, 팀에 없는 추천은 뒤에
  const recRows: TeamRecommendation[] = recs ? [
    ...teams.map(t => recs.recommendations.find(r => r.teamId === t.id)).filter((r): r is TeamRecommendation => !!r),
    ...recs.recommendations.filter(r => !teams.some(t => t.id === r.teamId)),
  ] : [];
  const recAge = recs ? ageDays(`${recs.lastUpdated}T09:00:00+09:00`) : Infinity;

  const timeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;

  const stats = [
    { label: 'AGENTS', value: pad2(agentCount), sub: `${teams.length} TEAMS` },
    { label: 'SKILLS', value: pad2(skillCount), sub: `PLUGIN ${pluginCount} · MCP ${mcpCount}` },
    { label: 'SESSIONS', value: String(sessions.length), sub: since ? `${since.slice(5)} 부터` : '-' },
    { label: 'TOOL CALLS', value: totalTools.toLocaleString(), sub: '누적' },
    { label: 'HOURS', value: `${totalHours}h`, sub: `${projectCount} PROJECTS` },
    { label: 'GRANTS', value: pad2(activeGrants.length), sub: `D-13 이내 ${urgentGrants}`, accent: urgentGrants > 0 ? C.hot : undefined },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'teams', label: `팀  [${pad2(teams.length)}]` },
    { key: 'sessions', label: `세션  [${pad2(sessions.length)}]` },
    { key: 'skills', label: `스킬  [${pad2(listedSkills.length)}]` },
    { key: 'grants', label: `공모  [${pad2(activeGrants.length)}]` },
  ];

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: SANS, color: C.text }}>
      <style>{css}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="monitor-header" style={{
        background: C.bg, borderBottom: `2px solid ${C.text}`, height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.2em' }}>NODE TREE</span>
          <span style={{ width: 1, height: 20, background: C.border }} />
          <Label style={{ letterSpacing: '0.12em' }}>AGENTS MONITOR</Label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <StatusDot recent={status === 'ready'} />
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em' }}>{timeStr}</span>
          </span>
          {lastSync && <span className="monitor-hide-sm"><Label style={{ letterSpacing: '0.04em' }}>SYNC {lastSync.slice(5, 10)} {fmtTime(lastSync)}</Label></span>}
        </div>
      </div>

      <div className="monitor-container" style={{ maxWidth: 1280, margin: '0 auto' }}>

        {status === 'error' && (
          <div style={{ marginBottom: 20 }}>
            <Empty>데이터 저장소(github.com/node-tree/claude-code-logs)에 연결하지 못했습니다. 잠시 뒤 자동으로 다시 시도합니다.</Empty>
          </div>
        )}

        {/* ── Stats strip ─────────────────────────────────────────────────── */}
        <div className="monitor-stats-grid" style={{ borderTop: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`, marginBottom: 24 }}>
          {stats.map(st => (
            <div key={st.label} style={{ borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: '14px 16px', minWidth: 0 }}>
              <Label>{st.label}</Label>
              <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: st.accent || C.text, lineHeight: 1, letterSpacing: '-0.02em', margin: '8px 0 6px' }}>
                {status === 'loading' ? '—' : st.value}
              </div>
              <Label style={{ letterSpacing: '0.04em' }}>{st.sub}</Label>
            </div>
          ))}
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="monitor-tabs" style={{ borderBottom: `1px solid ${C.border}` }}>
          {tabs.map(t => (
            <button key={t.key} className={`ikeda-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {/* ── TEAMS ───────────────────────────────────────────────────────── */}
        {tab === 'teams' && (
          <div style={{ paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 36 }}>

            {/* 운영 원칙 */}
            <div className="monitor-principles" style={{ borderTop: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }}>
              {PRINCIPLES.map(p => (
                <div key={p.k} style={{ borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: '14px 16px' }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', marginBottom: 6 }}>{p.k}</div>
                  <div style={{ fontFamily: SANS, fontSize: 13, color: C.textMid, lineHeight: 1.6 }}>{p.v}</div>
                </div>
              ))}
            </div>

            {/* 모델별 세션 */}
            <div>
              <SectionTitle title="MODELS" sub={`최근 ${sessions.length}개 세션의 주 모델`} />
              {status === 'loading' ? <Skeleton rows={1} /> : sessions.length === 0 ? (
                <Empty>세션 기록이 아직 없습니다.</Empty>
              ) : (
                <>
                  <div style={{ display: 'flex', height: 10, border: `1px solid ${C.border}` }}>
                    {MODEL_ORDER.filter(k => modelCounts[k]).map(k => (
                      <div key={k} title={`${MODEL_META[k].label} ${modelCounts[k]}`} style={{ width: `${(modelCounts[k] / sessions.length) * 100}%`, background: MODEL_META[k].col }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10 }}>
                    {MODEL_ORDER.filter(k => modelCounts[k]).map(k => (
                      <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, background: MODEL_META[k].col, border: k === 'unknown' ? `1px solid ${C.border}` : 'none' }} />
                        <span style={{ fontFamily: MONO, fontSize: 11, color: C.text }}>{MODEL_META[k].label}</span>
                        <Label style={{ letterSpacing: 0 }}>{modelCounts[k]} · {((modelCounts[k] / sessions.length) * 100).toFixed(0)}%</Label>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 팀 */}
            <div>
              <SectionTitle title="TEAMS" sub={`${teams.length}개 팀 · 에이전트 ${agentCount}`} right={<span className="monitor-hide-sm"><Label><span style={{ color: C.pulse }}>●</span> {RECENT_DAYS}일 안에 쓴 에이전트</Label></span>} />
              {status === 'loading' ? <Skeleton rows={5} /> : teams.length === 0 ? (
                <Empty>teams.json이 비어 있습니다. 맥에서 <code>python3 ~/.claude/hooks/sync-agents.py</code>를 실행하면 채워집니다.</Empty>
              ) : (
                <div className="monitor-teams-grid" style={{ borderTop: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }}>
                  {teams.map(team => (
                    <div key={team.id} style={{ borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: '16px 16px 12px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                        <span style={{ fontFamily: MONO, fontSize: 13, color: team.color }}>{team.emoji}</span>
                        <span style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700 }}>{team.name}</span>
                        <Label style={{ marginLeft: 'auto' }}>{pad2(team.agents.length)}</Label>
                      </div>
                      {team.desc && <div style={{ fontFamily: SANS, fontSize: 12, color: C.textMid, lineHeight: 1.55, margin: '6px 0 10px' }}>{team.desc}</div>}
                      <div style={{ borderTop: `1px solid ${C.border}` }}>
                        {team.agents.map(a => {
                          const act = activity[a.id];
                          const recent = !!act && ageDays(act.lastActive) < RECENT_DAYS;
                          return (
                            <div key={a.id} style={{ padding: '9px 0', borderBottom: `1px solid ${C.border}` }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <StatusDot recent={recent} />
                                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600 }}>{a.id}</span>
                                {act && <Label style={{ marginLeft: 'auto', letterSpacing: '0.04em' }}>{fmtRelDate(act.lastActive)}</Label>}
                              </div>
                              <div className="mon-clamp2" style={{ fontFamily: SANS, fontSize: 12, color: C.textMid, lineHeight: 1.5, marginTop: 3, paddingLeft: 13 }}>{a.desc}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 팀별 AI 도구 추천 */}
            <div>
              <SectionTitle
                title="팀별 AI 도구 추천"
                sub="매일 09:05 · 웹에서 확인한 도구만 · 설치된 것과 최근 14일 추천은 제외"
                right={recs && (
                  <Label style={{ color: recAge > 1 ? C.rising : C.textDim, letterSpacing: '0.04em' }}>
                    {recs.lastUpdated}{recAge > 1 ? ` · ${recAge}일 전` : ''}
                  </Label>
                )}
              />
              {status === 'loading' ? <Skeleton rows={4} /> : recRows.length === 0 ? (
                <Empty>추천 데이터가 없습니다. 클라우드 루틴 「NODE TREE 팀별 AI 도구 추천」이 매일 09:05에 채웁니다.</Empty>
              ) : (
                <div style={{ borderTop: `1px solid ${C.border}` }}>
                  {recRows.map(r => {
                    const team = teams.find(t => t.id === r.teamId);
                    return (
                      <div key={r.teamId} className="monitor-rec-row" style={{ borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ padding: '14px 12px 14px 0', display: 'flex', alignItems: 'baseline', gap: 7 }}>
                          <span style={{ fontFamily: MONO, fontSize: 12, color: team?.color || C.textMid }}>{team?.emoji || '·'}</span>
                          <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 700 }}>{team?.name || r.teamName}</span>
                        </div>
                        <div className="monitor-rec-items">
                          {r.items.map(item => (
                            <div key={item.name} style={{ padding: '14px 14px 14px 0', minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                                {item.url ? (
                                  <a className="mon-link" href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.text }}>{item.name} ↗</a>
                                ) : (
                                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700 }}>{item.name}</span>
                                )}
                                <Label style={{ letterSpacing: '0.08em' }}>{(item.type || '').toUpperCase()}</Label>
                                <span style={{ fontFamily: MONO, fontSize: 10, color: TREND_COL[item.trend] || C.textDim, letterSpacing: '0.08em' }}>{(item.trend || '').toUpperCase()}</span>
                              </div>
                              <div style={{ fontFamily: SANS, fontSize: 13, color: C.text, lineHeight: 1.5, marginTop: 4 }}>{item.desc}</div>
                              <div style={{ fontFamily: SANS, fontSize: 12, color: C.textMid, lineHeight: 1.55, marginTop: 4 }}>{item.reason}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SESSIONS ────────────────────────────────────────────────────── */}
        {tab === 'sessions' && (
          <div style={{ paddingTop: 24 }}>
            <SectionTitle title="SESSION LOG" sub="프로젝트 · 주 모델 · 쓴 에이전트 · 길이 · 도구 호출 (질문 원문은 올리지 않음)" />
            {status === 'loading' ? <Skeleton rows={8} /> : sessions.length === 0 ? (
              <Empty>세션 기록이 없습니다.</Empty>
            ) : (
              <div style={{ border: `1px solid ${C.border}` }}>
                <div className="monitor-session-row" style={{ padding: '8px 16px', borderBottom: `1px solid ${C.borderStrong}`, background: C.bgSub }}>
                  <span />
                  <Label>PROJECT</Label>
                  <Label>DATE</Label>
                  <span className="col-dur" style={{ fontFamily: MONO, fontSize: 10, color: C.textDim, letterSpacing: '0.1em', textAlign: 'right' }}>TIME</span>
                  <Label style={{ textAlign: 'right' }}>TOOLS</Label>
                </div>
                {sessions.map(s => <SessionRow key={s.sessionId} s={s} />)}
              </div>
            )}
          </div>
        )}

        {/* ── SKILLS ──────────────────────────────────────────────────────── */}
        {tab === 'skills' && (
          <div style={{ paddingTop: 24 }}>
            <SectionTitle title="SKILLS · PLUGINS · MCP" sub={`설치된 것 ${listedSkills.length}개 (꺼 둔 플러그인 제외)`} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              <button className={`ikeda-btn${skillCat === null ? ' active' : ''}`} onClick={() => setSkillCat(null)}>ALL {listedSkills.length}</button>
              {Object.keys(SKILL_CATS).filter(k => catCounts[k]).map(k => (
                <button key={k} className={`ikeda-btn${skillCat === k ? ' active' : ''}`} onClick={() => setSkillCat(k)}>
                  {SKILL_CATS[k].symbol} {SKILL_CATS[k].label} {catCounts[k]}
                </button>
              ))}
            </div>
            {status === 'loading' ? <Skeleton rows={8} /> : filteredSkills.length === 0 ? (
              <Empty>표시할 항목이 없습니다.</Empty>
            ) : (
              <div style={{ border: `1px solid ${C.border}` }}>
                {filteredSkills.map(s => (
                  <div key={`${s.type}-${s.id}`} className="ikeda-row" style={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 220px) 64px 1fr', gap: 12, alignItems: 'baseline', padding: '9px 16px', borderBottom: `1px solid ${C.border}` }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: C.textMid }}>{SKILL_CATS[s.category]?.symbol || '·'}</span>
                    <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                      {s.parentPlugin && <span style={{ fontWeight: 400, color: C.textDim }}> · {s.parentPlugin}</span>}
                    </span>
                    <Label style={{ letterSpacing: '0.08em' }}>{s.type.toUpperCase()}</Label>
                    <span className="mon-clamp2 monitor-hide-sm" style={{ fontFamily: SANS, fontSize: 12, color: C.textMid, lineHeight: 1.5 }}>{s.desc}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── GRANTS ──────────────────────────────────────────────────────── */}
        {tab === 'grants' && (() => {
          const domestic = activeGrants.filter(g => g.region === 'domestic');
          const intl = activeGrants.filter(g => g.region === 'international');
          const column = (title: string, sub: string, list: GrantItem[]) => (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '9px 14px', borderTop: `2px solid ${C.text}`, borderBottom: `1px solid ${C.border}`, background: C.bgSub }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em' }}>{title}</span>
                <Label>{sub} · {list.length}</Label>
              </div>
              <div style={{ border: `1px solid ${C.border}`, borderTop: 'none' }}>
                {list.length === 0
                  ? <div style={{ padding: '22px 14px', fontFamily: SANS, fontSize: 13, color: C.textDim }}>마감 전인 공모가 없습니다.</div>
                  : list.map(g => <GrantRow key={g.id} g={g} />)}
              </div>
            </div>
          );
          return (
            <div style={{ paddingTop: 24 }}>
              <SectionTitle
                title="GRANT RADAR"
                sub="현대예술 · 문화예술교육 · 미디어콘텐츠 · 매주 월요일 09:00 갱신"
                right={grantsUpdated && <Label style={{ color: ageDays(grantsUpdated) > 8 ? C.rising : C.textDim, letterSpacing: '0.04em' }}>UPDATED {grantsUpdated.slice(0, 10)}</Label>}
              />
              {status === 'loading' ? <Skeleton rows={6} /> : activeGrants.length === 0 ? (
                <Empty>마감 전인 공모가 없습니다{grantsUpdated ? ` (마지막 갱신 ${grantsUpdated.slice(0, 10)})` : ''}. 클라우드 루틴 「NODE TREE 공모 레이더(주간)」가 매주 월요일에 채웁니다.</Empty>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
                    {[{ col: C.hot, label: 'D-6 이내' }, { col: C.rising, label: 'D-13 이내' }, { col: '#a16207', label: 'D-29 이내' }, { col: C.textDim, label: '여유' }].map(l => (
                      <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, background: l.col }} />
                        <Label style={{ letterSpacing: '0.04em' }}>{l.label}</Label>
                      </span>
                    ))}
                  </div>
                  <div className="monitor-grants-grid">
                    {column('국내', 'DOMESTIC', domestic)}
                    {column('해외', 'INTERNATIONAL', intl)}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 40, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Label style={{ letterSpacing: '0.04em' }}>DATA github.com/node-tree/claude-code-logs</Label>
          <Label style={{ letterSpacing: '0.04em' }}>팀 · 스킬 · 세션: 작업 맥에서 자동 갱신</Label>
          <Label style={{ letterSpacing: '0.04em' }}>추천: 매일 09:05 · 공모: 매주 월 09:00</Label>
        </div>
      </div>
    </div>
  );
};

export default ClaudeMonitor;
