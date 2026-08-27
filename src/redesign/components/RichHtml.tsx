import DOMPurify from 'dompurify';
import React, { useMemo } from 'react';
import { ikUrl } from '../../utils/ikUrl';

// ════════════════════════════════════════════════════════════════════════
// RichHtml — DB 에 저장된 **레거시 에디터 HTML 을 v5 조판으로 되읽는다**.
//   내용(문장·이미지·영상)은 하나도 버리지 않는다. 버리는 것은 **판식뿐**:
//     · style / class / font 태그 = 옛 디자인(Helvetica·가운데정렬·flex·둥근모서리)의 잔재 → 제거
//     · 빈 <p><br></p> 더미 = 에디터가 남긴 여백 → 제거(v5 는 계선과 여백으로 리듬을 만든다)
//     · <img> → 도판 창(.rfig, 봉인 72% → 호버 100%)  · <iframe> → 16:9 창
//   살균은 DOMPurify(레거시와 같은 정책, iframe 허용). ikUrl 로 ImageKit 변환 규칙 유지(GIF 제외).
// ════════════════════════════════════════════════════════════════════════

const PURIFY: any = {
  ADD_TAGS: ['iframe'],
  ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src', 'target'],
  // 옛 판식을 지운다 — 내용이 아니라 껍데기다.
  FORBID_TAGS: ['font', 'style'],
  FORBID_ATTR: ['style', 'class', 'align', 'bgcolor', 'face', 'size', 'border', 'cellpadding', 'cellspacing'],
};

/** 텍스트도 미디어도 없는 껍데기 요소를 없앤다(에디터가 남긴 빈 문단·래퍼). */
function prune(root: HTMLElement) {
  for (let pass = 0; pass < 4; pass += 1) {
    let removed = 0;
    root.querySelectorAll('p, div, span, section, article, center, b, strong, em, i, u, h1, h2, h3, h4').forEach((el) => {
      if (el.querySelector('img, iframe, video, figure, hr, table')) return;
      if ((el.textContent || '').replace(/[ \s]/g, '')) return;
      el.remove();
      removed += 1;
    });
    if (!removed) break;
  }
}

/** 도판 창으로 승격 — 문단 안에 갇힌 이미지를 흐름 최상위로 끌어올린다. */
function liftMedia(root: HTMLElement, doc: Document) {
  root.querySelectorAll('img').forEach((img) => {
    const raw = img.getAttribute('src') || '';
    if (!raw) {
      img.remove();
      return;
    }
    img.setAttribute('src', ikUrl(raw.startsWith('//') ? `https:${raw}` : raw, { w: 1600 }));
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    if (!img.getAttribute('alt')) img.setAttribute('alt', '도판');

    let top: Element = img;
    while (top.parentElement && top.parentElement !== root) top = top.parentElement;
    const fig = doc.createElement('figure');
    fig.className = 'rfig';
    root.insertBefore(fig, top);
    fig.appendChild(img);
  });

  root.querySelectorAll('iframe').forEach((frame) => {
    let top: Element = frame;
    while (top.parentElement && top.parentElement !== root) top = top.parentElement;
    const box = doc.createElement('div');
    box.className = 'vwrap';
    root.insertBefore(box, top);
    box.appendChild(frame);
  });

  root.querySelectorAll('video').forEach((v) => {
    v.setAttribute('controls', 'controls');
    v.setAttribute('preload', 'metadata');
  });

  // 외부 링크는 새 탭(레거시와 동일 동작)
  root.querySelectorAll('a[href^="http"]').forEach((a) => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
}

/** 레거시 HTML → v5 판식 HTML. 브라우저 DOM 이 없으면(SSR) 살균만 한 채 돌려준다. */
export function toV5Html(html: string): string {
  if (!html) return '';
  const clean = DOMPurify.sanitize(html, PURIFY) as unknown as string;
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return clean;
  const doc = new DOMParser().parseFromString(`<body>${clean}</body>`, 'text/html');
  const root = doc.body;
  liftMedia(root, doc);
  prune(root);
  return root.innerHTML;
}

/** 본문에서 이미지 주소만 뽑는다(About 우단 도판용). */
export function imagesIn(html: string): string[] {
  if (!html) return [];
  const clean = DOMPurify.sanitize(html, PURIFY) as unknown as string;
  const found = clean.match(/<img[^>]+src="([^"]+)"/g) || [];
  return found
    .map((tag) => (tag.match(/src="([^"]+)"/) || [])[1])
    .filter(Boolean)
    .map((src) => (src.startsWith('//') ? `https:${src}` : src));
}

/** 본문에서 이미지를 뺀 나머지(문단만) — About 좌단 소개글용. */
export function textOnly(html: string): string {
  const v5 = toV5Html(html);
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return v5;
  const doc = new DOMParser().parseFromString(`<body>${v5}</body>`, 'text/html');
  doc.body.querySelectorAll('figure.rfig').forEach((f) => f.remove());
  return doc.body.innerHTML;
}

export interface RichHtmlProps {
  html: string;
  /** 기본 'rich' — 필요하면 'body rich' 처럼 겹쳐 쓴다 */
  className?: string;
  /** true 면 이미지를 뺀 문단만 렌더 */
  textOnlyMode?: boolean;
}

const RichHtml: React.FC<RichHtmlProps> = ({ html, className = 'rich', textOnlyMode }) => {
  const out = useMemo(() => (textOnlyMode ? textOnly(html) : toV5Html(html)), [html, textOnlyMode]);
  if (!out) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: out }} />;
};

export default React.memo(RichHtml);
