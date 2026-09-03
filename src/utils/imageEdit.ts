// ═══════════════════════════════════════════════════════════════
// 파괴 편집(원본 교체)용 canvas 파이프라인
//   회전(90° 단위) · 좌우/상하 반전 · 크롭 · 리사이즈를 브라우저에서 처리해
//   "같은 경로·같은 파일명"으로 재업로드할 Blob 을 만든다.
//
//   설계 메모
//   · 적용 순서: 크롭(원본 좌표계) → 축소 → 회전 → 반전.
//     canvas 변환은 나중에 호출한 것이 안쪽(먼저 적용)이므로
//     translate → scale(반전) → rotate 순으로 걸어 "결과 이미지 기준" 반전이 되게 한다.
//     (rotate 를 먼저 걸면 90° 회전 상태에서 '좌우 반전'이 상하로 보여 사용자가 혼란스럽다.)
//   · EXIF orientation: createImageBitmap(blob, {imageOrientation:'from-image'}) 로 흡수.
//     옵션 미지원 브라우저는 <img> 폴백(모던 브라우저는 image-orientation:from-image 가 기본).
//   · GIF/SVG 는 파괴 편집 대상에서 제외한다(애니메이션 손실·벡터 래스터화).
//   · 업로드 정책과 일관되게 긴 변 2400px 상한을 유지한다(utils/imageResize 와 동일 값).
// ═══════════════════════════════════════════════════════════════

export const MAX_EDGE = 2400;
/**
 * 재인코딩 품질 — 업로드 파이프라인(utils/imageResize.ts)과 동일한 0.82로 통일.
 *
 * 실측 근거: `_workspace/09_media/harness/quality-bench.js` (로그 quality-bench.log)
 *   14,338B 원본(400x240)을 90° 회전해 재인코딩했을 때
 *     q=1.00 → 66,295B (4.62x)   q=0.95 → 22,301B (1.56x)
 *     q=0.90 → 18,540B (1.29x)   q=0.82 → 16,517B (1.15x)   q=0.70 → 14,785B (1.03x)
 *   품질 1.0 부근에서 용량이 급격히 폭증하고, 0.9와 0.82의 차이는 1.12배다.
 *   원본을 "교체"하는 동작이라 증가분이 무료 3GB 한도를 직접 갉아먹으므로
 *   기존 업로드 정책과 같은 값을 쓴다(정책 이원화 방지가 주된 이유).
 *
 * 주의: PNG(image/png)는 무손실이라 이 값과 무관하며 용량이 커질 수 있다.
 *       그래서 편집 패널에 원본/결과 용량을 나란히 표시한다.
 */
export const JPEG_QUALITY = 0.82;

export type Rotate = 0 | 90 | 180 | 270;

/** 정규화 크롭 사각형(0~1). null 이면 전체. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EditOps {
  rotate: Rotate;
  flipH: boolean;
  flipV: boolean;
  crop: CropRect | null;
  /** 긴 변 상한(px). 지정 없으면 MAX_EDGE */
  maxEdge?: number;
}

export const IDENTITY_OPS: EditOps = { rotate: 0, flipH: false, flipV: false, crop: null };

export function isIdentity(ops: EditOps): boolean {
  return (
    ops.rotate === 0 &&
    !ops.flipH &&
    !ops.flipV &&
    (!ops.crop || (ops.crop.x <= 0.0005 && ops.crop.y <= 0.0005 && ops.crop.w >= 0.999 && ops.crop.h >= 0.999))
  );
}

export function extOf(nameOrUrl: string): string {
  const clean = nameOrUrl.split('?')[0].split('#')[0];
  const m = clean.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : '';
}

export type OutputMime = 'image/png' | 'image/jpeg' | 'image/webp';

/**
 * 파괴 편집 허용 확장자 — "화이트리스트"다.
 *   블랙리스트(gif/svg 만 제외)로 두면 .avif/.bmp/.tiff 같은 확장자가 통과한 뒤
 *   JPEG 바이트로 인코딩되어 원본 이름(.avif)을 덮어써 파일이 영구 손상된다.
 *   확장자와 실제 바이트 포맷이 반드시 일치해야 하므로, 캔버스가 인코딩할 수 있는
 *   포맷만 허용한다.
 */
export const DESTRUCTIVE_EXTS = ['jpg', 'jpeg', 'png', 'webp'] as const;

/** 확장자 → 저장 MIME. 확장자와 실제 인코딩 포맷을 반드시 일치시킨다. */
export function outputMime(nameOrUrl: string): OutputMime {
  const e = extOf(nameOrUrl);
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * 이 브라우저의 canvas 가 해당 MIME 으로 인코딩할 수 있는가.
 *   toDataURL/toBlob 은 미지원 MIME 이면 조용히 PNG 로 폴백한다 —
 *   그대로 두면 확장자와 내용이 어긋난 파일을 업로드하게 된다.
 */
export function canEncodeMime(mime: string): boolean {
  if (mime === 'image/png' || mime === 'image/jpeg') return true; // 스펙상 필수
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    return c.toDataURL(mime).indexOf(`data:${mime}`) === 0;
  } catch {
    return false;
  }
}

/** 파괴 편집 가능 여부 — 화이트리스트 + 실제 인코딩 지원 여부. */
export function canEditDestructive(nameOrUrl: string): boolean {
  const e = extOf(nameOrUrl);
  if (!(DESTRUCTIVE_EXTS as readonly string[]).includes(e)) return false;
  return canEncodeMime(outputMime(nameOrUrl));
}

export function destructiveBlockReason(nameOrUrl: string): string | null {
  const e = extOf(nameOrUrl);
  if (!e) return '확장자를 알 수 없어 편집할 수 없습니다.';
  if (e === 'gif') return 'GIF는 원본 교체 편집을 지원하지 않습니다(애니메이션이 단일 프레임으로 손실됩니다).';
  if (e === 'svg') return 'SVG는 벡터 파일이라 원본 교체 편집을 지원하지 않습니다.';
  if (!(DESTRUCTIVE_EXTS as readonly string[]).includes(e)) {
    return `.${e} 는 원본 교체 편집을 지원하지 않습니다(브라우저가 이 형식으로 다시 저장할 수 없어, 내용과 확장자가 어긋난 파일로 원본을 덮어쓸 위험이 있습니다). 지원 형식: ${DESTRUCTIVE_EXTS.join(', ')}`;
  }
  if (!canEncodeMime(outputMime(nameOrUrl))) {
    return `이 브라우저는 .${e} 형식으로 다시 저장할 수 없습니다. 다른 브라우저에서 시도해주세요.`;
  }
  return null;
}

export type Decoded = ImageBitmap | HTMLImageElement;

export function decodedSize(d: Decoded): { width: number; height: number } {
  if ('naturalWidth' in d) return { width: d.naturalWidth, height: d.naturalHeight };
  return { width: d.width, height: d.height };
}

/**
 * ImageKit 원본 URL(또는 Blob)을 캔버스에 그릴 수 있는 형태로 디코딩한다.
 *   · URL 은 fetch → blob 으로 받는다(캔버스 오염 방지. ImageKit 은 CORS 허용).
 *   · fetch 가 막히면 <img crossOrigin="anonymous"> 로 폴백한다.
 */
export async function decodeImage(source: string | Blob): Promise<Decoded> {
  let blob: Blob | null = null;

  if (typeof source === 'string') {
    try {
      // 변환 파라미터가 붙지 않은 "진짜 원본"을 받아야 한다 — 호출측에서 ?tr= 없는 URL 전달.
      const res = await fetch(source, { mode: 'cors', cache: 'no-store' });
      if (!res.ok) throw new Error(`원본을 불러오지 못했습니다 (${res.status})`);
      blob = await res.blob();
    } catch (e: any) {
      // CORS 로 fetch 가 막힌 경우 — img 태그 폴백(캔버스 오염 시 toBlob 에서 다시 실패한다).
      return await loadImageElement(source, true);
    }
  } else {
    blob = source;
  }

  if (typeof createImageBitmap === 'function') {
    try {
      // EXIF orientation 반영.
      //   TS 4.9 의 lib.dom 은 imageOrientation 을 'none'|'flipY' 로만 알고 있어(구 스펙)
      //   'from-image' 를 모른다 → unknown 경유 캐스팅. 런타임(모던 브라우저)에서는 유효하며,
      //   미지원 엔진은 옵션을 무시하거나 throw 하고 아래 폴백으로 내려간다.
      return await createImageBitmap(blob, {
        imageOrientation: 'from-image',
      } as unknown as ImageBitmapOptions);
    } catch {
      try {
        return await createImageBitmap(blob);
      } catch {
        /* 아래 img 폴백 */
      }
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    return await loadImageElement(url, false);
  } finally {
    // onload 이후 해제해도 이미 디코딩된 이미지라 안전.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function loadImageElement(src: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지 디코딩에 실패했습니다.'));
    img.src = src;
  });
}

/**
 * 정규화 크롭 → 원본 픽셀 좌표. previewSize 와 applyEdits 가 **같은 함수**를 쓴다.
 *   예전에는 두 곳이 각자 계산했고 경계 클램프가 서로 달라서
 *   (previewSize 는 x+w>1 을 보정하지 않고, applyEdits 는 남은 폭으로 잘랐다)
 *   범위를 벗어난 사각형에서 "표시된 결과 치수 ≠ 실제 저장 치수" 가 될 수 있었다.
 */
export function resolveCrop(
  srcW: number,
  srcH: number,
  crop: CropRect | null
): { sx: number; sy: number; sw: number; sh: number } {
  if (!crop) return { sx: 0, sy: 0, sw: srcW, sh: srcH };
  const sx = Math.min(Math.round(clamp01(crop.x) * srcW), Math.max(0, srcW - 1));
  const sy = Math.min(Math.round(clamp01(crop.y) * srcH), Math.max(0, srcH - 1));
  const sw = Math.max(1, Math.min(Math.round(clamp01(crop.w) * srcW), srcW - sx));
  const sh = Math.max(1, Math.min(Math.round(clamp01(crop.h) * srcH), srcH - sy));
  return { sx, sy, sw, sh };
}

/** 긴 변 상한에 맞춘 축소 치수. previewSize·applyEdits 공용. */
export function fitToMaxEdge(w: number, h: number, maxEdge: number): { w: number; h: number } {
  const longEdge = Math.max(w, h);
  if (longEdge <= maxEdge) return { w, h };
  const s = maxEdge / longEdge;
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/** 편집 결과의 최종 픽셀 치수를 미리 계산(미리보기 표기용). applyEdits 와 동일 경로. */
export function previewSize(
  srcW: number,
  srcH: number,
  ops: EditOps
): { width: number; height: number } {
  const { sw, sh } = resolveCrop(srcW, srcH, ops.crop);
  const fit = fitToMaxEdge(sw, sh, ops.maxEdge ?? MAX_EDGE);
  const swap = ops.rotate === 90 || ops.rotate === 270;
  return swap ? { width: fit.h, height: fit.w } : { width: fit.w, height: fit.h };
}

export interface EditResult {
  blob: Blob;
  width: number;
  height: number;
  mime: string;
}

/**
 * 편집을 적용해 업로드용 Blob 을 만든다.
 *   반환 width/height 는 "실제 캔버스 픽셀 치수" — 회전 90/270 이면 가로세로가 뒤바뀐다.
 */
export async function applyEdits(
  decoded: Decoded,
  ops: EditOps,
  opts: { mime?: OutputMime; quality?: number } = {}
): Promise<EditResult> {
  const { width: srcW, height: srcH } = decodedSize(decoded);
  if (!srcW || !srcH) throw new Error('이미지 크기를 읽지 못했습니다.');

  // 1) 크롭 — 원본 좌표계에서 잘라낼 영역(previewSize 와 동일한 resolveCrop 사용)
  const { sx: sxc, sy: syc, sw: swc, sh: shc } = resolveCrop(srcW, srcH, ops.crop);

  // 2) 축소 — 긴 변 상한(previewSize 와 동일한 fitToMaxEdge 사용)
  const fit = fitToMaxEdge(swc, shc, ops.maxEdge ?? MAX_EDGE);
  const dw = fit.w;
  const dh = fit.h;

  // 3) 회전 — 90/270 이면 출력 캔버스의 가로세로가 뒤바뀐다
  const swap = ops.rotate === 90 || ops.rotate === 270;
  const outW = swap ? dh : dw;
  const outH = swap ? dw : dh;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 만들 수 없습니다.');

  const mime = opts.mime ?? 'image/jpeg';
  if (mime === 'image/jpeg') {
    // JPEG 는 알파가 없다 — 투명 영역이 검게 나오지 않도록 흰색으로 채운다.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
  }
  ctx.imageSmoothingQuality = 'high';

  ctx.translate(outW / 2, outH / 2);
  // 반전을 rotate 보다 "바깥"에 걸어 결과 이미지 기준으로 뒤집히게 한다.
  ctx.scale(ops.flipH ? -1 : 1, ops.flipV ? -1 : 1);
  if (ops.rotate) ctx.rotate((ops.rotate * Math.PI) / 180);
  ctx.drawImage(decoded as CanvasImageSource, sxc, syc, swc, shc, -dw / 2, -dh / 2, dw, dh);

  const blob = await canvasToBlob(canvas, mime, opts.quality ?? JPEG_QUALITY);
  if (!blob) throw new Error('이미지 인코딩에 실패했습니다(캔버스가 오염되었을 수 있습니다).');

  // 마지막 방어선: toBlob 은 미지원 MIME 이면 조용히 PNG 로 폴백한다.
  // 그대로 올리면 확장자와 내용이 어긋난 파일이 원본을 덮어써 복구가 불가능하다.
  if (blob.type && blob.type !== mime) {
    throw new Error(
      `이 브라우저가 ${mime} 로 저장하지 못했습니다(실제 ${blob.type}). 확장자와 내용이 어긋나므로 저장을 중단했습니다.`
    );
  }

  return { blob, width: outW, height: outH, mime };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality);
    } catch {
      resolve(null); // 캔버스 오염(tainted) 등
    }
  });
}
