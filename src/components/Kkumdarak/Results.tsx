// ═══════════════════════════════════════════════════════════════════════
// Results.tsx — 마을의 기록 (/iso#results)
//   프로그램 7개가 낳은 산출물을 한데 모으는 허브. 상단 매체 필터(전체/지도/영상/기록).
//   설계 정본: Figma 「웹지도 설계」 01 IA — 프로그램별 + 필터 하이브리드.
//   ⚠️ 링크 없는 항목은 '준비 중'으로 남긴다(빈 카드를 만들지 않는다).
// ═══════════════════════════════════════════════════════════════════════
import React, { useMemo, useState } from 'react';
import { PROGRAMS } from './data';
import './results.css';

type Medium = 'map' | 'video' | 'archive';

interface ResultItem {
  id: string;
  programId: string;       // PROGRAMS.id — 없으면 'etc'
  title: string;
  medium: Medium;
  desc: string;
  href?: string;           // 내부 해시(#signal-map-3d) 또는 외부 URL. 없으면 준비 중
  external?: boolean;
}

const MEDIUM_LABEL: Record<Medium, string> = { map: '지도', video: '영상', archive: '기록' };

const RESULTS: ResultItem[] = [
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
    desc: '마을에서 들리는 소리와 사라진 소리를 한 장의 지도로 그렸습니다.',
  },
  {
    id: 'jangam-book',
    programId: 'jangam-chaekjeong',
    title: '장암 책정 — 마을 책의 정거장',
    medium: 'archive',
    desc: '마을 곳곳에 놓인 작은 책 정거장과 주민이 남긴 기록.',
  },
  {
    id: 'memory-station',
    programId: 'memory-station',
    title: '기억순환 정류장',
    medium: 'archive',
    desc: '정류장에서 주고받은 세대 간 이야기의 구술 아카이브.',
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

const Results: React.FC = () => {
  const [filter, setFilter] = useState<'all' | Medium>('all');
  const items = useMemo(
    () => (filter === 'all' ? RESULTS : RESULTS.filter((r) => r.medium === filter)),
    [filter],
  );
  const programName = (id: string) => PROGRAMS.find((p) => p.id === id)?.name ?? '';

  return (
    <section className="kd-section kd-results">
      <header className="kd-results-head">
        <h2>마을의 기록</h2>
        <p>프로그램에서 만들어진 지도와 영상, 기록을 한자리에 모았습니다. 준비되는 대로 하나씩 열립니다.</p>
      </header>

      <div className="kd-results-filters" role="tablist" aria-label="매체 필터">
        {(['all', 'map', 'video', 'archive'] as const).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={`kd-results-chip${filter === f ? ' on' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? '전체' : MEDIUM_LABEL[f]}
          </button>
        ))}
      </div>

      <ul className="kd-results-grid">
        {items.map((r) => {
          const ready = !!r.href;
          const inner = (
            <>
              <span className="kd-results-medium">{MEDIUM_LABEL[r.medium]}</span>
              <h3>{r.title}</h3>
              {programName(r.programId) && (
                <p className="kd-results-program">{programName(r.programId)}</p>
              )}
              <p className="kd-results-desc">{r.desc}</p>
              <span className="kd-results-cta">{ready ? '열어 보기 →' : '준비 중'}</span>
            </>
          );
          return (
            <li key={r.id} className={`kd-results-card${ready ? '' : ' is-pending'}`}>
              {ready ? (
                <a
                  href={r.href}
                  {...(r.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {inner}
                </a>
              ) : (
                <div aria-disabled="true">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default Results;
