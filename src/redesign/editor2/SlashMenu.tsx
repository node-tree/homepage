import type { Editor } from '@tiptap/core';
import React, { useEffect, useMemo, useState } from 'react';

// ════════════════════════════════════════════════════════════════════════
// SlashMenu — 빈 줄(또는 문단 시작)에서 "/" 를 치면 뜨는 삽입 메뉴. 의존성 없음.
//   Editor2 가 selectionUpdate/update 마다 현재 문단 텍스트를 보고 열고 닫는다.
//   키: ↑↓ 이동 · Enter 선택 · Esc 닫기 (Editor2 의 handleKeyDown 이 위임).
// ════════════════════════════════════════════════════════════════════════

export interface SlashItem {
  key: string;
  label: string;
  hint: string;
  run: (editor: Editor) => void;
}

export interface SlashState {
  open: boolean;
  query: string;
  from: number; // "/" 위치
  to: number;
  x: number;
  y: number;
}

export const CLOSED: SlashState = { open: false, query: '', from: 0, to: 0, x: 0, y: 0 };

/** 현재 커서가 있는 문단이 "/query" 만으로 이루어졌는지 본다. */
export function readSlash(editor: Editor): SlashState {
  const { state, view } = editor;
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.name !== 'paragraph') return CLOSED;
  const text = $from.parent.textContent;
  const m = text.match(/^\/([^\s/]{0,20})$/);
  if (!m) return CLOSED;
  const from = $from.start();
  const to = $from.end();
  const c = view.coordsAtPos(from);
  const host = view.dom.getBoundingClientRect();
  return { open: true, query: m[1], from, to, x: c.left - host.left, y: c.bottom - host.top + 6 };
}

export const SlashMenu: React.FC<{
  editor: Editor;
  state: SlashState;
  items: SlashItem[];
  index: number;
  onIndex: (i: number) => void;
  onPick: (item: SlashItem) => void;
}> = ({ state, items, index, onIndex, onPick }) => {
  if (!state.open) return null;
  return (
    <div className="nt-slash" style={{ left: state.x, top: state.y }} role="listbox" aria-label="삽입">
      {items.length === 0 ? (
        <div className="nt-slash__empty">— 없음</div>
      ) : (
        items.map((it, i) => (
          <button
            key={it.key}
            type="button"
            role="option"
            aria-selected={i === index}
            className={i === index ? 'on' : undefined}
            onMouseEnter={() => onIndex(i)}
            onMouseDown={(e) => {
              e.preventDefault();
              onPick(it);
            }}
          >
            <span className="nt-slash__lab">{it.label}</span>
            <span className="nt-slash__hint">{it.hint}</span>
          </button>
        ))
      )}
    </div>
  );
};

/** 검색·인덱스 관리 훅 */
export function useSlash(editor: Editor | null, all: SlashItem[]) {
  const [state, setState] = useState<SlashState>(CLOSED);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const next = readSlash(editor);
      queueMicrotask(() => setState((prev) => (prev.open === next.open && prev.query === next.query && prev.from === next.from ? prev : next)));
    };
    editor.on('update', sync);
    editor.on('selectionUpdate', sync);
    editor.on('blur', () => setState(CLOSED));
    return () => {
      editor.off('update', sync);
      editor.off('selectionUpdate', sync);
    };
  }, [editor]);
  useEffect(() => setIndex(0), [state.query, state.open]);
  const items = useMemo(() => {
    const q = state.query.toLowerCase();
    return q ? all.filter((it) => it.label.toLowerCase().includes(q) || it.key.includes(q)) : all;
  }, [all, state.query]);
  return { state, setState, index, setIndex, items };
}
