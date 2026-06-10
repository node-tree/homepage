// ═══════════════════════════════════════════════════════════════
// BlockEditor — 블록 스키마 정의
//   · 공용 블록 기반 WYSIWYG 에디터의 데이터 모델.
//   · 저장은 HTML(contents)을 단일 진실원으로 삼되, 블록 구조를 무손실
//     라운드트립하기 위해 직렬화 시 HTML 안에 data-* 메타를 함께 새긴다.
//   · 모든 좌표/크기는 가능한 한 상대값(%)으로 보관해 반응형을 유지한다.
// ═══════════════════════════════════════════════════════════════

export type BlockType =
  | 'text'
  | 'image'
  | 'gallery'
  | 'video'
  | 'shape'
  | 'spacer'
  | 'freeform'
  | 'html'; // 레거시/복잡 HTML 보존용

export type TextTag = 'p' | 'h1' | 'h2' | 'h3' | 'blockquote' | 'ul' | 'ol';

export type Align = 'left' | 'center' | 'right';

export interface BaseBlock {
  id: string;
  type: BlockType;
}

// 텍스트 블록: 인라인 서식(굵게/기울임/링크/색상/크기)은 html 안에 보존.
export interface TextBlock extends BaseBlock {
  type: 'text';
  tag: TextTag;
  html: string; // 인라인 서식이 포함된 내부 HTML
  align?: Align;
}

export interface ImageBlock extends BaseBlock {
  type: 'image';
  src: string;
  alt?: string;
  caption?: string;
  width?: number; // 폭 % (10~100), 미지정 시 100
  align?: Align;
}

export type GalleryLayout = 'grid2' | 'grid3' | 'masonry' | 'carousel' | 'split' | 'hero';

export interface GalleryItem {
  src: string;
  alt?: string;
  caption?: string;
}

// 갤러리/템플릿 블록. split·hero 는 text 필드를 함께 사용.
export interface GalleryBlock extends BaseBlock {
  type: 'gallery';
  layout: GalleryLayout;
  items: GalleryItem[];
  text?: string; // split / hero 템플릿의 텍스트 영역(HTML)
  reversed?: boolean; // split 좌우 반전
}

export type VideoProvider = 'youtube' | 'vimeo' | 'file';

export interface VideoBlock extends BaseBlock {
  type: 'video';
  provider: VideoProvider;
  url: string; // 원본 입력 URL
  embedSrc: string; // iframe src 또는 video src
  width?: number; // 폭 %
  align?: Align;
}

export type ShapeKind = 'divider' | 'line' | 'rect' | 'circle';

export interface ShapeBlock extends BaseBlock {
  type: 'shape';
  kind: ShapeKind;
  color?: string;
  size?: number; // px (선 두께 / 도형 한 변)
  align?: Align;
}

export interface SpacerBlock extends BaseBlock {
  type: 'spacer';
  height: number; // px
}

// 자유 캔버스 내 개별 아이템. 좌표/크기는 캔버스 대비 %.
export type FreeItemType = 'image' | 'text' | 'shape';

export interface FreeItem {
  id: string;
  kind: FreeItemType;
  // 위치/크기 — 캔버스 폭/높이 대비 백분율
  x: number; // %
  y: number; // %
  w: number; // %
  h: number; // %
  z: number;
  rotation?: number; // deg
  opacity?: number; // 0~1
  // 내용
  src?: string; // image
  html?: string; // text
  shape?: ShapeKind; // shape
  color?: string; // shape/text color
}

export interface FreeformBlock extends BaseBlock {
  type: 'freeform';
  ratio: number; // 캔버스 종횡비 (height/width), 반응형 스케일 기준
  items: FreeItem[];
  background?: string;
}

// 파싱 불가능한 복잡 HTML을 통째로 보존.
export interface HtmlBlock extends BaseBlock {
  type: 'html';
  html: string;
}

export type Block =
  | TextBlock
  | ImageBlock
  | GalleryBlock
  | VideoBlock
  | ShapeBlock
  | SpacerBlock
  | FreeformBlock
  | HtmlBlock;

let _idCounter = 0;
export function newId(prefix = 'b'): string {
  _idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_idCounter.toString(36)}`;
}

// 빈 블록 팩토리
export function createBlock(type: BlockType): Block {
  switch (type) {
    case 'text':
      return { id: newId(), type: 'text', tag: 'p', html: '', align: 'left' };
    case 'image':
      return { id: newId(), type: 'image', src: '', alt: '', caption: '', width: 100, align: 'center' };
    case 'gallery':
      return { id: newId(), type: 'gallery', layout: 'grid2', items: [] };
    case 'video':
      return { id: newId(), type: 'video', provider: 'youtube', url: '', embedSrc: '', width: 100, align: 'center' };
    case 'shape':
      return { id: newId(), type: 'shape', kind: 'divider', color: '#222222', size: 1, align: 'center' };
    case 'spacer':
      return { id: newId(), type: 'spacer', height: 40 };
    case 'freeform':
      return { id: newId(), type: 'freeform', ratio: 0.6, items: [], background: '#fafafa' };
    case 'html':
    default:
      return { id: newId(), type: 'html', html: '' };
  }
}

// 영상 URL → provider/embed 변환
export function resolveVideo(url: string): { provider: VideoProvider; embedSrc: string } {
  const u = (url || '').trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) {
    return { provider: 'youtube', embedSrc: `https://www.youtube.com/embed/${yt[1]}` };
  }
  const vimeo = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) {
    return { provider: 'vimeo', embedSrc: `https://player.vimeo.com/video/${vimeo[1]}` };
  }
  return { provider: 'file', embedSrc: u };
}
