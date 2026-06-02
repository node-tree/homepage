// ═══════════════════════════════════════════════════════════════
// 업로드 이미지 → PNG base64(프리픽스 제거) 변환 + 다운스케일/레터박스.
//   · canvas.toDataURL('image/png') → 'data:image/png;base64,XXXX' 에서 XXXX 만 반환.
//   · 서버도 data: 프리픽스를 방어적으로 제거하지만, 여기서 먼저 제거해 규약 준수.
//   · 레터박스: 템플릿 hp:pic 프레임은 19000×12000 HWPUNIT(≈1.583:1) 고정이라
//     업로드 비율이 다르면 한글이 프레임에 강제로 늘려 왜곡된다. 프레임 비율과 같은
//     캔버스에 흰 배경 + 비율보존 contain 으로 그려, 교체 이미지 자체가 프레임 비율과
//     일치하게 만든다(왜곡 없음, 여백은 흰색).
//   PNG 통일이라 서버 이미지 라이브러리 불필요.
// ═══════════════════════════════════════════════════════════════

export interface PngResult {
  base64: string; // data: 프리픽스 없는 순수 base64
  dataUrl: string; // 썸네일 미리보기용 (data:image/png;base64,…)
}

// 템플릿 사진 프레임 비율(19000/12000 HWPUNIT)
export const PHOTO_FRAME_RATIO = 19000 / 12000; // ≈ 1.5833

// file → 프레임 비율 캔버스에 레터박스(contain, 흰 배경)한 PNG.
//   frameWidth: 캔버스 가로(기본 1280) — 세로는 round(frameWidth / frameRatio).
export function fileToFramedPng(
  file: File,
  frameWidth = 1280,
  frameRatio = PHOTO_FRAME_RATIO,
): Promise<PngResult> {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('이미지 파일만 첨부할 수 있습니다.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('이미지를 디코드하지 못했습니다.'));
      img.onload = () => {
        const cw = Math.max(1, Math.round(frameWidth));
        const ch = Math.max(1, Math.round(frameWidth / frameRatio));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('캔버스를 사용할 수 없습니다.'));
          return;
        }
        // 흰 배경(레터박스 여백)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cw, ch);
        // 비율 보존 contain — 이미지를 프레임 안에 가운데 맞춤
        const sourceRatio = img.width / img.height || 1;
        let dw = cw;
        let dh = Math.round(cw / sourceRatio);
        if (dh > ch) {
          dh = ch;
          dw = Math.round(ch * sourceRatio);
        }
        const dx = Math.round((cw - dw) / 2);
        const dy = Math.round((ch - dh) / 2);
        ctx.drawImage(img, dx, dy, dw, dh);
        const dataUrl = canvas.toDataURL('image/png');
        const comma = dataUrl.indexOf(',');
        const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
        resolve({ base64, dataUrl });
      };
      img.src = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  });
}

// 하위호환: 기존 비율유지 다운스케일(레터박스 없음). 현재 PhotoUpload 는 fileToFramedPng 사용.
export function fileToDownscaledPng(file: File, maxWidth = 1280): Promise<PngResult> {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('이미지 파일만 첨부할 수 있습니다.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('이미지를 디코드하지 못했습니다.'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('캔버스를 사용할 수 없습니다.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/png');
        const comma = dataUrl.indexOf(',');
        const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
        resolve({ base64, dataUrl });
      };
      img.src = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  });
}
