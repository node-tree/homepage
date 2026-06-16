// ═══════════════════════════════════════════════════════════════
// 「마을소식」 — 이미지 기반 소식지 · 데이터 모델 + 호(號) 병합/상태
//   콘텐츠를 직접 이미지로 만들어 업로드하는 소식지. 한 호 = 이미지 여러 장.
//   톤은 kkumdarak(흰 배경·Gothic/Jua·둥근 두꺼운 테두리 카드·kd 팔레트)으로 통일.
//
//   다음 호 추가법:
//     1) 편집자 로그인 → 「+ 새 소식지」.
//     2) 호수(자동 제안)·제목·날짜 입력, 소식지 이미지를 업로드(여러 장, 순서 = 표시 순서).
//     3) 「발행」 또는 「준비중으로 저장」.
//
//   상태:
//     · 유효 호 = 정적 NEWS_ISSUES(현재 빈 배열) + 백엔드 issues 병합(같은 id 백엔드 우선).
//     · 공개 상태(published/draft)는 settings.newsStatus 버킷 + issue.status 폴백.
//     · 콜드스타트: 백엔드 미도착 동안 정적 목록만으로 낙관 렌더.
//
//   보도 기사(외부 링크 카드):
//     · 소식지 호와 같은 가판대에 카드로 보이되, 클릭 시 원문 사이트로 새 탭 이동만 한다.
//     · 별도 articles 배열로 저장 — issues(호) 직렬화/정규화와 충돌하지 않게 둔다.
// ═══════════════════════════════════════════════════════════════

// ── 호(號) 공개 상태 ──────────────────────────────────────────────
//   published = 발행(비로그인 포함 누구나 열람) / draft = 공개 전 준비중(편집자만).
//   런타임 토글은 settings.newsStatus 버킷에 영속되며 정적 status 보다 우선한다.
//   유효 상태 = override[id] ?? issue.status ?? 'published'.
export type NewsStatus = 'published' | 'draft';

// 호 id → 상태 오버라이드 맵(settings.newsStatus 와 동일 형태).
export type NewsStatusMap = Record<string, NewsStatus>;

// ── 소식지 이미지 ─────────────────────────────────────────────────
//   src = ImageKit URL(표시 시 ikUrl 로 사이징). 배열 순서 = 표시 순서.
export interface NewsImage {
  src: string;
  alt?: string;
}

// ── 호(號) ───────────────────────────────────────────────────────
export interface NewsIssue {
  id: string;
  no: number;             // 호수
  title: string;          // 호 제목
  date: string;           // 날짜 표기(예: '2026.6')
  status?: NewsStatus;    // 정적 기본 상태(미지정 = published). 런타임 override 가 덮는다.
  images: NewsImage[];    // 업로드한 소식지 이미지(여러 장, 순서 = 표시 순서)
}

// ── 보도 기사(외부 링크 카드) ─────────────────────────────────────
//   호(이미지 스택을 내부 read 뷰로 여는 것)와 달리, 기사는 가판대에서 카드로
//   보이되 클릭하면 원문 사이트로 새 탭 이동만 한다(내부 뷰 없음).
//   thumb 는 NewsImage(ImageKit URL) 재사용.
export interface NewsArticle {
  id: string;
  title: string;          // 기사 제목
  outlet: string;         // 언론사
  date: string;           // 게재일 표기 문자열(예: '2026.6.1')
  url: string;            // 원문 URL(새 탭으로 연다)
  thumb?: NewsImage;      // 대표 이미지(선택)
}

// ── 매체 정체성(헤더/푸터 텍스트) ─────────────────────────────────
export const NEWS_KICKER = '소식지';
export const NEWS_TITLE = '마을소식';
export const NEWS_SUBTITLE = '충남 부여군 장암면 · 꿈다락 문화예술학교 이소(異素)';

// ── 유효 상태 해석 ────────────────────────────────────────────────
//   런타임 override(서버 newsStatus) → 정적 issue.status → 'published' 순으로 폴백.
//   settings 미도착(콜드스타트) 구간에는 override 가 undefined 라 정적 status 로 낙관 렌더한다.
export function resolveIssueStatus(
  issue: Pick<NewsIssue, 'id' | 'status'>,
  override?: NewsStatusMap,
): NewsStatus {
  return (override && override[issue.id]) ?? issue.status ?? 'published';
}

// ── 정적 호 ───────────────────────────────────────────────────────
//   사용자가 직접 이미지로 업로드 → 정적 내장 호 없음(빈 배열).
export const NEWS_ISSUES: NewsIssue[] = [];

// 백엔드 편집 사본 페이로드(villageNewsAPI 가 주고받는 형태).
//   issues 는 Mixed(스키마 무관) — id → NewsIssue 맵.
//   articles 는 보도 기사(외부 링크 카드) 배열 — 표시 순서 = 배열 순서.
export interface VillageNewsData {
  issues: Record<string, NewsIssue>;
  articles?: NewsArticle[];
}

// ── 호 병합 ──────────────────────────────────────────────────────
//   유효 호 목록 = 정적 NEWS_ISSUES + 백엔드 issues. 같은 id 면 백엔드가 우선.
//   정렬: no 내림차순(최신 위), 동률은 id. backend 가 undefined(콜드스타트 미도착)면 정적만.
export function mergeIssues(
  backend?: Record<string, NewsIssue> | null,
): NewsIssue[] {
  const map = new Map<string, NewsIssue>();
  // 1) 정적 기준선.
  for (const it of NEWS_ISSUES) map.set(it.id, it);
  // 2) 백엔드 사본으로 덮어쓰기/추가(같은 id 우선).
  if (backend && typeof backend === 'object') {
    for (const id of Object.keys(backend)) {
      const b = backend[id];
      if (b && typeof b === 'object' && typeof b.id === 'string') {
        map.set(b.id, normalizeIssue(b));
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    if (b.no !== a.no) return b.no - a.no;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// 백엔드(Mixed)에서 온 호를 안전한 NewsIssue 형태로 정규화(이미지 배열 보장).
function normalizeIssue(b: any): NewsIssue {
  const images: NewsImage[] = Array.isArray(b.images)
    ? b.images
        .filter((im: any) => im && typeof im.src === 'string')
        .map((im: any) => ({ src: im.src, alt: typeof im.alt === 'string' ? im.alt : '' }))
    : [];
  return {
    id: String(b.id),
    no: Number.isFinite(b.no) ? Number(b.no) : 1,
    title: typeof b.title === 'string' ? b.title : `제${b.no ?? 1}호`,
    date: typeof b.date === 'string' ? b.date : '',
    status: b.status === 'draft' ? 'draft' : b.status === 'published' ? 'published' : undefined,
    images,
  };
}

// ── 기사 정규화/검증 ──────────────────────────────────────────────
// URL 최소 형식 검증 — http(s) 절대 URL 만 통과.
export function isValidArticleUrl(url: string): boolean {
  const v = (url || '').trim();
  if (!v) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// 백엔드(Mixed)에서 온 기사 배열을 안전한 NewsArticle[] 로 정규화.
//   id/title/outlet/date/url 문자열 보장, thumb 는 src 가 있을 때만 유지.
//   url 이 비었거나 비문자열인 항목은 떨어뜨린다(깨진 카드 방지).
export function normalizeArticles(raw: any): NewsArticle[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a: any) => a && typeof a === 'object' && typeof a.url === 'string' && a.url.trim())
    .map((a: any, i: number): NewsArticle => {
      const thumbSrc = a.thumb && typeof a.thumb === 'object' && typeof a.thumb.src === 'string'
        ? a.thumb.src
        : '';
      return {
        id: typeof a.id === 'string' && a.id ? a.id : `article-${i}-${Date.now().toString(36)}`,
        title: typeof a.title === 'string' ? a.title : '',
        outlet: typeof a.outlet === 'string' ? a.outlet : '',
        date: typeof a.date === 'string' ? a.date : '',
        url: String(a.url).trim(),
        thumb: thumbSrc
          ? { src: thumbSrc, alt: typeof a.thumb.alt === 'string' ? a.thumb.alt : '' }
          : undefined,
      };
    });
}

// 정적(코드 내장) 호인지 — 에디터에서 "삭제" 대신 "정적본으로 되돌리기"가 되는 호.
//   현재 정적 호가 없으므로 항상 false(인터페이스만 유지).
export function isStaticIssue(id: string): boolean {
  return NEWS_ISSUES.some((it) => it.id === id);
}

// 다음 호수 제안값(현재 최대 no + 1). 빈 목록이면 1.
export function suggestNextNo(issues: NewsIssue[]): number {
  return issues.reduce((mx, it) => Math.max(mx, it.no), 0) + 1;
}
