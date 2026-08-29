// ════════════════════════════════════════════════════════════════════════
// normalizeLegacy — 레거시(cafe24·BlockEditor) HTML 을 편집기 2.0 이 읽기 좋은 꼴로 미리 다듬는다.
//   원칙: **내용은 하나도 버리지 않는다**. 껍데기 div/span/center 만 벗기고,
//   스타일만 있는 div 는 <p> 로, 표·알 수 없는 복합 블록은 [data-nt-legacy] 로 감싸 ntRaw 가 보존한다.
//   (이 함수는 편집기에 **넣을 때만** 쓴다. 저장은 편집기 getHTML() 그대로.)
// ════════════════════════════════════════════════════════════════════════

const INLINE = new Set(['A', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'SPAN', 'BR', 'CODE', 'SUB', 'SUP', 'FONT', 'SMALL', 'MARK']);
const KEEP_BLOCK = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'HR', 'PRE', 'FIGURE', 'IFRAME', 'IMG', 'TABLE']);

function isInlineOnly(el: Element): boolean {
  return Array.from(el.childNodes).every((n) => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && INLINE.has((n as Element).tagName)));
}

function unwrap(el: Element) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

export function normalizeLegacy(html: string): string {
  if (!html || typeof DOMParser === 'undefined') return html || '';
  // 이미 2.0 계약으로 저장된 글은 손대지 않는다
  if (/data-nt="/.test(html)) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const body = doc.body;

  // 표는 통째로 보존
  body.querySelectorAll('table').forEach((t) => {
    const wrap = doc.createElement('div');
    wrap.setAttribute('data-nt-legacy', '1');
    t.replaceWith(wrap);
    wrap.appendChild(t);
  });

  // 안쪽부터 div/section/article/center 를 정리한다
  for (let pass = 0; pass < 6; pass += 1) {
    const wrappers = Array.from(body.querySelectorAll('div:not([data-nt-legacy]), section, article, center'));
    if (!wrappers.length) break;
    let changed = 0;
    wrappers.reverse().forEach((el) => {
      if (el.closest('[data-nt-legacy]') && el.getAttribute('data-nt-legacy') === null && el.parentElement?.closest('[data-nt-legacy]')) return;
      const hasBlockChild = Array.from(el.children).some((c) => KEEP_BLOCK.has(c.tagName) || c.tagName === 'DIV');
      if (el.querySelector('iframe') && !hasBlockChild) {
        // 영상 래퍼 → iframe 만 남긴다(ntEmbed 가 읽는다)
        const f = el.querySelector('iframe') as HTMLElement;
        el.replaceWith(f);
        changed += 1;
        return;
      }
      if (hasBlockChild) {
        unwrap(el);
        changed += 1;
        return;
      }
      if (isInlineOnly(el)) {
        const text = (el.textContent || '').replace(/ /g, ' ').trim();
        if (!text && !el.querySelector('img')) {
          el.remove();
          changed += 1;
          return;
        }
        const p = doc.createElement('p');
        while (el.firstChild) p.appendChild(el.firstChild);
        el.replaceWith(p);
        changed += 1;
      }
    });
    if (!changed) break;
  }

  // 인라인 스타일·font 태그 정리(판식은 2.0 이 정한다). 내용은 유지.
  body.querySelectorAll('[style]').forEach((el) => {
    if (el.closest('[data-nt-legacy]')) return;
    el.removeAttribute('style');
  });
  body.querySelectorAll('font').forEach((f) => unwrap(f));
  body.querySelectorAll('span').forEach((s) => {
    if (s.closest('[data-nt-legacy]')) return;
    if (!s.attributes.length || (s.attributes.length === 1 && s.hasAttribute('class'))) unwrap(s);
  });
  // 빈 문단 더미 제거(연속 <p><br></p>)
  body.querySelectorAll('p').forEach((p) => {
    if (!(p.textContent || '').replace(/ |\s/g, '') && !p.querySelector('img, iframe')) p.remove();
  });
  return body.innerHTML;
}
