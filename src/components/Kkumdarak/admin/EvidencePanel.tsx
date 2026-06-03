import React, { useMemo, useState } from 'react';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';

// ─────────────────────────────────────────────────────────────────────────────
// 증빙 패널 — 집행 건에 증빙 파일 첨부(Google Drive) + 비목별 필수증빙 체크리스트 대조.
//   Drive 미설정 시 업로드는 503 안내(체크리스트·목록은 정상 동작).
// ─────────────────────────────────────────────────────────────────────────────

interface EvidenceItem {
  _id?: string;
  name: string;
  formCode?: string;
  webViewLink?: string;
  uploadedAt?: string;
  size?: number;
}
interface Props {
  tx: any; // _id, majorCode, subCode, evidenceMeta[]
  checklist: Record<string, string[]>;
  onChanged: (updatedTx: any) => void;
  onAuthErr: (err: any) => boolean;
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

const EvidencePanel: React.FC<Props> = ({ tx, checklist, onChanged, onAuthErr }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [formCode, setFormCode] = useState('');

  const items: EvidenceItem[] = Array.isArray(tx.evidenceMeta) ? tx.evidenceMeta : [];
  const required = useMemo(
    () => checklist[`${tx.majorCode}-${tx.subCode}`] || [],
    [checklist, tx.majorCode, tx.subCode],
  );
  // 첨부된 formCode(또는 파일명에 서식코드 포함) 으로 충족 판단(느슨 매칭)
  const attachedKeys = items.map((it) => `${it.formCode || ''} ${it.name || ''}`);
  const isCovered = (req: string) => {
    const head = req.split(/[\s(]/)[0]; // "서식11" / "적격증빙" 등 앞부분
    return attachedKeys.some((a) => a.includes(head));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const b64 = await fileToBase64(file);
      const updated = await kkumdarakAdminAPI.uploadEvidence(tx._id, {
        file: b64,
        filename: file.name,
        formCode,
      });
      if (updated) onChanged(updated);
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '증빙 업로드에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (it: EvidenceItem) => {
    if (!it._id || busy) return;
    setBusy(true);
    setError('');
    try {
      const blob = await kkumdarakAdminAPI.downloadEvidence(tx._id, it._id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = it.name || '증빙';
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

  const handleDelete = async (evId?: string) => {
    if (!evId || busy) return;
    if (typeof window !== 'undefined' && !window.confirm('이 증빙을 삭제할까요?')) return;
    setBusy(true);
    setError('');
    try {
      const updated = await kkumdarakAdminAPI.deleteEvidence(tx._id, evId);
      if (updated) onChanged(updated);
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '증빙 삭제에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kd-evidence">
      {/* 비목별 필수 증빙 체크리스트 */}
      {required.length > 0 && (
        <div className="kd-evidence-checklist">
          <span className="kd-evidence-label">필수 증빙</span>
          <ul>
            {required.map((req) => (
              <li key={req} className={isCovered(req) ? 'is-covered' : 'is-missing'}>
                {isCovered(req) ? '✓' : '○'} {req}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 업로드 */}
      <div className="kd-evidence-upload">
        <input
          className="kd-field-input"
          type="text"
          placeholder="서식/증빙명 (예: 서식11 지출결의서)"
          value={formCode}
          onChange={(ev) => setFormCode(ev.target.value)}
          style={{ maxWidth: 260 }}
        />
        <label className={`kd-ledger-action kd-ledger-action--form${busy ? ' is-busy' : ''}`}>
          {busy ? '업로드 중…' : '＋ 증빙 첨부'}
          <input type="file" hidden onChange={handleUpload} disabled={busy} />
        </label>
      </div>

      {/* 첨부 목록 */}
      {items.length > 0 ? (
        <ul className="kd-evidence-list">
          {items.map((it) => (
            <li key={it._id || it.name}>
              <span className="kd-evidence-name">{it.name}</span>
              {it.formCode ? <em className="kd-evidence-form"> · {it.formCode}</em> : null}
              <button
                type="button"
                className="kd-ledger-action"
                onClick={() => handleDownload(it)}
                disabled={busy}
              >
                다운로드
              </button>
              {it.webViewLink ? (
                <a className="kd-evidence-drive" href={it.webViewLink} target="_blank" rel="noreferrer">
                  Drive
                </a>
              ) : null}
              <button
                type="button"
                className="kd-ledger-action kd-ledger-action--danger"
                onClick={() => handleDelete(it._id)}
                disabled={busy}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="kd-evidence-empty">첨부된 증빙이 없습니다.</p>
      )}

      {error && <p className="kd-forms-error">{error}</p>}
    </div>
  );
};

export default EvidencePanel;
