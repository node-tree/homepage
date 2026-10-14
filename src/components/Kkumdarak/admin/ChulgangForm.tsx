import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';
import PhotoUpload from './PhotoUpload';

// ═══════════════════════════════════════════════════════════════
// 출강확인서(서식5) 작업창 — 2026-10 최신판.
//   · 회차표(GET /forms/schedule, 변경교부신청서 0921 수정안2 반영)에서 프로그램·회차를 고르면
//     출강강사(주/보조/특강)·강사 수·장소·일자·시간·정원·교육주제·확인일(교육 다음 날)이 자동 기입된다.
//     손의 기억은 A형(〈땅을 달래는 노래〉)·B형을 따로 고른다. 자동 기입 뒤에도 모든 칸을 고칠 수 있다.
//   · 실참여는 사업관리에 등록된 회차 기록이 있으면 그 값, 없으면 직접 입력.
//   · 본문 6칸은 여러 줄 — 줄바꿈이 한글 문서의 문단이 된다(세부내용의 가./나./다. 줄 등).
//   · 「AI 초안」: 본문(교육주제·목표·세부내용·재료)과 평가 3종을 동시에 요청한다.
//   · 진행사진 2장: 왼쪽 수업 사진, 오른쪽 다과비 증빙 사진(비율 그대로).
//   · 서명: 서버가 담당자 「(인)」 위에 서명 그림을 얹는다(9월 제출본과 같은 자리).
// ═══════════════════════════════════════════════════════════════

const 담당자 = '이한희';

interface ScheduleSession {
  no: number;
  webNo: number;
  date: string; // YYYY-MM-DD
  weekday: string;
  start: string;
  end: string;
  hours: number;
  topic: string;
  content: string[];
  main: string[];
  assist: string[];
  special: string[];
  place: [string, string];
}
interface ScheduleTrack {
  id: string;
  programKey: string;
  variant: string | null;
  label: string;
  programName: string;
  programSub: string;
  quota: number;
  sessions: ScheduleSession[];
}
interface SessionRow {
  _id: string;
  sessionNo: number;
  date: string | null;
  attendance: number;
  title?: string;
  content?: string;
  note?: string;
}

const BODY_KEYS = ['교육목표', '세부내용', '교육재료'] as const;
const EVAL_KEYS = ['평가_운영', '평가_반응', '평가_보완'] as const;
const AI_KEYS = [...BODY_KEYS, ...EVAL_KEYS];

const TEXTAREAS: { key: (typeof AI_KEYS)[number]; label: string; rows: number; hint?: string }[] = [
  { key: '교육목표', label: '○ 교육목표', rows: 3 },
  { key: '세부내용', label: '○ 세부내용', rows: 10, hint: '「도입에서 …」 → 가. / 나. / 다. 한 줄씩 → 「마무리에서는 …」' },
  { key: '교육재료', label: '○ 교육재료', rows: 2 },
  { key: '평가_운영', label: '○ 운영 방식 및 교육 내용에 대한 평가', rows: 5 },
  { key: '평가_반응', label: '○ 인상 깊었던 참여자 반응 및 요청사항 등', rows: 5 },
  { key: '평가_보완', label: '○ 아쉬운 점, 보완 지점 등', rows: 5 },
];

const EMPTY_FIELDS = {
  출강강사: '',
  강사수: '',
  교육장소: '',
  교육장소상세: '',
  교육일자: '', // YYYY-MM-DD
  교육시간: '', // (HH:MM~HH:MM/N시간)
  정원: '',
  실참여: '',
  교육주제: '',
  확인일자: '', // YYYY-MM-DD
  교육목표: '',
  세부내용: '',
  교육재료: '',
  평가_운영: '',
  평가_반응: '',
  평가_보완: '',
};
type Fields = typeof EMPTY_FIELDS;

// 'YYYY-MM-DD' → 'YYYY. M. D.'
function dotDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[1]}. ${Number(m[2])}. ${Number(m[3])}.` : iso || '';
}
// 'YYYY-MM-DD' 다음 날
function nextDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  return d.toISOString().slice(0, 10);
}
function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
function instructorsText(s: ScheduleSession): string {
  return [
    ...s.main.map((n) => `${n}(주)`),
    ...s.special.map((n) => `${n}(주강사·특강)`),
    ...s.assist.map((n) => `${n}(보조)`),
  ].join(', ');
}

const ChulgangForm: React.FC = () => {
  const { logout } = useKkumdarakAuth();

  const [tracks, setTracks] = useState<ScheduleTrack[]>([]);
  const [trackId, setTrackId] = useState('');
  const [sessionNo, setSessionNo] = useState(''); // 회차표 회차 번호(유형 안 번호)
  // 사업관리 회차 기록 — 어느 프로그램 것인지 함께 둔다(프로그램을 바꾼 직후 이전 프로그램 값이 섞이지 않게).
  const [dbSessions, setDbSessions] = useState<{ programKey: string; rows: SessionRow[] }>({ programKey: '', rows: [] });
  const [fields, setFields] = useState<Fields>({ ...EMPTY_FIELDS, 확인일자: todayIso() });
  const [topicEdited, setTopicEdited] = useState(false);
  const [photoClass, setPhotoClass] = useState('');
  const [photoSnack, setPhotoSnack] = useState('');
  const [키워드, set키워드] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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
    const controller = new AbortController();
    (async () => {
      try {
        setTracks((await kkumdarakAdminAPI.getSchedule({ signal: controller.signal })) as ScheduleTrack[]);
      } catch (err: any) {
        if (err?.name === 'AbortError' || onAuthErr(err)) return;
        setError(err?.message || '회차표를 불러오지 못했습니다.');
      }
    })();
    return () => controller.abort();
  }, [onAuthErr]);

  const track = useMemo(() => tracks.find((t) => t.id === trackId) || null, [tracks, trackId]);
  const session = useMemo(
    () => (track ? track.sessions.find((s) => String(s.no) === sessionNo) || null : null),
    [track, sessionNo],
  );

  // 프로그램이 바뀌면 사업관리에 등록된 회차(실참여·회차 기록) 다시 읽기
  useEffect(() => {
    setDbSessions({ programKey: '', rows: [] }); // 조회 전에 비운다 — 이전 프로그램 기록이 남지 않게
    if (!track) return;
    const programKey = track.programKey;
    const controller = new AbortController();
    (async () => {
      try {
        const rows = (await kkumdarakAdminAPI.getSessions(programKey, { signal: controller.signal })) as SessionRow[];
        setDbSessions({ programKey, rows });
      } catch (err: any) {
        if (err?.name === 'AbortError' || onAuthErr(err)) return;
      }
    })();
    return () => controller.abort();
  }, [track, onAuthErr]);

  const dbSession = useMemo(() => {
    if (!session || !track || dbSessions.programKey !== track.programKey) return null;
    return dbSessions.rows.find((r) => r.sessionNo === session.webNo) || null;
  }, [dbSessions, session, track]);

  // 회차를 고르면 회차표 값으로 채운다(본문 6칸은 건드리지 않음).
  useEffect(() => {
    if (!track || !session) return;
    setFields((f) => ({
      ...f,
      출강강사: instructorsText(session),
      강사수: String(session.main.length + session.special.length + session.assist.length),
      교육장소: session.place[0] || '',
      교육장소상세: session.place[1] || '',
      교육일자: session.date,
      교육시간: `(${session.start}~${session.end}/${session.hours}시간)`,
      정원: String(track.quota),
      확인일자: nextDay(session.date) || f.확인일자,
      교육주제: topicEdited ? f.교육주제 : session.topic,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, session]);

  // 등록 회차의 실참여가 있으면 채운다(직접 쓴 값이 있으면 덮지 않음).
  useEffect(() => {
    if (dbSession && dbSession.attendance) {
      setFields((f) => (f.실참여 ? f : { ...f, 실참여: String(dbSession.attendance) }));
    }
  }, [dbSession]);

  const setField = (key: keyof Fields, value: string) => setFields((f) => ({ ...f, [key]: value }));

  const 기수회차 = sessionNo ? `(1기수 / ${sessionNo}회차)` : '';
  const 회차맥락 = useMemo(() => {
    if (!dbSession) return '';
    return [
      dbSession.title?.trim() ? `제목: ${dbSession.title.trim()}` : '',
      dbSession.content?.trim() ? `내용: ${dbSession.content.trim()}` : '',
      dbSession.note?.trim() ? `비고: ${dbSession.note.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }, [dbSession]);

  const canSubmit = !!track && !!sessionNo;
  const hasBody = AI_KEYS.some((k) => fields[k].trim());

  const handleAiDraft = async () => {
    if (aiBusy || !track || !session) {
      if (!session) setError('AI 초안은 프로그램과 회차를 먼저 고르세요.');
      return;
    }
    if (hasBody && !window.confirm('지금 쓴 교육목표·세부내용·평가를 AI 초안으로 덮어쓸까요?')) return;
    setAiBusy(true);
    setError('');
    setNotice('');
    const base = {
      docType: 'chulgang',
      programKey: track.programKey,
      회차: 기수회차,
      회차번호: String(session.webNo),
      교육주제: fields.교육주제,
      주제출처: topicEdited ? 'user' : 'plan',
      회차맥락,
      키워드,
    };
    try {
      const [body, evals] = await Promise.allSettled([
        kkumdarakAdminAPI.aiDraftForm({ ...base, part: 'body' }),
        kkumdarakAdminAPI.aiDraftForm({ ...base, part: 'eval' }),
      ]);
      const filled: string[] = [];
      setFields((f) => {
        const next = { ...f };
        if (body.status === 'fulfilled' && body.value.data) {
          const d = body.value.data as Record<string, unknown>;
          for (const k of BODY_KEYS) if (typeof d[k] === 'string') next[k] = d[k] as string;
          if (!topicEdited && typeof d.교육주제 === 'string' && d.교육주제.trim()) next.교육주제 = d.교육주제.trim();
        }
        if (evals.status === 'fulfilled' && evals.value.data) {
          const d = evals.value.data as Record<string, unknown>;
          for (const k of EVAL_KEYS) if (typeof d[k] === 'string') next[k] = d[k] as string;
        }
        return next;
      });
      if (body.status === 'fulfilled' && body.value.data) filled.push('본문');
      if (evals.status === 'fulfilled' && evals.value.data) filled.push('평가');
      const failed = [body, evals].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failed && onAuthErr(failed.reason)) return;
      if (filled.length === 2) setNotice('AI 초안을 채웠습니다. 사실과 다른 곳이 없는지 읽고 고쳐 주세요.');
      else if (filled.length === 1) setError(`${filled[0]}만 채웠습니다. 나머지는 다시 시도하거나 직접 써 주세요.`);
      else setError(failed?.reason?.message || 'AI 응답을 해석하지 못했습니다. 직접 입력하세요.');
    } finally {
      setAiBusy(false);
    }
  };

  const handleDownload = async () => {
    if (!canSubmit || busy || !track) return;
    setBusy(true);
    setError('');
    setNotice('');
    const [y, m, d] = (fields.확인일자 || todayIso()).split('-');
    const body: Record<string, string> = {
      출강강사: fields.출강강사,
      교육장소: fields.교육장소,
      교육장소상세: fields.교육장소상세,
      강사수: fields.강사수,
      프로그램명: track.programName,
      프로그램부제: track.programSub,
      기수회차,
      정원: fields.정원,
      실참여: fields.실참여,
      교육일자: dotDate(fields.교육일자),
      교육시간: fields.교육시간,
      교육주제: fields.교육주제,
      교육목표: fields.교육목표,
      세부내용: fields.세부내용,
      교육재료: fields.교육재료,
      평가_운영: fields.평가_운영,
      평가_반응: fields.평가_반응,
      평가_보완: fields.평가_보완,
      확인년: y,
      확인월: String(Number(m)),
      확인일: String(Number(d)),
      담당자,
    };
    if (photoClass) body.photo = photoClass;
    if (photoSnack) body.photo2 = photoSnack;
    try {
      const blob = await kkumdarakAdminAPI.downloadChulgangForm(body);
      const url = URL.createObjectURL(blob);
      const name = (track.programSub || track.programName).replace(/[/\\:*?"<>|〈〉]/g, '').replace(/\s+/g, '');
      const a = document.createElement('a');
      a.href = url;
      a.download = `출강확인서_${name}_${sessionNo}회차.hwpx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotice('출강확인서를 만들었습니다. 한글에서 열어 확인한 뒤 PDF로 저장하세요.');
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '출강확인서 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const input = (key: keyof Fields, label: string, opts: { placeholder?: string; type?: string; wide?: boolean } = {}) => (
    <label className={`kd-field${opts.wide ? ' kd-field-wide' : ''}`}>
      <span className="kd-field-label">{label}</span>
      <input
        type={opts.type || 'text'}
        className="kd-field-input"
        value={fields[key]}
        onChange={(e) => setField(key, e.target.value)}
        placeholder={opts.placeholder}
      />
    </label>
  );

  return (
    <div className="kd-forms">
      <p className="kd-forms-desc">
        프로그램과 회차를 고르면 <strong>최신 회차표(9월 변경신청 반영)</strong>대로 강사·장소·일시·정원·교육주제가 채워집니다.
        본문은 줄바꿈이 그대로 한글 문단이 됩니다. 사진은 수업 사진과 다과비 증빙 사진 두 장입니다.
      </p>

      <div className="kd-forms-body">
        <div className="kd-ledger-grid">
          <label className="kd-field">
            <span className="kd-field-label">프로그램</span>
            <select
              className="kd-field-input"
              value={trackId}
              onChange={(e) => {
                setTrackId(e.target.value);
                setSessionNo('');
                setTopicEdited(false);
                setFields((f) => ({ ...f, 실참여: '' }));
              }}
            >
              <option value="">선택…</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="kd-field">
            <span className="kd-field-label">회차</span>
            <select
              className="kd-field-input"
              value={sessionNo}
              onChange={(e) => {
                setSessionNo(e.target.value);
                setTopicEdited(false);
                setFields((f) => ({ ...f, 실참여: '' }));
              }}
              disabled={!track}
            >
              <option value="">선택…</option>
              {(track?.sessions || []).map((s) => (
                <option key={s.no} value={String(s.no)}>
                  {s.no}회차 · {dotDate(s.date)}({s.weekday}) · {s.topic}
                </option>
              ))}
            </select>
          </label>
          <label className="kd-field">
            <span className="kd-field-label">프로그램명 / 기수·회차</span>
            <input
              type="text"
              className="kd-field-input kd-field-readonly"
              value={track ? [track.programName, track.programSub, 기수회차].filter(Boolean).join(' ') : ''}
              readOnly
            />
          </label>

          {input('출강강사', '출강강사 *이름(역할)', { placeholder: '이화영(주), 정강현(보조)', wide: true })}
          {input('강사수', '강사 수')}
          {input('정원', '정원')}
          {input('실참여', `실참여${dbSession ? ' (사업관리 회차 기록)' : ''}`, { placeholder: '인원' })}
          {input('교육장소', '교육장소')}
          {input('교육장소상세', '교육장소 상세주소', { placeholder: '(충남 부여군 …)' })}
          {input('교육일자', '교육일자', { type: 'date' })}
          {input('교육시간', '운영시간/인정시간', { placeholder: '(18:00~21:00/3시간)' })}
          {input('확인일자', '확인 날짜(서명일)', { type: 'date' })}
          <label className="kd-field">
            <span className="kd-field-label">담당자 (고정)</span>
            <input type="text" className="kd-field-input kd-field-readonly" value={담당자} readOnly />
          </label>

          <label className="kd-field kd-field-wide">
            <span className="kd-field-label">교육주제{session && !topicEdited ? ' (회차표)' : ''}</span>
            <input
              type="text"
              className="kd-field-input"
              value={fields.교육주제}
              onChange={(e) => {
                setField('교육주제', e.target.value);
                setTopicEdited(!!e.target.value.trim());
              }}
              placeholder={session?.topic || '회차를 고르면 회차표 주제가 들어갑니다'}
            />
            {session && topicEdited && fields.교육주제.trim() !== session.topic && (
              <span className="kd-forms-hint">
                회차표 주제 「{session.topic}」 ·{' '}
                <button
                  type="button"
                  className="kd-forms-hint-btn"
                  onClick={() => {
                    setField('교육주제', session.topic);
                    setTopicEdited(false);
                  }}
                >
                  회차표 주제로 되돌리기
                </button>
              </span>
            )}
          </label>
        </div>

        {session && session.content.length > 0 && (
          <div className="kd-forms-plan">
            <strong>회차표 주요 내용</strong> (AI 초안의 근거)
            <ul>
              {session.content.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="kd-forms-ai">
          <input
            type="text"
            className="kd-field-input kd-forms-ai-input"
            value={키워드}
            onChange={(e) => set키워드(e.target.value)}
            placeholder="그날 실제로 한 일·분위기 키워드 — 예: 짝 인터뷰, 녹음, 받는 소리 연습, 귀가 동선"
          />
          <button
            type="button"
            className="kd-ledger-action kd-ledger-action--form"
            onClick={handleAiDraft}
            disabled={!session || aiBusy}
            title={!session ? '프로그램과 회차를 먼저 고르세요' : 'Claude 로 본문·평가 초안 만들기'}
          >
            {aiBusy ? 'AI 생성 중…' : 'AI 초안'}
          </button>
        </div>

        <div className="kd-forms-textareas">
          {TEXTAREAS.map((t) => (
            <label key={t.key} className="kd-field kd-field-wide">
              <span className="kd-field-label">{t.label}</span>
              {t.hint && <span className="kd-forms-hint">{t.hint}</span>}
              <textarea
                className={`kd-field-input kd-forms-textarea${t.rows >= 8 ? ' kd-forms-textarea--tall' : ''}`}
                rows={t.rows}
                value={fields[t.key]}
                onChange={(e) => setField(t.key, e.target.value)}
              />
            </label>
          ))}
        </div>

        <div className="kd-forms-photos">
          <PhotoUpload label="진행사진 — 수업" hint="강사·참여자(뒷모습 가능)·교육재료가 보이는 사진" onChange={setPhotoClass} />
          <PhotoUpload label="진행사진 — 다과비 증빙" hint="그 회차 다과 구매 건(시식 장면 아님)" onChange={setPhotoSnack} />
        </div>

        {notice && <div className="kd-ledger-notice" role="status">{notice}</div>}
        {error && <div className="kd-ledger-warning" role="status">{error}</div>}

        <div className="kd-ledger-form-actions">
          <button type="button" className="kd-ledger-submit" onClick={handleDownload} disabled={!canSubmit || busy}>
            {busy ? '생성 중…' : 'HWPX 생성'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChulgangForm;
