import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';
import PhotoUpload from './PhotoUpload';

// ═══════════════════════════════════════════════════════════════
// 회의록(서식7) 작업창 — 2026-10 최신판(9월 회의록 형식).
//   · 회의내용 = 안건 여러 개. 안건마다 굵은 제목 한 줄 + 결정 문단(한 줄에 하나, 「~하기로 함.」).
//     안건 수·줄 수 제한 없음. 안건 사이 빈 줄은 서버가 넣는다.
//   · 「AI 초안」 → /forms/ai-draft(docType hoeuirok) → {안건:[{제목, 내용[]}]}.
//   · 회의사진 2장(비율 그대로).
// ═══════════════════════════════════════════════════════════════

interface ProgramOpt {
  key: string;
  name: string;
  주강사: string[];
}
interface Agenda {
  제목: string;
  내용: string; // 한 줄에 결정 하나
}

const 운영진 = ['이화영', '이공희', '이진영', '이한희', '정강현'];
const emptyAgenda = (): Agenda => ({ 제목: '', 내용: '' });

const HoeuirokForm: React.FC = () => {
  const { logout } = useKkumdarakAuth();

  const [programs, setPrograms] = useState<ProgramOpt[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiProgramKey, setAiProgramKey] = useState('');
  const [키워드, set키워드] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [photo1, setPhoto1] = useState('');
  const [photo2, setPhoto2] = useState('');
  const [header, setHeader] = useState({
    회의일시: '', // "2026. 9. 23.(수) 11:00~14:00"
    회의장소: '',
    회의장소상세: '',
    참석자: '',
    회의주제: '',
  });
  const [agenda, setAgenda] = useState<Agenda[]>([emptyAgenda(), emptyAgenda(), emptyAgenda()]);

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
        setPrograms((await kkumdarakAdminAPI.getPrograms({ signal: controller.signal })) as ProgramOpt[]);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        onAuthErr(err);
      }
    })();
    return () => controller.abort();
  }, [onAuthErr]);

  const setHeaderField = (key: keyof typeof header, value: string) => setHeader((h) => ({ ...h, [key]: value }));
  const setAgendaField = (i: number, key: keyof Agenda, value: string) =>
    setAgenda((list) => list.map((a, j) => (j === i ? { ...a, [key]: value } : a)));

  const attendees = useMemo(
    () =>
      header.참석자
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [header.참석자],
  );
  const 참석인원 = attendees.length ? `총 ${attendees.length}명` : '';
  const canSubmit = !!header.회의일시.trim() || !!header.회의주제.trim();
  const hasAgenda = agenda.some((a) => a.제목.trim() || a.내용.trim());

  const handleAiDraft = async () => {
    if (aiBusy) return;
    if (hasAgenda && !window.confirm('지금 쓴 안건을 AI 초안으로 덮어쓸까요?')) return;
    setAiBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await kkumdarakAdminAPI.aiDraftForm({
        docType: 'hoeuirok',
        programKey: aiProgramKey || undefined,
        회의주제: header.회의주제,
        키워드,
      });
      const arr =
        res.data && Array.isArray((res.data as Record<string, unknown>).안건)
          ? ((res.data as Record<string, unknown>).안건 as any[])
          : null;
      if (arr && arr.length) {
        setAgenda(
          arr.map((item) => {
            const lines = Array.isArray(item?.내용)
              ? item.내용
              : [item?.내용, item?.결정1, item?.결정2];
            return {
              제목: typeof item?.제목 === 'string' ? item.제목 : '',
              내용: lines.filter((l: unknown) => typeof l === 'string' && l.trim()).join('\n'),
            };
          }),
        );
        setNotice('AI 초안을 채웠습니다. 실제 회의 내용과 다른 곳을 고쳐 주세요.');
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
    if (!canSubmit || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    const body: Record<string, unknown> = {
      회의일시: header.회의일시,
      회의장소: header.회의장소,
      회의장소상세: header.회의장소상세,
      참석인원,
      참석자: attendees.join(', '),
      회의주제: header.회의주제,
      안건: agenda.filter((a) => a.제목.trim() || a.내용.trim()),
    };
    if (photo1) body.photo = photo1;
    if (photo2) body.photo2 = photo2;
    try {
      const blob = await kkumdarakAdminAPI.downloadHoeuirokForm(body);
      const url = URL.createObjectURL(blob);
      const subject = (header.회의주제 || '회의록').replace(/[/\\:*?"<>|〈〉]/g, '').replace(/\s+/g, '').slice(0, 40);
      const a = document.createElement('a');
      a.href = url;
      a.download = `회의록_${subject || '회의록'}.hwpx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotice('회의록을 만들었습니다. 한글에서 열어 한 쪽 안에 들어가는지 확인하세요.');
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '회의록 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kd-forms">
      <p className="kd-forms-desc">
        9월 회의록과 같은 모양으로 만듭니다. 안건마다 제목 한 줄과 결정사항을 <strong>한 줄에 하나씩</strong> 쓰세요
        (「~하기로 함.」). 안건은 필요한 만큼 늘릴 수 있고, 사진은 두 장입니다.
      </p>

      <div className="kd-forms-body">
        <div className="kd-ledger-grid">
          <label className="kd-field kd-field-wide">
            <span className="kd-field-label">회의일시</span>
            <input
              type="text"
              className="kd-field-input"
              value={header.회의일시}
              onChange={(e) => setHeaderField('회의일시', e.target.value)}
              placeholder="2026. 9. 23.(수) 11:00~14:00"
            />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">회의장소</span>
            <input
              type="text"
              className="kd-field-input"
              value={header.회의장소}
              onChange={(e) => setHeaderField('회의장소', e.target.value)}
              placeholder="부여 내 식당, 카페"
            />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">회의장소 상세</span>
            <input
              type="text"
              className="kd-field-input"
              value={header.회의장소상세}
              onChange={(e) => setHeaderField('회의장소상세', e.target.value)}
              placeholder="(충남 부여군 규암면)"
            />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">참석인원 (자동)</span>
            <input type="text" className="kd-field-input kd-field-readonly" value={참석인원} readOnly />
          </label>
          <label className="kd-field kd-field-wide">
            <span className="kd-field-label">참석자 (쉼표 구분)</span>
            <input
              type="text"
              className="kd-field-input"
              value={header.참석자}
              onChange={(e) => setHeaderField('참석자', e.target.value)}
              placeholder="이화영, 이공희, 이진영, 이한희, 정강현"
            />
            <span className="kd-forms-hint">
              <button type="button" className="kd-forms-hint-btn" onClick={() => setHeaderField('참석자', 운영진.join(', '))}>
                운영진 5명 채우기
              </button>
            </span>
          </label>
          <label className="kd-field kd-field-wide">
            <span className="kd-field-label">회의주제</span>
            <input
              type="text"
              className="kd-field-input"
              value={header.회의주제}
              onChange={(e) => setHeaderField('회의주제', e.target.value)}
              placeholder="하반기 프로그램 변경 운영 및 〈다시, 안녕〉 준비 점검"
            />
          </label>
        </div>

        <div className="kd-forms-ai">
          <select
            className="kd-field-input"
            value={aiProgramKey}
            onChange={(e) => setAiProgramKey(e.target.value)}
            aria-label="AI 근거 프로그램(선택)"
          >
            <option value="">AI 근거 프로그램(선택)…</option>
            {programs.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="kd-field-input kd-forms-ai-input"
            value={키워드}
            onChange={(e) => set키워드(e.target.value)}
            placeholder="실제로 논의한 것 — 예: A형 변경 운영 준비, 10회차 결과 공유, 11월 다시 안녕 세부계획, 증빙 정리 일정"
          />
          <button
            type="button"
            className="kd-ledger-action kd-ledger-action--form"
            onClick={handleAiDraft}
            disabled={aiBusy}
            title="Claude 로 회의내용 초안 만들기"
          >
            {aiBusy ? 'AI 생성 중…' : 'AI 초안'}
          </button>
        </div>

        <div className="kd-forms-agenda">
          {agenda.map((a, i) => (
            <div key={i} className="kd-forms-agenda-slot">
              <label className="kd-field kd-field-wide">
                <span className="kd-field-label">안건 {i + 1} 제목 (굵게)</span>
                <input
                  type="text"
                  className="kd-field-input"
                  value={a.제목}
                  onChange={(e) => setAgendaField(i, '제목', e.target.value)}
                  placeholder="'마을의 신호' 10회차(조중현 특강) 결과 공유 및 결과물 정리"
                />
              </label>
              <label className="kd-field kd-field-wide">
                <span className="kd-field-label">결정사항 (한 줄에 하나)</span>
                <textarea
                  className="kd-field-input kd-forms-textarea kd-forms-decision"
                  rows={4}
                  value={a.내용}
                  onChange={(e) => setAgendaField(i, '내용', e.target.value)}
                  placeholder="논의 맥락 + 결정, 「~하기로 함.」으로 끝냄"
                />
              </label>
              {agenda.length > 1 && (
                <div className="kd-forms-row-actions">
                  <button
                    type="button"
                    className="kd-ledger-action kd-ledger-action--danger"
                    onClick={() => setAgenda((list) => list.filter((_, j) => j !== i))}
                  >
                    안건 {i + 1} 삭제
                  </button>
                </div>
              )}
            </div>
          ))}
          <div className="kd-forms-row-actions">
            <button type="button" className="kd-ledger-action" onClick={() => setAgenda((list) => [...list, emptyAgenda()])}>
              안건 추가
            </button>
          </div>
        </div>

        <div className="kd-forms-photos">
          <PhotoUpload label="회의사진 1" onChange={setPhoto1} />
          <PhotoUpload label="회의사진 2" onChange={setPhoto2} />
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

export default HoeuirokForm;
