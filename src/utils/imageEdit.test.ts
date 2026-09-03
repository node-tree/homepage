// imageEdit 순수 함수 단위 테스트
//   핵심 회귀 방지 대상 2가지:
//   ① 확장자 ↔ 인코딩 MIME 불일치로 원본을 손상시키는 사고
//      (.webp 를 JPEG 바이트로 덮어쓰던 결함 / .avif 같은 미지원 확장자 통과)
//   ② previewSize(화면 표기)와 applyEdits(실제 저장)의 크롭 클램프 불일치
//      → 같은 resolveCrop/fitToMaxEdge 를 쓰는지 검증
//
//   실행: CI=true npx react-scripts test --watchAll=false

import {
  DESTRUCTIVE_EXTS,
  IDENTITY_OPS,
  MAX_EDGE,
  canEditDestructive,
  destructiveBlockReason,
  extOf,
  fitToMaxEdge,
  isIdentity,
  outputMime,
  previewSize,
  resolveCrop,
} from './imageEdit';

describe('extOf', () => {
  it('쿼리·해시를 무시하고 소문자 확장자를 뽑는다', () => {
    expect(extOf('a.JPG')).toBe('jpg');
    expect(extOf('/uploads/b.png?tr=w-300')).toBe('png');
    expect(extOf('https://ik.imagekit.io/x/c.webp#frag')).toBe('webp');
    expect(extOf('noext')).toBe('');
  });
});

describe('outputMime — 확장자와 인코딩 포맷 일치', () => {
  it('.webp 는 image/webp 로 인코딩한다 (JPEG 로 덮어쓰면 원본 손상)', () => {
    expect(outputMime('a.webp')).toBe('image/webp');
    expect(outputMime('/uploads/photo.WEBP?tr=w-800')).toBe('image/webp');
  });
  it('.png 는 image/png', () => {
    expect(outputMime('a.png')).toBe('image/png');
  });
  it('.jpg/.jpeg 는 image/jpeg', () => {
    expect(outputMime('a.jpg')).toBe('image/jpeg');
    expect(outputMime('a.jpeg')).toBe('image/jpeg');
  });
});

describe('canEditDestructive — 화이트리스트', () => {
  it('avif 는 파괴 편집 대상이 아니다', () => {
    expect(canEditDestructive('a.avif')).toBe(false);
  });
  it('gif·svg 도 제외', () => {
    expect(canEditDestructive('a.gif')).toBe(false);
    expect(canEditDestructive('a.svg')).toBe(false);
  });
  it('화이트리스트에 없는 확장자는 모두 제외(블랙리스트 방식의 구멍 차단)', () => {
    ['a.bmp', 'a.tiff', 'a.heic', 'a.ico', 'noext'].forEach((n) => {
      expect(canEditDestructive(n)).toBe(false);
    });
  });
  it('jpg/png 는 스펙상 항상 인코딩 가능하므로 허용', () => {
    expect(canEditDestructive('a.jpg')).toBe(true);
    expect(canEditDestructive('a.png')).toBe(true);
  });
  it('허용 목록은 jpg/jpeg/png/webp', () => {
    expect([...DESTRUCTIVE_EXTS].sort()).toEqual(['jpeg', 'jpg', 'png', 'webp']);
  });
});

describe('destructiveBlockReason', () => {
  it('미지원 확장자는 사유와 지원 형식을 함께 알린다', () => {
    const r = destructiveBlockReason('a.avif');
    expect(r).toBeTruthy();
    expect(r).toContain('avif');
    expect(r).toContain('webp'); // 지원 형식 안내 포함
  });
  it('허용 확장자는 사유 없음', () => {
    expect(destructiveBlockReason('a.jpg')).toBeNull();
  });
});

describe('resolveCrop — 경계 클램프', () => {
  it('크롭 없으면 원본 전체', () => {
    expect(resolveCrop(400, 240, null)).toEqual({ sx: 0, sy: 0, sw: 400, sh: 240 });
  });
  it('정상 범위는 그대로 환산', () => {
    expect(resolveCrop(400, 240, { x: 0.2, y: 0.2, w: 0.55, h: 0.5 })).toEqual({
      sx: 80,
      sy: 48,
      sw: 220,
      sh: 120,
    });
  });
  it('x+w 가 1 을 넘으면 남은 폭으로 잘린다', () => {
    // x=0.8, w=0.5 → 0.3 초과. 남은 폭 80px 로 클램프되어야 한다.
    expect(resolveCrop(400, 240, { x: 0.8, y: 0, w: 0.5, h: 1 })).toEqual({
      sx: 320,
      sy: 0,
      sw: 80,
      sh: 240,
    });
  });
  it('음수/1 초과 입력도 0~1 로 클램프', () => {
    expect(resolveCrop(400, 240, { x: -1, y: -1, w: 2, h: 2 })).toEqual({
      sx: 0,
      sy: 0,
      sw: 400,
      sh: 240,
    });
  });
});

describe('fitToMaxEdge', () => {
  it('상한 이하는 그대로', () => {
    expect(fitToMaxEdge(400, 240, MAX_EDGE)).toEqual({ w: 400, h: 240 });
  });
  it('긴 변 기준으로 비율 유지 축소', () => {
    expect(fitToMaxEdge(4800, 2400, 2400)).toEqual({ w: 2400, h: 1200 });
  });
});

describe('previewSize — applyEdits 와 동일 경로여야 한다', () => {
  it('회전 90/270 이면 가로세로가 뒤바뀐다', () => {
    expect(previewSize(400, 240, { ...IDENTITY_OPS, rotate: 90 })).toEqual({ width: 240, height: 400 });
    expect(previewSize(400, 240, { ...IDENTITY_OPS, rotate: 270 })).toEqual({ width: 240, height: 400 });
    expect(previewSize(400, 240, { ...IDENTITY_OPS, rotate: 180 })).toEqual({ width: 400, height: 240 });
  });
  it('크롭 후 회전이 함께 반영된다', () => {
    expect(
      previewSize(400, 240, { ...IDENTITY_OPS, rotate: 90, crop: { x: 0.2, y: 0.2, w: 0.55, h: 0.5 } })
    ).toEqual({ width: 120, height: 220 });
  });
  it('범위를 벗어난 크롭에서도 resolveCrop 클램프 결과와 일치한다(표기 ≠ 저장 방지)', () => {
    const crop = { x: 0.8, y: 0, w: 0.5, h: 1 };
    const { sw, sh } = resolveCrop(400, 240, crop);
    expect(previewSize(400, 240, { ...IDENTITY_OPS, crop })).toEqual({ width: sw, height: sh });
  });
  it('긴 변 상한 축소도 반영', () => {
    expect(previewSize(4800, 2400, { ...IDENTITY_OPS })).toEqual({ width: 2400, height: 1200 });
  });
});

describe('isIdentity', () => {
  it('무변환 판정', () => {
    expect(isIdentity(IDENTITY_OPS)).toBe(true);
    expect(isIdentity({ ...IDENTITY_OPS, crop: { x: 0, y: 0, w: 1, h: 1 } })).toBe(true);
    expect(isIdentity({ ...IDENTITY_OPS, rotate: 90 })).toBe(false);
    expect(isIdentity({ ...IDENTITY_OPS, flipH: true })).toBe(false);
    expect(isIdentity({ ...IDENTITY_OPS, crop: { x: 0.1, y: 0, w: 0.8, h: 1 } })).toBe(false);
  });
});
