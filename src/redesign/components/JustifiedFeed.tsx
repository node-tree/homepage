import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ikUrl } from '../../utils/ikUrl';

// ════════════════════════════════════════════════════════════════════════
// JustifiedFeed → 균일 격자(2026-08-30 사용자 결정 "추천대로": 정돈 + 세로 도판 안 자르기).
//   · 3열(모바일 2열) · 칸 비율 3:2 고정 · 가로 도판은 칸을 채우고(cover), 세로(비율<1)는 여백 두고 담는다(contain).
//   · 봉인(흐림) 없음, 호버는 제목만 주서. 모든 글 수록, 도판 없는 글은 점선 칸.
//   · 비율은 미리 읽어(모듈+sessionStorage 캐시) cover/contain 을 정한다 — 읽기 전엔 cover.
//   (글줄 정렬 layout() 은 남겨 둔다 — 되돌릴 때 쓴다.)
// ════════════════════════════════════════════════════════════════════════

export interface FeedEntry {
  id: string;
  href: string;
  src?: string | null;
  title: string;
  /** Mono 메타 조각. `dim` 이면 옅게 */
  meta: { text: string; dim?: boolean }[];
}

const CACHE_KEY = 'nt.dims.v1';
const ABSENT_RATIO = 3 / 2;
const dims = new Map<string, number>();
try {
  const raw = sessionStorage.getItem(CACHE_KEY);
  if (raw) Object.entries(JSON.parse(raw) as Record<string, number>).forEach(([k, v]) => dims.set(k, v));
} catch {
  /* 저장소 불가 환경 — 캐시 없이 간다 */
}
function remember(src: string, ratio: number) {
  dims.set(src, ratio);
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(dims)));
  } catch {
    /* ignore */
  }
}

/** 도판 URL(썸네일 폭 고정 — 행 높이 ≤ 420px 이므로 1200 이면 레티나까지 넉넉하다) */
export function feedSrc(src: string): string {
  return ikUrl(src.startsWith('//') ? `https:${src}` : src, { w: 1200 });
}

interface Row { items: (FeedEntry & { ratio: number })[]; height: number }

/** 글줄 정렬 — 목표 높이에 가장 가깝게 행을 끊는다. 마지막 행은 목표 높이 이하로만. */
export function layout(entries: (FeedEntry & { ratio: number })[], width: number, targetH: number, gap: number, maxPerRow: number): Row[] {
  const rows: Row[] = [];
  let cur: (FeedEntry & { ratio: number })[] = [];
  let sum = 0;
  const heightFor = (items: typeof cur, s: number) => (width - gap * (items.length - 1)) / s;
  entries.forEach((e) => {
    cur.push(e);
    sum += e.ratio;
    const h = heightFor(cur, sum);
    if (h <= targetH || cur.length >= maxPerRow) {
      // 한 장 더 넣기 전이 더 목표에 가까웠다면 그쪽을 택한다(첫 장은 예외)
      if (cur.length > 1 && h < targetH) {
        const prev = cur.slice(0, -1);
        const prevH = heightFor(prev, sum - e.ratio);
        if (Math.abs(prevH - targetH) < Math.abs(h - targetH) && prevH <= targetH * 1.35) {
          rows.push({ items: prev, height: prevH });
          cur = [e];
          sum = e.ratio;
          return;
        }
      }
      rows.push({ items: cur, height: Math.min(h, targetH * 1.35) });
      cur = [];
      sum = 0;
    }
  });
  if (cur.length) rows.push({ items: cur, height: Math.min(heightFor(cur, sum), targetH) });
  return rows;
}

const JustifiedFeed: React.FC<{ entries: FeedEntry[] }> = ({ entries }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [, bump] = useState(0);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([en]) => setWidth(Math.round(en.contentRect.width)));
    ro.observe(el);
    setWidth(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  // 비율을 미리 읽는다 — 모르는 것만.
  useEffect(() => {
    let alive = true;
    entries.forEach((e) => {
      if (!e.src || dims.has(e.src)) return;
      const img = new Image();
      img.onload = () => {
        if (!alive || !img.naturalWidth || !img.naturalHeight) return;
        remember(e.src as string, img.naturalWidth / img.naturalHeight);
        bump((n) => n + 1);
      };
      img.src = feedSrc(e.src);
    });
    return () => {
      alive = false;
    };
  }, [entries]);

  const entriesWithRatio = useMemo(() => entries.map((e) => ({ ...e, ratio: e.src ? dims.get(e.src) ?? null : null })), [entries, dims.size]); // eslint-disable-line react-hooks/exhaustive-deps
  void width; // ResizeObserver 는 되돌림(글줄 정렬)용으로 남긴다

  return (
    <div className="gfeed" ref={hostRef}>
      {entriesWithRatio.map((e) => {
        const portrait = e.ratio !== null && e.ratio < 0.9;
        return (
          <figure className={`gfig${e.src ? '' : ' absent'}${portrait ? ' portrait' : ''}`} key={e.id}>
            <Link to={e.href} className="gwin" aria-label={e.title}>
              {e.src ? <img src={feedSrc(e.src)} alt={e.title} loading="lazy" decoding="async" /> : <span className="gabsent">ABSENT · 도판 미기재</span>}
            </Link>
            <figcaption>
              <Link to={e.href} className="h">
                {e.title}
              </Link>
              <span className="m">
                {e.meta.map((m, i) => (
                  <span key={i} className={m.dim ? 't' : undefined}>
                    {m.text}
                  </span>
                ))}
              </span>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
};

export default React.memo(JustifiedFeed);
