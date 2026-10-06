import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toV5Html } from './RichHtml';
import { ikUrl } from '../../utils/ikUrl';
import '../photos.css';

type Photo = { src: string; alt: string; caption?: string; credit?: string };
interface Props {
  hero?: string; body: string; lede?: string; photoHtml: string;
  imageLayout?: unknown[]; title: string; children?: React.ReactNode;
}

// No ratio fixture is imported: the browser reads each actual image's intrinsic size.
function arrange(group: HTMLElement) {
  const figures = Array.from(group.children) as HTMLElement[];
  figures.forEach(fig => {
    const img = fig.querySelector('img')!;
    fig.dataset.landscape = String(img.naturalHeight > 0 && img.naturalWidth / img.naturalHeight > 1.15);
  });
  let large = true;
  for (let i = 0; i < figures.length;) {
    const fig = figures[i];
    if (fig.dataset.size) {
      fig.style.setProperty('--photo-span', fig.dataset.size === 'full' ? '6' : fig.dataset.size === 'half' ? '3' : '2');
      i++; continue;
    }
    const portrait = (el: HTMLElement) => {
      const img = el.querySelector('img')!;
      return img.naturalWidth > 0 && img.naturalWidth < img.naturalHeight;
    };
    if (portrait(fig)) {
      let end = i;
      while (end < figures.length && !figures[end].dataset.size && portrait(figures[end])) end++;
      const count = end - i;
      // Four portraits remain 2+2. Only an exact triplet gets three columns.
      const span = count === 3 ? '2' : '3';
      for (; i < end; i++) figures[i].style.setProperty('--photo-span', span);
      large = true;
    } else {
      // A final landscape pair closes the group even when the next beat is large.
      const tailPair = i === figures.length - 2 && fig.dataset.landscape === 'true' && figures[i + 1].dataset.landscape === 'true';
      const pair = (!large || tailPair) && i + 1 < figures.length && !figures[i + 1].dataset.size && !portrait(figures[i + 1]);
      fig.style.setProperty('--photo-span', pair ? '3' : '6');
      if (pair) figures[++i].style.setProperty('--photo-span', '3');
      i++; large = !large;
    }
  }
}

const PhotoEssay: React.FC<Props> = ({ hero, body, lede, photoHtml, imageLayout, title, children }) => {
  const hasProseEnd = React.Children.toArray(children).length > 0;
  const [proseTarget, setProseTarget] = useState<HTMLElement | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const photos = useRef<Photo[]>([]);
  const trigger = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const update = () => setWide(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    const host = root.current!;
    const doc = document;
    host.innerHTML = '';
    const lead = doc.createElement('div'); lead.className = 'rl rich lead-media';
    if (hero) lead.innerHTML = toV5Html(hero);
    if (lead.childNodes.length) host.append(lead);
    const content = doc.createElement('div'); content.className = 'rl rich photo-content';
    if (lede) { const p = doc.createElement('p'); p.className = 'post-lede reading-text'; p.textContent = lede; content.append(p); }
    const raw = doc.createElement('div'); raw.innerHTML = toV5Html(body);
    content.append(...Array.from(raw.childNodes));
    const tail = doc.createElement('div'); tail.className = 'photo-prose-tail';
    content.append(tail); setProseTarget(tail);
    const photoRoot = doc.createElement('div'); photoRoot.innerHTML = toV5Html(photoHtml);
    content.append(...Array.from(photoRoot.childNodes));
    host.append(content);
    const all = Array.from(host.querySelectorAll<HTMLImageElement>('img'));
    if (all[0]) (all[0].closest('figure') || all[0]).id = 'detail-photos';
    host.querySelectorAll('figure.rfig figcaption').forEach(el => el.remove());
    photos.current = all.map(img => ({ src: img.src, alt: img.alt === '이미지' ? title : img.alt || title }));
    const layouts = new Map<string, string>();
    (imageLayout || []).forEach(entry => {
      const item = entry as { src?: string; size?: string };
      if (item.src && ['full', 'half', 'third'].includes(item.size || '')) layouts.set(new URL(ikUrl(item.src, { w: 1600 }), document.baseURI).href, item.size!);
    });
    all.forEach((img, index) => {
      const button = doc.createElement('button'); button.type = 'button'; button.className = 'photo-open';
      button.dataset.photo = String(index); button.setAttribute('aria-label', `${photos.current[index].alt} 사진 ${index + 1} 크게 보기`);
      img.before(button); button.append(img);
      const size = layouts.get(img.src); if (size && img.closest('figure')) (img.closest('figure') as HTMLElement).dataset.size = size;
      img.addEventListener('error', () => { button.classList.add('photo-unavailable'); button.setAttribute('aria-label', '사진을 불러오지 못했습니다. 크게 보기로 다시 시도'); });
    });
    // Short essays keep one column.
    if (all.length <= 2) return;
    // Group only adjacent top-level photographs. Text, video and editor contracts stop a run.
    let group: HTMLElement | null = null;
    Array.from(content.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) return;
      if (node instanceof HTMLElement && node.matches('figure.rfig')) {
        if (!group) { group = doc.createElement('div'); group.className = 'photo-group'; node.before(group); }
        group.append(node);
      } else group = null;
    });
    const groups = Array.from(content.querySelectorAll<HTMLElement>('.photo-group'));
    groups.forEach(el => {
      arrange(el);
      el.querySelectorAll('img').forEach(img => img.addEventListener('load', () => arrange(el)));
    });
    const observers: ResizeObserver[] = [];
    if (wide && all.length > 2) {
      // The fixed header can resize with navigation, fonts and viewport width.
      // Scope its measured lower edge to this essay; decoration is independent.
      const header = host.closest('.nt')?.querySelector('header');
      if (header) {
        const measureHeader = () => host.style.setProperty('--photo-header-bottom', `${header.getBoundingClientRect().bottom}px`);
        measureHeader();
        const observer = new ResizeObserver(measureHeader);
        observer.observe(header); observers.push(observer);
      }
      groups.forEach(el => {
        const preceding: Node[] = [];
        let prev = el.previousSibling;
        while (prev && !(prev instanceof HTMLElement && (prev.matches('.photo-group, .photo-split') || prev.querySelector('img, iframe, video')))) {
          preceding.unshift(prev); prev = prev.previousSibling;
        }
        if (!preceding.some(n => n.textContent?.trim()) && !hasProseEnd) return;
        const section = doc.createElement('section'); section.className = 'photo-split';
        const prose = doc.createElement('div'); prose.className = 'photo-prose';
        el.before(section); prose.append(...preceding); section.append(prose, el);
        const measureProse = () => prose.style.setProperty('--prose-height', `${prose.getBoundingClientRect().height}px`);
        measureProse();
        const observer = new ResizeObserver(measureProse);
        observer.observe(prose); observers.push(observer);
      });
    }
    return () => observers.forEach(observer => observer.disconnect());
  }, [hero, body, lede, photoHtml, imageLayout, title, wide, hasProseEnd]);

  useEffect(() => {
    if (active === null) return;
    const el = dialog.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    el.showModal();
    return () => {
      el.close(); document.body.style.overflow = overflow;
      trigger.current?.focus({ preventScroll: true });
    };
    // Dialog lifecycle must not restart on each photograph.
  }, [active === null]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setFailed(false); }, [active]);
  const move = (step: number) => setActive(n => n === null ? null : (n + step + photos.current.length) % photos.current.length);
  const photo = active === null ? null : photos.current[active];
  return <>
    {proseTarget && createPortal(children, proseTarget)}
    <div ref={root} className="photo-essay photos-split" onClick={event => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-photo]');
      if (button) { trigger.current = button; setActive(Number(button.dataset.photo)); }
    }} />
    {photo && createPortal(<dialog ref={dialog} className="photo-dialog" aria-label={`${title} 사진 크게 보기`}
      onCancel={event => { event.preventDefault(); setActive(null); }}
      onKeyDown={event => {
        if (event.key === 'Tab') {
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
      }}>
      <div className="photo-toolbar"><span aria-live="polite">{active! + 1} / {photos.current.length}</span><button type="button" autoFocus onClick={() => setActive(null)}>닫기 · Esc</button></div>
      <div className="photo-stage" onTouchStart={event => { const t = event.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; }}
        onTouchEnd={event => { const t = event.changedTouches[0], start = touch.current; touch.current = null;
          if (start && Math.abs(t.clientX - start.x) > 50 && Math.abs(t.clientX - start.x) > Math.abs(t.clientY - start.y)) move(t.clientX < start.x ? 1 : -1);
        }}>
        {failed ? <p role="status">사진을 불러오지 못했습니다. <button type="button" onClick={() => setFailed(false)}>다시 시도</button></p> : <img key={photo.src} src={photo.src} alt={photo.alt} onError={() => setFailed(true)} />}
      </div>
      {(photo.caption || photo.credit) && <p className="photo-caption">{[photo.caption, photo.credit].filter(Boolean).join(' · ')}</p>}
      {photos.current.length > 1 && <div className="photo-navigation"><button type="button" onClick={() => move(-1)} aria-label="이전 사진">← 이전</button><button type="button" onClick={() => move(1)} aria-label="다음 사진">다음 →</button></div>}
    </dialog>, document.body)}
  </>;
};
export default PhotoEssay;
