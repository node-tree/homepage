/**
 * ImageKit URL 변환 헬퍼
 *
 * 실측으로 확정된 규칙 (ImageKit 무료플랜):
 * - 정적 이미지(JPG/PNG 등): `?tr=w-1600,f-auto` 명시 변환을 붙여야 대형 파일의 자동최적화
 *   400 에러가 복구되고 용량이 크게 줄어든다. → 반드시 변환 파라미터 적용.
 * - 애니메이션 GIF: `?tr=...` 를 붙이면 깨진다(37바이트 에러 응답). → 절대 변환 금지,
 *   무파라미터 원본 그대로 전송(ImageKit이 자동으로 용량을 줄여줌, 애니메이션 보존).
 * - ImageKit URL은 직접 호출해도 CORS/핫링크 문제 없음(프록시 불필요).
 */

const IK_HOST = 'ik.imagekit.io';

/** 쿼리스트링을 무시하고 확장자가 .gif 인지 판별(대소문자 무시) */
function isGif(url: string): boolean {
  return /\.gif(\?|#|$)/i.test(url);
}

/** ImageKit 호스트인지 판별 */
function isImageKit(url: string): boolean {
  return typeof url === 'string' && url.includes(IK_HOST);
}

export interface IkUrlOptions {
  /** 가로 리사이즈 폭(px). 기본 1600. */
  w?: number;
  /** 품질(1-100). 지정 시 q-{q} 부착. */
  q?: number;
}

/**
 * ImageKit URL 에 안전하게 변환 파라미터를 부착한다.
 * - ImageKit 호스트가 아니면 → 그대로 반환(변경 없음).
 * - .gif 이면 → 변환 미적용, 원본 그대로 반환.
 * - jpg/jpeg/png 등 → 쿼리가 없을 때만 `?tr=w-{w},f-auto`(+ q-{q}) 부착.
 *   이미 쿼리(`?`)가 있으면 중복 부착 금지.
 */
export function ikUrl(url: string | null | undefined, opts: IkUrlOptions = {}): string {
  if (!url) return url ?? '';
  // 프로토콜 상대 경로(//host/...) 보정
  let out = url.startsWith('//') ? `https:${url}` : url;

  if (!isImageKit(out)) return out; // 외부/로컬 URL 은 그대로
  if (isGif(out)) return out; // GIF 은 변환 금지
  if (out.includes('?')) return out; // 이미 쿼리 있으면 손대지 않음

  const w = opts.w ?? 1600;
  const parts = [`w-${w}`, 'f-auto'];
  if (typeof opts.q === 'number') parts.push(`q-${opts.q}`);
  return `${out}?tr=${parts.join(',')}`;
}

/**
 * HTML 문자열 내 `<img>` 태그의 src 만 골라 ikUrl 로 치환한다.
 * (video/iframe/a 등 다른 태그의 URL 은 건드리지 않는다 — 비이미지에 tr 을 붙이면 깨진다.)
 *
 * - 따옴표 종류(", ')를 백레퍼런스로 보존.
 * - src 가 첫 속성이 아니어도 매칭(`[^>]*?` ).
 * - 한글 경로 그대로 둠(브라우저가 UTF-8 인코딩).
 */
export function ikRewriteHtml(html: string | null | undefined, opts: IkUrlOptions = {}): string {
  if (!html) return html ?? '';
  return html.replace(
    /(<img\b[^>]*?\ssrc=)(["'])(.*?)\2/gi,
    (_m, pre: string, quote: string, src: string) => `${pre}${quote}${ikUrl(src, opts)}${quote}`
  );
}
