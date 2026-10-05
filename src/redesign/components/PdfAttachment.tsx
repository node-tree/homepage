import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import attachments from '../pdfAttachments.json';
import '../pdf.css';

type Attachment = typeof attachments[number];
type PageImage = { src: string; width: number; height: number; bytes: number };
type Manifest = { pageCount: number; sourceBytes: number; cover: string; pages: PageImage[] };

function PdfLeaf({ page, number, title }: { page: PageImage; number: number; title: string }) {
  const [state, setState] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  return <div className="pdf-leaf" aria-busy={state === 'loading'}>
    {state === 'loading' && <span className="pdf-image-status" role="status">{number}쪽 불러오는 중…</span>}
    {state === 'error' && <div className="pdf-image-status" role="alert">
      <p>{number}쪽을 불러오지 못했습니다.</p>
      <button type="button" onClick={() => { setState('loading'); setAttempt(n => n + 1); }}>다시 시도</button>
    </div>}
    <img key={attempt} src={page.src + (attempt ? `?retry=${attempt}` : '')} width={page.width} height={page.height}
      alt={`${title}, ${number}쪽`} draggable={false} style={{ visibility: state === 'ready' ? 'visible' : 'hidden' }}
      onLoad={() => setState('ready')} onError={() => setState('error')} />
  </div>;
}

function PdfViewer({ item, manifest, onClose }: { item: Attachment; manifest: Manifest; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [page, setPage] = useState(1);
  const [input, setInput] = useState('1');
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  // Some source PDFs already impose two printed pages on one landscape page.
  const [spread, setSpread] = useState(() => !manifest.pages.some(image => image.width > image.height));
  const [zoom, setZoom] = useState(false);
  const paired = wide && spread;
  const first = paired && page > 1 ? page - page % 2 : page;
  const last = paired && first > 1 ? Math.min(first + 1, manifest.pageCount) : first;
  const go = (target: number) => setPage(Math.max(1, Math.min(manifest.pageCount, target)));
  const next = () => go(last + 1);
  const previous = () => go(paired ? first - 2 : first - 1);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const update = () => setWide(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const el = dialog.current!;
    const trigger = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    el.showModal();
    el.querySelector<HTMLButtonElement>('.pdf-close')?.focus();
    document.body.style.overflow = 'hidden';
    return () => { el.close(); document.body.style.overflow = overflow; trigger?.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    setInput(String(first));
    stage.current?.scrollTo(0, 0);
    // Fetch only the next reading unit, never the entire publication.
    const ahead = paired ? 2 : 1;
    for (let n = last + 1; n <= Math.min(last + ahead, manifest.pageCount); n++) {
      const image = new Image(); image.src = manifest.pages[n - 1].src;
    }
  }, [first, last, paired, manifest]);
  useEffect(() => { stage.current?.scrollTo(0, 0); }, [zoom]);

  const keyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Tab') {
      const controls = Array.from(dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input')).filter(el => el.getClientRects().length);
      const start = controls[0], end = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === start) { event.preventDefault(); end.focus(); }
      else if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); start.focus(); }
    }
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); next(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); previous(); }
    if (event.key === 'Home') { event.preventDefault(); go(1); }
    if (event.key === 'End') { event.preventDefault(); go(manifest.pageCount); }
  };

  return createPortal(<dialog ref={dialog} className="pdf-dialog" aria-labelledby={`pdf-title-${item.id}`}
    aria-describedby={`pdf-help-${item.id}`} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={keyDown}>
    <header className="pdf-toolbar">
      <div><span className="pdf-eyebrow">{item.kind}</span><h2 id={`pdf-title-${item.id}`}>{item.title}</h2></div>
      <button type="button" className="pdf-close" onClick={onClose}>닫기 <span aria-hidden="true">×</span></button>
    </header>
    <div className="pdf-options">
      <div className="pdf-modes">
        {wide && <button type="button" aria-pressed={spread} onClick={() => setSpread(value => !value)}>{spread ? '한 쪽 보기' : '두 쪽 보기'}</button>}
        <button type="button" aria-pressed={zoom} onClick={() => setZoom(value => !value)}>{zoom ? '화면에 맞추기' : '확대 보기'}</button>
      </div>
      <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer">원본 PDF 열기 ↗</a>
    </div>
    <div ref={stage} className={`pdf-stage${zoom ? ' is-zoomed' : ''}`} tabIndex={0} aria-label="PDF 지면"
      onTouchStart={event => { touch.current = !zoom && event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }}
      onTouchMove={event => { if (event.touches.length !== 1) touch.current = null; }}
      onTouchCancel={() => { touch.current = null; }}
      onTouchEnd={event => {
        const start = touch.current; touch.current = null;
        if (!start || zoom || !event.changedTouches.length) return;
        const dx = event.changedTouches[0].clientX - start.x;
        const dy = event.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0) next(); else previous(); }
      }}>
      <div className="pdf-sheets">
        {Array.from({ length: last - first + 1 }, (_, index) => first + index).map(number =>
          <PdfLeaf key={number} page={manifest.pages[number - 1]} number={number} title={item.title} />)}
      </div>
    </div>
    <nav className="pdf-navigation" aria-label="PDF 쪽 이동">
      <button type="button" disabled={first === 1} onClick={previous} aria-label="이전 쪽">← <span>이전</span></button>
      <div className="pdf-pagination">
        <span className="pdf-page-count" aria-hidden="true">{first}{last > first ? `–${last}` : ''} / {manifest.pageCount}</span>
        <form onSubmit={event => { event.preventDefault(); const target = Number(input); if (Number.isFinite(target) && input) go(Math.round(target)); }}>
          <div className="pdf-jump-field">
            <label htmlFor={`pdf-page-${item.id}`}>쪽 이동</label>
            <input id={`pdf-page-${item.id}`} type="number" inputMode="numeric" min={1} max={manifest.pageCount} value={input} onChange={event => setInput(event.target.value)} />
          </div>
          <button type="submit">이동</button>
        </form>
      </div>
      <button type="button" disabled={last === manifest.pageCount} onClick={next} aria-label="다음 쪽"><span>다음</span> →</button>
    </nav>
    <span className="pdf-sr-only" role="status" aria-live="polite">{first}{last > first ? `–${last}` : ''} / {manifest.pageCount}쪽</span>
    <p className="pdf-help" id={`pdf-help-${item.id}`}>PDF 쪽 기준 · 이미지 미리보기 · 검색·선택은 원본 PDF에서</p>
  </dialog>, document.body);
}

function AttachmentCard({ item }: { item: Attachment }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    fetch(item.manifestUrl, { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Missing preview');
      return response.json();
    }).then((data: Manifest) => {
      if (!data.pageCount || data.pages?.length !== data.pageCount) throw new Error('Invalid preview');
      setManifest(data);
    }).catch(error => { if (error.name !== 'AbortError') setFailed(true); });
    return () => controller.abort();
  }, [item.manifestUrl, attempt]);
  return <section className="pdf-attachment" aria-label={`${item.title} ${item.kind}`}>
    <div className="pdf-cover">
      {manifest && <img src={manifest.cover} width={manifest.pages[0].width} height={manifest.pages[0].height}
        alt={`${item.title} ${item.kind} 표지`} loading="lazy" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />}
    </div>
    <div className="pdf-info">
      <p className="pdf-meta">{item.kind}{manifest && ` · ${manifest.pageCount}쪽 · PDF ${(manifest.sourceBytes / 1000000).toFixed(1)} MB`}</p>
      <h2>{item.title}</h2>
      <div className="pdf-actions">
        {manifest ? <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog">펼쳐 보기 <span aria-hidden="true">↗</span></button>
          : failed ? <button type="button" onClick={() => setAttempt(value => value + 1)}>미리보기 다시 시도</button>
          : <span role="status">미리보기 준비 중…</span>}
        <a href={item.pdfUrl} download={item.downloadName}>PDF 내려받기 <span aria-hidden="true">↓</span></a>
      </div>
      {failed && <p className="pdf-error" role="alert">미리보기를 불러오지 못했습니다. <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer">원본 PDF 열기 ↗</a></p>}
    </div>
    {open && manifest && <PdfViewer item={item} manifest={manifest} onClose={() => setOpen(false)} />}
  </section>;
}

export default function PdfAttachments({ postId }: { postId: string }) {
  return <>{attachments.filter(item => item.postId === postId).map(item => <AttachmentCard key={item.id} item={item} />)}</>;
}
