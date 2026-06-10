// ═══════════════════════════════════════════════════════════════
// BlockEditor — 블록 ↔ HTML 직렬화 / 레거시 HTML 파서
//
//   설계 원칙:
//   · 저장 단일 진실원은 HTML(contents). 모든 기존 뷰어가 그대로 동작한다.
//   · 블록 구조 무손실 라운드트립을 위해, 블록을 HTML로 직렬화할 때
//     각 블록 래퍼에 data-bk(블록타입)·data-bk-json(블록 직렬화) 속성을 새긴다.
//     → 다시 열 때 data-bk-json 이 있으면 그대로 복원, 없으면(레거시 HTML)
//       DOM을 휴리스틱 파싱해 블록으로 분해한다.
//   · 뷰어는 data-* 속성을 무시하므로 렌더 결과에 영향이 없다.
//   · GIF 변환 금지 등 ikUrl 규칙은 뷰어/직렬화 모두에서 ikUrl 헬퍼에 위임.
// ═══════════════════════════════════════════════════════════════

import {
  Block,
  GalleryItem,
  FreeItem,
  newId,
  resolveVideo,
  TextTag,
} from './blockTypes';

const ATTR_TYPE = 'data-bk';
const ATTR_JSON = 'data-bk-json';

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function alignStyle(align?: string): string {
  if (align === 'center') return 'text-align:center;';
  if (align === 'right') return 'text-align:right;';
  if (align === 'left') return 'text-align:left;';
  return '';
}

// 파일 영상의 확장자 기반 MIME 타입 추정(<source type>). 미지정/모호하면 빈 문자열.
function videoMimeType(url: string): string {
  const m = (url || '').split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i);
  if (!m) return '';
  const ext = m[1].toLowerCase();
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    webm: 'video/webm',
    ogv: 'video/ogg',
    ogg: 'video/ogg',
    mov: 'video/quicktime',
  };
  return map[ext] || '';
}

function blockMeta(b: Block): string {
  // 블록 메타 직렬화. html 류 필드는 base64로 안전하게 보관(따옴표/꺾쇠 충돌 방지).
  let json: string;
  try {
    json = JSON.stringify(b);
  } catch {
    json = '{}';
  }
  // btoa 는 latin1 만 처리 → UTF-8 안전 인코딩
  const encoded = utf8ToBase64(json);
  return `${ATTR_TYPE}="${b.type}" ${ATTR_JSON}="${encoded}"`;
}

function utf8ToBase64(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return '';
  }
}

function base64ToUtf8(b64: string): string {
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return '';
  }
}

// ───────────────────────── 블록 → HTML ─────────────────────────

function imgTag(src: string, alt = '', extraStyle = ''): string {
  return `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" style="max-width:100%;height:auto;${extraStyle}" />`;
}

function blockToHtml(b: Block): string {
  const meta = blockMeta(b);
  switch (b.type) {
    case 'text': {
      const align = alignStyle(b.align);
      const inner = b.html || '<br>';
      if (b.tag === 'ul' || b.tag === 'ol') {
        return `<${b.tag} ${meta} style="${align}">${inner}</${b.tag}>`;
      }
      return `<${b.tag} ${meta} style="${align}">${inner}</${b.tag}>`;
    }
    case 'image': {
      if (!b.src) return `<div ${meta}></div>`;
      const w = b.width && b.width < 100 ? `width:${b.width}%;` : '';
      const wrapAlign =
        b.align === 'left' ? 'margin-right:auto;' : b.align === 'right' ? 'margin-left:auto;' : 'margin-left:auto;margin-right:auto;';
      const cap = b.caption
        ? `<figcaption style="font-size:0.85rem;color:#888;text-align:center;margin-top:6px;">${esc(b.caption)}</figcaption>`
        : '';
      return `<figure ${meta} style="margin:16px auto;${w}${wrapAlign}text-align:center;">${imgTag(
        b.src,
        b.alt || ''
      )}${cap}</figure>`;
    }
    case 'gallery': {
      const itemsHtml = b.items
        .filter((it) => it.src)
        .map((it) => {
          const cap = it.caption
            ? `<figcaption style="font-size:0.8rem;color:#888;margin-top:4px;">${esc(it.caption)}</figcaption>`
            : '';
          return `<figure style="margin:0;">${imgTag(it.src, it.alt || '')}${cap}</figure>`;
        })
        .join('');
      let style = '';
      if (b.layout === 'grid2') style = 'display:grid;grid-template-columns:repeat(2,1fr);gap:12px;';
      else if (b.layout === 'grid3') style = 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px;';
      else if (b.layout === 'masonry') style = 'column-count:3;column-gap:12px;';
      else if (b.layout === 'carousel')
        style = 'display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;';
      if (b.layout === 'masonry') {
        const masItems = b.items
          .filter((it) => it.src)
          .map(
            (it) =>
              `<figure style="margin:0 0 12px;break-inside:avoid;">${imgTag(it.src, it.alt || '')}</figure>`
          )
          .join('');
        return `<div ${meta} class="bk-gallery bk-masonry" style="${style}margin:16px 0;">${masItems}</div>`;
      }
      if (b.layout === 'carousel') {
        const carItems = b.items
          .filter((it) => it.src)
          .map(
            (it) =>
              `<figure style="margin:0;flex:0 0 80%;scroll-snap-align:center;">${imgTag(
                it.src,
                it.alt || ''
              )}</figure>`
          )
          .join('');
        return `<div ${meta} class="bk-gallery bk-carousel" style="${style}margin:16px 0;">${carItems}</div>`;
      }
      if (b.layout === 'split' || b.layout === 'hero') {
        const textHtml = b.text || '';
        if (b.layout === 'hero') {
          const heroImg = b.items[0]?.src ? imgTag(b.items[0].src, b.items[0].alt || '', 'border-radius:8px;') : '';
          return `<div ${meta} class="bk-gallery bk-hero" style="margin:16px 0;">${heroImg}<div style="margin-top:16px;">${textHtml}</div></div>`;
        }
        const splitImg = b.items[0]?.src ? imgTag(b.items[0].src, b.items[0].alt || '', 'border-radius:8px;') : '';
        const dir = b.reversed ? 'row-reverse' : 'row';
        return `<div ${meta} class="bk-gallery bk-split" style="display:flex;flex-direction:${dir};gap:20px;align-items:center;margin:16px 0;flex-wrap:wrap;"><div style="flex:1;min-width:240px;">${splitImg}</div><div style="flex:1;min-width:240px;">${textHtml}</div></div>`;
      }
      return `<div ${meta} class="bk-gallery bk-${b.layout}" style="${style}margin:16px 0;">${itemsHtml}</div>`;
    }
    case 'video': {
      if (!b.embedSrc) return `<div ${meta}></div>`;
      const w = b.width && b.width < 100 ? `${b.width}%` : '100%';
      const wrapAlign =
        b.align === 'left' ? 'margin-right:auto;' : b.align === 'right' ? 'margin-left:auto;' : 'margin-left:auto;margin-right:auto;';
      const media =
        b.provider === 'file'
          ? (() => {
              const mime = videoMimeType(b.embedSrc);
              const typeAttr = mime ? ` type="${mime}"` : '';
              return `<video controls style="position:absolute;top:0;left:0;width:100%;height:100%;"><source src="${esc(
                b.embedSrc
              )}"${typeAttr} /></video>`;
            })()
          : `<iframe src="${esc(
              b.embedSrc
            )}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe>`;
      return `<div ${meta} class="video-container" style="position:relative;width:${w};${wrapAlign}padding-bottom:${
        (9 / 16) * (b.width && b.width < 100 ? b.width : 100)
      }%;height:0;overflow:hidden;background:#000;border-radius:8px;margin:16px auto;">${media}</div>`;
    }
    case 'shape': {
      const align = b.align === 'left' ? 'margin-right:auto;' : b.align === 'right' ? 'margin-left:auto;' : 'margin:auto;';
      const color = esc(b.color || '#222');
      const size = b.size || 1;
      if (b.kind === 'divider' || b.kind === 'line') {
        return `<hr ${meta} style="border:none;border-top:${size}px solid ${color};width:60%;${align}margin-top:24px;margin-bottom:24px;" />`;
      }
      if (b.kind === 'circle') {
        return `<div ${meta} style="width:${size}px;height:${size}px;border-radius:50%;background:${color};${align}margin-top:16px;margin-bottom:16px;"></div>`;
      }
      // rect
      return `<div ${meta} style="width:${size}px;height:${size}px;background:${color};${align}margin-top:16px;margin-bottom:16px;"></div>`;
    }
    case 'spacer':
      return `<div ${meta} style="height:${b.height}px;" aria-hidden="true"></div>`;
    case 'freeform': {
      const items = b.items
        .map((it) => {
          const transform = `transform:rotate(${it.rotation || 0}deg);`;
          const base = `position:absolute;left:${it.x}%;top:${it.y}%;width:${it.w}%;height:${it.h}%;z-index:${
            it.z
          };opacity:${it.opacity ?? 1};${transform}`;
          if (it.kind === 'image' && it.src) {
            return `<div style="${base}"><img src="${esc(
              it.src
            )}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:4px;" /></div>`;
          }
          if (it.kind === 'text') {
            return `<div style="${base}overflow:hidden;color:${esc(it.color || '#222')};">${it.html || ''}</div>`;
          }
          if (it.kind === 'shape') {
            const radius = it.shape === 'circle' ? 'border-radius:50%;' : '';
            return `<div style="${base}background:${esc(it.color || '#222')};${radius}"></div>`;
          }
          return '';
        })
        .join('');
      return `<div ${meta} class="bk-freeform" style="position:relative;width:100%;padding-bottom:${
        b.ratio * 100
      }%;background:${esc(b.background || '#fafafa')};margin:16px 0;border-radius:8px;overflow:hidden;">${items}</div>`;
    }
    case 'html':
    default:
      return `<div ${meta} class="bk-html">${(b as any).html || ''}</div>`;
  }
}

export function blocksToHtml(blocks: Block[]): string {
  return blocks.map(blockToHtml).join('\n');
}

// ───────────────────────── HTML → 블록 ─────────────────────────

// 1차: data-bk-json 메타가 있으면 무손실 복원.
function blockFromMeta(el: Element): Block | null {
  const json = el.getAttribute(ATTR_JSON);
  if (!json) return null;
  const decoded = base64ToUtf8(json);
  if (!decoded) return null;
  try {
    const parsed = JSON.parse(decoded) as Block;
    if (parsed && parsed.type) {
      // id 가 비었으면 새로 부여
      if (!parsed.id) (parsed as any).id = newId();
      return parsed;
    }
  } catch {
    /* fallthrough */
  }
  return null;
}

// 2차: 레거시 DOM 휴리스틱 파싱.
function legacyNodeToBlocks(node: Node): Block[] {
  const out: Block[] = [];
  if (node.nodeType === Node.TEXT_NODE) {
    const t = (node.textContent || '').trim();
    if (t) out.push({ id: newId(), type: 'text', tag: 'p', html: esc(t), align: 'left' });
    return out;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return out;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  // iframe → 영상 블록
  if (tag === 'iframe') {
    const src = el.getAttribute('src') || '';
    const { provider } = resolveVideo(src);
    out.push({ id: newId(), type: 'video', provider: src.includes('youtube') ? 'youtube' : src.includes('vimeo') ? 'vimeo' : provider, url: src, embedSrc: src, width: 100, align: 'center' });
    return out;
  }
  if (tag === 'video') {
    const source = el.querySelector('source');
    const src = source?.getAttribute('src') || el.getAttribute('src') || '';
    out.push({ id: newId(), type: 'video', provider: 'file', url: src, embedSrc: src, width: 100, align: 'center' });
    return out;
  }
  if (tag === 'img') {
    out.push({
      id: newId(),
      type: 'image',
      src: el.getAttribute('src') || '',
      alt: el.getAttribute('alt') || '',
      caption: '',
      width: 100,
      align: 'center',
    });
    return out;
  }
  if (tag === 'hr') {
    out.push({ id: newId(), type: 'shape', kind: 'divider', color: '#222', size: 1, align: 'center' });
    return out;
  }
  if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
    out.push({ id: newId(), type: 'text', tag: tag as TextTag, html: el.innerHTML, align: 'left' });
    return out;
  }
  if (tag === 'ul' || tag === 'ol') {
    out.push({ id: newId(), type: 'text', tag: tag as TextTag, html: el.innerHTML, align: 'left' });
    return out;
  }
  if (tag === 'blockquote') {
    out.push({ id: newId(), type: 'text', tag: 'blockquote', html: el.innerHTML, align: 'left' });
    return out;
  }

  // 컨테이너(div/p/figure/span): 내부에 미디어가 섞여 있으면 분해, 아니면 텍스트 블록.
  const mediaInside = el.querySelector('img, iframe, video, hr');
  const directText = Array.from(el.childNodes).some(
    (n) => n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim()
  );

  if (mediaInside && !(tag === 'figure')) {
    // 미디어와 텍스트가 섞인 컨테이너 → 자식 단위로 재귀 분해
    let textBuffer = '';
    const flushText = () => {
      const trimmed = textBuffer.trim();
      if (trimmed) out.push({ id: newId(), type: 'text', tag: 'p', html: trimmed, align: 'left' });
      textBuffer = '';
    };
    el.childNodes.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const cTag = (child as HTMLElement).tagName.toLowerCase();
        const cHasMedia = ['img', 'iframe', 'video', 'hr'].includes(cTag) || (child as HTMLElement).querySelector?.('img, iframe, video, hr');
        if (cHasMedia) {
          flushText();
          out.push(...legacyNodeToBlocks(child));
        } else {
          textBuffer += (child as HTMLElement).outerHTML;
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        textBuffer += child.textContent || '';
      }
    });
    flushText();
    return out;
  }

  // figure 단일 이미지/캡션
  if (tag === 'figure') {
    const img = el.querySelector('img');
    if (img) {
      const cap = el.querySelector('figcaption');
      out.push({
        id: newId(),
        type: 'image',
        src: img.getAttribute('src') || '',
        alt: img.getAttribute('alt') || '',
        caption: cap?.textContent || '',
        width: 100,
        align: 'center',
      });
      return out;
    }
  }

  // 순수 텍스트 컨테이너
  const html = el.innerHTML.trim();
  if (html && (directText || /<(strong|em|b|i|u|a|span|br)\b/i.test(html) || html.length > 0)) {
    // 빈 <br> 만 있는 줄은 건너뜀
    if (html === '<br>' || html === '<br/>') return out;
    out.push({ id: newId(), type: 'text', tag: 'p', html, align: 'left' });
  }
  return out;
}

// 콘텐츠 HTML → 블록 배열. 메타가 있으면 무손실, 없으면 레거시 파싱.
export function htmlToBlocks(html: string): Block[] {
  if (!html || !html.trim()) return [];
  const container = document.createElement('div');
  container.innerHTML = html;

  // 메타 기반 복원 시도: 최상위에 data-bk 가 하나라도 있으면 메타 경로.
  const metaEls = Array.from(container.children).filter((c) => c.hasAttribute(ATTR_TYPE));
  if (metaEls.length > 0 && metaEls.length === container.children.length) {
    const blocks: Block[] = [];
    metaEls.forEach((el) => {
      const b = blockFromMeta(el);
      if (b) blocks.push(b);
      else blocks.push(...legacyNodeToBlocks(el));
    });
    return blocks.length ? blocks : [{ id: newId(), type: 'html', html }];
  }

  // 레거시 경로: 최상위 자식들을 순회 파싱.
  const blocks: Block[] = [];
  container.childNodes.forEach((node) => {
    blocks.push(...legacyNodeToBlocks(node));
  });

  // 아무 것도 못 뽑았으면 통째로 HTML 블록 보존.
  if (blocks.length === 0) {
    return [{ id: newId(), type: 'html', html }];
  }
  return blocks;
}

// 갤러리 헬퍼 외부 노출 (프리셋 생성용)
export function emptyGalleryItems(n: number): GalleryItem[] {
  return Array.from({ length: n }, () => ({ src: '', alt: '', caption: '' }));
}

export function emptyFreeItem(kind: FreeItem['kind']): FreeItem {
  return {
    id: newId('f'),
    kind,
    x: 10,
    y: 10,
    w: 30,
    h: 20,
    z: 1,
    rotation: 0,
    opacity: 1,
    color: '#222222',
    shape: 'rect',
    html: kind === 'text' ? '텍스트' : undefined,
  };
}
