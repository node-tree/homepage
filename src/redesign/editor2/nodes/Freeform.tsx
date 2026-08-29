import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import React, { useRef } from 'react';
import { ikUrl } from '../../../utils/ikUrl';

// ════════════════════════════════════════════════════════════════════════
// ntFreeform — Cargo Freeform 형 캔버스. 높이 지정 컨테이너 안에 이미지·텍스트 박스를 % 좌표로
//   드래그·리사이즈·겹침(z). 자석 스냅 5%. 모바일은 세로 스택 폴백(data-keep="1" 이면 캔버스 유지).
//   <div class="nt-free" data-nt="freeform" data-keep="0" style="--h:60vh">
//     <div class="nt-free__item" data-kind="image" style="left:10%;top:5%;width:30%;z-index:1"><img src></div>
//     <div class="nt-free__item" data-kind="text"  style="…">글</div>
//   </div>
// ════════════════════════════════════════════════════════════════════════

export interface FreeItem { id: string; kind: 'image' | 'text'; src?: string; text?: string; x: number; y: number; w: number; z: number }

const SNAP = 5;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const uid = () => Math.random().toString(36).slice(2, 8);

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ntFreeform: { insertFreeform: () => ReturnType };
  }
}

const FreeformView: React.FC<NodeViewProps> = ({ node, updateAttributes, selected, editor, deleteNode }) => {
  const items = node.attrs.items as FreeItem[];
  const h = node.attrs.h as number;
  const keep = node.attrs.keep as boolean;
  const hostRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; mode: 'move' | 'size'; x0: number; y0: number; ix: number; iy: number; iw: number } | null>(null);
  const [active, setActive] = React.useState<string | null>(null);

  const set = (next: FreeItem[]) => updateAttributes({ items: next });
  const patch = (id: string, p: Partial<FreeItem>) => set(items.map((it) => (it.id === id ? { ...it, ...p } : it)));

  const onDown = (e: React.PointerEvent, it: FreeItem, mode: 'move' | 'size') => {
    if (!editor.isEditable) return;
    if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
    drag.current = { id: it.id, mode, x0: e.clientX, y0: e.clientY, ix: it.x, iy: it.y, iw: it.w };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setActive(it.id);
    e.preventDefault();
    e.stopPropagation();
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const box = hostRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = ((e.clientX - d.x0) / box.width) * 100;
    const dy = ((e.clientY - d.y0) / box.height) * 100;
    if (d.mode === 'move') patch(d.id, { x: Math.max(0, Math.min(95, snap(d.ix + dx))), y: Math.max(0, Math.min(95, snap(d.iy + dy))) });
    else patch(d.id, { w: Math.max(10, Math.min(100, snap(d.iw + dx))) });
  };
  const onUp = () => {
    drag.current = null;
  };

  const addImage = () =>
    window.dispatchEvent(
      new CustomEvent('nt-gallery-add', {
        detail: { apply: (urls: string[]) => set([...items, ...urls.map((src, i) => ({ id: uid(), kind: 'image' as const, src, x: snap(10 + i * 10), y: snap(10 + i * 10), w: 40, z: items.length + i + 1 }))]) },
      }),
    );
  const addText = () => set([...items, { id: uid(), kind: 'text', text: '글', x: 10, y: 10, w: 30, z: items.length + 1 }]);
  const cur = items.find((i) => i.id === active);

  return (
    <NodeViewWrapper className={`nt-free${selected ? ' is-selected' : ''}${editor.isEditable ? ' is-editing' : ''}`} data-nt="freeform" data-keep={keep ? '1' : '0'} style={{ '--h': `${h}vh` } as React.CSSProperties} data-drag-handle>
      <div className="nt-free__stage" ref={hostRef} onPointerMove={onMove} onPointerUp={onUp} contentEditable={false}>
        {items.map((it) => (
          <div
            key={it.id}
            className={`nt-free__item${active === it.id ? ' is-active' : ''}`}
            data-kind={it.kind}
            style={{ left: `${it.x}%`, top: `${it.y}%`, width: `${it.w}%`, zIndex: it.z }}
            onPointerDown={(e) => onDown(e, it, 'move')}
          >
            {it.kind === 'image' ? (
              <img src={ikUrl(it.src || '', { w: 1200 })} alt="" draggable={false} />
            ) : editor.isEditable ? (
              <textarea value={it.text || ''} onChange={(e) => patch(it.id, { text: e.target.value })} onPointerDown={(e) => e.stopPropagation()} />
            ) : (
              <p>{it.text}</p>
            )}
            {editor.isEditable && <span className="nt-free__grip" onPointerDown={(e) => onDown(e, it, 'size')} />}
          </div>
        ))}
      </div>
      {editor.isEditable && (
        <div className="nt-tool nt-tool--free" contentEditable={false}>
          <span className="nt-tool__lab">자유배치</span>
          <button type="button" onClick={addImage}>
            + 이미지
          </button>
          <button type="button" onClick={addText}>
            + 글
          </button>
          <span className="nt-tool__sep" />
          <span className="nt-tool__lab">높이</span>
          {[40, 60, 80, 100].map((v) => (
            <button key={v} type="button" className={h === v ? 'on' : undefined} onClick={() => updateAttributes({ h: v })}>
              {v}vh
            </button>
          ))}
          <span className="nt-tool__sep" />
          <button type="button" className={keep ? 'on' : undefined} onClick={() => updateAttributes({ keep: !keep })} title="모바일에서도 캔버스 유지">
            모바일 유지
          </button>
          {cur && (
            <>
              <span className="nt-tool__sep" />
              <span className="nt-tool__lab">선택</span>
              <button type="button" onClick={() => patch(cur.id, { z: Math.max(...items.map((i) => i.z)) + 1 })}>
                앞으로
              </button>
              <button type="button" onClick={() => patch(cur.id, { z: Math.max(0, Math.min(...items.map((i) => i.z)) - 1) })}>
                뒤로
              </button>
              <button
                type="button"
                onClick={() => {
                  set(items.filter((i) => i.id !== cur.id));
                  setActive(null);
                }}
              >
                빼기
              </button>
              <span className="nt-tool__val">
                {cur.x}% · {cur.y}% · w{cur.w}%
              </span>
            </>
          )}
          <span className="nt-tool__sep" />
          <button type="button" onClick={() => deleteNode()}>
            삭제
          </button>
        </div>
      )}
    </NodeViewWrapper>
  );
};

export const Freeform = Node.create({
  name: 'ntFreeform',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { items: { default: [] as FreeItem[] }, h: { default: 60 }, keep: { default: false } };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-nt="freeform"]',
        getAttrs: (el) => {
          const e = el as HTMLElement;
          const items: FreeItem[] = Array.from(e.querySelectorAll('.nt-free__item')).map((n) => {
            const d = n as HTMLElement;
            const kind = (d.getAttribute('data-kind') as 'image' | 'text') || 'image';
            return {
              id: uid(),
              kind,
              src: d.querySelector('img')?.getAttribute('src')?.split('?tr=')[0] || undefined,
              text: kind === 'text' ? d.textContent || '' : undefined,
              x: parseFloat(d.style.left) || 0,
              y: parseFloat(d.style.top) || 0,
              w: parseFloat(d.style.width) || 30,
              z: parseInt(d.style.zIndex || '1', 10) || 1,
            };
          });
          return { items, h: parseInt(e.style.getPropertyValue('--h') || '60', 10) || 60, keep: e.getAttribute('data-keep') === '1' };
        },
      },
    ];
  },
  renderHTML({ node }) {
    const items = node.attrs.items as FreeItem[];
    return [
      'div',
      mergeAttributes({ class: 'nt-free', 'data-nt': 'freeform', 'data-keep': node.attrs.keep ? '1' : '0', style: `--h:${node.attrs.h}vh` }),
      ...items.map((it) => [
        'div',
        { class: 'nt-free__item', 'data-kind': it.kind, style: `left:${it.x}%;top:${it.y}%;width:${it.w}%;z-index:${it.z}` },
        it.kind === 'image' ? ['img', { src: it.src || '', alt: '', loading: 'lazy', decoding: 'async' }] : ['p', {}, it.text || ''],
      ]),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FreeformView);
  },
  addCommands() {
    return {
      insertFreeform:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { items: [], h: 60 } }),
    };
  },
});
