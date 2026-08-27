// ════════════════════════════════════════════════════════════════════════
// db.ts — v5 페이지가 쓰는 DB 접속부.
//   원칙(2026-08-27 지시): **정본은 DB다**. v5 는 판식만 바꾼다 — 정적 복사본을 만들지 않는다.
//   레거시 컴포넌트(src/components/*.tsx)가 쓰던 서비스(src/services/api.js)를 그대로 재사용한다.
//   ※ api.js 는 자체 캐시(localStorage 5분)를 갖고 있어 레거시/v5 가 같은 캐시를 공유한다.
// ════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { aboutAPI, contactAPI, cvAPI, filedAPI, workAPI } from '../services/api';

/** ART WORK · COMMONS 글 1건 — /api/work · /api/filed 응답 그대로. */
export interface DbPost {
  id: string;
  title: string;
  content: string;
  date: string;
  images?: string[];
  thumbnail?: string | null;
  category?: string;
  sortOrder?: number;
  imageLayout?: unknown[];
}

export interface DbHeader {
  title: string;
  subtitle: string;
}

export type Kind = 'work' | 'filed';

const apiOf = (kind: Kind) => (kind === 'work' ? workAPI : filedAPI);

export interface Async<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** 공통 비동기 로더 — cleanup 으로 언마운트 후 setState 를 막는다(누수 방지). */
function useAsync<T>(run: () => Promise<T>, deps: React.DependencyList): Async<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let alive = true;
    setError(null);
    run()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, error, loading: data === null && error === null, reload };
}

/** 글 목록(정렬은 서버 sortOrder 순서 그대로). */
export function usePosts(kind: Kind): Async<DbPost[]> {
  return useAsync<DbPost[]>(async () => {
    const res = await apiOf(kind).getAllPosts();
    if (!res.success) throw new Error(res.message || '글을 불러오는데 실패했습니다.');
    return res.data as DbPost[];
  }, [kind]);
}

/** 페이지 표제(제목·부제) — DB 미응답 시 폴백 문구는 레거시와 동일하게 둔다. */
export function useHeader(kind: Kind): DbHeader {
  const fallback: DbHeader =
    kind === 'work' ? { title: 'ART WORK', subtitle: '작업 기록' } : { title: 'COMMONS', subtitle: '기록/아카이브' };
  const [header, setHeader] = useState<DbHeader>(fallback);

  useEffect(() => {
    let alive = true;
    const load = kind === 'work' ? workAPI.getWorkHeader() : filedAPI.getFiledHeader();
    load
      .then((res: any) => {
        if (!alive || !res?.success || !res.data) return;
        setHeader({ title: res.data.title || fallback.title, subtitle: res.data.subtitle || fallback.subtitle });
      })
      .catch(() => {
        /* 폴백 유지 */
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  return header;
}

export interface DbAbout {
  title: string;
  content: string;
  htmlContent: string;
}

export function useAbout(): Async<DbAbout> {
  return useAsync<DbAbout>(async () => {
    const res = await aboutAPI.getAbout();
    if (!res.success) throw new Error(res.message || 'About 데이터를 불러오지 못했습니다.');
    return {
      title: res.data.title || 'ABOUT',
      content: res.data.content || '',
      htmlContent: res.data.htmlContent || '',
    };
  }, []);
}

export interface DbCv {
  title: string;
  subtitle: string;
  content: string;
}

export function useCv(): Async<DbCv> {
  return useAsync<DbCv>(async () => {
    const res = await cvAPI.getCV();
    if (!res.success || !res.data) throw new Error(res.message || 'CV 를 불러오지 못했습니다.');
    return {
      title: res.data.title || 'CV',
      subtitle: res.data.subtitle || '활동 이력',
      content: res.data.content || '',
    };
  }, []);
}

export interface DbContact {
  emails: string[];
  location: string;
  socialLinks: { name: string; url: string }[];
}

export function useContact(): Async<DbContact> {
  return useAsync<DbContact>(async () => {
    const res = await contactAPI.getContact();
    if (!res.success || !res.data) throw new Error(res.message || 'Contact 를 불러오지 못했습니다.');
    return {
      emails: res.data.emails || (res.data.email ? [res.data.email] : []),
      location: res.data.location || '',
      socialLinks: res.data.socialLinks || [],
    };
  }, []);
}

/** 리서치 아카이브(옵시디안 동기화) 여부 — 인증 불필요. */
export function useResearchSynced(postId?: string): boolean {
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (!postId) {
      setSynced(false);
      return;
    }
    let alive = true;
    workAPI
      .getResearchStatus(postId)
      .then((res: any) => {
        if (alive) setSynced(!!res?.data?.synced);
      })
      .catch(() => {
        if (alive) setSynced(false);
      });
    return () => {
      alive = false;
    };
  }, [postId]);
  return synced;
}

/** '2026. 5. 4.' · '2026-05-04' 등에서 연도 4자리만 뽑는다. 없으면 null(=결측). */
export function yearOf(date?: string): string | null {
  const m = (date || '').match(/(19|20)\d{2}/);
  return m ? m[0] : null;
}

/** 목록 메타용 — '2026. 5. 4.' → '2026.05.04' (Mono 정렬용) */
export function monoDate(date?: string): string {
  if (!date) return '';
  const m = (date || '').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return date.trim();
  return `${m[1]}.${m[2].padStart(2, '0')}.${m[3].padStart(2, '0')}`;
}

export { workAPI, filedAPI };
