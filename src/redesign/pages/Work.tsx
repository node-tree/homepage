import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import MiniClock from '../components/MiniClock';
import NtPage from '../components/NtPage';
import PlateFrame from '../components/PlateFrame';
import VerticalMeta from '../components/VerticalMeta';
import { DetailBlock, FEATURES, fallbackDetail, findDetail, findFeature } from '../data/works';

type Chunk =
  | { kind: 'plate'; block: Extract<DetailBlock, { kind: 'plate' }> }
  | { kind: 'text'; blocks: Exclude<DetailBlock, { kind: 'plate' }>[] };

/** 도판 사이의 연속된 본문 블록을 한 덩어리로 묶는다. */
function groupBlocks(blocks: DetailBlock[]): Chunk[] {
  const out: Chunk[] = [];
  for (const b of blocks) {
    if (b.kind === 'plate') {
      out.push({ kind: 'plate', block: b });
    } else if (out.length && out[out.length - 1].kind === 'text') {
      (out[out.length - 1] as Extract<Chunk, { kind: 'text' }>).blocks.push(b);
    } else {
      out.push({ kind: 'text', blocks: [b] });
    }
  }
  return out;
}

/**
 * Work 상세 — 좌 3정간 세로쓰기 메타 / 본문 12정간 / 잔여 4정간 비움(설계 §5.3).
 *   우상단 56px 소형 시계는 `.detail` 안 absolute 라 헤더(56px) 바로 아래에서 시작한다
 *   — 고정 헤더 가림 함정을 피하려고 흐름 위(main padding-top) 에 얹는다.
 */
const Work: React.FC = () => {
  const { slug = '' } = useParams();
  const feature = findFeature(slug);
  if (!feature) return <Navigate to="/work" replace />;

  const i = FEATURES.indexOf(feature);
  const next = FEATURES[(i + 1) % FEATURES.length];
  const detail = findDetail(slug) ?? fallbackDetail(feature, next);

  return (
    <NtPage
      path={`/work/${slug}`}
      title={`NODE TREE | ${detail.title}`}
      description={`${detail.title} — ${feature.spec}`}
      keywords={`NODE TREE, ${detail.title}, 이화영, 정강현`}
    >
      <section className="detail">
        <MiniClock />
        <div className="meta">
          <VerticalMeta rows={detail.meta} />
        </div>
        <div className="txt">
          <h1 className="title">
            {detail.title}
            {detail.titleEn ? <em>{detail.titleEn}</em> : null}
          </h1>
          <div className="sub">{detail.sub}</div>

          {/* 도판(fw)과 본문(body)을 목업과 같은 덩어리로 묶는다 — 이어지는 p·h2 는 한 .body 안에
              있어야 `p + p` 여백과 h2 계선 간격이 목업과 같아진다. */}
          {groupBlocks(detail.blocks).map((chunk, k) =>
            chunk.kind === 'plate' ? (
              <div className="fw" key={k}>
                <PlateFrame still={chunk.block.still} absent={chunk.block.absent} />
                <div className="fcap">{chunk.block.caption}</div>
              </div>
            ) : (
              <div className="body" key={k} style={{ marginTop: 44 }}>
                {chunk.blocks.map((b, j) =>
                  b.kind === 'h2' ? <h2 key={j}>{b.text}</h2> : <p key={j}>{b.kind === 'p' ? b.text : null}</p>
                )}
              </div>
            )
          )}

          {detail.source ? (
            <div className="src" style={{ marginTop: 36 }}>
              {detail.source}
            </div>
          ) : null}
        </div>
      </section>

      <div className="nextwork">
        <Link to={`/work/${detail.next.slug}`}>
          <span>다음 작품 — {detail.next.title}</span>
          <span className="k">NEXT WORK →</span>
        </Link>
      </div>
    </NtPage>
  );
};

export default Work;
