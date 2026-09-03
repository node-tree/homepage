// ═══════════════════════════════════════════════════════════════
// ImageKit 변환 URL 빌더 — "비파괴 편집"용
//
//   ⚠️ utils/ikUrl.ts 와 역할이 다르다. 섞지 말 것.
//     · ikUrl: 렌더 파이프라인용. "쿼리가 이미 있으면 손대지 않는" 멱등 헬퍼.
//       사이트 전역이 의존하므로 이 파일은 ikUrl 을 import 하지도, 수정하지도 않는다.
//     · ikTransform(이 파일): 관리자가 편집 패널에서 명시적으로 만드는 변환 URL.
//       기존 ?tr= 을 "교체"한다(누적 금지 — 두 번 회전 걸리는 사고 방지).
//
//   공통 규칙(실측 기반, ikUrl 과 동일):
//     · ImageKit 호스트가 아니면 그대로 반환.
//     · GIF 는 변환 금지(?tr= 를 붙이면 37바이트 에러 응답 + 애니메이션 파괴).
//     · SVG 도 래스터 변환 대상이 아니므로 제외한다.
//
//   파라미터 약어는 ImageKit node SDK 의 supportedTransforms 맵을 정본으로 삼았다
//   (rt=rotate, fl=flip, w/h/ar/c/cm/fo/q/f/bl/r/bg, e-grayscale).
// ═══════════════════════════════════════════════════════════════

const IK_HOST = 'ik.imagekit.io';

export type IkRotate = 0 | 90 | 180 | 270;
export type IkFlip = 'none' | 'h' | 'v' | 'h_v';
export type IkFit = 'maintain_ratio' | 'at_max' | 'at_least' | 'force';

export interface IkTransformOptions {
  /** 회전(시계방향). ImageKit rt- */
  rotate?: IkRotate;
  /** 반전. ImageKit fl-h / fl-v / fl-h_v */
  flip?: IkFlip;
  width?: number | null;
  height?: number | null;
  /** 종횡비 크롭 — 'ar-16-9' 형태로 들어간다. cropMode 'extract' 와 함께 써야 잘린다. */
  aspect?: string | null;
  /** c- (리사이즈 방식) */
  fit?: IkFit | null;
  /** cm- (크롭 모드). 'extract' = 지정 비율로 잘라냄, 'pad_resize' = 여백 채움 */
  cropMode?: 'extract' | 'pad_resize' | null;
  /** fo- (초점). 'auto' 면 ImageKit 이 피사체 기준으로 자른다. */
  focus?: string | null;
  /** q- 1~100 */
  quality?: number | null;
  /** f- (auto 권장) */
  format?: 'auto' | 'jpg' | 'png' | 'webp' | 'avif' | null;
  grayscale?: boolean;
  /** bl- 1~100 */
  blur?: number | null;
  /** r- 값 또는 'max'(원형) */
  radius?: number | 'max' | null;
  /** bg- RRGGBB (pad_resize 여백색) */
  background?: string | null;
}

export const DEFAULT_TRANSFORM: IkTransformOptions = {
  rotate: 0,
  flip: 'none',
  width: null,
  height: null,
  aspect: null,
  fit: null,
  cropMode: null,
  focus: null,
  quality: null,
  format: 'auto',
  grayscale: false,
  blur: null,
  radius: null,
  background: null,
};

/** 쿼리스트링을 무시하고 확장자를 판별 */
function extOf(url: string): string {
  const clean = url.split('?')[0].split('#')[0];
  const m = clean.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
}

export function isImageKitUrl(url: string): boolean {
  return typeof url === 'string' && url.includes(IK_HOST);
}

/**
 * 변환을 적용할 수 있는 대상인가.
 *   · ImageKit 호스트가 아니면 불가(외부 URL)
 *   · GIF/SVG 는 변환 금지
 */
export function canTransform(url: string): boolean {
  if (!isImageKitUrl(url)) return false;
  const ext = extOf(url);
  return ext !== 'gif' && ext !== 'svg';
}

/** 변환 불가 사유(사용자 안내 문구). 가능하면 null. */
export function transformBlockReason(url: string): string | null {
  if (!isImageKitUrl(url)) return 'ImageKit 파일이 아니어서 변환할 수 없습니다.';
  const ext = extOf(url);
  if (ext === 'gif') return 'GIF는 변환 파라미터를 붙이면 애니메이션이 깨집니다(원본만 사용).';
  if (ext === 'svg') return 'SVG는 래스터 변환 대상이 아닙니다.';
  return null;
}

/** 옵션 → tr 파라미터 토큰 배열. 빈 배열이면 변환 없음. */
export function buildTransformTokens(o: IkTransformOptions): string[] {
  const t: string[] = [];
  if (o.rotate) t.push(`rt-${o.rotate}`); // 0 은 falsy — 별도 비교 불필요
  if (o.flip && o.flip !== 'none') t.push(`fl-${o.flip}`);
  if (o.width) t.push(`w-${Math.round(o.width)}`);
  if (o.height) t.push(`h-${Math.round(o.height)}`);
  if (o.aspect) t.push(`ar-${o.aspect}`);
  if (o.fit) t.push(`c-${o.fit}`);
  if (o.cropMode) t.push(`cm-${o.cropMode}`);
  if (o.focus) t.push(`fo-${o.focus}`);
  if (o.background) t.push(`bg-${o.background.replace(/^#/, '')}`);
  if (o.grayscale) t.push('e-grayscale');
  if (o.blur) t.push(`bl-${Math.round(o.blur)}`);
  if (o.radius) t.push(`r-${o.radius}`);
  if (o.quality) t.push(`q-${Math.round(o.quality)}`);
  if (o.format) t.push(`f-${o.format}`);
  return t;
}

/** 사람이 읽는 요약(‘rt-90,fl-h,w-1200,f-auto’). 없으면 '(변환 없음)'. */
export function describeTransform(o: IkTransformOptions): string {
  const t = buildTransformTokens(o);
  return t.length ? t.join(',') : '(변환 없음)';
}

/**
 * 변환 URL 생성.
 *   · 변환 불가(GIF/SVG/외부)면 원본 URL 을 그대로 반환한다(쿼리 제거).
 *   · 기존 ?tr= 은 "교체"한다 — 이미 회전이 걸린 URL 에 또 회전을 얹지 않기 위함.
 *   · tr 이외의 기존 쿼리는 보존한다(ik-* 등).
 */
export function ikTransformUrl(url: string | null | undefined, o: IkTransformOptions): string {
  if (!url) return '';
  const src = url.startsWith('//') ? `https:${url}` : url;
  if (!canTransform(src)) return src.split('?')[0];

  const [base, query = ''] = src.split('#')[0].split('?');
  const params = new URLSearchParams(query);
  params.delete('tr'); // 누적 금지 — 항상 새로 만든다

  const tokens = buildTransformTokens(o);
  if (tokens.length) params.set('tr', tokens.join(','));

  const qs = params.toString();
  // URLSearchParams 는 ','를 %2C 로 인코딩한다. ImageKit tr 은 쉼표 원문이 관례라 되돌린다.
  const decoded = qs.replace(/%2C/gi, ',').replace(/%2D/gi, '-');
  return decoded ? `${base}?${decoded}` : base;
}

/** 캐시 버스터 부착 — 원본을 덮어쓴 직후 미리보기를 강제로 갱신할 때만 사용. */
export function withCacheBuster(url: string, stamp: number = Date.now()): string {
  if (!url) return '';
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}ik-cb=${stamp}`;
}
