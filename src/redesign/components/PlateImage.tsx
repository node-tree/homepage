import React from 'react';
import { ikUrl } from '../../utils/ikUrl';

// ════════════════════════════════════════════════════════════════════════
// PlateImage — DB 이미지(ImageKit)를 v5 도판 창에 끼운다.
//   PlateFrame(정적 시안용 placeholder)과 형제. 규칙은 같다:
//   봉인 brightness(.72) → 호버 개봉 100%. 원형 썸네일·둥근 모서리 금지.
//   src 가 없으면 absent — 자리는 남기고 값만 비운다(설계 §2.2).
// ════════════════════════════════════════════════════════════════════════

export interface PlateImageProps {
  src?: string | null;
  alt: string;
  /** CSS aspect-ratio (기본 16/9) */
  ratio?: string;
  /** absent 일 때 창에 찍히는 Mono 문구 */
  note?: string;
  /** ImageKit 리사이즈 폭 */
  w?: number;
  /** 봉인 없이 처음부터 개봉 */
  open?: boolean;
}

const PlateImage: React.FC<PlateImageProps> = ({ src, alt, ratio = '16/9', note, w = 1200, open }) => {
  if (!src) {
    const text = note ?? 'ABSENT · 도판 미기재';
    return (
      <div className="plate absent" style={{ aspectRatio: ratio }} data-absent={text} role="img" aria-label={text} />
    );
  }
  const url = ikUrl(src.startsWith('//') ? `https:${src}` : src, { w });
  return (
    <div className={`plate pic${open ? ' open' : ''}`} style={{ aspectRatio: ratio }}>
      <img src={url} alt={alt} loading="lazy" decoding="async" />
    </div>
  );
};

export default React.memo(PlateImage);
