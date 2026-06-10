// ═══════════════════════════════════════════════════════════════
// InlineText — 텍스트 블록 내부의 contentEditable 인라인 에디터
//   · 굵게/기울임/밑줄/링크/색상/크기 인라인 서식(execCommand)을 지원.
//   · 부모가 비제어(uncontrolled)로 다루도록, onCommit(html) 으로만 보고.
//     매 키 입력마다 setState 하지 않아 커서 점프를 방지한다.
// ═══════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';

interface InlineTextProps {
  html: string;
  tag: string; // p,h1,h2,h3,blockquote,ul,ol
  align?: string;
  placeholder?: string;
  onCommit: (html: string) => void;
  onFocusToolbar?: (api: InlineApi | null) => void;
}

export interface InlineApi {
  exec: (command: string, value?: string) => void;
}

const InlineText: React.FC<InlineTextProps> = ({
  html,
  tag,
  align,
  placeholder,
  onCommit,
  onFocusToolbar,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  // 초기/외부 변경 시에만 innerHTML 주입(편집 중 덮어쓰기 방지).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html && !focused) {
      ref.current.innerHTML = html || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  const exec = (command: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
    if (ref.current) onCommit(ref.current.innerHTML);
  };

  const TagName = (tag === 'ul' || tag === 'ol' ? 'div' : tag) as any;
  const isList = tag === 'ul' || tag === 'ol';

  return (
    <TagName
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={`bk-inline ${isList ? 'bk-inline-list' : ''}`}
      data-placeholder={placeholder || '텍스트를 입력하세요'}
      style={{ textAlign: (align as any) || 'left' }}
      onFocus={() => {
        setFocused(true);
        onFocusToolbar?.({ exec });
      }}
      onBlur={() => {
        setFocused(false);
        if (ref.current) onCommit(ref.current.innerHTML);
      }}
      onInput={() => {
        if (ref.current) onCommit(ref.current.innerHTML);
      }}
    />
  );
};

export default InlineText;
