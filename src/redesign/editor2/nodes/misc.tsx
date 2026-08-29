import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import React from 'react';

// ════════════════════════════════════════════════════════════════════════
// ntEmbed  — 유튜브/비메오 iframe. <div class="nt-embed" data-nt="embed"><iframe …></div>
// ntSpacer — 여백. <div class="nt-spacer" data-nt="spacer" style="--h:64px"></div>
// ntRaw    — 원문 HTML 보존(표·복잡한 레거시 블록). 편집기 안에서는 읽기전용 프리뷰.
//            <div data-nt="raw">…원문…</div>  ← 저장 시 원문을 그대로 되돌린다(유실 0).
// ════════════════════════════════════════════════════════════════════════

/** 유튜브/비메오 URL → 임베드 URL. 아니면 null */
export function embedUrl(input: string): string | null {
  const u = input.trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  if (/^https?:\/\/(www\.)?(youtube\.com|player\.vimeo\.com)\/embed/.test(u)) return u;
  return null;
}

const EmbedView: React.FC<NodeViewProps> = ({ node, selected }) => (
  <NodeViewWrapper className={`nt-embed${selected ? ' is-selected' : ''}`} data-nt="embed" data-drag-handle>
    <iframe src={node.attrs.src} title="embed" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
  </NodeViewWrapper>
);

export const Embed = Node.create({
  name: 'ntEmbed',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: '' } };
  },
  parseHTML() {
    return [
      { tag: 'div[data-nt="embed"]', getAttrs: (el) => ({ src: (el as HTMLElement).querySelector('iframe')?.getAttribute('src') || '' }) },
      {
        tag: 'iframe[src]',
        getAttrs: (el) => {
          const e = el as HTMLElement;
          if (e.closest('[data-nt="embed"], [data-nt="raw"]')) return false;
          return { src: e.getAttribute('src') || '' };
        },
      },
    ];
  },
  renderHTML({ node }) {
    return [
      'div',
      mergeAttributes({ class: 'nt-embed', 'data-nt': 'embed' }),
      ['iframe', { src: node.attrs.src, allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture', allowfullscreen: 'true', frameborder: '0' }],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(EmbedView);
  },
});

const SpacerView: React.FC<NodeViewProps> = ({ node, selected, updateAttributes, editor }) => (
  <NodeViewWrapper className={`nt-spacer${selected ? ' is-selected' : ''}`} data-nt="spacer" style={{ '--h': `${node.attrs.h}px` } as React.CSSProperties} data-drag-handle>
    {editor.isEditable && selected && (
      <div className="nt-tool" contentEditable={false}>
        <span className="nt-tool__lab">여백</span>
        {[32, 64, 120, 200].map((h) => (
          <button key={h} type="button" className={node.attrs.h === h ? 'on' : undefined} onClick={() => updateAttributes({ h })}>
            {h}
          </button>
        ))}
      </div>
    )}
  </NodeViewWrapper>
);

export const Spacer = Node.create({
  name: 'ntSpacer',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { h: { default: 64 } };
  },
  parseHTML() {
    return [{ tag: 'div[data-nt="spacer"]', getAttrs: (el) => ({ h: parseInt((el as HTMLElement).style.getPropertyValue('--h') || '64', 10) || 64 }) }];
  },
  renderHTML({ node }) {
    return ['div', mergeAttributes({ class: 'nt-spacer', 'data-nt': 'spacer', style: `--h:${node.attrs.h}px` })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(SpacerView);
  },
});

const RawView: React.FC<NodeViewProps> = ({ node, selected }) => (
  <NodeViewWrapper className={`nt-raw${selected ? ' is-selected' : ''}`} data-nt="raw" data-drag-handle>
    <div className="nt-raw__lab" contentEditable={false}>
      RAW · 원문 블록(그대로 보존)
    </div>
    <div className="nt-raw__body" contentEditable={false} dangerouslySetInnerHTML={{ __html: node.attrs.html }} />
  </NodeViewWrapper>
);

export const Raw = Node.create({
  name: 'ntRaw',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { html: { default: '' } };
  },
  parseHTML() {
    return [
      { tag: 'div[data-nt="raw"]', getAttrs: (el) => ({ html: (el as HTMLElement).innerHTML }) },
      // 표·레거시 복합 블록은 통째로 보존한다
      { tag: 'table', priority: 60, getAttrs: (el) => ({ html: (el as HTMLElement).outerHTML }) },
      { tag: 'div[data-nt-legacy]', priority: 60, getAttrs: (el) => ({ html: (el as HTMLElement).innerHTML }) },
    ];
  },
  renderHTML({ node }) {
    const el = document.createElement('div');
    el.setAttribute('data-nt', 'raw');
    el.innerHTML = node.attrs.html;
    return el as any;
  },
  addNodeView() {
    return ReactNodeViewRenderer(RawView);
  },
});
