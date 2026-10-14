// ═══════════════════════════════════════════════════════════════
// 업로드 사진(base64 PNG·JPEG) 디코드·검증 헬퍼.
//   · data: 프리픽스가 있어도 방어적으로 제거(클라이언트도 제거하지만 이중 방어).
//   · base64 → Buffer, 디코드 후 8MB 초과 시 거부, PNG/JPEG 시그니처 확인.
//     (2026-10: 사진은 브라우저에서 긴 변 1600px JPEG 로 줄여 보낸다 — 서식 사진 칸이 비율을 그대로 쓴다)
//   반환: { buffer } (정상) | { error } (사용자 안내 메시지) | { } (photo 없음 → 사진 칸에 안내 글).
// ═══════════════════════════════════════════════════════════════

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff]);

function decodePhoto(photo) {
  if (photo == null || photo === '') return {}; // 사진 미첨부
  if (typeof photo !== 'string') return { error: '사진 형식이 올바르지 않습니다.' };

  const b64 = photo.replace(/^data:[^,]*,/, '');

  let buffer;
  try {
    buffer = Buffer.from(b64, 'base64');
  } catch (e) {
    return { error: '사진을 디코드하지 못했습니다.' };
  }

  if (!buffer || buffer.length === 0) {
    return { error: '사진 데이터가 비어 있습니다.' };
  }
  if (buffer.length > MAX_BYTES) {
    return { error: '사진이 너무 큽니다(8MB 초과). 더 작은 이미지를 사용하세요.' };
  }
  const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIG);
  const isJpeg = buffer.length >= 3 && buffer.subarray(0, 3).equals(JPEG_SIG);
  if (!isPng && !isJpeg) {
    return { error: 'PNG·JPEG 이미지만 첨부할 수 있습니다.' };
  }

  return { buffer };
}

// 여러 장을 한 번에: { 키: base64 } → { buffers: { 키: Buffer|null } } | { error }
function decodePhotos(map) {
  const buffers = {};
  for (const [key, value] of Object.entries(map || {})) {
    const r = decodePhoto(value);
    if (r.error) return { error: `${key}: ${r.error}` };
    buffers[key] = r.buffer || null;
  }
  return { buffers };
}

module.exports = { decodePhoto, decodePhotos, MAX_BYTES };
