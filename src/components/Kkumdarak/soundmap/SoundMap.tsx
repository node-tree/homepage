// ═══════════════════════════════════════════════════════════════════════
// SoundMap.tsx — 장암면 소리지도 (/iso#sound-map)
//   손그림 청음지도 도판(public/sound-map.svg) 위에 18지점 마커를 얹어
//   누르면 그 자리의 소리를 듣는다. 실선=지금 들리는 소리 / 점선=사라진 소리.
//   음원은 후입력: soundSpots.ts 기본값 위에 서버 오버라이드(_sound)를 덮는다.
//   로그인 시 카드에서 소리 URL·설명 편집.
// ═══════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SOUND_SPOTS, KIND_LABEL, SoundSpot } from './soundSpots';
import { signalMapAPI } from '../../../services/api';
import { useKkumdarakAuth } from '../KkumdarakAuthContext';
import './soundmap.css';

const SoundMap: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { authed } = useKkumdarakAuth();
  const [store, setStore] = useState<any>({});
  const [openN, setOpenN] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ sub: '', ono: '', audio: '' });
  const [saving, setSaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { signalMapAPI.get().then(setStore); }, []);

  const spots: SoundSpot[] = useMemo(() => {
    const ov = (store._sound || {}) as Record<string, Partial<SoundSpot>>;
    return SOUND_SPOTS.map((s) => ({ ...s, ...(ov[String(s.n)] || {}) }));
  }, [store]);

  const open = useMemo(() => spots.find((s) => s.n === openN) ?? null, [spots, openN]);

  useEffect(() => {
    setEditing(false);
    if (open) setForm({ sub: open.sub || '', ono: open.ono || '', audio: open.audio || '' });
    if (audioRef.current) { audioRef.current.pause(); }   // 지점 전환 시 이전 소리 정지
  }, [openN]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveEdit = async () => {
    if (!openN) return;
    setSaving(true);
    try {
      const next = {
        ...store,
        _sound: {
          ...(store._sound || {}),
          [String(openN)]: { sub: form.sub.trim(), ono: form.ono.trim(), audio: form.audio.trim() || undefined },
        },
      };
      await signalMapAPI.save(next);
      setStore(next);
      setEditing(false);
    } catch (e: any) {
      alert(e?.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sndmap">
      <header className="sndmap-head">
        <h1>장암면 소리지도</h1>
        <p>실선은 지금 들리는 소리, 점선은 사라진 소리입니다. 번호를 눌러 들어 보세요.</p>
      </header>
      <button className="sndmap-back" onClick={onBack}>← 이소 홈으로</button>

      <div className="sndmap-stage">
        <div className="sndmap-plate">
          <img src="/sound-map-v2.png" alt="장암면 소리지도 도판" />
          {spots.map((s) => (
            <button
              key={s.n}
              className={`sndmap-dot${s.kind === 'gone' ? ' is-gone' : ''}${openN === s.n ? ' is-open' : ''}${s.audio ? ' has-audio' : ''}`}
              style={{ left: `${s.u * 100}%`, top: `${s.v * 100}%` }}
              onClick={() => setOpenN(openN === s.n ? null : s.n)}
              aria-label={`${s.n}. ${s.name}`}
            >
              <span>{s.n}</span>
            </button>
          ))}
        </div>
      </div>

      {open && (
        <aside className="sndmap-card" role="dialog" aria-label={`${open.name} 소개`}>
          <button className="sndmap-card-close" onClick={() => setOpenN(null)} aria-label="닫기">✕</button>
          <span className="sndmap-card-tag">{open.n} · {KIND_LABEL[open.kind]}</span>
          <h2>{open.name}</h2>
          {open.sub && <p className="sndmap-card-sub">{open.sub}</p>}
          {open.ono && <p className="sndmap-card-ono">{open.ono}</p>}
          {open.audio ? (
            <audio ref={audioRef} className="sndmap-card-audio" controls preload="none" src={open.audio} />
          ) : (
            <p className="sndmap-card-draft">이 자리의 소리는 채록되는 대로 채워집니다.</p>
          )}
          {authed && !editing && (
            <button className="sndmap-edit-btn" onClick={() => setEditing(true)}>이 지점 편집</button>
          )}
          {authed && editing && (
            <div className="sndmap-edit">
              <label>설명
                <input value={form.sub} onChange={(e) => setForm((f) => ({ ...f, sub: e.target.value }))} />
              </label>
              <label>의성어
                <input value={form.ono} onChange={(e) => setForm((f) => ({ ...f, ono: e.target.value }))} />
              </label>
              <label>소리 URL
                <input value={form.audio} placeholder="https://…mp3"
                  onChange={(e) => setForm((f) => ({ ...f, audio: e.target.value }))} />
              </label>
              <div className="sndmap-edit-row">
                <button onClick={saveEdit} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
                <button onClick={() => setEditing(false)} disabled={saving}>취소</button>
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
};

export default SoundMap;
