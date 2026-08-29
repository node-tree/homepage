import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ikUrl } from '../../utils/ikUrl';

// ════════════════════════════════════════════════════════════════════════
// JustifiedFeed — 목록의 도판 흐름(2026-08-30 재설계).
//   원칙(사용자 "글 리스트 이미지가 이상하다" → 리서치: Cargo Justify · 에디토리얼 인덱스):
//   · 도판은 **원본 비율 그대로**(강제 창 비율·크롭 없음). 포스터는 세로로, 설치 전경은 가로로 선다.
//   · 한 행의 높이가 같다 — 글줄처럼 정렬(justify). 마지막 행은 늘리지 않는다.
//   · 봉인(72% 흐림)을 두지 않는다. 도판은 처음부터 보인다. 호버는 제목 색만 주서(朱書).
//   · 모든 글이 도판 흐름에 실린다(8건 제한 폐기). 도판 없는 글은 점선 창(absent)으로 자리만.
//   · 비율은 이미지를 한 번 미리 읽어 알아낸다(모듈 캐시 + sessionStorage). 읽기 전엔 3:2 로 잡고
//     읽히면 재배치 — 자리 변동을 최소화하려고 행 높이는 고정 목표치를 쓴다.
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
function layout(entries: (FeedEntry & { ratio: number })[], width: number, targetH: number, gap: number, maxPerRow: number): Row[] {
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

  const rows = useMemo(() => {
    if (!width) return [];
    const mobile = width < 560;
    const tablet = width < 900;
    const gap = mobile ? 14 : 24;
    const targetH = mobile ? Math.min(width * 0.9, 300) : tablet ? 260 : 340;
    const maxPerRow = mobile ? 1 : tablet ? 3 : 4;
    const withRatio = entries.map((e) => ({ ...e, ratio: e.src ? dims.get(e.src) ?? ABSENT_RATIO : ABSENT_RATIO }));
    return layout(withRatio, width, targetH, gap, maxPerRow).map((r) => ({ ...r, gap }));
  }, [entries, width, dims.size]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="jfeed" ref={hostRef}>
      {rows.map((row, ri) => (
        <div className="jrow" key={ri} style={{ gap: row.gap }}>
          {row.items.map((e) => {
            const w = Math.round(e.ratio * row.height);
            return (
              <figure className={`jfig${e.src ? '' : ' absent'}`} key={e.id} style={{ width: w, flex: `0 1 ${w}px` }}>
                <Link to={e.href} className="jwin" style={{ height: Math.round(row.height) }} aria-label={e.title}>
                  {e.src ? (
                    <img src={feedSrc(e.src)} alt={e.title} loading="lazy" decoding="async" />
                  ) : (
                    <span className="jabsent">ABSENT · 도판 미기재</span>
                  )}
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
      ))}
    </div>
  );
};

export default React.memo(JustifiedFeed);
