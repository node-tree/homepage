import React, { useCallback, useEffect, useState } from 'react';
import './checklistView.css';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import { kkumdarakAdminAPI } from '../../../services/kkumdarakAdminApi';

// ─────────────────────────────────────────────────────────────────────────────
// 체크리스트 트래커 — kind='personnel'(인건비·4대보험 월별) | 'settlement'(정산 단계).
//   템플릿(백엔드 정본 기준) + 저장된 체크 상태. 토글 시 저장(상태만, 금액 없음).
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  kind: 'personnel' | 'settlement';
}

const ChecklistView: React.FC<Props> = ({ kind }) => {
  const { logout } = useKkumdarakAuth();
  const [template, setTemplate] = useState<any>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
    setLoading(true);
    kkumdarakAdminAPI
      .getChecklist(kind, { signal: c.signal })
      .then((d) => {
        setTemplate(d.template);
        setChecked(d.checked || {});
      })
      .catch((err: any) => {
        if (err?.name === 'AbortError') return;
        if (onAuthErr(err)) return;
        setError(err?.message || '체크리스트를 불러오지 못했습니다.');
      })
      .finally(() => setLoading(false));
    return () => c.abort();
  }, [kind, onAuthErr]);

  const toggle = async (k: string) => {
    const next = { ...checked, [k]: !checked[k] };
    setChecked(next);
    setSaving(true);
    setError('');
    try {
      await kkumdarakAdminAPI.saveChecklist(kind, next);
    } catch (err: any) {
      if (onAuthErr(err)) return;
      setError(err?.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className="kd-checklist"
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label="불러오는 중"
      >
        <span className="kd-skel-sronly">불러오는 중…</span>
        <span className="kd-skel-bar" style={{ width: '32%', height: 14 }} aria-hidden="true" />
        <div className="kd-check-list" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="kd-skel-bar" style={{ width: `${72 - i * 6}%`, height: 18 }} />
          ))}
        </div>
      </div>
    );
  }
  if (!template) return <p className="kd-forms-error">{error || '템플릿이 없습니다.'}</p>;

  const Box = ({ k, label }: { k: string; label: string }) => (
    <label className="kd-check-item">
      <input type="checkbox" checked={!!checked[k]} onChange={() => toggle(k)} />
      <span className={checked[k] ? 'is-done' : ''}>{label}</span>
    </label>
  );

  return (
    <div className="kd-checklist">
      {saving && <span className="kd-check-saving">저장 중…</span>}
      {error && <p className="kd-forms-error">{error}</p>}

      {/* 인건비: 월별 그리드 + 일회성 */}
      {kind === 'personnel' && (
        <>
          <p className="kd-checklist-sub">{template.person}</p>
          <div className="kd-check-table-wrap">
            <table className="kd-admin-table">
              <thead>
                <tr>
                  <th>월</th>
                  {template.monthItems.map((it: any) => (
                    <th key={it.key} title={it.label}>{it.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {template.months.map((m: string) => (
                  <tr key={m}>
                    <td className="kd-admin-td-name">{m}</td>
                    {template.monthItems.map((it: any) => {
                      const k = `${m}:${it.key}`;
                      return (
                        <td key={k} className="kd-check-cell">
                          <input type="checkbox" checked={!!checked[k]} onChange={() => toggle(k)} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="kd-checklist-sub">일회성</div>
          <div className="kd-check-list">
            {template.oneTime.map((it: any) => (
              <Box key={it.key} k={`once:${it.key}`} label={it.label} />
            ))}
          </div>
        </>
      )}

      {/* 정산: 단계 리스트 */}
      {kind === 'settlement' && (
        <div className="kd-check-list">
          {template.steps.map((s: any) => (
            <div key={s.key} className="kd-check-step">
              <label className="kd-check-item">
                <input type="checkbox" checked={!!checked[`step:${s.key}`]} onChange={() => toggle(`step:${s.key}`)} />
                <span className={checked[`step:${s.key}`] ? 'is-done' : ''}>{s.label}</span>
              </label>
              <span className="kd-check-due">{s.due}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChecklistView;
