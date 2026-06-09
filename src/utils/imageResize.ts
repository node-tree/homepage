// ═══════════════════════════════════════════════════════════════
// 업로드 전 브라우저 자동 리사이즈 (canvas 기반)
//   · 긴 변 최대 2400px, JPEG quality ~0.82.
//   · 원본이 이미 2400px 이하이면 변환하지 않고 원본 그대로 반환.
//   · GIF 는 애니메이션 보존을 위해 절대 변환하지 않는다(원본 그대로).
// ═══════════════════════════════════════════════════════════════

const MAX_EDGE = 2400;
const JPEG_QUALITY = 0.82;

export interface ResizeResult {
  blob: Blob;
  fileName: string;
  resized: boolean; // 실제로 리사이즈/재인코딩 되었는지
}

function isGif(file: File): boolean {
  return file.type === 'image/gif' || /\.gif$/i.test(file.name);
}

/** 확장자를 .jpg 로 교체(리사이즈로 JPEG 재인코딩 시) */
function toJpegName(name: string): string {
  return name.replace(/\.[^.]+$/, '') + '.jpg';
}

/**
 * 파일을 업로드용 Blob 으로 준비한다.
 * - GIF: 원본 그대로(resized=false).
 * - 이미지가 아니거나(예외) 디코딩 실패: 원본 그대로 fallback.
 * - 긴 변 <= 2400px: 원본 그대로(resized=false).
 * - 그 외: 비율 유지 축소 후 JPEG(0.82)로 재인코딩.
 */
export async function prepareImageForUpload(file: File): Promise<ResizeResult> {
  // GIF 또는 비이미지 → 원본 그대로
  if (isGif(file) || !file.type.startsWith('image/')) {
    return { blob: file, fileName: file.name, resized: false };
  }

  let bitmap: ImageBitmap | HTMLImageElement | null = null;
  let width = 0;
  let height = 0;

  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
    } else {
      const img = await loadImageElement(file);
      bitmap = img;
      width = img.naturalWidth;
      height = img.naturalHeight;
    }
  } catch {
    // 디코딩 실패 → 원본 업로드
    return { blob: file, fileName: file.name, resized: false };
  }

  const longEdge = Math.max(width, height);
  if (longEdge <= MAX_EDGE) {
    if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();
    return { blob: file, fileName: file.name, resized: false };
  }

  const scale = MAX_EDGE / longEdge;
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();
    return { blob: file, fileName: file.name, resized: false };
  }
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, targetW, targetH);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
  if (!blob) {
    return { blob: file, fileName: file.name, resized: false };
  }

  // 재인코딩 결과가 원본보다 크면(드물게) 원본 사용
  if (blob.size >= file.size) {
    return { blob: file, fileName: file.name, resized: false };
  }

  return { blob, fileName: toJpegName(file.name), resized: true };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('이미지 디코딩 실패'));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}
