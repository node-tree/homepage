import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import React from 'react';

// ════════════════════════════════════════════════════════════════════════
// ntColumns / ntColumn — 2~4 컬럼. 컬럼 안에 문단·도판·무엇이든.
//   <div class="nt-cols" data-nt="columns" style="--cols:2;--ratio:1fr 2fr">
//     <div class="nt-col" data-nt="col">…</div> …
//   </div>
// ════════════════════════════════════════════════════════════════════════

const RATIOS: Record<number, { label: string; v: string }[]> = {
  2: [
    { label: '1:1', v: '1fr 1fr' },
    { label: '1:2', v: '1fr 2fr' },
    { label: '2:1', v: '2fr 1fr' },
    { label: '1:3', v: '1fr 3fr' },
    { label: '3:1', v: '3fr 1fr' },
  ],
  3: [
    { label: '1:1:1', v: '1fr 1fr 1fr' },
    { label: '2:1:1', v: '2fr 1fr 1fr' },
    { label: '1:2:1', v: '1fr 2fr 1fr' },
    { label: '1:1:2', v: '1fr 1fr 2fr' },
  ],
  4: [{ label: '균등', v: '1fr 1fr 1fr 1fr' }],
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ntColumns: { insertColumns: (n: number) => ReturnType };
  }
}

const ColumnsView: React.FC<NodeViewProps> = ({ node, updateAttributes, editor, getPos, deleteNode }) => {
  const cols = node.attrs.cols as number;
  const ratio = node.attrs.ratio as string;
  const setCols = (n: number) => {
    // 컬럼 수 변경: 부족하면 빈 컬럼 추가, 많으면 뒤 컬럼 내용을 마지막 컬럼으로 합친다
    const pos = getPos();
    if (typeof pos !== 'number') return;
    const { state } = editor;
    const tr = state.tr;
    const cur = node.childCount;
    if (n > cur) {
      const end = pos + node.nodeSize - 1;
      for (let i = cur; i < n; i += 1) tr.insert(end, state.schema.nodes.ntColumn.createAndFill() as any);
    } else if (n < cur) {
      // 마지막 남길 컬럼 끝에 초과 컬럼 내용을 붙이고 초과 컬럼을 지운다
      let keepEnd = pos + 1;
      for (let i = 0; i < n; i += 1) keepEnd += node.child(i).nodeSize;
      const extra: any[] = [];
      for (let i = n; i < cur; i += 1) node.child(i).forEach((c) => extra.push(c));
      const from = keepEnd;
      const to = pos + node.nodeSize - 1;
      tr.delete(from, to);
      tr.insert(from - 1, extra);
    }
    tr.setNodeMarkup(pos, undefined, { cols: n, ratio: RATIOS[n][0].v });
    editor.view.dispatch(tr);
  };
  return (
    <NodeViewWrapper className="nt-cols" data-nt="columns" style={{ '--cols': cols, '--ratio': ratio } as React.CSSProperties}>
      {editor.isEditable && (
        <div className="nt-tool nt-tool--cols" contentEditable={false}>
          <span className="nt-tool__lab">컬럼</span>
          {[2, 3, 4].map((n) => (
            <button key={n} type="button" className={cols === n ? 'on' : undefined} onClick={() => setCols(n)}>
              {n}
            </button>
          ))}
          <span className="nt-tool__sep" />
          <span className="nt-tool__lab">비율</span>
          {(RATIOS[cols] || []).map((r) => (
            <button key={r.v} type="button" className={ratio === r.v ? 'on' : undefined} onClick={() => updateAttributes({ ratio: r.v })}>
              {r.label}
            </button>
          ))}
          <span className="nt-tool__sep" />
          <button type="button" onClick={() => deleteNode()}>
            해제
          </button>
        </div>
      )}
      <NodeViewContent className="nt-cols__body" />
    </NodeViewWrapper>
  );
};

export const Column = Node.create({
  name: 'ntColumn',
  content: 'block+',
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-nt="col"]' }];
  },
  renderHTML() {
    return ['div', { class: 'nt-col', 'data-nt': 'col' }, 0];
  },
});

export const Columns = Node.create({
  name: 'ntColumns',
  group: 'block',
  content: 'ntColumn{2,4}',
  isolating: true,
  draggable: true,
  addAttributes() {
    return { cols: { default: 2 }, ratio: { default: '1fr 1fr' } };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-nt="columns"]',
        getAttrs: (el) => {
          const e = el as HTMLElement;
          const n = parseInt(e.style.getPropertyValue('--cols') || '2', 10) || 2;
          return { cols: Math.min(4, Math.max(2, n)), ratio: e.style.getPropertyValue('--ratio') || RATIOS[Math.min(4, Math.max(2, n))][0].v };
        },
      },
    ];
  },
  renderHTML({ node }) {
    return ['div', mergeAttributes({ class: 'nt-cols', 'data-nt': 'columns', style: `--cols:${node.attrs.cols};--ratio:${node.attrs.ratio}` }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ColumnsView);
  },
  addCommands() {
    return {
      insertColumns:
        (n) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { cols: n, ratio: RATIOS[n][0].v },
            content: Array.from({ length: n }, () => ({ type: 'ntColumn', content: [{ type: 'paragraph' }] })),
          }),
    };
  },
});
