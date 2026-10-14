import React, { useCallback, useState } from 'react';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';
import PhotoUpload from './PhotoUpload';

// ─────────────────────────────────────────────────────────────────────────────
// 검수조서 작업창 — 2026-10 최신판(5월 실제 제출본 형식).
//   5월에 낸 검수조서는 「검 수 조 서」 물품 검수 형식이다:
//   품명·규격·수량·비고 표(최대 4행) + 사진 4장 + 「상기 물품을 정히 영수함.」 + 날짜 +
//   「노드트리 행정실무 성명 이한희」와 서명(서버가 넣음).
//   (이전의 일반용역비 양식·검수의견 AI 초안은 제출본에 없는 칸이라 뺐다)
// ─────────────────────────────────────────────────────────────────────────────

interface Item {
  품명: string;
  규격: string;
  수량: string;
  비고: string;
}
const emptyItem = (): Item => ({ 품명: '', 규격: '', 수량: '', 비고: '' });
const MAX_ITEMS = 4;

function todayIso(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

const GeomsuForm: React.FC = () => {
  const { logout } = useKkumdarakAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [items, setItems] = useState<Item[]>([emptyItem(), emptyItem()]);
  const [확인일자, set확인일자] = useState(todayIso());
  const [담당자, set담당자] = useState('이한희');
  const [photos, setPhotos] = useState<string[]>(['', '', '', '']);

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

  const setItem = (i: number, k: keyof Item, v: string) =>
    setItems((list) => list.map((it, j) => (j === i ? { ...it, [k]: v } : it)));

  const canSubmit = items.some((it) => it.품명.trim());

  const handleDownload = async () => {
    if (busy || !canSubmit) return;
    setBusy(true);
    setError('');
    setNotice('');
    const [y, m, d] = (확인일자 || todayIso()).split('-');
    const body: Record<string, unknown> = {
      품목: items,
      확인년: y,
      확인월: String(Number(m)),
      확인일: String(Number(d)),
      담당자,
    };
    photos.forEach((p, i) => {
      if (p) body[`photo${i + 1}`] = p;
    });
    try {
      const blob = await kkumdarakAdminAPI.downloadGeomsuForm(body);
      const url = URL.createObjectURL(blob);
      const first = (items.find((it) => it.품명.trim())?.품명 || '').replace(/[/\\:*?"<>|()\s]/g, '').slice(0, 30);
      const a = document.createElement('a');
      a.href = url;
      a.download = `검수조서${first ? `_${first}` : ''}.hwpx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotice('검수조서를 만들었습니다.');
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '검수조서 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kd-forms">
      <p className="kd-forms-desc">
        5월에 제출한 검수조서와 같은 모양(품명·규격·수량·비고 + 사진 4장 + 「상기 물품을 정히 영수함」)으로 만듭니다.
        결과물 링크는 비고에 적으세요.
      </p>

      <div className="kd-forms-body">
        <div className="kd-forms-section-title">품목 (최대 4행)</div>
        {items.map((it, i) => (
          <div key={i} className="kd-ledger-grid">
            <label className="kd-field">
              <span className="kd-field-label">{i + 1} · 품명</span>
              <input className="kd-field-input" value={it.품명} onChange={(e) => setItem(i, '품명', e.target.value)} placeholder="인터렉티브 아카이브 개발/구축(홈페이지)" />
            </label>
            <label className="kd-field">
              <span className="kd-field-label">규격 / 수량</span>
              <span style={{ display: 'flex', gap: 8 }}>
                <input className="kd-field-input" value={it.규격} onChange={(e) => setItem(i, '규격', e.target.value)} placeholder="url" />
                <input className="kd-field-input" value={it.수량} onChange={(e) => setItem(i, '수량', e.target.value)} placeholder="1" />
              </span>
            </label>
            <label className="kd-field">
              <span className="kd-field-label">비고</span>
              <input className="kd-field-input" value={it.비고} onChange={(e) => setItem(i, '비고', e.target.value)} placeholder="https://…" />
            </label>
          </div>
        ))}
        <div className="kd-forms-row-actions">
          {items.length < MAX_ITEMS && (
            <button type="button" className="kd-ledger-action" onClick={() => setItems((l) => [...l, emptyItem()])}>
              품목 추가
            </button>
          )}
          {items.length > 1 && (
            <button type="button" className="kd-ledger-action kd-ledger-action--danger" onClick={() => setItems((l) => l.slice(0, -1))}>
              마지막 품목 삭제
            </button>
          )}
        </div>

        <div className="kd-ledger-grid" style={{ marginTop: 16 }}>
          <label className="kd-field">
            <span className="kd-field-label">영수 날짜</span>
            <input type="date" className="kd-field-input" value={확인일자} onChange={(e) => set확인일자(e.target.value)} />
          </label>
          <label className="kd-field">
            <span className="kd-field-label">행정실무 성명</span>
            <input className="kd-field-input" value={담당자} onChange={(e) => set담당자(e.target.value)} />
          </label>
        </div>

        <div className="kd-forms-photos kd-forms-photos--4">
          {photos.map((_, i) => (
            <PhotoUpload
              key={i}
              label={`검수 사진 ${i + 1}`}
              hint={i < 2 ? '결과물 화면·산출물' : '현장·제작 과정'}
              onChange={(b64) => setPhotos((ps) => ps.map((p, j) => (j === i ? b64 : p)))}
            />
          ))}
        </div>

        {notice && <div className="kd-ledger-notice" role="status">{notice}</div>}
        {error && <div className="kd-ledger-warning" role="status">{error}</div>}

        <div className="kd-ledger-form-actions">
          <button type="button" className="kd-ledger-submit" onClick={handleDownload} disabled={busy || !canSubmit}>
            {busy ? '생성 중…' : 'HWPX 생성'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeomsuForm;
