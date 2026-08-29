import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import React, { useRef } from 'react';
import { ikUrl } from '../../../utils/ikUrl';

// ════════════════════════════════════════════════════════════════════════
// ntFigure — 도판 한 장(이미지 + 캡션 + 크레딧). 편집기 2.0 의 핵심 노드.
//   HTML 계약(공개 렌더 richlayout.css 와 공유):
//   <figure class="nt-fig" data-nt="figure" data-width="text|narrow|wide|bleed|custom"
//           data-align="left|center|right" data-float="none|left|right" style="--w:62%">
//     <img src alt>  <figcaption>캡션 <span class="nt-credit">크레딧</span></figcaption>
//   </figure>
//   폭 프리셋 + 오른쪽 가장자리 드래그로 임의 % (custom).
// ════════════════════════════════════════════════════════════════════════

export type FigWidth = 'narrow' | 'text' | 'wide' | 'bleed' | 'custom';
export type FigAlign = 'left' | 'center' | 'right';
export type FigFloat = 'none' | 'left' | 'right';

export interface FigureAttrs {
  src: string;
  alt: string;
  width: FigWidth;
  pct: number | null;
  align: FigAlign;
  float: FigFloat;
  caption: string;
  credit: string;
  link: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ntFigure: {
      insertFigure: (attrs: Partial<FigureAttrs> & { src: string }) => ReturnType;
      updateFigure: (attrs: Partial<FigureAttrs>) => ReturnType;
    };
  }
}

const WIDTHS: { k: FigWidth; label: string }[] = [
  { k: 'narrow', label: '좁게' },
  { k: 'text', label: '본문' },
  { k: 'wide', label: '넓게' },
  { k: 'bleed', label: '전폭' },
];

const FigureView: React.FC<NodeViewProps> = ({ node, updateAttributes, selected, editor, deleteNode }) => {
  const a = node.attrs as FigureAttrs;
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x0: number; w0: number; box: number } | null>(null);

  // 오른쪽 손잡이 드래그 → custom %
  const onHandleDown = (e: React.PointerEvent) => {
    const host = wrapRef.current?.parentElement as HTMLElement | null; // NodeViewWrapper
    if (!host) return;
    const box = host.parentElement?.getBoundingClientRect().width || host.getBoundingClientRect().width;
    drag.current = { x0: e.clientX, w0: (wrapRef.current as HTMLDivElement).getBoundingClientRect().width, box };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const { x0, w0, box } = drag.current;
    const pct = Math.round(Math.max(15, Math.min(100, ((w0 + (e.clientX - x0) * (a.align === 'center' ? 2 : 1)) / box) * 100)));
    updateAttributes({ width: 'custom', pct });
  };
  const onHandleUp = () => {
    drag.current = null;
  };

  const style: React.CSSProperties = a.width === 'custom' && a.pct ? ({ '--w': `${a.pct}%` } as React.CSSProperties) : {};

  return (
    <NodeViewWrapper
      as="figure"
      className={`nt-fig${selected ? ' is-selected' : ''}`}
      data-nt="figure"
      data-width={a.width}
      data-align={a.align}
      data-float={a.float}
      style={style}
      data-drag-handle
    >
      <div className="nt-fig__win" ref={wrapRef}>
        <img src={ikUrl(a.src, { w: 1600 })} alt={a.alt} draggable={false} />
        {editor.isEditable && (
          <span
            className="nt-fig__grip"
            title="폭 조절"
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            contentEditable={false}
          />
        )}
      </div>
      <figcaption contentEditable={false}>
        {editor.isEditable ? (
          <>
            <input
              className="nt-fig__cap"
              value={a.caption}
              placeholder="캡션"
              onChange={(e) => updateAttributes({ caption: e.target.value })}
            />
            <input
              className="nt-fig__credit"
              value={a.credit}
              placeholder="크레딧"
              onChange={(e) => updateAttributes({ credit: e.target.value })}
            />
          </>
        ) : (
          <>
            {a.caption}
            {a.credit ? <span className="nt-credit">{a.credit}</span> : null}
          </>
        )}
      </figcaption>
      {editor.isEditable && selected && (
        <div className="nt-tool" contentEditable={false}>
          <span className="nt-tool__lab">폭</span>
          {WIDTHS.map((w) => (
            <button key={w.k} type="button" className={a.width === w.k ? 'on' : undefined} onClick={() => updateAttributes({ width: w.k, pct: null, float: w.k === 'bleed' || w.k === 'wide' ? 'none' : a.float })}>
              {w.label}
            </button>
          ))}
          {a.width === 'custom' && <span className="nt-tool__val">{a.pct}%</span>}
          <span className="nt-tool__sep" />
          <span className="nt-tool__lab">정렬</span>
          {(['left', 'center', 'right'] as FigAlign[]).map((k) => (
            <button key={k} type="button" className={a.align === k ? 'on' : undefined} onClick={() => updateAttributes({ align: k })}>
              {k === 'left' ? '좌' : k === 'center' ? '중' : '우'}
            </button>
          ))}
          <span className="nt-tool__sep" />
          <span className="nt-tool__lab">감싸기</span>
          {(['none', 'left', 'right'] as FigFloat[]).map((k) => (
            <button
              key={k}
              type="button"
              className={a.float === k ? 'on' : undefined}
              onClick={() => updateAttributes({ float: k, width: k === 'none' ? a.width : a.width === 'wide' || a.width === 'bleed' ? 'narrow' : a.width })}
            >
              {k === 'none' ? '없음' : k === 'left' ? '왼쪽' : '오른쪽'}
            </button>
          ))}
          <span className="nt-tool__sep" />
          <button
            type="button"
            onClick={() => {
              // 링크는 바깥 대화상자(Editor2.onRequestLink)로 — 커스텀 이벤트로 넘긴다
              window.dispatchEvent(new CustomEvent('nt-fig-link', { detail: { current: a.link, apply: (v: string) => updateAttributes({ link: v }) } }));
            }}
            className={a.link ? 'on' : undefined}
          >
            링크
          </button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('nt-fig-replace', { detail: { apply: (src: string) => updateAttributes({ src }) } }))}>
            교체
          </button>
          <button type="button" onClick={() => deleteNode()}>
            삭제
          </button>
        </div>
      )}
    </NodeViewWrapper>
  );
};

export const Figure = Node.create({
  name: 'ntFigure',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      width: { default: 'text' as FigWidth },
      pct: { default: null as number | null },
      align: { default: 'center' as FigAlign },
      float: { default: 'none' as FigFloat },
      caption: { default: '' },
      credit: { default: '' },
      link: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-nt="figure"]',
        getAttrs: (el) => {
          const fig = el as HTMLElement;
          const img = fig.querySelector('img');
          if (!img) return false;
          const cap = fig.querySelector('figcaption');
          const credit = cap?.querySelector('.nt-credit');
          const captionText = cap ? Array.from(cap.childNodes).filter((n) => n !== credit).map((n) => n.textContent || '').join('').trim() : '';
          const w = fig.style.getPropertyValue('--w');
          return {
            src: img.getAttribute('src') || '',
            alt: img.getAttribute('alt') || '',
            width: (fig.getAttribute('data-width') as FigWidth) || 'text',
            pct: w ? parseFloat(w) : null,
            align: (fig.getAttribute('data-align') as FigAlign) || 'center',
            float: (fig.getAttribute('data-float') as FigFloat) || 'none',
            caption: captionText,
            credit: credit?.textContent?.trim() || '',
            link: fig.querySelector('a')?.getAttribute('href') || '',
          };
        },
      },
      // 레거시: 맨몸 <img>(문단 안에 있어도 블록으로 끌어올린다)
      {
        tag: 'img[src]',
        getAttrs: (el) => {
          const img = el as HTMLImageElement;
          if (img.closest('figure[data-nt="figure"]')) return false;
          const raw = img.getAttribute('src') || '';
          if (!raw || raw.startsWith('data:')) return false;
          return { src: raw.split('?tr=')[0], alt: img.getAttribute('alt') || '' };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const a = node.attrs as FigureAttrs;
    const style = a.width === 'custom' && a.pct ? `--w:${a.pct}%` : undefined;
    const img: any = ['img', { src: a.src, alt: a.alt, loading: 'lazy', decoding: 'async' }];
    const media: any = a.link ? ['a', { href: a.link, target: '_blank', rel: 'noopener noreferrer' }, img] : img;
    const cap: any[] = ['figcaption', {}, a.caption];
    if (a.credit) cap.push(['span', { class: 'nt-credit' }, a.credit]);
    return [
      'figure',
      mergeAttributes({
        class: 'nt-fig',
        'data-nt': 'figure',
        'data-width': a.width,
        'data-align': a.align,
        'data-float': a.float,
        style,
      }),
      media,
      a.caption || a.credit ? cap : ['figcaption', { class: 'is-empty' }],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureView);
  },

  addCommands() {
    return {
      insertFigure:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
      updateFigure:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
    };
  },
});

export default Figure;
