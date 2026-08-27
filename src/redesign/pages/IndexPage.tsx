import React from 'react';
import NtPage from '../components/NtPage';
import { rich } from '../components/rich';
import {
  ARCHIVE,
  ARCHIVE_ANCHORS,
  ARCHIVE_COUNTS,
  ARCHIVE_NOTE,
  ARCHIVE_SOURCE,
} from '../data/index-archive';

/**
 * Index — 전시·상영·공공예술·수상·레지던시·출판·언론 단일 리스트(연도 역순, 설계 §5.4).
 *   앵커 #cv · #press · #publication. /cv 는 App 라우팅에서 /index#cv 로 넘긴다.
 */
const IndexPage: React.FC = () => (
  <NtPage
    path="/index"
    title="NODE TREE | Index — 인덱스"
    description="NODE TREE 2016—2026 활동 연혁. 전시·상영·공공예술·수상·레지던시·출판·언론을 연도 역순 단일 리스트로."
    keywords="NODE TREE CV, 이화영 이력, 정강현 이력, 전시 이력, 수상, 레지던시"
  >
    <section className="pagehead">
      <div className="lab">INDEX · 2016—2026</div>
      <h1>
        인덱스<em>Index</em>
      </h1>
      <div className="note">{ARCHIVE_NOTE}</div>
    </section>
    <div className="hair dae" />

    <section className="arch">
      <div className="list">
        {ARCHIVE.map((r, i) => (
          <div key={i} className={`yrow${r.head ? ' head' : ''}`} id={r.anchor}>
            <span className={`y${r.year ? '' : ' dim'}`}>{r.year ?? '·'}</span>
            <span className="tag">{r.tag}</span>
            <span className="e">{rich(r.entry)}</span>
            <span className={`pl${r.place ? '' : ' absent'}`}>{r.place ?? '—'}</span>
          </div>
        ))}
        <div className="src">{ARCHIVE_SOURCE}</div>
      </div>

      <div className="anchors">
        <b>ANCHOR</b>
        {ARCHIVE_ANCHORS.map((a) => (
          <React.Fragment key={a.id}>
            <a href={`#${a.id}`}>{a.label}</a>
            <br />
          </React.Fragment>
        ))}
        <div className="cnt">
          <b>COUNT</b>
          {ARCHIVE_COUNTS.map((c, i) => (
            <React.Fragment key={c}>
              {i > 0 && <br />}
              {c}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  </NtPage>
);

export default IndexPage;
