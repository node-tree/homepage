import React from 'react';
import { Link } from 'react-router-dom';
import { IndexRow as IndexRowData } from '../data/works';

/**
 * IndexRow — 텍스트 인덱스 한 행. 제목 밑줄의 **선질이 곧 확신도**(설계 §2.2):
 *   measured 2px 실선 · stated 1px 실선 · proxy 1px 점선 · absent 는 값 자리를 비운다(`—`).
 */
const IndexRow: React.FC<{ row: IndexRowData }> = ({ row }) => {
  const title = <span className={`t ${row.confidence}`}>{row.title}</span>;
  return (
    <div className="row">
      {row.slug ? <Link to={`/work/${row.slug}`}>{title}</Link> : title}
      <span className="md">{row.medium}</span>
      <span className="yr">{row.year}</span>
      <span className={`pl${row.place ? '' : ' absent'}`}>{row.place ?? '—'}</span>
    </div>
  );
};

export default React.memo(IndexRow);
