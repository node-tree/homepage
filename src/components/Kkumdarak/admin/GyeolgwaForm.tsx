import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';
import PhotoUpload from './PhotoUpload';

// ─────────────────────────────────────────────────────────────────────────────
// 서식6 기획·개발 결과보고서 작업창 — 2026-10 최신판(9월 제출본 형식).
//   · 제목 「(N월)」 = 보고월. 기본정보·참여인력(여러 줄)·주요내용은 모두 고칠 수 있다.
//   · 활동 개요 회차 행 1~5개(쓴 만큼만 서식에 남고 나머지 행은 지워진다).
//   · 세부내용 = 번호 소제목 5개 본문(줄바꿈 = 문단, 빈 줄 = 문단 사이 빈 줄).
//     「AI 초안」은 소제목 다섯 개를 동시에 요청한다(한 번에 4,000자를 쓰면 서버 시간 초과 위험).
//   · 활동사진 4장, 담당자 서명(서버가 「(인)」 위에 얹음).
// ─────────────────────────────────────────────────────────────────────────────

interface ProgramStat {
  key: string;
  name: string;
  quota: number;
  targetGroup: string;
  주강사: string[];
}

const SECTIONS = [
  { key: '역할', label: '1. 기획개발 참여인력 역할', rows: 6 },
  { key: '대상', label: '2. 대상 분석', rows: 6 },
  { key: '과정', label: '3. 기획개발 과정', rows: 12, hint: '○ (발상) / ○ (개발) / ○ (운영 점검) / ○ (관리) 문단을 빈 줄로 나눔' },
  { key: '실행', label: '4. 프로그램 실행 계획', rows: 8, hint: '○ (라벨) 문단 2~5개' },
  { key: '평가', label: '5. 평가 및 성과 계획', rows: 8, hint: '○ (참여자 피드백) / ○ (학습 성과) / ○ (향후 개선점) …' },
] as const;
type SectionKey = (typeof SECTIONS)[number]['key'];

const 담당자 = '이한희';
const 기록담당 = '이진영(홍보·기록담당)';
const MAX_ROWS = 5;
const emptyRow = () => ({ 일시: '', 주제: '', 참석: '' });

function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
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
  const [보고월, set보고월] = useState(String(new Date().getMonth() + 1));
  const [확인일자, set확인일자] = useState(todayIso());
  const [photos, setPhotos] = useState<string[]>(['', '', '', '']);

  const [f, setF] = useState({
    교육대상: '',
    세부대상: '',
    교육인원: '',
    참여인력: '',
    장르: '',
    주요내용: '',
  });
  const [sections, setSections] = useState<Record<SectionKey, string>>({ 역할: '', 대상: '', 과정: '', 실행: '', 평가: '' });
  const [rows, setRows] = useState([emptyRow(), emptyRow(), emptyRow()]);

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
        if (err?.name === 'AbortError' || onAuthErr(err)) return;
        setError(err?.message || '프로그램을 불러오지 못했습니다.');
      });
    return () => c.abort();
  }, [onAuthErr]);

  const program = useMemo(() => programs.find((p) => p.key === programKey) || null, [programs, programKey]);
  const setField = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setRow = (i: number, k: '일시' | '주제' | '참석', v: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  // 프로그램을 고르면 기본값을 채운다. 직접 고친 칸은 그대로 두고, 비었거나 지난번 자동값 그대로인 칸만
  //   새 프로그램 값으로 바꾼다(프로그램을 바꿔도 앞 프로그램 값이 남지 않게).
  const autoRef = useRef({ 교육대상: '', 교육인원: '', 참여인력: '' });
  useEffect(() => {
    if (!program) return;
    const next = {
      교육대상: program.targetGroup,
      교육인원: `총 ${program.quota}명`,
      참여인력: [...program.주강사.map((n) => `${n}(기획/주강사),`), 기록담당].join('\n'),
    };
    const prevAuto = autoRef.current;
    setF((p) => {
      const out = { ...p };
      (Object.keys(next) as (keyof typeof next)[]).forEach((k) => {
        if (!p[k].trim() || p[k] === prevAuto[k]) out[k] = next[k];
      });
      return out;
    });
    autoRef.current = next;
  }, [program]);

  // 참여인력 수 = 「이름(」 개수
  const 참여인력수 = useMemo(() => {
    const n = (f.참여인력.match(/[가-힣]{2,4}\s*\(/g) || []).length;
    return n ? `(총 ${n}명)` : '';
  }, [f.참여인력]);

  const hasSections = SECTIONS.some((s) => sections[s.key].trim());

  const handleAiDraft = async () => {
    if (aiBusy) return;
    if (!program) {
      setError('AI 초안은 프로그램을 먼저 고르세요.');
      return;
    }
    if (hasSections && !window.confirm('지금 쓴 세부내용을 AI 초안으로 덮어쓸까요?')) return;
    setAiBusy(true);
    setError('');
    setNotice('');
    const reportMonth = `${new Date().getFullYear()}년 ${보고월}월`;
    const results = await Promise.allSettled(
      SECTIONS.map((s) =>
        kkumdarakAdminAPI.aiDraftForm({ docType: 'gyeolgwa', programKey, 키워드, reportMonth, 섹션: s.key }),
      ),
    );
    const done: string[] = [];
    setSections((prev) => {
      const next = { ...prev };
      results.forEach((r, i) => {
        if (r.status !== 'fulfilled' || !r.value.data) return;
        const v = (r.value.data as Record<string, unknown>).본문;
        if (typeof v === 'string' && v.trim()) next[SECTIONS[i].key] = v;
      });
      return next;
    });
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value.data) done.push(SECTIONS[i].label);
    });
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    if (failed && onAuthErr(failed.reason)) {
      setAiBusy(false);
      return;
    }
    if (done.length === SECTIONS.length) setNotice('소제목 다섯 개를 모두 채웠습니다. 사실과 다른 곳을 고쳐 주세요.');
    else if (done.length) setError(`${done.length}/5개만 채웠습니다. 빈 소제목은 다시 시도하거나 직접 써 주세요.`);
    else setError(failed?.reason?.message || 'AI 초안 생성에 실패했습니다.');
    setAiBusy(false);
  };

  const handleDownload = async () => {
    if (!program || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    const [y, m, d] = (확인일자 || todayIso()).split('-');
    const body: Record<string, unknown> = {
      보고월,
      운영기관명: '노드트리',
      프로그램명: program.name,
      교육대상: f.교육대상,
      세부대상: f.세부대상,
      교육인원: f.교육인원,
      참여인력수,
      참여인력: f.참여인력,
      장르: f.장르,
      주요내용: f.주요내용,
      회차: rows,
      세부: sections,
      확인년: y,
      확인월: String(Number(m)),
      확인일: String(Number(d)),
      담당자,
    };
    photos.forEach((p, i) => {
      if (p) body[`photo${i + 1}`] = p;
    });
    try {
      const blob = await kkumdarakAdminAPI.downloadGyeolgwaForm(body);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${program.name.replace(/[/\\:*?"<>|()]/g, '')} 프로그램 기획·개발 결과보고서 ${보고월}월.hwpx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotice('결과보고서를 만들었습니다. 한글에서 3~5쪽인지 확인하세요.');
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '결과보고서 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kd-forms">
      <p className="kd-forms-desc">
        9월 결과보고서와 같은 모양으로 만듭니다. 활동 개요는 쓴 회차 수만큼(1~5행)만 남고, 세부내용은 소제목 다섯 개 아래
        여러 문단으로 들어갑니다. 활동사진은 네 장입니다.
      </p>

      <div className="kd-forms-body">
        <div className="kd-ledger-grid">
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
            <span className="kd-field-label">보고월</span>
            <select className="kd-field-input" value={보고월} onChange={(e) => set보고월(e.target.value)}>
              {[5, 6, 7, 8, 9, 10, 11, 12].map((mm) => (
                <option key={mm} value={String(mm)}>
                  {mm}월
                </option>
              ))}
            </select>
          </label>
          <label className="kd-field">
            <span className="kd-field-label">확인 날짜(서명일)</span>
            <input type="date" className="kd-field-input" value={확인일자} onChange={(e) => set확인일자(e.target.value)} />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">교육대상</span>
            <input className="kd-field-input" value={f.교육대상} onChange={(e) => setField('교육대상', e.target.value)} placeholder="전생애" />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">교육인원</span>
            <input className="kd-field-input" value={f.교육인원} onChange={(e) => setField('교육인원', e.target.value)} placeholder="총 15명" />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">장르(부장르)</span>
            <input className="kd-field-input" value={f.장르} onChange={(e) => setField('장르', e.target.value)} placeholder="미디어(인터랙티브)" />
          </label>
          <label className="kd-field kd-field-wide">
            <span className="kd-field-label">세부대상</span>
            <input className="kd-field-input" value={f.세부대상} onChange={(e) => setField('세부대상', e.target.value)} placeholder="아동·청소년(장암초 5~6학년 + 중·고등학생)" />
          </label>
          <label className="kd-field kd-field-wide">
            <span className="kd-field-label">기획개발 참여인력 {참여인력수} — 한 줄에 한 사람(또는 두 사람)</span>
            <textarea className="kd-field-input kd-forms-textarea" rows={3} value={f.참여인력} onChange={(e) => setField('참여인력', e.target.value)} />
          </label>
          <label className="kd-field kd-field-wide">
            <span className="kd-field-label">프로그램 주요내용</span>
            <textarea className="kd-field-input kd-forms-textarea" rows={2} value={f.주요내용} onChange={(e) => setField('주요내용', e.target.value)} />
          </label>
        </div>

        <div className="kd-forms-section-title">기획·개발 활동 개요 (1~5회차)</div>
        {rows.map((r, i) => (
          <div key={i} className="kd-ledger-grid">
            <label className="kd-field">
              <span className="kd-field-label">{i + 1} · 일시</span>
              <input className="kd-field-input" value={r.일시} onChange={(e) => setRow(i, '일시', e.target.value)} placeholder="9. 2.(수) 오후" />
            </label>
            <label className="kd-field">
              <span className="kd-field-label">활동주제</span>
              <input className="kd-field-input" value={r.주제} onChange={(e) => setRow(i, '주제', e.target.value)} />
            </label>
            <label className="kd-field">
              <span className="kd-field-label">참석자</span>
              <input className="kd-field-input" value={r.참석} onChange={(e) => setRow(i, '참석', e.target.value)} placeholder="정강현, 이화영, 이진영" />
            </label>
          </div>
        ))}
        <div className="kd-forms-row-actions">
          {rows.length < MAX_ROWS && (
            <button type="button" className="kd-ledger-action" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
              회차 행 추가
            </button>
          )}
          {rows.length > 1 && (
            <button type="button" className="kd-ledger-action kd-ledger-action--danger" onClick={() => setRows((rs) => rs.slice(0, -1))}>
              마지막 행 삭제
            </button>
          )}
        </div>

        <div className="kd-forms-ai">
          <input
            className="kd-field-input kd-forms-ai-input"
            placeholder="이번 달 실제로 한 일 키워드 — 예: 10회차 특강 결합, 만족도 설문 정리, 상설전시 배치 설계"
            value={키워드}
            onChange={(e) => set키워드(e.target.value)}
          />
          <button
            type="button"
            className="kd-ledger-action kd-ledger-action--form"
            onClick={handleAiDraft}
            disabled={aiBusy || !program}
            title={!program ? '프로그램을 먼저 고르세요' : '소제목 다섯 개를 동시에 생성'}
          >
            {aiBusy ? 'AI 생성 중…' : 'AI 초안'}
          </button>
        </div>
        <div className="kd-forms-textareas">
          {SECTIONS.map((s) => (
            <label key={s.key} className="kd-field kd-field-wide">
              <span className="kd-field-label">{s.label}</span>
              {'hint' in s && s.hint && <span className="kd-forms-hint">{s.hint}</span>}
              <textarea
                className={`kd-field-input kd-forms-textarea${s.rows >= 8 ? ' kd-forms-textarea--tall' : ''}`}
                rows={s.rows}
                value={sections[s.key]}
                onChange={(e) => setSections((p) => ({ ...p, [s.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>

        <div className="kd-forms-photos kd-forms-photos--4">
          {photos.map((_, i) => (
            <PhotoUpload
              key={i}
              label={`활동사진 ${i + 1}`}
              onChange={(b64) => setPhotos((ps) => ps.map((p, j) => (j === i ? b64 : p)))}
            />
          ))}
        </div>

        {notice && <div className="kd-ledger-notice" role="status">{notice}</div>}
        {error && <div className="kd-ledger-warning" role="status">{error}</div>}

        <div className="kd-ledger-form-actions">
          <button type="button" className="kd-ledger-submit" onClick={handleDownload} disabled={!program || busy}>
            {busy ? '생성 중…' : 'HWPX 생성'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GyeolgwaForm;
