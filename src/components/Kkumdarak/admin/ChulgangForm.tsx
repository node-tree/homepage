import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';
import PhotoUpload from './PhotoUpload';

// ═══════════════════════════════════════════════════════════════
// 출강확인서(서식5) 작업창.
//   · 프로그램 선택 → 주강사·정원 자동기입.
//   · 회차: 등록된 회차가 있으면 드롭다운(자동기입) + 맨 위 "직접 입력" 옵션.
//     "직접 입력"(또는 등록 회차 0건)이면 회차번호·교육일자·실참여를 직접 입력 →
//     회차 미등록 상태에서도 출강확인서 생성 가능.
//   · 「AI 초안」 → /forms/ai-draft(docType chulgang)로 본문 6칸 채움(KNUH, grounded).
//   · 진행사진 첨부(선택) → BinData/chulgang_photo.png 교체(없으면 더미 유지).
//   · 클라이언트가 21개 플레이스홀더 값을 모두 조립해 POST → HWPX blob 다운로드.
//   · {{확인년/월/일}}는 클라이언트 today(KST 환경) 기준 — Vercel UTC 시프트 회피.
// ═══════════════════════════════════════════════════════════════

const MANUAL = '__manual__'; // 회차 직접입력 센티넬(Mongo _id 와 충돌 없음)

// AI 초안이 채우는 본문 6키(화이트리스트 — 그 외 키는 무시해 fields 오염 방지)
const AI_DRAFT_KEYS = ['교육목표', '세부내용', '교육재료', '평가_운영', '평가_반응', '평가_보완'] as const;

interface ProgramStat {
  key: string;
  name: string;
  quota: number;
  주강사: string[];
}
interface SessionRow {
  _id: string;
  sessionNo: number;
  date: string | null;
  attendance: number;
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
    담당자: '',
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

  // 직접입력이면 회차번호 필수, 선택이면 세션 선택 필수
  const canSubmit =
    !!selectedProgram && (isManual ? !!manualSessionNo : !!selectedSession);

  // ── AI 초안 — 본문 6칸 채움(grounded). 프로그램 선택 필수. ──
  const handleAiDraft = async () => {
    if (!selectedProgram || aiBusy) return;
    setAiBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await kkumdarakAdminAPI.aiDraftForm({
        docType: 'chulgang',
        programKey,
        회차: 기수회차,
        교육주제: fields.교육주제,
        키워드,
      });
      if (res.data && typeof res.data === 'object') {
        // 6키 화이트리스트 + 문자열 가드(그 외/중첩 키 무시)
        setFields((f) => {
          const next = { ...f };
          for (const k of AI_DRAFT_KEYS) {
            const v = (res.data as Record<string, unknown>)[k];
            if (typeof v === 'string') next[k] = v;
          }
          return next;
        });
        setNotice('AI 초안을 본문에 채웠습니다. 내용을 검토·수정하세요.');
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
      담당자: fields.담당자,
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
        프로그램·회차를 선택하면 강사·일자·실참여가 자동 기입됩니다. 등록된 회차가 없으면 "회차 직접 입력"으로 작성하세요. 본문은 「AI 초안」으로 생성하거나 직접 입력합니다.
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
          <label className="kd-field">
            <span className="kd-field-label">교육주제</span>
            <input
              type="text"
              className="kd-field-input"
              value={fields.교육주제}
              onChange={(e) => setField('교육주제', e.target.value)}
            />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">담당자</span>
            <input
              type="text"
              className="kd-field-input"
              value={fields.담당자}
              onChange={(e) => setField('담당자', e.target.value)}
            />
          </label>
        </div>

        {/* AI 초안 — 키워드 + 버튼 (본문 6칸 채움) */}
        <div className="kd-forms-ai">
          <input
            type="text"
            className="kd-field-input kd-forms-ai-input"
            value={키워드}
            onChange={(e) => set키워드(e.target.value)}
            placeholder="키워드(쉼표/자유) — 예: 목공, 진열대 제작, 안전교육"
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
                rows={3}
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
