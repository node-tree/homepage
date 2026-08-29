import type { Editor } from '@tiptap/core';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ImageKitPicker from '../../components/editor/ImageKitPicker';
import '../richlayout.css';
import './editor2.css';
import Figure from './nodes/Figure';
import { Embed, Raw, Spacer, embedUrl } from './nodes/misc';
import { normalizeLegacy } from './normalize';
import { CLOSED, SlashItem, SlashMenu, useSlash } from './SlashMenu';
import { imageFilesOf, uploadImage } from './upload';

// ════════════════════════════════════════════════════════════════════════
// Editor2 — Tiptap 3 기반 글 편집기(2026-08-30, 리서치: 자료실/기술/웹-편집기).
//   · 슬래시 메뉴("/") · 선택 버블(B/I/링크/제목/인용) · 블록 드래그 핸들 · Undo/Redo
//   · 이미지: 드롭/붙여넣기 → ImageKit 업로드, 라이브러리 피커, URL 붙여넣기
//   · 유튜브/비메오 URL 붙여넣기 → 임베드
//   · 저장 형식 = HTML(getHTML). 공개 렌더와 같은 richlayout.css 로 WYSIWYG.
//   · 레거시 HTML 은 normalizeLegacy 로 읽고, 모르는 블록은 ntRaw 로 보존(유실 0).
// ════════════════════════════════════════════════════════════════════════

export interface Editor2Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** 링크 URL 입력 — 바깥 대화상자(PromptDialog) */
  onRequestLink?: (apply: (url: string) => void, current?: string) => void;
}

const Editor2: React.FC<Editor2Props> = ({ value, onChange, placeholder, onRequestLink }) => {
  const [picker, setPicker] = useState<{ open: boolean; onPick: (urls: string[]) => void; multiple?: boolean }>({ open: false, onPick: () => undefined });
  const [busy, setBusy] = useState<string | null>(null);
  const lastEmitted = useRef<string>(value || '');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
        dropcursor: { color: '#BE3C28', width: 2 },
      }),
      Placeholder.configure({ placeholder: placeholder ?? '본문을 입력하십시오 — "/" 로 삽입' }),
      Figure,
      Embed,
      Spacer,
      Raw,
    ],
    content: normalizeLegacy(value || ''),
    // 트랜잭션마다 React 트리를 다시 그리지 않는다(NodeView flushSync 경고·성능). 메뉴 상태는 이벤트로 받는다.
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: 'rl nt-editor2__body', spellcheck: 'false' },
      handleDrop: (view, event) => {
        const files = imageFilesOf(event.dataTransfer);
        if (!files.length) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.to;
        void uploadMany(files, pos);
        return true;
      },
      handlePaste: (view, event) => {
        const files = imageFilesOf(event.clipboardData);
        if (files.length) {
          event.preventDefault();
          void uploadMany(files, view.state.selection.to);
          return true;
        }
        const text = event.clipboardData?.getData('text/plain')?.trim() || '';
        if (!text || /\s/.test(text)) return false;
        const emb = embedUrl(text);
        if (emb) {
          editorRef.current?.chain().focus().insertContent({ type: 'ntEmbed', attrs: { src: emb } }).run();
          return true;
        }
        if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|avif)(\?\S*)?$/i.test(text) || /ik\.imagekit\.io\//.test(text)) {
          editorRef.current?.chain().focus().insertFigure({ src: text.split('?tr=')[0] }).run();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.isEmpty ? '' : ed.getHTML();
      if (html !== lastEmitted.current) {
        lastEmitted.current = html;
        onChange(html);
      }
    },
  });
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;
  // 개발 검증용 손잡이(프로덕션 번들에서는 제거된다)
  if (process.env.NODE_ENV !== 'production') (window as any).__ntEditor = editor;

  // 선택 버블 — 자체 구현(서브패스 해상 문제로 @tiptap/react/menus 를 쓰지 않는다)
  const [bubble, setBubble] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty || !editor.isEditable || editor.isActive('ntFigure') || editor.isActive('ntRaw') || editor.isActive('ntEmbed')) {
        setBubble(null);
        return;
      }
      const a = editor.view.coordsAtPos(from);
      const b = editor.view.coordsAtPos(to);
      const host = editor.view.dom.getBoundingClientRect();
      queueMicrotask(() => setBubble({ x: Math.max(0, (a.left + b.left) / 2 - host.left), y: Math.min(a.top, b.top) - host.top - 10 }));
    };
    editor.on('selectionUpdate', sync);
    editor.on('blur', () => setBubble(null));
    editor.on('focus', sync);
    return () => {
      editor.off('selectionUpdate', sync);
      editor.off('focus', sync);
    };
  }, [editor]);

  // 바깥에서 value 가 바뀌면(불러오기) 편집기에 반영 — 편집기가 낸 값은 되돌려 넣지 않는다.
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    // effect 안에서 곧장 setContent 하면 NodeView 가 flushSync 로 그려져 React 가 경고한다 → 다음 틱
    const t = window.setTimeout(() => editor.commands.setContent(normalizeLegacy(value || ''), { emitUpdate: false }), 0);
    return () => window.clearTimeout(t);
  }, [value, editor]);

  const uploadMany = useCallback(async (files: File[], pos: number) => {
    const ed = editorRef.current;
    if (!ed) return;
    setBusy(`업로드 중 · ${files.length}`);
    try {
      let at = pos;
      for (const f of files) {
        // eslint-disable-next-line no-await-in-loop
        const url = await uploadImage(f);
        ed.chain().focus().insertContentAt(at, { type: 'ntFigure', attrs: { src: url, alt: f.name.replace(/\.[^.]+$/, '') } }).run();
        at = ed.state.selection.to;
      }
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('nt-toast', { detail: { text: `업로드 실패 · ${e?.message || ''}`, kind: 'error' } }));
    } finally {
      setBusy(null);
    }
  }, []);

  // 도판 노드가 쏘는 요청(링크·교체) 을 받아 대화상자/피커로 연결
  useEffect(() => {
    const onLink = (e: Event) => {
      const { current, apply } = (e as CustomEvent).detail;
      if (onRequestLink) onRequestLink(apply, current);
    };
    const onReplace = (e: Event) => {
      const { apply } = (e as CustomEvent).detail;
      setPicker({ open: true, onPick: (urls) => urls[0] && apply(urls[0]) });
    };
    window.addEventListener('nt-fig-link', onLink);
    window.addEventListener('nt-fig-replace', onReplace);
    return () => {
      window.removeEventListener('nt-fig-link', onLink);
      window.removeEventListener('nt-fig-replace', onReplace);
    };
  }, [onRequestLink]);

  const pickImages = useCallback((multiple: boolean, insert: (urls: string[]) => void) => {
    setPicker({ open: true, multiple, onPick: insert });
  }, []);

  const slashItems = useMemo<SlashItem[]>(
    () => [
      { key: 'p', label: '본문', hint: '문단', run: (ed) => ed.chain().focus().setParagraph().run() },
      { key: 'h2', label: '제목', hint: 'H2', run: (ed) => ed.chain().focus().setHeading({ level: 2 }).run() },
      { key: 'h3', label: '소제목', hint: 'H3', run: (ed) => ed.chain().focus().setHeading({ level: 3 }).run() },
      { key: 'quote', label: '인용', hint: '들여쓴 문단', run: (ed) => ed.chain().focus().setBlockquote().run() },
      { key: 'ul', label: '목록', hint: '•', run: (ed) => ed.chain().focus().toggleBulletList().run() },
      { key: 'ol', label: '번호 목록', hint: '1.', run: (ed) => ed.chain().focus().toggleOrderedList().run() },
      {
        key: 'image',
        label: '이미지',
        hint: '라이브러리 · 업로드',
        run: (ed) => pickImages(false, (urls) => urls[0] && ed.chain().focus().insertFigure({ src: urls[0] }).run()),
      },
      {
        key: 'images',
        label: '이미지 여러 장',
        hint: '연속 도판',
        run: (ed) =>
          pickImages(true, (urls) => {
            const chain = ed.chain().focus();
            urls.forEach((u) => chain.insertContent({ type: 'ntFigure', attrs: { src: u } }));
            chain.run();
          }),
      },
      {
        key: 'video',
        label: '영상',
        hint: '유튜브 · 비메오 URL',
        run: (ed) =>
          onRequestLink
            ? onRequestLink((url) => {
                const src = embedUrl(url);
                if (src) ed.chain().focus().insertContent({ type: 'ntEmbed', attrs: { src } }).run();
              })
            : undefined,
      },
      { key: 'hr', label: '구분선', hint: '계선', run: (ed) => ed.chain().focus().setHorizontalRule().run() },
      { key: 'space', label: '여백', hint: '64px', run: (ed) => ed.chain().focus().insertContent({ type: 'ntSpacer', attrs: { h: 64 } }).run() },
    ],
    [pickImages, onRequestLink],
  );
  const slash = useSlash(editor, slashItems);

  const pickSlash = useCallback(
    (item: SlashItem) => {
      const ed = editorRef.current;
      if (!ed) return;
      const { from, to } = slash.state;
      ed.chain().focus().deleteRange({ from, to }).run();
      item.run(ed);
      slash.setState(CLOSED);
    },
    [slash],
  );

  // 슬래시 키 위임
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const onKey = (e: KeyboardEvent) => {
      if (!slash.state.open) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        slash.setIndex((slash.index + 1) % Math.max(1, slash.items.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        slash.setIndex((slash.index - 1 + Math.max(1, slash.items.length)) % Math.max(1, slash.items.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const it = slash.items[slash.index];
        if (it) pickSlash(it);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        slash.setState(CLOSED);
      }
    };
    dom.addEventListener('keydown', onKey, true);
    return () => dom.removeEventListener('keydown', onKey, true);
  }, [editor, slash, pickSlash]);

  const setLink = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const current = ed.getAttributes('link').href as string | undefined;
    const apply = (url: string) => {
      if (!url) ed.chain().focus().extendMarkRange('link').unsetLink().run();
      else ed.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };
    if (onRequestLink) onRequestLink(apply, current);
  }, [onRequestLink]);

  if (!editor) return <div className="nt-editor2 is-loading">LOADING · 편집기</div>;

  return (
    <div className="nt-editor2">
      <div className="nt-editor2__bar" contentEditable={false}>
        <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
          ↶ 취소
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
          ↷ 다시
        </button>
        <span className="nt-editor2__sep" />
        <button type="button" onClick={() => pickImages(false, (urls) => urls[0] && editor.chain().focus().insertFigure({ src: urls[0] }).run())}>
          + 이미지
        </button>
        <span className="nt-editor2__hint">빈 줄에서 “/” 삽입 메뉴 · 이미지는 끌어다 놓거나 붙여넣기 · 왼쪽 손잡이로 순서</span>
        {busy && <span className="nt-editor2__busy">{busy}</span>}
      </div>

      <DragHandle editor={editor}>
        <span className="nt-editor2__grip" aria-hidden>
          ⋮⋮
        </span>
      </DragHandle>


      <div className="nt-editor2__stage">
        <EditorContent editor={editor} />
      {bubble && (
        <div className="nt-bubble__host" style={{ left: bubble.x, top: bubble.y }} onMouseDown={(e) => e.preventDefault()}>
        <div className="nt-bubble">
            <button type="button" className={editor.isActive('bold') ? 'on' : undefined} onClick={() => editor.chain().focus().toggleBold().run()}>
              <b>B</b>
            </button>
            <button type="button" className={editor.isActive('italic') ? 'on' : undefined} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <i>I</i>
            </button>
            <button type="button" className={editor.isActive('underline') ? 'on' : undefined} onClick={() => editor.chain().focus().toggleUnderline().run()}>
              <u>U</u>
            </button>
            <button type="button" className={editor.isActive('link') ? 'on' : undefined} onClick={setLink}>
              링크
            </button>
            <span className="nt-bubble__sep" />
            <button type="button" className={editor.isActive('heading', { level: 2 }) ? 'on' : undefined} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              제목
            </button>
            <button type="button" className={editor.isActive('heading', { level: 3 }) ? 'on' : undefined} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
              소제목
            </button>
            <button type="button" className={editor.isActive('blockquote') ? 'on' : undefined} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              인용
            </button>
          </div>
        </div>
      )}
        <SlashMenu editor={editor} state={slash.state} items={slash.items} index={slash.index} onIndex={slash.setIndex} onPick={pickSlash} />
      </div>

      <ImageKitPicker
        open={picker.open}
        multiple={picker.multiple}
        onClose={() => setPicker((p) => ({ ...p, open: false }))}
        onSelect={(urls) => {
          picker.onPick(urls);
          setPicker((p) => ({ ...p, open: false }));
        }}
        title="도판 선택"
      />
    </div>
  );
};

export default Editor2;
