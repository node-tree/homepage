import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';
import PhotoUpload from './PhotoUpload';

// ═══════════════════════════════════════════════════════════════
// 회의록(서식7) 작업창.
//   · 헤더(회의일시·장소·참석자·주제) + 논의안건 5슬롯(안건명 + 결정 2줄).
//   · 참석자: 프로그램 선택 시 주강사 prefill(선택적 편의).
//   · 「AI 초안」 → /forms/ai-draft(docType hoeuirok) → 반환된 안건 슬롯만 채움(나머지 슬롯 보존).
//   · 회의사진 첨부(선택) → BinData/hoeuirok_photo.png 교체(없으면 더미 유지).
//   · 클라이언트가 21개 플레이스홀더 값을 모두 조립해 POST → HWPX blob 다운로드.
//     {{참석인원}}="총 N명"(참석자 수에서 산출), {{참석자}}=쉼표구분.
//   · 안 쓰는 안건 슬롯은 빈 문자열 전송(서버 매퍼가 ''로 치환 — 미치환 토큰 없음).
//   · 결정사항은 AI "자세하게" 강화로 "맥락 한 문장 + 결정"의 다문장이 들어올 수 있어
//     단일줄 input → textarea 로 바꿔 긴 문장이 잘려 보이지 않게 한다(데스크톱·모바일 동일).
// ═══════════════════════════════════════════════════════════════

interface ProgramOpt {
  key: string;
  name: string;
  주강사: string[];
}

const AGENDA_SLOTS = [1, 2, 3, 4, 5] as const;

const HoeuirokForm: React.FC = () => {
  const { logout } = useKkumdarakAuth();

  const [programs, setPrograms] = useState<ProgramOpt[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  // AI 초안
  const [aiProgramKey, setAiProgramKey] = useState('');
  const [키워드, set키워드] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  // 회의사진(base64 PNG, 프리픽스 없음). 빈 문자열이면 미첨부.
  const [photo, setPhoto] = useState('');

  const [header, setHeader] = useState({
    회의일시: '', // 자유텍스트 "2026. 7. 3.(목) 14:00~15:30"
    회의장소: '',
    회의장소상세: '',
    참석자: '', // 쉼표구분 입력
    회의주제: '',
  });

  // 안건 5슬롯 — { 안건1, 안건1_1, 안건1_2, ... }
  const [agenda, setAgenda] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    AGENDA_SLOTS.forEach((n) => {
      init[`안건${n}`] = '';
      init[`안건${n}_1`] = '';
      init[`안건${n}_2`] = '';
    });
    return init;
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

  // 프로그램 목록(참석자 prefill + AI grounding 선택용)
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const rows = await kkumdarakAdminAPI.getPrograms({ signal: controller.signal });
        setPrograms(rows as ProgramOpt[]);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        onAuthErr(err); // 프로그램 로드 실패는 비치명(prefill/AI grounding 만 불가)
      }
    })();
    return () => controller.abort();
  }, [onAuthErr]);

  const setHeaderField = (key: keyof typeof header, value: string) => {
    setHeader((h) => ({ ...h, [key]: value }));
  };
  const setAgendaField = (key: string, value: string) => {
    setAgenda((a) => ({ ...a, [key]: value }));
  };

  // 참석자(쉼표구분) → 배열
  const attendees = useMemo(
    () =>
      header.참석자
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [header.참석자],
  );
  const 참석인원 = attendees.length ? `총 ${attendees.length}명` : '';

  // 주강사 prefill — 선택 프로그램의 주강사를 참석자 칸에 채움(기존 입력 대체)
  const prefillFromProgram = (programKey: string) => {
    const p = programs.find((x) => x.key === programKey);
    if (!p) return;
    setHeaderField('참석자', (p.주강사 || []).join(', '));
  };

  const canSubmit = !!header.회의일시.trim() || !!header.회의주제.trim();

  // 기존 안건 슬롯에 내용이 있는지(덮어쓰기 confirm 판단용)
  const hasAgendaContent = () => Object.values(agenda).some((v) => v && v.trim());

  // ── AI 초안 — 안건 배열 → 5슬롯 평면키 변환(안건N/안건N_1/안건N_2). ──
  //   ⚠️ AI 는 {안건:[{제목,결정1,결정2}]} 배열을 주지만 폼은 평면키라 키가 겹치지 않는다.
  //   명시 매핑(naive spread 금지). 반환된 슬롯(0..arr.length-1)만 채우고 나머지 슬롯은 기존값 유지.
  //   기존 안건에 내용이 있으면 덮어쓰기 confirm.
  const handleAiDraft = async () => {
    if (aiBusy) return;
    if (
      hasAgendaContent() &&
      typeof window !== 'undefined' &&
      !window.confirm('기존 안건을 AI 초안으로 덮어쓸까요?')
    ) {
      return;
    }
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
      if (arr) {
        setAgenda((prev) => {
          const next = { ...prev };
          // 반환된 안건 수만큼만 채운다(최대 5). 반환 안 한 슬롯은 prev 유지(유실 방지).
          const count = Math.min(arr.length, AGENDA_SLOTS.length);
          for (let i = 0; i < count; i += 1) {
            const item = arr[i] || {};
            next[`안건${i + 1}`] = typeof item.제목 === 'string' ? item.제목 : '';
            next[`안건${i + 1}_1`] = typeof item.결정1 === 'string' ? item.결정1 : '';
            next[`안건${i + 1}_2`] = typeof item.결정2 === 'string' ? item.결정2 : '';
          }
          return next;
        });
        setNotice('AI 초안을 안건에 채웠습니다. 내용을 검토·수정하세요.');
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
    const body: Record<string, string> = {
      회의일시: header.회의일시,
      회의장소: header.회의장소,
      회의장소상세: header.회의장소상세,
      참석인원,
      참석자: attendees.join(', '),
      회의주제: header.회의주제,
      ...agenda, // 15개 안건 키(빈 슬롯은 '')
    };
    if (photo) body.photo = photo; // 사진 있으면만 포함(없으면 더미 유지 — 회귀 없음)
    try {
      const blob = await kkumdarakAdminAPI.downloadHoeuirokForm(body);
      const url = URL.createObjectURL(blob);
      const subject = (header.회의주제 || '회의록')
        .replace(/[/\\:*?"<>|]/g, '')
        .replace(/\s+/g, '');
      const a = document.createElement('a');
      a.href = url;
      a.download = `회의록_${subject || '회의록'}.hwpx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotice('회의록이 생성되었습니다.');
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
        회의 정보와 논의안건(최대 5개)을 입력해 회의록을 생성합니다. 참석자는 쉼표로 구분하며, 프로그램을 고르면 주강사를 채우거나 「AI 초안」으로 안건을 생성할 수 있습니다. 결정사항은 "논의 맥락 + 결정"으로 풍부하게 작성됩니다.
      </p>

      <div className="kd-forms-body">
        {/* 헤더 */}
        <div className="kd-ledger-grid">
          <label className="kd-field kd-field-wide">
            <span className="kd-field-label">회의일시</span>
            <input
              type="text"
              className="kd-field-input"
              value={header.회의일시}
              onChange={(e) => setHeaderField('회의일시', e.target.value)}
              placeholder="2026. 7. 3.(목) 14:00~15:30"
            />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">회의장소</span>
            <input
              type="text"
              className="kd-field-input"
              value={header.회의장소}
              onChange={(e) => setHeaderField('회의장소', e.target.value)}
            />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">회의장소 상세</span>
            <input
              type="text"
              className="kd-field-input"
              value={header.회의장소상세}
              onChange={(e) => setHeaderField('회의장소상세', e.target.value)}
            />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">회의주제</span>
            <input
              type="text"
              className="kd-field-input"
              value={header.회의주제}
              onChange={(e) => setHeaderField('회의주제', e.target.value)}
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
              placeholder="이화영, 이공희, 정강현"
            />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">주강사 채우기(선택)</span>
            <select
              className="kd-field-input"
              value=""
              onChange={(e) => {
                if (e.target.value) prefillFromProgram(e.target.value);
              }}
            >
              <option value="">프로그램 선택…</option>
              {programs.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* AI 초안 — 그라운딩 프로그램 + 키워드 + 버튼 (안건 채움) */}
        <div className="kd-forms-ai">
          <select
            className="kd-field-input"
            value={aiProgramKey}
            onChange={(e) => setAiProgramKey(e.target.value)}
            aria-label="AI 그라운딩 프로그램(선택)"
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
            placeholder="키워드를 쉼표로 나열 — 예: 일정 점검, 예산 집행, 안전 관리, 출결 편차"
          />
          <button
            type="button"
            className="kd-ledger-action kd-ledger-action--form"
            onClick={handleAiDraft}
            disabled={aiBusy}
            title="KNUH AI 로 논의안건 초안 생성"
          >
            {aiBusy ? 'AI 생성 중…' : 'AI 초안'}
          </button>
        </div>

        {/* 논의안건 5슬롯 */}
        <div className="kd-forms-agenda">
          {AGENDA_SLOTS.map((n) => (
            <div key={n} className="kd-forms-agenda-slot">
              <label className="kd-field kd-field-wide">
                <span className="kd-field-label">안건 {n}</span>
                <input
                  type="text"
                  className="kd-field-input"
                  value={agenda[`안건${n}`]}
                  onChange={(e) => setAgendaField(`안건${n}`, e.target.value)}
                  placeholder="안건명(미사용 시 비움)"
                />
              </label>
              <label className="kd-field kd-field-wide">
                <span className="kd-field-label">└ 결정사항 1</span>
                <textarea
                  className="kd-field-input kd-forms-textarea kd-forms-decision"
                  rows={2}
                  value={agenda[`안건${n}_1`]}
                  onChange={(e) => setAgendaField(`안건${n}_1`, e.target.value)}
                  placeholder="논의 맥락 + 결정사항"
                />
              </label>
              <label className="kd-field kd-field-wide">
                <span className="kd-field-label">└ 결정사항 2</span>
                <textarea
                  className="kd-field-input kd-forms-textarea kd-forms-decision"
                  rows={2}
                  value={agenda[`안건${n}_2`]}
                  onChange={(e) => setAgendaField(`안건${n}_2`, e.target.value)}
                  placeholder="논의 맥락 + 결정사항"
                />
              </label>
            </div>
          ))}
        </div>

        {/* 회의사진 첨부 */}
        <PhotoUpload label="회의사진" onChange={setPhoto} />

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

export default HoeuirokForm;
