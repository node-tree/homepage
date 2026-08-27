import React from 'react';
import { Link } from 'react-router-dom';
import { FeedItem } from '../data/feed';
import PlateFrame from './PlateFrame';

/**
 * FeedRow — Current 피드 한 항목.
 *   `.i1~.i6` 클래스가 도판이 놓이는 정간 열을 정한다(대강 3·5·8·11·13·16 어긋남).
 *   도판은 봉인 72% → 호버 개봉 100%.
 */
const FeedRow: React.FC<{ item: FeedItem }> = ({ item }) => {
  const plate = <PlateFrame still={item.still} absent={item.absent} />;
  return (
    <article className={`item i${item.slot}`}>
      <div className="fig">
        {item.href ? <Link to={item.href}>{plate}</Link> : plate}
        <div className="cap">
          {item.paras.map((p, i) => (
            <p key={i}>
              {i === 0 && item.head ? <span className="h">{item.head}</span> : null}
              {i === 0 && item.head ? ' ' : null}
              {p}
            </p>
          ))}
          <div className="m">
            {item.meta.map((m) => (
              <span key={m.text} className={m.kind}>
                {m.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
};

export default React.memo(FeedRow);
