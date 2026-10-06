import React from 'react';
import { Link } from 'react-router-dom';
import { DbHeader, DbPost, postYear } from '../db';
import VerticalSeal from './VerticalSeal';
import '../collection.css';

/** 두 목록은 같은 행·글줄·링크 자리를 공유한다. 다른 페이지의 Note는 바꾸지 않는다. */
export const CollectionHead: React.FC<{ header: DbHeader; count: number; commons?: boolean }> = ({ header, count, commons }) => {
  const [definition, ...support] = header.subtitle.split(/\r?\n/);
  return <>
    <section className="pagehead collection-head">
      <VerticalSeal place="head" mark={commons ? '共有地' : '作品'} roman={commons ? 'COMMONS' : 'WORK'} />
      <div className="lab">{header.title} · {count || '—'}</div>
      <h1>{header.title}</h1>
      <div className="note collection-intro">
        <p className="collection-definition">{definition.trim()}</p>
        <p className="collection-support">{support.join(' ').trim()}</p>
        <div className="collection-link">
          {commons && <a href="https://isoartlab.com" target="_blank" rel="noopener noreferrer">이소 異素 · isoartlab.com ↗</a>}
        </div>
      </div>
    </section>
    <div className="hair" />
  </>;
};

export const YearFilter: React.FC<{ posts: DbPost[]; year: string; base: string; category?: string }> = ({ posts, year, base, category }) => {
  const years = Array.from(new Set(posts.map(postYear).filter(Boolean))).sort((a, b) => Number(b) - Number(a));
  if (posts.some((post) => !postYear(post))) years.push('unknown');
  const target = (value: string) => {
    const params = new URLSearchParams();
    if (value !== 'all') params.set('yr', value);
    if (category && category !== '전체') params.set('cat', category);
    return `${base}${params.toString() ? `?${params}` : ''}`;
  };
  return <nav className="collection-filter" aria-label="연도 필터">
    {['all', ...years].map((value) => <Link key={value} to={target(value)}
      className={year === value ? 'on' : undefined} aria-current={year === value ? 'page' : undefined}>
      {value === 'all' ? `전체 ${posts.length}` : value === 'unknown' ? '연도 미상' : value}
    </Link>)}
  </nav>;
};
