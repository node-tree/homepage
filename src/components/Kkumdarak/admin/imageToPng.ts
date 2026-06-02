// ═══════════════════════════════════════════════════════════════
// 업로드 이미지 → PNG base64(프리픽스 제거) 변환 + 다운스케일.
//   · 가로 최대 maxWidth(기본 1280px) 비율 유지 축소(원본이 작으면 그대로).
//   · canvas.toDataURL('image/png') → 'data:image/png;base64,XXXX' 에서 XXXX 만 반환.
//   · 서버도 data: 프리픽스를 방어적으로 제거하지만, 여기서 먼저 제거해 규약 준수.
//   PNG 통일이라 서버 이미지 라이브러리 불필요.
// ═══════════════════════════════════════════════════════════════

export interface PngResult {
  base64: string; // data: 프리픽스 없는 순수 base64
  dataUrl: string; // 썸네일 미리보기용 (data:image/png;base64,…)
}

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
