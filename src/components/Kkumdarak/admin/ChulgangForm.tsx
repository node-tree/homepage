import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';
import PhotoUpload from './PhotoUpload';

// ═══════════════════════════════════════════════════════════════
// 출강확인서(서식5) 작업창.
//   · 프로그램 선택 → 주강사·정원 자동기입.
//   · 회차: 등록된 회차가 있으면 드롭다운(자동기입) + 맨 위 "직접 입력" 옵션.
//     "직접 입력"(또는 등록 회차 0건)이면 회차번호·교육일자·실참여를 직접 입력 →
//     회차 미등록 상태에서도 출강확인서 생성 가능.
//   · 「AI 초안」 → /forms/ai-draft(docType chulgang)로 교육주제 + 본문 6칸 채움(KNUH, grounded).
//     기존 본문에 내용이 있으면 덮어쓰기 confirm.
//   · 교육주제 = 「사업계획서 기본주제 + AI 보강」 접목(2026-08):
//     ① 프로그램·회차를 고르면 /forms/plan-topic 이 계획서(03-프로그램.md baked)의 회차 기본주제를
//        AI 없이 즉시 자동 기입한다(정밀도 exact=회차별 명시 / stage=단계 기준).
//     ② 「AI 초안」은 그 기본주제를 앵커로 고정하고 회차맥락·키워드로 " — 보강구"만 덧붙인다.
//        (서버 mergeTopic 이 코드로 강제 — LLM 이 주제를 새로 써 와도 기본주제는 훼손되지 않는다.)
//     ③ 사용자가 직접 고쳐 쓰면 출처가 'user' 가 되어 자동기입·AI 가 더 이상 건드리지 않는다.
//        「계획서 주제로」 버튼으로 언제든 기본주제로 되돌릴 수 있다.
//   · 진행사진 첨부(선택) → BinData/chulgang_photo.png 교체(없으면 더미 유지).
//   · 클라이언트가 21개 플레이스홀더 값을 모두 조립해 POST → HWPX blob 다운로드.
//   · {{확인년/월/일}}는 클라이언트 today(KST 환경) 기준 — Vercel UTC 시프트 회피.
// ═══════════════════════════════════════════════════════════════

const MANUAL = '__manual__'; // 회차 직접입력 센티넬(Mongo _id 와 충돌 없음)

// 담당자 고정 — 꿈다락 행정담당(사업계획서 강사 라인업 기준). 서식마다 손으로 적지 않는다.
//   서명 이미지는 서버가 「담당자: 이한희」 오른쪽에 고정 삽입한다(chulgangForm.js).
const 담당자 = '이한희';

// AI 초안이 채우는 본문 6키(화이트리스트 — 그 외 키는 무시해 fields 오염 방지)
const AI_DRAFT_KEYS = ['교육목표', '세부내용', '교육재료', '평가_운영', '평가_반응', '평가_보완'] as const;

// 참고: AI 초안이 실제로 채우는 키 = 교육주제(자동 추측) + 위 본문 6키.
//   교육주제는 읽기전용이 아니다 — AI 값은 어디까지나 "초기값"이고 사용자가 자유롭게 수정한다.
//   AI 가 빈 문자열을 주면(근거 없음) 기존 사용자 입력을 지우지 않는다(채움 로직의 주제채움 가드).

interface ProgramStat {
  key: string;
  name: string;
  quota: number;
  주강사: string[];
}
// 계획서 회차 기본주제(GET /forms/plan-topic) — 교육주제 자동기입·AI 앵커의 근거.
interface PlanTopic {
  기본주제: string;
  정밀도: 'exact' | 'stage' | 'none';
  단계: string;
  회차범위: string;
  세부활동: string[];
  근거: string;
  가정: string;
  총회차: number;
}
interface SessionRow {
  _id: string;
  sessionNo: number;
  date: string | null;
  attendance: number;
  // 교육주제 자동 추측의 근거(강사일지 성격) — 등록 회차에 기록돼 있으면 AI 초안에 맥락으로 전달.
  title?: string;
  content?: string;
  note?: string;
}

// Date → 'YYYY. M. D.' (UTC 게터 — YYYY-MM-DD 가 UTC 자정으로 해석되어 일자 시프트 방지)
function fmtKoreanDate(input: string | null): string {
  if (!input) return '';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';
  return `${d.getUTCFullYear()}. ${d.getUTCMonth() + 1}. ${d.getUTCDate()}.`;
}

const TEXTAREA_FIELDS: { key: string; label: string }[] = [
  { key: '교육목표', label: '교육목표' },
  { key: '세부내용', label: '세부내용' },
  { key: '교육재료', label: '교육재료' },
  { key: '평가_운영', label: '평가 — 운영' },
  { key: '평가_반응', label: '평가 — 반응' },
  { key: '평가_보완', label: '평가 — 보완' },
];

const ChulgangForm: React.FC = () => {
  const { logout } = useKkumdarakAuth();

  const [programs, setPrograms] = useState<ProgramStat[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [programKey, setProgramKey] = useState('');
  const [sessionId, setSessionId] = useState(MANUAL); // 기본 직접 입력

  // 회차 직접입력 값
  const [manualSessionNo, setManualSessionNo] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualAttendance, setManualAttendance] = useState('');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // AI 초안
  const [키워드, set키워드] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  // 계획서 기본주제(자동기입 근거) + 교육주제 출처.
  //   출처 'plan' = 계획서/AI 가 채운 값(자동 갱신 대상), 'user' = 사용자가 직접 쓴 값(불변).
  //   ref 를 같이 두는 이유: 자동기입 effect 가 출처 변경마다 재실행되면 안 되고,
  //   비동기 응답이 늦게 도착했을 때 "그 사이 사용자가 입력했는지"를 최신값으로 판정해야 한다.
  const [planTopic, setPlanTopic] = useState<PlanTopic | null>(null);
  const [topicSource, setTopicSource] = useState<'' | 'plan' | 'user'>('');
  const topicSourceRef = useRef<'' | 'plan' | 'user'>('');
  const markTopicSource = useCallback((v: '' | 'plan' | 'user') => {
    topicSourceRef.current = v;
    setTopicSource(v);
  }, []);

  // 진행사진(base64 PNG, 프리픽스 없음). 빈 문자열이면 미첨부.
  const [photo, setPhoto] = useState('');

  // 수동입력 필드
  const [fields, setFields] = useState({
    교육장소: '',
    교육장소상세: '',
    강사수: '',
    교육시간: '', // "(HH:MM~HH:MM / N시간)"
    보조강사: '',
    교육주제: '',
    교육목표: '',
    세부내용: '',
    교육재료: '',
    평가_운영: '',
    평가_반응: '',
    평가_보완: '',
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

  // 프로그램 목록 로드
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const rows = await kkumdarakAdminAPI.getPrograms({ signal: controller.signal });
        setPrograms(rows as ProgramStat[]);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (onAuthErr(err)) return;
        setError(err?.message || '프로그램을 불러오지 못했습니다.');
      }
    })();
    return () => controller.abort();
  }, [onAuthErr]);

  // 프로그램 변경 시 회차 목록 로드 + 회차 선택 직접입력으로 초기화
  useEffect(() => {
    if (!programKey) {
      setSessions([]);
      setSessionId(MANUAL);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const rows = await kkumdarakAdminAPI.getSessions(programKey, { signal: controller.signal });
        setSessions(rows as SessionRow[]);
        setSessionId(MANUAL);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (onAuthErr(err)) return;
        setError(err?.message || '회차를 불러오지 못했습니다.');
      }
    })();
    return () => controller.abort();
  }, [programKey, onAuthErr]);

  const selectedProgram = useMemo(
    () => programs.find((p) => p.key === programKey) || null,
    [programs, programKey],
  );
  const selectedSession = useMemo(
    () => sessions.find((s) => s._id === sessionId) || null,
    [sessions, sessionId],
  );

  const setField = (key: keyof typeof fields, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
  };

  // AI 초안에 넘길 회차 맥락(교육주제 추측 근거). 등록 회차를 선택했을 때만 — 직접입력이면 빈 문자열.
  //   회차 기록의 제목·내용·비고가 곧 강사일지 성격의 1차 근거다(없으면 grounding 회차 구성으로 폴백).
  const 회차맥락 = useMemo(() => {
    if (!selectedSession) return '';
    const d = fmtKoreanDate(selectedSession.date);
    return [
      `${selectedSession.sessionNo}회차${d ? ` · ${d}` : ''}`,
      selectedSession.title?.trim() ? `제목: ${selectedSession.title.trim()}` : '',
      selectedSession.content?.trim() ? `내용: ${selectedSession.content.trim()}` : '',
      selectedSession.note?.trim() ? `비고: ${selectedSession.note.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }, [selectedSession]);

  // 회차 직접입력 모드: 등록 회차 0건이거나 "직접 입력" 선택 시
  const isManual = sessions.length === 0 || sessionId === MANUAL;

  // 출강강사 = 주강사+"(주)" + 보조강사 입력 합성
  const chulgangGangsa = useMemo(() => {
    const ju = (selectedProgram?.주강사 || []).map((n) => `${n}(주)`);
    const bo = fields.보조강사.trim() ? [`${fields.보조강사.trim()}(보조)`] : [];
    return [...ju, ...bo].join(', ');
  }, [selectedProgram, fields.보조강사]);

  // 회차 파생값(직접입력 ↔ 선택 분기)
  const effSessionNo = isManual ? manualSessionNo : selectedSession ? String(selectedSession.sessionNo) : '';
  const 기수회차 = effSessionNo ? `(1기수 / ${effSessionNo}회차)` : '';
  const 교육일자 = isManual
    ? fmtKoreanDate(manualDate || null)
    : fmtKoreanDate(selectedSession ? selectedSession.date : null);
  const 실참여 = isManual
    ? manualAttendance
    : selectedSession
      ? String(selectedSession.attendance ?? '')
      : '';
  const 정원 = selectedProgram ? String(selectedProgram.quota) : '';
  const 프로그램명 = selectedProgram ? selectedProgram.name : '';

  // ── 계획서 기본주제 자동 기입 ───────────────────────────────────────────────
  //   프로그램 + 회차번호가 정해지는 즉시 사업계획서의 회차 주제를 교육주제에 채운다.
  //   AI 호출이 아니라 상수 조회라 즉시·무료다. 사용자가 직접 쓴 주제('user')는 덮지 않는다.
  useEffect(() => {
    const n = parseInt(effSessionNo, 10);
    if (!programKey || !Number.isInteger(n) || n < 1) {
      setPlanTopic(null);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const p = (await kkumdarakAdminAPI.getPlanTopic(programKey, n, {
          signal: controller.signal,
        })) as PlanTopic | null;
        setPlanTopic(p);
        const base = (p?.기본주제 || '').trim();
        if (!base) return;
        if (topicSourceRef.current === 'user') return; // 사용자 입력 보호
        setFields((f) => (f.교육주제 === base ? f : { ...f, 교육주제: base }));
        markTopicSource('plan');
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        // 계획서 조회 실패는 치명적이지 않다(직접 입력·AI 초안으로 진행 가능) — 조용히 무시.
        setPlanTopic(null);
      }
    })();
    return () => controller.abort();
  }, [programKey, effSessionNo, markTopicSource]);

  // 계획서 주제 되돌리기 가능 여부 — 사용자가 고쳐 쓴 뒤에만 노출.
  const planBase = (planTopic?.기본주제 || '').trim();
  const canRestorePlan = !!planBase && fields.교육주제.trim() !== planBase;

  // 직접입력이면 회차번호 필수, 선택이면 세션 선택 필수
  const canSubmit =
    !!selectedProgram && (isManual ? !!manualSessionNo : !!selectedSession);

  // 본문 6칸 중 내용이 하나라도 있는지(덮어쓰기 confirm 판단용)
  const hasBodyContent = () => AI_DRAFT_KEYS.some((k) => fields[k] && fields[k].trim());

  // ── AI 초안 — 본문 6칸 채움(grounded). 프로그램 선택 필수. 기존 본문 있으면 confirm. ──
  const handleAiDraft = async () => {
    if (aiBusy) return;
    if (!selectedProgram) {
      setError('AI 초안은 프로그램을 먼저 선택해야 합니다.');
      return;
    }
    if (
      hasBodyContent() &&
      typeof window !== 'undefined' &&
      !window.confirm('기존 본문을 AI 초안으로 덮어쓸까요?')
    ) {
      return;
    }
    // 요청 직전 상태 — 채움 판정·안내문구를 실제 동작과 일치시키는 기준.
    //   "사용자가 직접 쓴 주제"만 불변이다. 계획서가 자동 기입한 값('plan')은 AI 가 앵커로 삼아
    //   보강하므로 덮어써도 기본주제는 유지된다(서버 mergeTopic 이 보장).
    const 사용자주제 = topicSourceRef.current === 'user' && !!fields.교육주제.trim();
    setAiBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await kkumdarakAdminAPI.aiDraftForm({
        docType: 'chulgang',
        programKey,
        회차: 기수회차,
        회차번호: effSessionNo, // 서버가 계획서 기본주제(앵커)를 해석하는 키
        교육주제: fields.교육주제,
        주제출처: 사용자주제 ? 'user' : 'plan',
        회차맥락,
        키워드,
      });
      if (res.data && typeof res.data === 'object') {
        // 7키(교육주제 + 본문 6) 화이트리스트 + 문자열 가드(그 외/중첩 키 무시)
        const data = res.data as Record<string, unknown>;
        // 교육주제 채움 가드 — "사용자 입력 불변"을 프롬프트(LLM 준수)가 아니라 코드로 보장한다.
        //   ① AI 가 근거 없어 ''를 준 경우, ② 사용자가 직접 쓴 교육주제가 있는 경우
        //   → 둘 다 기존 값을 유지한다. 계획서가 자동 기입한 값은 "기본주제 + AI 보강"으로 갱신된다.
        //   (본문 6칸은 기존대로 덮어쓰되 hasBodyContent() confirm 이 사전 동의를 받는다.)
        // (setFields 업데이터는 지연 실행이라 그 안에서 플래그를 세우면 안 됨 — 여기서 미리 판정)
        const 주제값 = typeof data.교육주제 === 'string' ? data.교육주제.trim() : '';
        const 주제채움 = !!주제값 && !사용자주제;
        const 앵커 = (res.plan?.기본주제 || planBase || '').trim();
        setFields((f) => {
          const next = { ...f };
          for (const k of AI_DRAFT_KEYS) {
            const v = data[k];
            if (typeof v === 'string') next[k] = v;
          }
          // 요청 중 사용자가 주제를 직접 고쳤으면(ref 최신값) 덮지 않는다.
          if (주제채움 && topicSourceRef.current !== 'user') next.교육주제 = 주제값;
          return next;
        });
        if (주제채움 && topicSourceRef.current !== 'user') markTopicSource('plan');
        setNotice(
          주제채움 && 앵커 && 주제값.includes(앵커)
            ? `AI 초안을 채웠습니다. 교육주제는 계획서 기본주제 「${앵커}」를 유지한 채 보강했습니다.`
            : 주제채움
              ? 'AI 초안을 교육주제·본문에 채웠습니다. 교육주제를 포함해 모두 자유롭게 수정할 수 있습니다.'
              : 'AI 초안을 본문에 채웠습니다. 내용을 검토·수정하세요.',
        );
      } else {
        // 파싱 실패 — 원문 안내(폼은 비우지 않음)
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
    if (!canSubmit || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    // {{확인년/월/일}} = 클라이언트 today(KST 환경)
    const today = new Date();
    const body: Record<string, string> = {
      출강강사: chulgangGangsa,
      교육장소: fields.교육장소,
      교육장소상세: fields.교육장소상세,
      강사수: fields.강사수,
      프로그램명,
      기수회차,
      정원,
      실참여,
      교육일자,
      교육시간: fields.교육시간,
      교육주제: fields.교육주제,
      교육목표: fields.교육목표,
      세부내용: fields.세부내용,
      교육재료: fields.교육재료,
      평가_운영: fields.평가_운영,
      평가_반응: fields.평가_반응,
      평가_보완: fields.평가_보완,
      확인년: String(today.getFullYear()),
      확인월: String(today.getMonth() + 1),
      확인일: String(today.getDate()),
      담당자,
    };
    if (photo) body.photo = photo; // 사진 있으면만 포함(없으면 더미 유지 — 회귀 없음)
    try {
      const blob = await kkumdarakAdminAPI.downloadChulgangForm(body);
      const url = URL.createObjectURL(blob);
      const m = 기수회차.match(/(\d+)\s*회차/);
      const hoecha = m ? `${m[1]}회차` : '';
      const namePart = `${프로그램명}`.replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, '');
      const a = document.createElement('a');
      a.href = url;
      a.download = ['출강확인서', namePart, hoecha].filter(Boolean).join('_') + '.hwpx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotice('출강확인서가 생성되었습니다.');
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '출강확인서 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kd-forms">
      <p className="kd-forms-desc">
        프로그램·회차를 선택하면 강사·일자·실참여와 <strong>사업계획서의 회차 교육주제</strong>가 자동 기입됩니다. 등록된 회차가 없으면 "회차 직접 입력"으로 작성하세요. 「AI 초안」은 계획서 기본주제를 그대로 둔 채 회차 기록·키워드로 주제를 보강하고 본문 6칸을 채웁니다.
      </p>

      <div className="kd-forms-body">
        {/* 선택 + 자동기입 */}
        <div className="kd-ledger-grid">
          <label className="kd-field">
            <span className="kd-field-label">프로그램</span>
            <select
              className="kd-field-input"
              value={programKey}
              onChange={(e) => setProgramKey(e.target.value)}
            >
              <option value="">선택…</option>
              {programs.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          {/* 등록된 회차가 있을 때만 선택 드롭다운 노출. 없으면(직접입력) 드롭다운 숨기고 아래 입력칸만 */}
          {sessions.length > 0 && (
            <label className="kd-field">
              <span className="kd-field-label">회차</span>
              <select
                className="kd-field-input"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                disabled={!programKey}
              >
                <option value={MANUAL}>회차 직접 입력</option>
                {sessions.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.sessionNo}회차 {s.date ? `· ${(s.date || '').slice(0, 10)}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* 회차 직접 입력칸 (직접입력 모드에서만 — 등록회차 0건이면 항상) */}
          {isManual && (
            <>
              <label className="kd-field">
                <span className="kd-field-label">회차번호</span>
                <input
                  type="number"
                  min={1}
                  className="kd-field-input"
                  value={manualSessionNo}
                  onChange={(e) => setManualSessionNo(e.target.value)}
                  placeholder="예: 5"
                />
              </label>
              <label className="kd-field">
                <span className="kd-field-label">교육일자</span>
                <input
                  type="date"
                  className="kd-field-input"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                />
              </label>
              <label className="kd-field">
                <span className="kd-field-label">실참여</span>
                <input
                  type="number"
                  min={0}
                  className="kd-field-input"
                  value={manualAttendance}
                  onChange={(e) => setManualAttendance(e.target.value)}
                  placeholder="인원"
                />
              </label>
            </>
          )}

          <label className="kd-field">
            <span className="kd-field-label">프로그램명 (자동)</span>
            <input type="text" className="kd-field-input kd-field-readonly" value={프로그램명} readOnly />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">출강강사 (자동+보조)</span>
            <input type="text" className="kd-field-input kd-field-readonly" value={chulgangGangsa} readOnly />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">기수/회차 (자동)</span>
            <input type="text" className="kd-field-input kd-field-readonly" value={기수회차} readOnly />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">교육일자 (자동)</span>
            <input type="text" className="kd-field-input kd-field-readonly" value={교육일자} readOnly />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">정원 (자동)</span>
            <input type="text" className="kd-field-input kd-field-readonly" value={정원} readOnly />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">실참여 (자동)</span>
            <input type="text" className="kd-field-input kd-field-readonly" value={실참여} readOnly />
          </label>

          {/* 수동입력 */}
          <label className="kd-field">
            <span className="kd-field-label">보조강사</span>
            <input
              type="text"
              className="kd-field-input"
              value={fields.보조강사}
              onChange={(e) => setField('보조강사', e.target.value)}
              placeholder="이름(없으면 비움)"
            />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">강사수</span>
            <input
              type="text"
              className="kd-field-input"
              value={fields.강사수}
              onChange={(e) => setField('강사수', e.target.value)}
              placeholder="예: 2"
            />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">교육장소</span>
            <input
              type="text"
              className="kd-field-input"
              value={fields.교육장소}
              onChange={(e) => setField('교육장소', e.target.value)}
            />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">교육장소 상세</span>
            <input
              type="text"
              className="kd-field-input"
              value={fields.교육장소상세}
              onChange={(e) => setField('교육장소상세', e.target.value)}
            />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">교육시간</span>
            <input
              type="text"
              className="kd-field-input"
              value={fields.교육시간}
              onChange={(e) => setField('교육시간', e.target.value)}
              placeholder="(14:00~17:00 / 3시간)"
            />
          </label>
          <label className="kd-field kd-field-wide">
            <span className="kd-field-label">
              교육주제
              {topicSource === 'plan' && planBase ? ' (계획서 자동)' : ''}
            </span>
            <input
              type="text"
              className="kd-field-input"
              value={fields.교육주제}
              onChange={(e) => {
                setField('교육주제', e.target.value);
                // 비우면 출처를 초기화 — 회차를 다시 고르면 계획서 주제가 재기입된다.
                markTopicSource(e.target.value.trim() ? 'user' : '');
              }}
              placeholder={planBase || '프로그램·회차를 고르면 계획서 주제가 자동 기입됩니다'}
            />
            {planTopic && planBase && (
              <span className="kd-forms-hint">
                계획서 기본주제 「{planBase}」 ·{' '}
                {planTopic.정밀도 === 'stage'
                  ? `${planTopic.회차범위} 단계 기준`
                  : `${planTopic.회차범위} 명시`}
                {canRestorePlan && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      className="kd-forms-hint-btn"
                      onClick={() => {
                        setField('교육주제', planBase);
                        markTopicSource('plan');
                      }}
                    >
                      계획서 주제로 되돌리기
                    </button>
                  </>
                )}
                {planTopic.가정 && (
                  <span className="kd-forms-hint-note">※ {planTopic.가정}</span>
                )}
              </span>
            )}
          </label>
          <label className="kd-field">
            <span className="kd-field-label">담당자 (고정)</span>
            <input type="text" className="kd-field-input kd-field-readonly" value={담당자} readOnly />
            <span className="kd-forms-hint">서명 이미지가 이름 오른쪽에 자동으로 들어갑니다.</span>
          </label>
        </div>

        {/* AI 초안 — 키워드 + 버튼 (본문 6칸 채움) */}
        <div className="kd-forms-ai">
          <input
            type="text"
            className="kd-field-input kd-forms-ai-input"
            value={키워드}
            onChange={(e) => set키워드(e.target.value)}
            placeholder="키워드를 쉼표로 나열 — 예: 목공 실습, 진열대 제작, 사포·코팅, 안전교육"
          />
          <button
            type="button"
            className="kd-ledger-action kd-ledger-action--form"
            onClick={handleAiDraft}
            disabled={!selectedProgram || aiBusy}
            title={!selectedProgram ? '프로그램을 먼저 선택하세요' : 'KNUH AI 로 본문 초안 생성'}
          >
            {aiBusy ? 'AI 생성 중…' : 'AI 초안'}
          </button>
        </div>

        {/* 본문 6칸 */}
        <div className="kd-forms-textareas">
          {TEXTAREA_FIELDS.map((t) => (
            <label key={t.key} className="kd-field kd-field-wide">
              <span className="kd-field-label">{t.label}</span>
              <textarea
                className="kd-field-input kd-forms-textarea"
                rows={5}
                value={fields[t.key as keyof typeof fields]}
                onChange={(e) => setField(t.key as keyof typeof fields, e.target.value)}
              />
            </label>
          ))}
        </div>

        {/* 진행사진 첨부 */}
        <PhotoUpload label="진행사진" onChange={setPhoto} />

        {notice && <div className="kd-ledger-notice" role="status">{notice}</div>}
        {error && <div className="kd-ledger-warning" role="status">{error}</div>}

        <div className="kd-ledger-form-actions">
          <button
            type="button"
            className="kd-ledger-submit"
            onClick={handleDownload}
            disabled={!canSubmit || busy}
          >
            {busy ? '생성 중…' : 'HWPX 생성'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChulgangForm;
