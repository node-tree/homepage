// ═══════════════════════════════════════════════════════════════════════
// Results.tsx — 마을기록 (/iso#results)
//   프로그램 7개가 낳은 산출물 허브. 상단 매체 필터(전체/지도/영상/기록).
//   설계 정본: Figma 「웹지도 설계」 01 IA — 프로그램별 + 필터 하이브리드.
//   ⚠️ 링크 없는 항목은 '준비 중'으로 남긴다(빈 카드를 만들지 않는다).
//
//   편집: 꿈다락 로그인 시 카드마다 인라인 편집(제목·설명·링크·매체) + 항목 추가/삭제.
//         저장소는 지도와 같은 signal-map-content 문서의 `_results` 키(별도 API 불필요).
//         정적 기본 목록 위에 오버라이드를 덮는 구조 — 삭제는 hidden 플래그(복구 가능).
// ═══════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useState } from 'react';
import { PROGRAMS } from './data';
import { signalMapAPI } from '../../services/api';
import { useKkumdarakAuth } from './KkumdarakAuthContext';
import './results.css';

type Medium = 'map' | 'video' | 'archive';

interface ResultItem {
  id: string;
  programId: string;       // PROGRAMS.id — 없으면 'etc'
  title: string;
  medium: Medium;
  desc: string;
  href?: string;           // 내부 해시(#signal-map-3d) 또는 외부 URL(유튜브 등). 없으면 준비 중
  external?: boolean;
  hidden?: boolean;
}

const MEDIUM_LABEL: Record<Medium, string> = { map: '지도', video: '영상', archive: '기록' };
const MEDIA: Medium[] = ['map', 'video', 'archive'];
const isExternal = (href?: string) => !!href && /^https?:\/\//.test(href);

const BASE: ResultItem[] = [
  {
    id: 'signal-map',
    programId: 'maeul-signal',
    title: '마을의 신호 — 마을지도',
    medium: 'map',
    desc: '참여자가 나무판 위에 지은 마을을 웹 위에 다시 세웠습니다. 돌려 보고, 신호를 눌러 이야기와 소리를 듣습니다.',
    href: '#signal-map-3d',
  },
  {
    id: 'sound-map',
    programId: 'sound-diary',
    title: '장암면 소리지도',
    medium: 'map',
    desc: '마을에서 들리는 소리와 사라진 소리를 한 장의 지도로 그렸습니다. 번호를 누르면 그 자리의 소리가 납니다.',
    href: '#sound-map',
  },
  {
    id: 'jangam-book',
    programId: 'jangam-chaekjeong',
    title: '장암 책정',
    medium: 'video',
    desc: '마을 곳곳에 놓인 작은 책 정거장과 주민이 남긴 기록의 영상.',
  },
  {
    id: 'memory-station',
    programId: 'memory-station',
    title: '기억순환 정류장',
    medium: 'video',
    desc: '정류장에서 주고받은 세대 간 이야기를 담은 영상.',
  },
  {
    id: 'hand-memory',
    programId: 'hand-memory',
    title: '손의 기억',
    medium: 'archive',
    desc: '손으로 만들고 다듬은 작업들, 몸이 기억하는 마을의 기술.',
  },
  {
    id: 'scape-diary',
    programId: 'scape-diary',
    title: '풍경일기 영상',
    medium: 'video',
    desc: '계절마다 변하는 장암의 풍경을 담은 영상 기록.',
  },
  {
    id: 'festival-film',
    programId: 'goodbye-again',
    title: '〈다시, 안녕〉 축제 기록영상',
    medium: 'video',
    desc: '한 해의 기록·소리·풍경이 모이는 마을 축제의 기록.',
  },
];

const EMPTY_FORM = { title: '', desc: '', href: '', medium: 'video' as Medium, programId: '' };

const Results: React.FC = () => {
  const { authed } = useKkumdarakAuth();
  const [filter, setFilter] = useState<'all' | Medium>('all');
  const [store, setStore] = useState<any>({});          // signal-map-content 전체 문서
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { signalMapAPI.get().then(setStore); }, []);

  const results: ResultItem[] = useMemo(() => {
    const ov = (store._results || {}) as Record<string, Partial<ResultItem>>;
    const extra = (store._resultsAdded || []) as ResultItem[];
    return [...BASE, ...extra]
      .map((r) => ({ ...r, ...(ov[r.id] || {}) }))
      .filter((r) => !r.hidden);
  }, [store]);

  const items = useMemo(
    () => (filter === 'all' ? results : results.filter((r) => r.medium === filter)),
    [filter, results],
  );
  const programName = (id: string) => PROGRAMS.find((p) => p.id === id)?.name ?? '';

  const persist = async (next: any) => {
    setSaving(true);
    try {
      await signalMapAPI.save(next);
      setStore(next);
      setEditingId(null);
    } catch (e: any) {
      alert(e?.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (r: ResultItem) => {
    setEditingId(r.id);
    setForm({ title: r.title, desc: r.desc, href: r.href || '', medium: r.medium, programId: r.programId });
  };

  const saveEdit = () => {
    if (!editingId) return;
    const patch = {
      title: form.title.trim(),
      desc: form.desc.trim(),
      medium: form.medium,
      programId: form.programId,
      href: form.href.trim() || undefined,
    };
    const added = (store._resultsAdded || []) as ResultItem[];
    if (added.some((a) => a.id === editingId)) {
      // 직접 추가한 항목은 목록 자체를 갱신
      persist({ ...store, _resultsAdded: added.map((a) => (a.id === editingId ? { ...a, ...patch } : a)) });
    } else {
      persist({ ...store, _results: { ...(store._results || {}), [editingId]: patch } });
    }
  };

  const addItem = () => {
    const id = `r-${Date.now().toString(36)}`;
    const item: ResultItem = { id, programId: '', title: '새 기록', medium: 'video', desc: '' };
    const next = { ...store, _resultsAdded: [...((store._resultsAdded || []) as ResultItem[]), item] };
    setStore(next);
    startEdit(item);
    signalMapAPI.save(next).catch((e: any) => alert(e?.message || '저장 실패'));
  };

  const removeItem = (r: ResultItem) => {
    if (!window.confirm(`「${r.title}」 항목을 목록에서 지울까요?`)) return;
    const added = (store._resultsAdded || []) as ResultItem[];
    if (added.some((a) => a.id === r.id)) {
      persist({ ...store, _resultsAdded: added.filter((a) => a.id !== r.id) });
    } else {
      persist({ ...store, _results: { ...(store._results || {}), [r.id]: { ...(store._results?.[r.id] || {}), hidden: true } } });
    }
  };

  return (
    <section className="kd-section kd-results">
      <header className="kd-results-head">
        <h2>마을기록</h2>
        <p>프로그램에서 만들어진 지도와 영상, 기록을 한자리에 모았습니다. 준비되는 대로 하나씩 열립니다.</p>
      </header>

      <div className="kd-results-filters" role="tablist" aria-label="매체 필터">
        {(['all', ...MEDIA] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`kd-results-chip${filter === f ? ' on' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? '전체' : MEDIUM_LABEL[f as Medium]}
          </button>
        ))}
        {authed && (
          <button className="kd-results-chip kd-results-chip--add" onClick={addItem} disabled={saving}>
            + 기록 추가
          </button>
        )}
      </div>

      <ul className="kd-results-grid">
        {items.map((r) => {
          const ready = !!r.href;
          const ext = r.external ?? isExternal(r.href);
          if (editingId === r.id) {
            return (
              <li key={r.id} className="kd-results-card is-editing">
                <div className="kd-results-form">
                  <label>제목
                    <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </label>
                  <label>설명
                    <textarea rows={3} value={form.desc} onChange={(e) => setForm((f) => ({ ...f, desc: e.target.value }))} />
                  </label>
                  <label>링크 (유튜브 URL 또는 #signal-map-3d)
                    <input value={form.href} placeholder="https://youtu.be/…"
                      onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))} />
                  </label>
                  <label>매체
                    <select value={form.medium} onChange={(e) => setForm((f) => ({ ...f, medium: e.target.value as Medium }))}>
                      {MEDIA.map((m) => <option key={m} value={m}>{MEDIUM_LABEL[m]}</option>)}
                    </select>
                  </label>
                  <label>프로그램
                    <select value={form.programId} onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))}>
                      <option value="">(연결 없음)</option>
                      {PROGRAMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                  <div className="kd-results-formrow">
                    <button onClick={saveEdit} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
                    <button onClick={() => setEditingId(null)} disabled={saving}>취소</button>
                  </div>
                </div>
              </li>
            );
          }
          const inner = (
            <>
              <span className="kd-results-medium">{MEDIUM_LABEL[r.medium]}</span>
              <h3>{r.title}</h3>
              {programName(r.programId) && <p className="kd-results-program">{programName(r.programId)}</p>}
              <p className="kd-results-desc">{r.desc}</p>
              <span className="kd-results-cta">{ready ? '열어 보기 →' : '준비 중'}</span>
            </>
          );
          return (
            <li key={r.id} className={`kd-results-card${ready ? '' : ' is-pending'}`}>
              {ready ? (
                <a href={r.href} {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{inner}</a>
              ) : (
                <div aria-disabled="true">{inner}</div>
              )}
              {authed && (
                <div className="kd-results-tools">
                  <button onClick={() => startEdit(r)}>편집</button>
                  <button className="danger" onClick={() => removeItem(r)}>삭제</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default Results;
