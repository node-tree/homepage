import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import React, { useEffect, useRef } from 'react';
import { ikUrl } from '../../../utils/ikUrl';

// ════════════════════════════════════════════════════════════════════════
// ntGallery — 여러 장. 레이아웃 grid(열 2~5) / justify(글줄 정렬, 원본 비율) / masonry.
//   <div class="nt-gallery" data-nt="gallery" data-layout="justify" data-cols="3" data-gap="12">
//     <figure style="--r:1.5"><img src alt><figcaption>…</figcaption></figure> …
//   </div>
//   --r(가로/세로 비율)은 편집기가 이미지를 읽어 채운다 → 공개 페이지는 CSS 만으로 justify.
// ════════════════════════════════════════════════════════════════════════

export interface GalleryItem { src: string; alt?: string; caption?: string; r?: number }
export type GalleryLayout = 'grid' | 'justify' | 'masonry';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ntGallery: { insertGallery: (items: GalleryItem[], layout?: GalleryLayout) => ReturnType };
  }
}

const GalleryView: React.FC<NodeViewProps> = ({ node, updateAttributes, selected, editor, deleteNode }) => {
  const items = node.attrs.items as GalleryItem[];
  const layout = node.attrs.layout as GalleryLayout;
  const cols = node.attrs.cols as number;
  const gap = node.attrs.gap as number;
  // 최신 items — 이미지 onload 가 옛 클로저의 items 를 덮어쓰지 않게(마지막 한 장만 남던 경쟁 방지)
  const latest = useRef(items);
  latest.current = items;

  // 비율 채우기(모르는 것만)
  useEffect(() => {
    let alive = true;
    items.forEach((it) => {
      if (it.r) return;
      const img = new Image();
      img.onload = () => {
        if (!alive || !img.naturalWidth) return;
        const r = +(img.naturalWidth / img.naturalHeight).toFixed(3);
        const next = latest.current.map((x) => (x.src === it.src && !x.r ? { ...x, r } : x));
        latest.current = next;
        updateAttributes({ items: next });
      };
      img.src = ikUrl(it.src, { w: 800 });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.src).join('|')]);

  const set = (next: GalleryItem[]) => updateAttributes({ items: next });
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };
  const add = () => window.dispatchEvent(new CustomEvent('nt-gallery-add', { detail: { apply: (urls: string[]) => set([...items, ...urls.map((src) => ({ src }))]) } }));

  return (
    <NodeViewWrapper className={`nt-gallery${selected ? ' is-selected' : ''}`} data-nt="gallery" data-layout={layout} data-cols={cols} data-gap={gap} style={{ '--gap': `${gap}px` } as React.CSSProperties} data-drag-handle>
      {items.map((it, i) => (
        <figure key={`${it.src}-${i}`} style={{ '--r': it.r ?? 1.5 } as React.CSSProperties}>
          <img src={ikUrl(it.src, { w: 1200 })} alt={it.alt || ''} draggable={false} />
          {editor.isEditable ? (
            <figcaption contentEditable={false}>
              <input value={it.caption || ''} placeholder="캡션" onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} />
              <span className="nt-gallery__ops">
                <button type="button" onClick={() => move(i, -1)} title="앞으로">
                  ←
                </button>
                <button type="button" onClick={() => move(i, 1)} title="뒤로">
                  →
                </button>
                <button type="button" onClick={() => set(items.filter((_, j) => j !== i))} title="빼기">
                  ×
                </button>
              </span>
            </figcaption>
          ) : it.caption ? (
            <figcaption>{it.caption}</figcaption>
          ) : null}
        </figure>
      ))}
      {editor.isEditable && (
        <div className="nt-tool nt-tool--gallery" contentEditable={false}>
          <span className="nt-tool__lab">배열</span>
          {(['justify', 'grid', 'masonry'] as GalleryLayout[]).map((k) => (
            <button key={k} type="button" className={layout === k ? 'on' : undefined} onClick={() => updateAttributes({ layout: k })}>
              {k === 'justify' ? '글줄' : k === 'grid' ? '격자' : '벽돌'}
            </button>
          ))}
          {layout !== 'justify' && (
            <>
              <span className="nt-tool__sep" />
              <span className="nt-tool__lab">열</span>
              {[2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={cols === n ? 'on' : undefined} onClick={() => updateAttributes({ cols: n })}>
                  {n}
                </button>
              ))}
            </>
          )}
          <span className="nt-tool__sep" />
          <span className="nt-tool__lab">간격</span>
          {[0, 6, 12, 24].map((g) => (
            <button key={g} type="button" className={gap === g ? 'on' : undefined} onClick={() => updateAttributes({ gap: g })}>
              {g}
            </button>
          ))}
          <span className="nt-tool__sep" />
          <button type="button" onClick={add}>
            + 추가
          </button>
          <button type="button" onClick={() => deleteNode()}>
            삭제
          </button>
        </div>
      )}
    </NodeViewWrapper>
  );
};

export const Gallery = Node.create({
  name: 'ntGallery',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      items: { default: [] as GalleryItem[] },
      layout: { default: 'justify' as GalleryLayout },
      cols: { default: 3 },
      gap: { default: 12 },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-nt="gallery"]',
        getAttrs: (el) => {
          const e = el as HTMLElement;
          const items: GalleryItem[] = Array.from(e.querySelectorAll('figure')).map((f) => {
            const img = f.querySelector('img');
            const r = parseFloat(f.style.getPropertyValue('--r'));
            return { src: img?.getAttribute('src')?.split('?tr=')[0] || '', alt: img?.getAttribute('alt') || '', caption: f.querySelector('figcaption')?.textContent || '', r: r || undefined };
          }).filter((i) => i.src);
          return {
            items,
            layout: (e.getAttribute('data-layout') as GalleryLayout) || 'justify',
            cols: parseInt(e.getAttribute('data-cols') || '3', 10) || 3,
            gap: parseInt(e.getAttribute('data-gap') || '12', 10),
          };
        },
      },
    ];
  },
  renderHTML({ node }) {
    const items = node.attrs.items as GalleryItem[];
    return [
      'div',
      mergeAttributes({ class: 'nt-gallery', 'data-nt': 'gallery', 'data-layout': node.attrs.layout, 'data-cols': String(node.attrs.cols), 'data-gap': String(node.attrs.gap), style: `--gap:${node.attrs.gap}px` }),
      ...items.map((it) => {
        const fig: any[] = ['figure', { style: `--r:${it.r ?? 1.5}` }, ['img', { src: it.src, alt: it.alt || '', loading: 'lazy', decoding: 'async' }]];
        if (it.caption) fig.push(['figcaption', {}, it.caption]);
        return fig;
      }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(GalleryView);
  },
  addCommands() {
    return {
      insertGallery:
        (items, layout = 'justify') =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { items, layout } }),
    };
  },
});
