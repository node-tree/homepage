import React, { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// NODE TREE AGENTS MONITOR — IKEDA RYOJI AESTHETIC
// data as material · precision as beauty · white silence
// ═══════════════════════════════════════════════════════════════════════════════

const GITHUB_RAW = 'https://raw.githubusercontent.com/node-tree/claude-code-logs/main';
const REFRESH_MS = 60_000;
const MONO = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace";
const SANS = "-apple-system, BlinkMacSystemFont, 'Noto Sans KR', sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────────
interface TeamDef {
  id: string; name: string; emoji: string; color: string; bg: string;
  desc: string; skills: string[]; agents: AgentMember[];
}
interface AgentMember { id: string; name: string; desc: string; emoji?: string; }
interface SkillDef {
  id: string; type: 'skill' | 'plugin' | 'mcp' | 'agent'; category: string;
  name: string; desc: string; emoji: string; version?: string;
}
interface SessionSummary {
  sessionId: string; date: string; startTime: string; durationSeconds: number;
  modelTier: 'opus' | 'sonnet' | 'haiku'; projectName: string;
  toolCallCount: number; firstPrompt?: string;
}
interface IndexData { lastUpdated: string; totalSessions: number; sessions: SessionSummary[]; }
interface AgentsData { lastUpdated: string; totalAgents: number; agents: SkillDef[]; }
interface AgentActivity {
  [agentId: string]: { lastActive: string; lastProject: string; sessionId: string; };
}
interface RecommendItem { name: string; type: 'skill' | 'agent' | 'mcp'; desc: string; reason: string; trend: 'hot' | 'rising' | 'stable'; }
interface TeamRecommendation { teamId: string; teamName: string; items: RecommendItem[]; }
interface RecommendationsData { lastUpdated: string; recommendations: TeamRecommendation[]; }

// ── Harness agents ────────────────────────────────────────────────────────────
const AGENTS = [
  { tier: 'opus' as const,   role: 'PLANNER',   korean: '전략가', symbol: '▲', desc: '짧은 요청 → 상세 설계서 변환. 복잡한 추론 담당.', col: '#111' },
  { tier: 'sonnet' as const, role: 'GENERATOR', korean: '구현자', symbol: '■', desc: 'Sprint Contract 단위 코드 구현. 주력 에이전트.', col: '#444' },
  { tier: 'haiku' as const,  role: 'EVALUATOR', korean: '평가자', symbol: '○', desc: 'Playwright 테스트 및 채점. 자기 편향 제거.', col: '#888' },
] as const;

const SKILL_CATEGORIES: Record<string, { label: string }> = {
  art:      { label: 'ART' }, audio:    { label: 'AUDIO' },
  document: { label: 'DOC' }, dev:      { label: 'DEV' },
  research: { label: 'RESEARCH' }, meta: { label: 'SYSTEM' },
};

const FALLBACK_TEAMS: TeamDef[] = [
  { id: 'dev',        name: '개발팀',           emoji: '■', color: '#1d4ed8', bg: '#eff6ff', desc: '소프트웨어 개발, 배포, 인프라', skills: ['vercel-react-best-practices','kicad-pcb-design','clangd-lsp','cli-anything','mcp-playwright'], agents: [] },
  { id: 'research',   name: '리서치팀',         emoji: '○', color: '#b45309', bg: '#fffbeb', desc: '정보 수집, 분석, 지식 정리', skills: ['notebooklm-research','youtube-study'], agents: [] },
  { id: 'art',        name: '예술작업팀',       emoji: '▲', color: '#7c3aed', bg: '#f5f3ff', desc: '사운드 아트, 영상, 설치, 생성 예술', skills: ['algorithmic-art','supercollider-sound-art','td-guide','web-audio-synth','remotion-best-practices','canvas-design'], agents: [] },
  { id: 'accounting', name: '회계팀',           emoji: '□', color: '#059669', bg: '#ecfdf5', desc: '재무 관리, 예산, 지출 추적', skills: ['xlsx','korea-accounting','grant-accounting','pdf','hwpx','pptx'], agents: [] },
  { id: 'design',     name: '디자인 및 홍보팀', emoji: '●', color: '#e11d48', bg: '#fff1f2', desc: 'UI/UX 디자인, 브랜딩, 홍보', skills: ['pencil-design','taste-skill','frontend-design','photo-grading','figma-generate-design'], agents: [] },
  { id: 'planning',   name: '기획팀',           emoji: '◆', color: '#0891b2', bg: '#ecfeff', desc: '프로젝트 기획, 제안서, 문서 작성', skills: ['pptx','hwpx','pdf','skill-creator'], agents: [] },
];

// 카테고리별 단일 기호 — 이케다 료지 원칙
const CAT_SYMBOL: Record<string, string> = {
  art: '●', audio: '◇', document: '□', dev: '■', research: '○', meta: '◆',
};

const FALLBACK_SKILLS: SkillDef[] = [
  { id: 'algorithmic-art', type: 'skill', category: 'art', name: 'Algorithmic Art', desc: 'p5.js generative art, flow fields', emoji: '●' },
  { id: 'canvas-design', type: 'skill', category: 'art', name: 'Canvas Design', desc: 'Visual art in .png/.pdf', emoji: '●' },
  { id: 'photo-grading', type: 'skill', category: 'art', name: 'Photo Grading', desc: '유명 감성 사진작가 스타일 보정', emoji: '●' },
  { id: 'pencil-design', type: 'skill', category: 'art', name: 'Pencil Design', desc: 'Web/mobile UI in .pen', emoji: '●' },
  { id: 'taste-skill', type: 'skill', category: 'art', name: 'Design Taste', desc: 'Senior UI/UX engineering', emoji: '●' },
  { id: 'web-audio-synth', type: 'skill', category: 'audio', name: 'Web Audio Synth', desc: 'Strudel, Tone.js, Web Audio API', emoji: '◇' },
  { id: 'supercollider-sound-art', type: 'skill', category: 'audio', name: 'SuperCollider', desc: 'Generative music & installations', emoji: '◇' },
  { id: 'supercollider-sound-art-for-daisy', type: 'skill', category: 'audio', name: 'SC × Daisy', desc: 'Daisy Patch SM hardware', emoji: '◇' },
  { id: 'td-guide', type: 'skill', category: 'audio', name: 'TouchDesigner', desc: 'TD operators, GLSL shaders', emoji: '◇' },
  { id: 'remotion-best-practices', type: 'skill', category: 'audio', name: 'Remotion', desc: 'Video creation in React', emoji: '◇' },
  { id: 'xlsx', type: 'skill', category: 'document', name: 'XLSX', desc: '예산표·지출내역·정산서 Excel 생성', emoji: '□' },
  { id: 'korea-accounting', type: 'skill', category: 'document', name: '한국 세무회계', desc: '법인세·부가세·원천세·4대보험 실무', emoji: '□' },
  { id: 'grant-accounting', type: 'skill', category: 'document', name: '지원사업 회계', desc: 'e나라도움·보탬e·NCAS 집행·정산', emoji: '□' },
  { id: 'hwpx', type: 'skill', category: 'document', name: 'HWPX', desc: '한글 문서(.hwpx) 생성·편집', emoji: '□' },
  { id: 'pdf', type: 'skill', category: 'document', name: 'PDF', desc: 'PDF manipulation & forms', emoji: '□' },
  { id: 'pptx', type: 'skill', category: 'document', name: 'PPTX', desc: 'Presentation creation', emoji: '□' },
  { id: 'kicad-pcb-design', type: 'skill', category: 'dev', name: 'KiCad PCB', desc: 'Eurorack PCB, Daisy Patch SM', emoji: '■' },
  { id: 'vercel-react-best-practices', type: 'skill', category: 'dev', name: 'Vercel/React', desc: 'React & Next.js performance', emoji: '■' },
  { id: 'notebooklm-research', type: 'skill', category: 'research', name: 'NotebookLM', desc: 'URL → NotebookLM → Obsidian', emoji: '○' },
  { id: 'youtube-study', type: 'skill', category: 'research', name: 'YouTube Study', desc: 'YouTube 영상 분석 및 학습', emoji: '○' },
  { id: 'skill-creator', type: 'skill', category: 'meta', name: 'Skill Creator', desc: 'Create & optimize skills', emoji: '◆' },
  { id: 'frontend-design', type: 'plugin', category: 'art', name: 'Frontend Design', desc: '1개 스킬 포함', emoji: '●' },
  { id: 'claude-qwen-tts', type: 'plugin', category: 'audio', name: 'Claude Qwen TTS', desc: '1개 스킬 포함', emoji: '◇' },
  { id: 'figma', type: 'plugin', category: 'dev', name: 'Figma', desc: '7개 스킬 포함', emoji: '■' },
  { id: 'mcp-pencil', type: 'mcp', category: 'dev', name: 'pencil', desc: 'MCP: Pencil design editor', emoji: '×' },
  { id: 'mcp-playwright', type: 'mcp', category: 'dev', name: 'playwright', desc: 'MCP: Browser automation', emoji: '×' },
];

// 에이전트 한글 설명 맵
const AGENT_DESC_KO: Record<string, string> = {
  'nodetreehome-web':    'nodetreeHome 웹 개발 · React 컴포넌트 · API · 배포',
  'doc-design':          '포트폴리오·도록·공문서·보고서 제작 (Pencil, HWPX)',
  'grant-writer':        '지원서·작가노트·프로젝트 설명문 작성',
  'project-planner':     '일정·예산·역할 분담·진행 상황 관리 (Obsidian)',
  'pr-content':          '홍보문·보도자료·전시 소개·SNS 캡션 작성',
  'visual-design':       '포스터·인스타 이미지·전시 그래픽·홍보물 제작',
  'grant-research':      '공모·레지던시·지원사업 발굴 및 전략 기획',
  'nodetree-research':   '작가·작품·이론·기술 리서치 및 Obsidian 정리',
  'media-art-pipeline':  'OSC·ArtNet·ESP32·TidalCycles·TouchDesigner 파이프라인',
  'saengsanso-accounting':    '주식회사 생산소 세무·회계·급여·법인카드 처리',
  'grant-accounting-agent':   '공모사업 정산·e나라도움·e보템·NCAS 집행 관리',
  'code-evaluator':           '구현 결과물 채점 (GAN 이밸류에이터) · PASS/REWORK 판정',
};

const SYSTEM_MAP = [
  { team: '개발팀',           emoji: '■', color: '#1d4ed8', agents: ['nodetreehome-web'] },
  { team: '리서치팀',         emoji: '○', color: '#b45309', agents: ['nodetree-research', 'grant-research'] },
  { team: '예술작업팀',       emoji: '▲', color: '#7c3aed', agents: ['media-art-pipeline'] },
  { team: '회계팀',           emoji: '□', color: '#059669', agents: ['saengsanso-accounting', 'grant-accounting-agent'] },
  { team: '디자인 및 홍보팀', emoji: '●', color: '#e11d48', agents: ['visual-design', 'pr-content'] },
  { team: '기획팀',           emoji: '◆', color: '#0891b2', agents: ['doc-design', 'grant-writer', 'project-planner'] },
];

const MOCK_SESSIONS: SessionSummary[] = [
  { sessionId: 'a1b2', date: '2026-03-30', startTime: new Date(Date.now()-3600000).toISOString(), durationSeconds: 4740, modelTier: 'sonnet', projectName: 'nodetreeHome', toolCallCount: 67, firstPrompt: '구현하자 그리고 디자인은 좀 더 비주얼 미디어아트적으로' },
  { sessionId: 'e5f6', date: '2026-03-30', startTime: new Date(Date.now()-7200000).toISOString(), durationSeconds: 1820, modelTier: 'opus', projectName: 'portfolio', toolCallCount: 23, firstPrompt: '이화영 수행 이력 포트폴리오 제작' },
  { sessionId: 'c9d0', date: '2026-03-30', startTime: new Date(Date.now()-9600000).toISOString(), durationSeconds: 540, modelTier: 'haiku', projectName: 'ocean', toolCallCount: 8, firstPrompt: '부산 근해 실시간 API 테스트' },
  { sessionId: 'a3b4', date: '2026-03-29', startTime: new Date(Date.now()-86400000).toISOString(), durationSeconds: 3200, modelTier: 'sonnet', projectName: 'nodetreeHome', toolCallCount: 44, firstPrompt: '채널2 실시간 해양데이터 구현' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDur(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`;
}
function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch { return '--:--'; }
}
function fmtRelDate(iso: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (diff === 0) return 'TODAY';
    if (diff === 1) return 'YESTERDAY';
    return `${diff}D AGO`;
  } catch { return ''; }
}
function pad2(n: number) { return String(n).padStart(2, '0'); }

// ── CSS-in-JS constants ───────────────────────────────────────────────────────
const C = {
  bg: '#ffffff',
  bgSub: '#fafafa',
  border: '#e8e8e8',
  borderStrong: '#222',
  text: '#0a0a0a',
  textMid: '#555',
  textDim: '#aaa',
  active: '#0a0a0a',
  pulse: '#22c55e',
  hot: '#ef4444',
  rising: '#f59e0b',
};

const scanlineStyle = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&display=swap');
  @keyframes blink { 0%,100%{opacity:1} 49%{opacity:1} 50%{opacity:0} 51%{opacity:0} }
  @keyframes pulse-line { 0%,100%{opacity:0.3} 50%{opacity:1} }
  @keyframes scan { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
  @keyframes flicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.8} 94%{opacity:1} }
  .ikeda-row:hover { background: #f5f5f5 !important; }
  .ikeda-btn { cursor:pointer; background:transparent; border:1px solid #222; color:#0a0a0a; font-family:${MONO}; font-size:10px; padding:4px 10px; letter-spacing:0.1em; transition:all 0.1s; }
  .ikeda-btn:hover { background:#0a0a0a; color:#fff; }
  .ikeda-btn.active { background:#0a0a0a; color:#fff; }
  .ikeda-tab { cursor:pointer; background:transparent; border:none; border-bottom:2px solid transparent; color:#aaa; font-family:${MONO}; font-size:11px; padding:10px 16px; letter-spacing:0.12em; transition:all 0.1s; }
  .ikeda-tab:hover { color:#0a0a0a; }
  .ikeda-tab.active { color:#0a0a0a; border-bottom-color:#0a0a0a; }

  /* === RESPONSIVE === */
  .monitor-header { padding: 0 32px; }
  .monitor-container { padding: 20px 24px; }
  .monitor-stats-grid { display: grid; grid-template-columns: repeat(6, 1fr); }
  .monitor-teams-grid { display: grid; grid-template-columns: repeat(3, 1fr); }
  .monitor-rec-grid { display: grid; grid-template-columns: repeat(3, 1fr); }
  .monitor-concept-strip { display: grid; grid-template-columns: repeat(3, 1fr); }
  .monitor-agents-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
  .monitor-tab-legend { margin-left: auto; display: flex; align-items: center; padding-right: 16px; }
  .monitor-scroll-x { overflow-x: auto; -webkit-overflow-scrolling: touch; }

  @media (max-width: 768px) {
    .monitor-header { padding: 0 12px; }
    .monitor-container { padding: 16px 12px; }
    .monitor-stats-grid { grid-template-columns: repeat(3, 1fr); }
    .monitor-teams-grid { grid-template-columns: repeat(1, 1fr); }
    .monitor-rec-grid { grid-template-columns: repeat(1, 1fr); }
    .monitor-concept-strip { grid-template-columns: repeat(1, 1fr); }
    .monitor-agents-grid { grid-template-columns: repeat(1, 1fr); }
    .monitor-tab-legend { display: none; }
    .ikeda-tab { padding: 10px 10px; font-size: 10px; }
  }

  @media (max-width: 480px) {
    .monitor-stats-grid { grid-template-columns: repeat(2, 1fr); }
  }

  @keyframes slide-in-left { from { transform: translateX(-100%); } to { transform: translateX(0); } }
  .monitor-overview-btn {
    position: fixed; left: 0; top: 50%; transform: translateY(-50%);
    z-index: 201; background: #0a0a0a; color: #fff; border: none; cursor: pointer;
    padding: 14px 7px; font-size: 8px; letter-spacing: 0.25em;
    writing-mode: vertical-rl; border-radius: 0 2px 2px 0; transition: background 0.1s;
  }
  .monitor-overview-btn:hover, .monitor-overview-btn.open { background: #444; }
  .monitor-overview-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.2); z-index: 199; }
  .monitor-overview-panel {
    position: fixed; top: 0; left: 0; width: min(480px, 95vw); height: 100vh;
    background: #fff; border-right: 2px solid #0a0a0a; z-index: 200;
    overflow-y: auto; box-shadow: 4px 0 24px rgba(0,0,0,0.08);
    animation: slide-in-left 0.2s ease;
  }
`;

// ── Sub-components ────────────────────────────────────────────────────────────

function DataRow({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontFamily: MONO, fontSize: 9, color: C.textDim, letterSpacing: '0.1em' }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: accent || C.text }}>{value}</span>
    </div>
  );
}

function StatusDot({ active, recent }: { active: boolean; recent?: boolean }) {
  if (!active) return <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ddd', display: 'inline-block' }} />;
  return (
    <span style={{
      width: 5, height: 5, borderRadius: '50%', display: 'inline-block',
      background: recent ? C.pulse : '#bbb',
      animation: recent ? 'pulse-line 2s infinite' : 'none',
    }} />
  );
}

function AgentCard({ agent, sessions }: { agent: typeof AGENTS[number]; sessions: SessionSummary[] }) {
  const mySessions = sessions.filter(s => s.modelTier === agent.tier);
  const pct = sessions.length ? Math.round((mySessions.length / sessions.length) * 100) : 0;
  const last = mySessions[0];
  const isActive = last ? (Date.now() - new Date(last.startTime).getTime()) < 86400000 : false;

  return (
    <div style={{ border: `1px solid ${isActive ? C.borderStrong : C.border}`, padding: '16px', background: C.bg }}>
      {/* header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 18, color: agent.col, lineHeight: 1 }}>{agent.symbol}</span>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: C.text }}>{agent.role}</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.textDim, letterSpacing: '0.08em' }}>{agent.korean}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <StatusDot active={isActive} recent={isActive} />
          <span style={{ fontFamily: MONO, fontSize: 9, color: isActive ? C.pulse : C.textDim, letterSpacing: '0.08em' }}>
            {isActive ? 'ACTIVE' : 'IDLE'}
          </span>
        </div>
      </div>

      <p style={{ fontFamily: SANS, fontSize: 11, color: C.textMid, lineHeight: 1.6, margin: '0 0 12px 0' }}>{agent.desc}</p>

      {/* usage bar */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: C.textDim, letterSpacing: '0.1em' }}>SESSION USAGE</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: C.text }}>{mySessions.length} / {pct}%</span>
        </div>
        <div style={{ height: 2, background: C.border }}>
          <div style={{ height: '100%', width: `${pct}%`, background: C.text, transition: 'width 0.6s ease' }} />
        </div>
      </div>

      {last && (
        <DataRow label="LAST PROJECT" value={`${last.projectName} · ${fmtRelDate(last.startTime)}`} />
      )}
      <DataRow label="TOOL CALLS" value={mySessions.reduce((s, r) => s + r.toolCallCount, 0).toLocaleString()} />
    </div>
  );
}

function SessionRow({ session }: { session: SessionSummary }) {
  const ag = AGENTS.find(a => a.tier === session.modelTier)!;
  return (
    <div className="ikeda-row" style={{
      display: 'grid', gridTemplateColumns: '28px 1fr 120px 60px 48px',
      alignItems: 'center', gap: 12,
      padding: '7px 16px', borderBottom: `1px solid ${C.border}`,
      transition: 'background 0.1s',
    }}>
      <span style={{ fontFamily: MONO, fontSize: 14, color: ag.col, textAlign: 'center' }}>{ag.symbol}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: C.text, letterSpacing: '0.05em' }}>
          {session.projectName}
          <span style={{ fontFamily: MONO, fontSize: 8, marginLeft: 8, color: C.textDim, letterSpacing: '0.1em' }}>{ag.role}</span>
        </div>
        {session.firstPrompt && (
          <div style={{ fontFamily: SANS, fontSize: 10, color: C.textDim, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {session.firstPrompt}
          </div>
        )}
      </div>
      <span style={{ fontFamily: MONO, fontSize: 9, color: C.textMid, letterSpacing: '0.05em' }}>
        {fmtRelDate(session.startTime)} {fmtTime(session.startTime)}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 9, color: C.textDim, textAlign: 'right' }}>{fmtDur(session.durationSeconds)}</span>
      <span style={{ fontFamily: MONO, fontSize: 9, color: C.textDim, textAlign: 'right' }}>T:{session.toolCallCount}</span>
    </div>
  );
}

// ── Overview Panel ────────────────────────────────────────────────────────────

function SectionHeader({ n, label }: { n: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontFamily: MONO, fontSize: 8, color: C.textDim, letterSpacing: '0.15em' }}>{n}</span>
      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: C.text }}>{label}</span>
    </div>
  );
}

function OverviewPanel({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div className="monitor-overview-backdrop" onClick={onClose} />
      <div className="monitor-overview-panel">

        {/* Header */}
        <div style={{
          padding: '0 20px', height: 52, borderBottom: `2px solid ${C.text}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, background: C.bg, zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: C.text }}>SYSTEM</span>
            <span style={{ fontFamily: MONO, fontSize: 8, color: C.textDim, letterSpacing: '0.1em' }}>NODE TREE · AGENT ARCHITECTURE</span>
          </div>
          <button className="ikeda-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ padding: '24px 20px' }}>

          {/* 01: HARNESS GAN LOOP */}
          <div style={{ marginBottom: 32 }}>
            <SectionHeader n="01" label="HARNESS — GAN LOOP" />
            {AGENTS.map((agent, i) => (
              <React.Fragment key={agent.tier}>
                <div style={{
                  border: `1px solid ${i === 0 ? C.borderStrong : C.border}`,
                  padding: '12px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: i === 0 ? C.bgSub : C.bg,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontFamily: MONO, fontSize: 22, color: agent.col, lineHeight: 1, width: 26, textAlign: 'center', flexShrink: 0 }}>{agent.symbol}</span>
                    <div>
                      <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', color: C.text }}>{agent.role}</div>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: C.textDim, letterSpacing: '0.1em', marginTop: 2 }}>{agent.tier.toUpperCase()} · {agent.korean}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: SANS, fontSize: 10, color: C.textMid, maxWidth: 150, textAlign: 'right', lineHeight: 1.6 }}>{agent.desc}</div>
                </div>
                {i < AGENTS.length - 1 && (
                  <div style={{ padding: '3px 0 3px 37px', fontFamily: MONO, fontSize: 12, color: C.textDim }}>↓</div>
                )}
              </React.Fragment>
            ))}
            <div style={{
              marginTop: 8, padding: '7px 12px',
              border: `1px dashed ${C.border}`,
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              <span style={{ fontFamily: MONO, fontSize: 11, color: C.textDim }}>↻</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: C.textDim, letterSpacing: '0.08em' }}>
                EVALUATOR REWORK → GENERATOR 재실행 (PASS까지 루프)
              </span>
            </div>
          </div>

          {/* 02: ORGANIZATION */}
          <div style={{ marginBottom: 32 }}>
            <SectionHeader n="02" label="ORGANIZATION — 6 TEAMS · 11 AGENTS" />
            <div style={{ border: `1px solid ${C.border}`, borderBottom: 'none' }}>
              {SYSTEM_MAP.map(row => (
                <div key={row.team} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{
                    padding: '9px 12px', borderRight: `1px solid ${C.border}`,
                    background: C.bgSub, display: 'flex', alignItems: 'center', gap: 7,
                  }}>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: row.color, flexShrink: 0 }}>{row.emoji}</span>
                    <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: C.text, letterSpacing: '0.05em', lineHeight: 1.5 }}>{row.team}</span>
                  </div>
                  <div style={{ padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {row.agents.map(a => (
                      <span key={a} style={{ fontFamily: MONO, fontSize: 9, color: C.textMid, letterSpacing: '0.03em' }}>· {a}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 03: ROUTING */}
          <div style={{ marginBottom: 32 }}>
            <SectionHeader n="03" label="ROUTING RULES — KEYWORD → AGENT" />
            <div style={{ border: `1px solid ${C.border}`, borderBottom: 'none' }}>
              {([
                { kw: 'nodetreeHome, React, 배포, API 라우트', agent: 'nodetreehome-web' },
                { kw: '부가세, 원천세, 4대보험, 법인세', agent: 'saengsanso-accounting' },
                { kw: 'e나라도움, 보탬e, NCAS, 정산', agent: 'grant-accounting-agent' },
                { kw: '공모, 레지던시, 지원사업 찾기', agent: 'grant-research' },
                { kw: '리서치, URL 분석, Obsidian', agent: 'nodetree-research' },
                { kw: '포스터, 인스타, 홍보물, 전시 그래픽', agent: 'visual-design' },
                { kw: 'OSC, ArtNet, TouchDesigner, ESP32', agent: 'media-art-pipeline' },
                { kw: '지원서, 작가노트, 제안서', agent: 'grant-writer' },
              ] as const).map((row, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto',
                  gap: 10, padding: '6px 12px',
                  borderBottom: `1px solid ${C.border}`,
                  alignItems: 'center',
                }}>
                  <span style={{ fontFamily: SANS, fontSize: 9, color: C.textDim, lineHeight: 1.5 }}>{row.kw}</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: C.text, fontWeight: 600, whiteSpace: 'nowrap' }}>→ {row.agent}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 04: DATA FLOW */}
          <div>
            <SectionHeader n="04" label="DATA FLOW — SESSION TO MONITOR" />
            <div style={{ border: `1px solid ${C.border}`, borderBottom: 'none' }}>
              {([
                { step: 'USER',      desc: '요청 입력 → Claude Code CLI 실행' },
                { step: 'PLANNER',   desc: 'OPUS — 요청을 Sprint Contract로 변환' },
                { step: 'GENERATOR', desc: 'SONNET — 팀 에이전트 파견 · 결과물 생성' },
                { step: 'EVALUATOR', desc: 'HAIKU — Playwright 테스트 · PASS / REWORK 판정' },
                { step: 'STOP HOOK', desc: '세션 종료 시 자동 실행 → logs JSON 업데이트' },
                { step: 'GITHUB',    desc: 'node-tree/claude-code-logs 에 push' },
                { step: 'MONITOR',   desc: 'nodetree.kr/monitor — 60초마다 자동 동기화' },
              ] as const).map((item, i, arr) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '76px 1fr',
                  borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none',
                }}>
                  <div style={{
                    padding: '7px 10px', borderRight: `1px solid ${C.border}`,
                    background: C.bgSub, display: 'flex', alignItems: 'center',
                  }}>
                    <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', color: C.text }}>{item.step}</span>
                  </div>
                  <div style={{ padding: '7px 12px', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontFamily: SANS, fontSize: 10, color: C.textMid, lineHeight: 1.5 }}>{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const ClaudeMonitor: React.FC = () => {
  const [sessions, setSessions] = useState<SessionSummary[]>(MOCK_SESSIONS);
  const [totalSessions, setTotalSessions] = useState(47);
  const [skills, setSkills] = useState<SkillDef[]>(FALLBACK_SKILLS);
  const [teams, setTeams] = useState<TeamDef[]>([]);
  const [agentActivity, setAgentActivity] = useState<AgentActivity>({});
  const [recommendations, setRecommendations] = useState<RecommendationsData | null>(null);
  const [isMock, setIsMock] = useState(true);
  const [lastSync, setLastSync] = useState('');
  const [now, setNow] = useState(new Date());
  const [mainTab, setMainTab] = useState<'teams' | 'agents' | 'skills'>('teams');
  const [skillCategory, setSkillCategory] = useState<string | null>(null);
  const [showOverview, setShowOverview] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [indexRes, agentsRes, teamsRes, activityRes, recommendRes] = await Promise.all([
        fetch(`${GITHUB_RAW}/index.json?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`${GITHUB_RAW}/agents.json?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`${GITHUB_RAW}/teams.json?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`${GITHUB_RAW}/agent-activity.json?t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`${GITHUB_RAW}/recommendations.json?t=${Date.now()}`, { cache: 'no-store' }),
      ]);
      if (indexRes.ok) {
        const d: IndexData = await indexRes.json();
        setSessions(d.sessions || []);
        setTotalSessions(d.totalSessions || 0);
        setLastSync(d.lastUpdated || '');
        setIsMock(false);
      }
      if (agentsRes.ok) {
        const d: AgentsData = await agentsRes.json();
        if (d.agents?.length) setSkills(d.agents);
      }
      if (activityRes.ok) {
        const d: AgentActivity = await activityRes.json();
        setAgentActivity(d);
      }
      if (teamsRes.ok) {
        const d = await teamsRes.json();
        if (d.teams?.length) {
          const merged = d.teams.map((t: TeamDef) => {
            const fallback = FALLBACK_TEAMS.find(f => f.id === t.id);
            return { ...fallback, ...t, skills: fallback?.skills || [] };
          });
          setTeams(merged);
        }
      }
      if (recommendRes.ok) {
        const d: RecommendationsData = await recommendRes.json();
        if (d.recommendations?.length) setRecommendations(d);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, REFRESH_MS);
    return () => clearInterval(iv);
  }, [fetchAll]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalTools = sessions.reduce((s, r) => s + r.toolCallCount, 0);
  const totalHours = (sessions.reduce((s, r) => s + r.durationSeconds, 0) / 3600).toFixed(1);
  const projectSet = new Set<string>();
  sessions.forEach(s => projectSet.add(s.projectName));

  const skillCount  = skills.filter(s => s.type === 'skill').length;
  const pluginCount = skills.filter(s => s.type === 'plugin').length;
  const mcpCount    = skills.filter(s => s.type === 'mcp').length;
  const agentCount  = skills.filter(s => s.type === 'agent').length;

  const categoryCounts: Record<string, number> = {};
  skills.forEach(s => { if (s.type !== 'agent') categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1; });

  const filteredSkills = (skillCategory
    ? skills.filter(s => s.category === skillCategory)
    : skills
  ).filter(s => s.type !== 'agent');

  const displayTeams = teams.length ? teams : FALLBACK_TEAMS;

  const timeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: SANS, color: C.text }}>
      <style>{scanlineStyle}</style>

      {/* LEFT EDGE SYSTEM BUTTON */}
      <button
        className={`monitor-overview-btn${showOverview ? ' open' : ''}`}
        onClick={() => setShowOverview(v => !v)}
      >
        SYSTEM
      </button>
      {showOverview && <OverviewPanel onClose={() => setShowOverview(false)} />}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="monitor-header" style={{
        background: C.bg, borderBottom: `2px solid ${C.text}`,
        height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
        animation: 'flicker 8s infinite',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', color: C.text }}>
            NODE TREE
          </div>
          <div style={{ width: 1, height: 20, background: C.border }} />
          <div style={{ fontFamily: MONO, fontSize: 10, color: C.textDim, letterSpacing: '0.12em' }}>
            AGENTS MONITOR
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {isMock && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.textDim, letterSpacing: '0.1em', borderBottom: '1px solid #ddd' }}>
              DEMO DATA
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.pulse, display: 'inline-block', animation: 'pulse-line 2s infinite' }} />
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.text, letterSpacing: '0.08em', animation: 'flicker 6s infinite' }}>{timeStr}</span>
          </div>
          {lastSync && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.textDim, letterSpacing: '0.06em' }}>
              SYNC {fmtTime(lastSync)}
            </span>
          )}
        </div>
      </div>

      <div className="monitor-container" style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* ── Stats strip ─────────────────────────────────────────────────── */}
        <div className="monitor-stats-grid" style={{
          borderTop: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}`,
          marginBottom: 24,
        }}>
          {[
            { label: 'HARNESS AGENTS', value: '03', sub: 'PLN·GEN·EVAL' },
            { label: 'SUB-AGENTS', value: String(agentCount).padStart(2,'0'), sub: `${displayTeams.length} TEAMS` },
            { label: 'SKILLS', value: String(skillCount).padStart(2,'0'), sub: `PLG:${pluginCount} MCP:${mcpCount}` },
            { label: 'SESSIONS', value: String(totalSessions).padStart(3,'0'), sub: 'TOTAL LOGGED' },
            { label: 'TOOL CALLS', value: totalTools.toLocaleString(), sub: 'CUMULATIVE' },
            { label: 'COMPUTE', value: `${totalHours}h`, sub: `${projectSet.size} PROJECTS` },
          ].map(stat => (
            <div key={stat.label} style={{
              borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
              padding: '14px 16px',
            }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: C.textDim, letterSpacing: '0.12em', marginBottom: 6 }}>{stat.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1, letterSpacing: '-0.02em' }}>{stat.value}</div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: C.textDim, marginTop: 4, letterSpacing: '0.08em' }}>{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div style={{ borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 0, marginBottom: 0 }}>
          {([
            { key: 'teams', label: `TEAMS  [${String(displayTeams.length).padStart(2,'0')}]` },
            { key: 'agents', label: `HARNESS  [03]` },
            { key: 'skills', label: `SKILLS  [${String(skills.filter(s=>s.type!=='agent').length).padStart(2,'0')}]` },
          ] as const).map(t => (
            <button key={t.key} className={`ikeda-tab${mainTab === t.key ? ' active' : ''}`} onClick={() => setMainTab(t.key)}>
              {t.label}
            </button>
          ))}
          <div className="monitor-tab-legend">
            <span style={{ fontFamily: MONO, fontSize: 8, color: C.textDim, letterSpacing: '0.1em' }}>
              TEAM = ORG · AGENT = WORKER · SKILL = CAPABILITY
            </span>
          </div>
        </div>

        {/* ── TEAMS TAB ───────────────────────────────────────────────────── */}
        {mainTab === 'teams' && (
          <div style={{ padding: '24px 0' }}>
            {/* Team grid */}
            <div className="monitor-teams-grid" style={{
              border: `1px solid ${C.border}`, borderRight: 'none', borderBottom: 'none',
              marginBottom: 32,
            }}>
              {displayTeams.map((team, idx) => {
                const teamHasActive = team.agents?.some(a => {
                  const act = agentActivity[a.id];
                  return act && (Date.now() - new Date(act.lastActive).getTime()) < 86400000;
                });
                return (
                  <div key={team.id} style={{
                    borderRight: `1px solid ${C.border}`,
                    borderBottom: `1px solid ${C.border}`,
                    borderTop: teamHasActive ? `2px solid ${C.text}` : `2px solid transparent`,
                  }}>
                    {/* Team header */}
                    <div style={{
                      padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: teamHasActive ? '#f5f5f5' : C.bg,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontFamily: MONO, fontSize: 16, color: C.textMid }}>{team.emoji}</span>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: C.text }}>
                              {team.name.toUpperCase()}
                            </span>
                            {teamHasActive && <StatusDot active={true} recent={true} />}
                          </div>
                          <div style={{ fontFamily: SANS, fontSize: 10, color: C.textDim, marginTop: 1 }}>{team.desc}</div>
                        </div>
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: 9, color: C.textDim, letterSpacing: '0.06em' }}>
                        {String(idx).padStart(2,'0')}
                      </span>
                    </div>

                    {/* Agents */}
                    <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: C.textDim, letterSpacing: '0.12em', marginBottom: 8 }}>
                        AGENTS  {String(team.agents?.length || 0).padStart(2,'0')}
                      </div>
                      {team.agents?.length ? (
                        team.agents.map(agent => {
                          const act = agentActivity[agent.id];
                          const isActive = act && (Date.now() - new Date(act.lastActive).getTime()) < 86400000;
                          const isRecent = act && (Date.now() - new Date(act.lastActive).getTime()) < 3600000;
                          return (
                            <div key={agent.id} style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '6px 0', borderBottom: `1px solid ${C.border}`,
                            }}>
                              <StatusDot active={!!isActive} recent={!!isRecent} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: C.text }}>{agent.name}</span>
                                  {isActive && (
                                    <span style={{ fontFamily: MONO, fontSize: 8, color: isRecent ? C.pulse : C.textDim, letterSpacing: '0.08em' }}>
                                      {isRecent ? 'ACTIVE' : 'RECENT'}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontFamily: SANS, fontSize: 9, color: C.textDim, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: 160 }}>
                                  {isActive ? `${act.lastProject} · ${fmtRelDate(act.lastActive)}` : (AGENT_DESC_KO[agent.id] || agent.desc || '—')}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ fontFamily: MONO, fontSize: 9, color: C.textDim, letterSpacing: '0.08em', padding: '8px 0' }}>
                          — EMPTY SLOT
                        </div>
                      )}
                    </div>

                    {/* Skills */}
                    <div style={{ padding: '10px 16px' }}>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: C.textDim, letterSpacing: '0.12em', marginBottom: 6 }}>SKILLS</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {team.skills?.slice(0, 4).map(s => (
                          <span key={s} style={{
                            fontFamily: MONO, fontSize: 8, padding: '2px 6px',
                            border: `1px solid ${C.border}`, color: C.textMid,
                            letterSpacing: '0.06em',
                          }}>
                            {s.replace(/-/g, ' ').toUpperCase()}
                          </span>
                        ))}
                        {(team.skills?.length || 0) > 4 && (
                          <span style={{ fontFamily: MONO, fontSize: 8, color: C.textDim, padding: '2px 0' }}>
                            +{team.skills.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recommendations */}
            <div style={{ borderTop: `2px solid ${C.text}`, paddingTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: C.text }}>DAILY RECOMMENDATIONS</span>
                {recommendations && (
                  <span style={{ fontFamily: MONO, fontSize: 9, color: C.textDim, letterSpacing: '0.08em' }}>
                    AUTO-GENERATED · {recommendations.lastUpdated}
                  </span>
                )}
              </div>

              {recommendations ? (
                <div className="monitor-rec-grid" style={{
                  border: `1px solid ${C.border}`, borderRight: 'none', borderBottom: 'none',
                }}>
                  {recommendations.recommendations.map(rec => (
                    <div key={rec.teamId} style={{ borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
                      <div style={{
                        padding: '8px 14px', borderBottom: `1px solid ${C.border}`,
                        fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: C.textMid,
                      }}>
                        {rec.teamName.toUpperCase()}
                      </div>
                      {rec.items.map((item, i) => (
                        <div key={i} style={{ padding: '10px 14px', borderBottom: i < rec.items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: C.text }}>{item.name}</span>
                            <span style={{
                              fontFamily: MONO, fontSize: 8, letterSpacing: '0.08em',
                              color: item.trend === 'hot' ? C.hot : item.trend === 'rising' ? C.rising : C.textDim,
                            }}>
                              {item.trend === 'hot' ? '▲ HOT' : item.trend === 'rising' ? '↑ RISING' : '— STABLE'}
                            </span>
                          </div>
                          <div style={{ fontFamily: SANS, fontSize: 10, color: C.textMid, marginBottom: 3 }}>{item.desc}</div>
                          <div style={{ fontFamily: SANS, fontSize: 9, color: C.textDim, lineHeight: 1.5 }}>{item.reason}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '20px 0', fontFamily: MONO, fontSize: 10, color: C.textDim, letterSpacing: '0.1em' }}>
                  — 매일 09:00 KST 자동 업데이트 대기 중
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AGENTS TAB ──────────────────────────────────────────────────── */}
        {mainTab === 'agents' && (
          <div style={{ padding: '24px 0' }}>
            {/* Harness concept strip */}
            <div className="monitor-concept-strip" style={{
              border: `1px solid ${C.border}`, borderRight: 'none',
              marginBottom: 24,
            }}>
              {[
                { label: 'PLANNER → OPUS', desc: '짧은 요청을 상세 설계서로 변환' },
                { label: 'GENERATOR → SONNET', desc: 'Sprint Contract 단위 코드 구현' },
                { label: 'EVALUATOR → HAIKU', desc: 'Playwright 테스트 · 채점 · 피드백' },
              ].map((item, i) => (
                <div key={i} style={{ borderRight: `1px solid ${C.border}`, padding: '12px 16px' }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: C.text, marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontFamily: SANS, fontSize: 10, color: C.textDim }}>{item.desc}</div>
                </div>
              ))}
            </div>

            <div className="monitor-agents-grid">
              {AGENTS.map(agent => <AgentCard key={agent.tier} agent={agent} sessions={sessions} />)}
            </div>

            {/* Session log */}
            <div className="monitor-scroll-x" style={{ borderTop: `2px solid ${C.text}` }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                padding: '12px 16px', borderBottom: `1px solid ${C.border}`,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.15em' }}>SESSION LOG</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: C.textDim, letterSpacing: '0.08em' }}>AGENT ACTIVITY HISTORY</span>
              </div>
              {/* column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '28px 1fr 120px 60px 48px',
                gap: 12, padding: '5px 16px', borderBottom: `1px solid ${C.border}`,
                background: C.bgSub,
              }}>
                {['SYM', 'PROJECT / PROMPT', 'TIME', 'DUR', 'TOOLS'].map(h => (
                  <span key={h} style={{ fontFamily: MONO, fontSize: 7, color: C.textDim, letterSpacing: '0.1em' }}>{h}</span>
                ))}
              </div>
              {sessions.length === 0 ? (
                <div style={{ padding: '32px 16px', fontFamily: MONO, fontSize: 10, color: C.textDim, letterSpacing: '0.1em' }}>
                  — NO SESSION DATA. AWAITING CLAUDE CODE STOP HOOK.
                </div>
              ) : (
                sessions.slice(0, 12).map(s => <SessionRow key={s.sessionId} session={s} />)
              )}
            </div>
          </div>
        )}

        {/* ── SKILLS TAB ──────────────────────────────────────────────────── */}
        {mainTab === 'skills' && (
          <div style={{ padding: '24px 0' }}>
            {/* filter bar */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
              <button className={`ikeda-btn${!skillCategory ? ' active' : ''}`} onClick={() => setSkillCategory(null)}>
                ALL [{skills.filter(s => s.type !== 'agent').length}]
              </button>
              {Object.entries(SKILL_CATEGORIES).map(([key, cfg]) => {
                const cnt = categoryCounts[key];
                if (!cnt) return null;
                return (
                  <button key={key} className={`ikeda-btn${skillCategory === key ? ' active' : ''}`}
                    onClick={() => setSkillCategory(skillCategory === key ? null : key)}>
                    {cfg.label} [{cnt}]
                  </button>
                );
              })}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
                {[
                  { label: 'SKILL', col: C.textMid }, { label: 'SUB', col: '#7c3aed' },
                  { label: 'PLUGIN', col: '#1d4ed8' }, { label: 'MCP', col: '#0891b2' },
                ].map(t => (
                  <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontFamily: MONO, fontSize: 7, padding: '1px 5px', border: `1px solid`, borderColor: t.col, color: t.col, letterSpacing: '0.08em' }}>
                      {t.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* skill table */}
            <div className="monitor-scroll-x" style={{ border: `1px solid ${C.border}`, borderBottom: 'none' }}>
              {/* header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '32px 180px 1fr 60px 56px',
                gap: 12, padding: '6px 16px', borderBottom: `1px solid ${C.border}`,
                background: C.bgSub,
              }}>
                {['', 'NAME', 'DESCRIPTION', 'CAT', 'TYPE'].map(h => (
                  <span key={h} style={{ fontFamily: MONO, fontSize: 7, color: C.textDim, letterSpacing: '0.1em' }}>{h}</span>
                ))}
              </div>
              {filteredSkills.map((skill, i) => {
                const isSubSkill = !!(skill as any).parentPlugin;
                const typeLabel = skill.type === 'plugin' ? 'PLUGIN' : skill.type === 'mcp' ? 'MCP' : isSubSkill ? 'SUB' : 'SKILL';
                const typeCol = skill.type === 'plugin' ? '#1d4ed8' : skill.type === 'mcp' ? '#0891b2' : isSubSkill ? '#7c3aed' : C.textMid;
                return (
                  <div key={skill.id} className="ikeda-row" style={{
                    display: 'grid', gridTemplateColumns: '32px 180px 1fr 60px 56px',
                    gap: 12, padding: '7px 16px', borderBottom: `1px solid ${C.border}`,
                    alignItems: 'center',
                  }}>
                    <span style={{ fontFamily: MONO, fontSize: 13, color: C.textDim, textAlign: 'center' }}>{CAT_SYMBOL[skill.category] || skill.emoji}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, color: C.text, letterSpacing: '0.04em' }}>{skill.name}</span>
                    <span style={{ fontFamily: SANS, fontSize: 10, color: C.textMid }}>{skill.desc}</span>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: C.textDim, letterSpacing: '0.06em' }}>
                      {(SKILL_CATEGORIES[skill.category] || { label: '—' }).label}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 8, color: typeCol, border: `1px solid`, borderColor: typeCol + '66', padding: '1px 4px', letterSpacing: '0.06em', textAlign: 'center' }}>
                      {typeLabel}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: '10px 0', fontFamily: MONO, fontSize: 8, color: C.textDim, letterSpacing: '0.1em' }}>
              {filteredSkills.length} ENTRIES · AUTO-SYNC ON SESSION STOP
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClaudeMonitor;
