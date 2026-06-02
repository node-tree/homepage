// ═══════════════════════════════════════════════════════════════
// 업로드 사진(base64 PNG) 디코드·검증 헬퍼.
//   · data: 프리픽스가 있어도 방어적으로 제거(클라이언트도 제거하지만 이중 방어).
//   · base64 → Buffer, 디코드 후 8MB 초과 시 거부, PNG 시그니처 sniff.
//   반환: { buffer } (정상) | { error } (사용자 안내 메시지) | { } (photo 없음 → 사진 미교체).
// ═══════════════════════════════════════════════════════════════

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function decodePhoto(photo) {
  if (photo == null || photo === '') return {}; // 사진 미첨부 — 더미 유지
  if (typeof photo !== 'string') return { error: '사진 형식이 올바르지 않습니다.' };

  // data:image/png;base64,XXXX → XXXX (프리픽스 방어적 제거)
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
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIG)) {
    return { error: 'PNG 이미지만 첨부할 수 있습니다.' };
  }

  return { buffer };
}

module.exports = { decodePhoto, MAX_BYTES };
