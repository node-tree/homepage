import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './evidenceLibrary.css';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';

// ─────────────────────────────────────────────────────────────────────────────
// 증빙 관리(독립 메뉴) — 집행 건과 분리. 파일 업로드(비목·서식·메모 태그)·목록·필터·
//   다운로드·삭제 + 비목별 필수증빙 체크리스트. 저장은 GridFS(앱 클라우드).
// ─────────────────────────────────────────────────────────────────────────────

interface Line {
  lineKey: string;
  majorCode: string;
  majorName: string;
  subCode: string;
  subName: string;
}
interface Ev {
  _id: string;
  filename: string;
  kind?: 'file' | 'link';
  url?: string;
  majorCode: string;
  subCode: string;
  formCode: string;
  note: string;
  size: number;
  createdAt: string;
  webViewLink?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || '');
      resolve(s.includes(',') ? s.slice(s.indexOf(',') + 1) : s);
    };
    r.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    r.readAsDataURL(file);
  });
}
const won = (n: number) => (n >= 1024 * 1024 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.ceil(n / 1024)}KB`);

const EvidenceLibrary: React.FC = () => {
  const { logout } = useKkumdarakAuth();
  const [lines, setLines] = useState<Line[]>([]);
  const [checklist, setChecklist] = useState<Record<string, string[]>>({});
  const [rows, setRows] = useState<Ev[]>([]);
  const [filterMajor, setFilterMajor] = useState(''); // lineKey 필터
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 업로드 폼
  const [upLine, setUpLine] = useState('');
  const [formCode, setFormCode] = useState('');
  const [note, setNote] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [mode, setMode] = useState<'file' | 'link'>('file'); // 증빙 추가 방식

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

  const loadRows = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const major = filterMajor ? filterMajor.split('-')[0] : '';
        const list = await kkumdarakAdminAPI.getEvidences(major, { signal });
        setRows(list as Ev[]);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        if (onAuthErr(err)) return;
        setError(err?.message || '증빙 목록을 불러오지 못했습니다.');
      }
    },
    [filterMajor, onAuthErr],
  );

  useEffect(() => {
    const c = new AbortController();
    kkumdarakAdminAPI
      .getBudgetSummary({ signal: c.signal })
      .then((d) => d && setLines(d.lines || []))
      .catch(() => {});
    kkumdarakAdminAPI
      .getEvidenceChecklist({ signal: c.signal })
      .then((cl) => setChecklist(cl || {}))
      .catch(() => {});
    return () => c.abort();
  }, []);

  useEffect(() => {
    const c = new AbortController();
    loadRows(c.signal);
    return () => c.abort();
  }, [loadRows]);

  const lineLabel = useMemo(() => {
    const m: Record<string, string> = {};
    lines.forEach((l) => (m[l.lineKey] = `${l.majorName}(${l.majorCode})·${l.subName}(${l.subCode})`));
    return m;
  }, [lines]);

  const required = useMemo(() => (filterMajor ? checklist[filterMajor] || [] : []), [checklist, filterMajor]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const [majorCode, subCode] = upLine ? upLine.split('-') : ['', ''];
      const b64 = await fileToBase64(file);
      await kkumdarakAdminAPI.uploadEvidenceFile({
        file: b64,
        filename: file.name,
        majorCode,
        subCode,
        formCode,
        note,
      });
      setNote('');
      setFormCode('');
      await loadRows();
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '증빙 업로드에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddLink = async () => {
    const u = linkUrl.trim();
    if (!u || busy) return;
    if (!/^https?:\/\//i.test(u)) {
      setError('링크는 http(s):// 로 시작해야 합니다.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const [majorCode, subCode] = upLine ? upLine.split('-') : ['', ''];
      await kkumdarakAdminAPI.uploadEvidenceFile({
        url: u,
        filename: formCode || u,
        majorCode,
        subCode,
        formCode,
        note,
      });
      setLinkUrl('');
      setNote('');
      setFormCode('');
      await loadRows();
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '링크 추가에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (ev: Ev) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const blob = await kkumdarakAdminAPI.downloadEvidenceFile(ev._id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ev.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '다운로드에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (ev: Ev) => {
    if (busy || (typeof window !== 'undefined' && !window.confirm(`"${ev.filename}" 을 삭제할까요?`))) return;
    setBusy(true);
    setError('');
    try {
      await kkumdarakAdminAPI.deleteEvidenceFile(ev._id);
      await loadRows();
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '삭제에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kd-evlib">
      {/* 증빙 추가 — 파일/링크 중 선택 */}
      <div className="kd-evlib-modetoggle" role="tablist">
        <button type="button" className={mode === 'file' ? 'active' : ''} onClick={() => setMode('file')}>
          파일 업로드
        </button>
        <button type="button" className={mode === 'link' ? 'active' : ''} onClick={() => setMode('link')}>
          링크 추가
        </button>
      </div>
      <div className="kd-evlib-upload">
        <select className="kd-field-input" value={upLine} onChange={(e) => setUpLine(e.target.value)} title="비목(선택)">
          <option value="">비목 선택(선택)</option>
          {lines.map((l) => (
            <option key={l.lineKey} value={l.lineKey}>
              {l.majorName}·{l.subName}
            </option>
          ))}
        </select>
        <input className="kd-field-input" placeholder="서식/증빙명 (예: 서식11 지출결의서)" value={formCode} onChange={(e) => setFormCode(e.target.value)} />
        <input className="kd-field-input" placeholder="메모(선택)" value={note} onChange={(e) => setNote(e.target.value)} />

        {mode === 'file' ? (
          <label className={`kd-ledger-action kd-ledger-action--form${busy ? ' is-busy' : ''}`}>
            {busy ? '업로드 중…' : '＋ 파일 선택'}
            <input type="file" hidden onChange={handleUpload} disabled={busy} />
          </label>
        ) : (
          <>
            <input
              className="kd-field-input"
              style={{ minWidth: 260, flex: 1 }}
              placeholder="증빙 링크 (https:// … — 예: 구글드라이브 공유 링크)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <button type="button" className="kd-ledger-action kd-ledger-action--form" onClick={handleAddLink} disabled={busy || !linkUrl.trim()}>
              ＋ 링크 추가
            </button>
          </>
        )}
      </div>

      {/* 필터 + 체크리스트 */}
      <div className="kd-evlib-filter">
        <span>비목 필터</span>
        <select className="kd-field-input" value={filterMajor} onChange={(e) => setFilterMajor(e.target.value)}>
          <option value="">전체</option>
          {lines.map((l) => (
            <option key={l.lineKey} value={l.lineKey}>
              {l.majorName}·{l.subName}
            </option>
          ))}
        </select>
      </div>
      {required.length > 0 && (
        <div className="kd-evidence-checklist">
          <span className="kd-evidence-label">이 비목 필수 증빙</span>
          <ul>
            {required.map((r) => {
              const covered = rows.some((ev) => `${ev.formCode} ${ev.filename}`.includes(r.split(/[\s(]/)[0]));
              return (
                <li key={r} className={covered ? 'is-covered' : 'is-missing'}>
                  {covered ? '✓' : '○'} {r}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {error && <p className="kd-forms-error">{error}</p>}

      {/* 목록 */}
      {rows.length === 0 ? (
        <p className="kd-evidence-empty">증빙이 없습니다. 위에서 파일을 업로드하세요.</p>
      ) : (
        <div className="kd-admin-table-wrap">
          <table className="kd-admin-table">
            <thead>
              <tr>
                <th>파일명</th>
                <th>비목</th>
                <th>서식</th>
                <th>크기</th>
                <th>업로드</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ev) => (
                <tr key={ev._id}>
                  <td className="kd-admin-td-name">{ev.filename}</td>
                  <td className="kd-admin-td-name">{lineLabel[`${ev.majorCode}-${ev.subCode}`] || '—'}</td>
                  <td className="kd-admin-td-name">{ev.formCode || '—'}</td>
                  <td className="kd-admin-td-name">{ev.kind === 'link' ? '🔗 링크' : won(ev.size)}</td>
                  <td className="kd-admin-td-name">{(ev.createdAt || '').slice(0, 10)}</td>
                  <td className="kd-admin-td-name kd-ledger-actions">
                    {ev.kind === 'link' ? (
                      <a className="kd-ledger-action" href={ev.url} target="_blank" rel="noreferrer">
                        열기
                      </a>
                    ) : (
                      <button type="button" className="kd-ledger-action" onClick={() => handleDownload(ev)} disabled={busy}>
                        다운로드
                      </button>
                    )}
                    {ev.webViewLink ? (
                      <a className="kd-evidence-drive" href={ev.webViewLink} target="_blank" rel="noreferrer">Drive</a>
                    ) : null}
                    <button type="button" className="kd-ledger-action kd-ledger-action--danger" onClick={() => handleDelete(ev)} disabled={busy}>
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

export default EvidenceLibrary;
