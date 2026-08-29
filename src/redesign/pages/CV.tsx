import React, { Suspense, lazy, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AdminLine, State } from '../components/bits';
import NtPage from '../components/NtPage';
import VerticalSeal from '../components/VerticalSeal';
import { useCv } from '../db';
import { useEditMode } from '../edit';

// 제자리 편집기는 편집 모드에서만 내려받는다.
const CvEdit = lazy(() => import('../edit/CvEdit'));

// ════════════════════════════════════════════════════════════════════════
// CV(/cv) — 내용은 DB(/api/cv 의 줄글), 판식만 v5.
//   목업 정본: _workspace/03_mock/v5/index-archive.html
//     좌 = 연도 Mono 고정 · 가운데 = 분류 표찰 + 항목 · 우 = 장소
//     섹션([개인전]·[전시/공연]…)은 2px 계선의 head 행 + 우단 앵커.
//   원문은 `연도 항목_장소_장소` 꼴이므로 밑줄(_)을 장소 칸으로 옮겨 앉힌다 —
//   **글자는 하나도 버리지 않는다**(위치만 바뀐다).
// ════════════════════════════════════════════════════════════════════════

interface CvRow {
  year: string | null;
  entry: string;
  place: string | null;
}
interface CvSection {
  label: string;
  anchor: string;
  rows: CvRow[];
}

const YEAR_RE = /^((?:19|20)\d{2}(?:\s*[-–~—]\s*(?:현재|(?:19|20)\d{2}))?)\s+(.+)$/;

export function parseCv(text: string): CvSection[] {
  const sections: CvSection[] = [];
  let current: CvSection = { label: '프로필', anchor: 'sec-0', rows: [] };
  sections.push(current);

  text.split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    const head = line.match(/^\[(.+)\]$/);
    if (head) {
      current = { label: head[1], anchor: `sec-${sections.length}`, rows: [] };
      sections.push(current);
      return;
    }
    const m = line.match(YEAR_RE);
    const body = m ? m[2] : line;
    const parts = body.split('_').map((s) => s.trim()).filter(Boolean);
    current.rows.push({
      year: m ? m[1].replace(/\s+/g, '') : null,
      entry: parts[0] ?? body,
      place: parts.length > 1 ? parts.slice(1).join(' · ') : null,
    });
  });

  return sections.filter((s) => s.rows.length > 0);
}

const CV: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { editing, setEditing } = useEditMode();
  const { data, error, loading, reload } = useCv();
  const sections = useMemo(() => (data ? parseCv(data.content) : []), [data]);

  const years = sections
    .flatMap((s) => s.rows.map((r) => r.year))
    .filter(Boolean)
    .map((y) => (y as string).slice(0, 4))
    .sort();
  const span = years.length ? `${years[0]}—${years[years.length - 1]}` : '';
  const total = sections.reduce((n, s) => n + s.rows.length, 0);

  return (
    <NtPage
      path="/cv"
      title="NODE TREE | CV — 이력"
      description="이화영+정강현 NODE TREE의 전시 이력, 레지던시, 수상 내역."
      keywords="NODE TREE CV, 이화영 이력, 정강현 이력, 전시 이력"
    >
      <section className="pagehead">
        <VerticalSeal place="head" mark="履歷" roman="CV" />
        <div className="lab">
          {data?.title || 'CV'}
          {span ? ` · ${span}` : ''}
        </div>
        <h1>
          {data?.subtitle || '활동 이력'}
          <em>{data?.title || 'CV'}</em>
        </h1>
      </section>
      <div className="hair dae" />

      {loading && <State text="LOADING · 이력을 불러오는 중…" />}
      {error && <State text={`ERROR · ${error}`} onRetry={reload} />}

      {data && editing && (
        <Suspense fallback={<State text="LOADING · 편집기를 불러오는 중…" />}>
          <CvEdit data={data} onSaved={reload} onClose={() => setEditing(false)} />
        </Suspense>
      )}

      {sections.length > 0 && !editing && (
        <section className="arch">
          <div className="list">
            {sections.map((s) => {
              let lastYear: string | null = null;
              return (
                <React.Fragment key={s.anchor}>
                  <div className="yrow head" id={s.anchor}>
                    <span className="y">{s.rows.find((r) => r.year)?.year?.slice(0, 4) ?? '·'}</span>
                    <span className="tag">{s.rows.length}건</span>
                    <span className="e">
                      <b>{s.label}</b>
                    </span>
                    <span className="pl absent">—</span>
                  </div>
                  {s.rows.map((r, k) => {
                    const same = r.year !== null && r.year === lastYear;
                    if (r.year) lastYear = r.year;
                    return (
                      <div className="yrow" key={`${s.anchor}-${k}`}>
                        <span className={`y${r.year && !same ? '' : ' dim'}`}>{r.year && !same ? r.year : '·'}</span>
                        <span className="tag">{s.label}</span>
                        <span className="e">{r.entry}</span>
                        <span className={`pl${r.place ? '' : ' absent'}`}>{r.place ?? '—'}</span>
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
            <div className="src">출처 · nodetree.kr DB /api/cv — {total}행. 밑줄(_)로 구분된 장소는 우단으로 옮겼다.</div>
            {isAuthenticated && <AdminLine page="cv" />}
          </div>

          <div className="anchors">
            <b>ANCHOR</b>
            {sections.map((s) => (
              <React.Fragment key={s.anchor}>
                <a href={`#${s.anchor}`}>{s.label}</a>
                <br />
              </React.Fragment>
            ))}
            <div className="cnt">
              <b>COUNT</b>
              {sections.map((s, i) => (
                <React.Fragment key={s.anchor}>
                  {i > 0 && <br />}
                  {s.label} {s.rows.length}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>
      )}
    </NtPage>
  );
};

export default CV;
