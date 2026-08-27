import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import IndexRow from '../components/IndexRow';
import NtPage from '../components/NtPage';
import PlateFrame from '../components/PlateFrame';
import { FEATURES, INDEX_GROUPS, WORKS_COUNT, WORKS_NOTE, WORKS_SOURCE } from '../data/works';

/**
 * Works — 도판 흐름(정간 어긋남) + 텍스트 인덱스(확신도 선질). 설계 §5.2.
 *   궤적 필터는 목업의 정적 토글을 실제 동작으로 옮긴 것(항목은 숨지 않고 그룹 단위로 걸러진다).
 */
/** 궤적 토글 — 목업의 정적 <a> 를 **URL 로 되는 링크**로. 공유·뒤로가기가 그대로 산다. */
const Toggle: React.FC<{ on: boolean; to: string; label: string }> = ({ on, to, label }) => (
  <Link to={to} className={on ? 'on' : undefined} aria-current={on ? 'true' : undefined}>
    {label}
  </Link>
);

const Works: React.FC = () => {
  const [params] = useSearchParams();
  const traj = params.get('traj') ?? 'all';
  const groups = traj === 'all' ? INDEX_GROUPS : INDEX_GROUPS.filter((g) => g.id === traj);

  return (
    <NtPage
      path="/work"
      title="NODE TREE | Works — 작품"
      description="NODE TREE의 작품 24점. 공생직조 〈이물〉·이토록 고요한 파동·위성악보 연작. 도판이 없는 작품은 자리를 비워 둔다."
      keywords="NODE TREE 작품, 공생직조 이물, 위성악보, 에디아포닉, 허음망무, 소달구지"
    >
      <section className="pagehead">
        <div className="lab">WORKS · {WORKS_COUNT}</div>
        <h1>
          작품<em>Works</em>
        </h1>
        <div className="note">{WORKS_NOTE}</div>
      </section>
      <div className="hair" />

      <section className="feed">
        {FEATURES.map((w) => (
          <article key={w.slug} className={`item i${w.slot}`}>
            <div className="fig">
              <Link to={`/work/${w.slug}`}>
                <PlateFrame still={w.still} absent={w.absent} />
              </Link>
              <div className="cap">
                <p>
                  <span className="h">{w.title}</span>
                </p>
                <div className="m">
                  <span>{w.spec}</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>

      <div className="hair dae" style={{ marginTop: 64 }} />

      <section className="index">
        <div className="rows">
          {groups.map((g) => (
            <React.Fragment key={g.id}>
              <div className="grp">{g.label}</div>
              {g.rows.map((r) => (
                <IndexRow key={r.title} row={r} />
              ))}
            </React.Fragment>
          ))}
          <div className="src">{WORKS_SOURCE}</div>
        </div>

        <div className="filt">
          <b>궤적 TRAJECTORY</b>
          <Toggle on={traj === 'all'} to="/work" label={`ALL ${WORKS_COUNT}`} />
          <br />
          {/* 목업 순서 = 시간순(탐지 → 공명) */}
          {[...INDEX_GROUPS].reverse().map((g) => (
            <React.Fragment key={g.id}>
              <Toggle on={traj === g.id} to={`/work?traj=${g.id}`} label={g.short} />
              <br />
            </React.Fragment>
          ))}
          <div className="key">
            <b>확신도 CONFIDENCE</b>
            measured · 확정
            <br />
            stated · 설명
            <br />
            proxy · 예정
            <br />
            absent · 미기재
          </div>
        </div>
      </section>
    </NtPage>
  );
};

export default Works;
