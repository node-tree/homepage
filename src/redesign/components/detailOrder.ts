import { DbPost } from '../db';
import { toV5Html } from './RichHtml';
import videoTitles from '../data/videoTitles.json';

export type DetailVideo = { html: string; title: string };
// ImageKit transforms do not turn a photograph into a different source photograph.
export function photoKey(src: string): string {
  try {
    const url = new URL(src, document.baseURI);
    url.pathname = url.pathname.replace(/\/tr:[^/]+/g, '');
    url.searchParams.delete('tr'); url.hash = '';
    return url.href;
  } catch { return src; }
}

export function orderDetail(post: DbPost | null) {
  const root = document.createElement('div');
  root.innerHTML = toV5Html(post?.content || '');
  const videos: DetailVideo[] = [];
  root.querySelectorAll('iframe, video').forEach(frame => {
    const src = frame.getAttribute('src') || '';
    const id = src.match(/(?:embed\/|youtu\.be\/|[?&]v=)([\w-]+)/)?.[1];
    const title = (videoTitles as Record<string, string>)[`https://www.youtube.com/embed/${id}`] || frame.getAttribute('title') || '';
    if (frame.tagName === 'IFRAME') {
      frame.setAttribute('title', title || '영상');
      frame.setAttribute('loading', 'lazy');
    }
    videos.push({ html: frame.outerHTML, title });
    frame.remove();
  });
  const photos: HTMLImageElement[] = [];
  const seen = new Set<string>();
  const collect = (img: HTMLImageElement) => {
    const src = img.getAttribute('src') || '';
    if (src && !seen.has(photoKey(src))) { seen.add(photoKey(src)); photos.push(img.cloneNode(true) as HTMLImageElement); }
  };
  root.querySelectorAll<HTMLImageElement>('img').forEach(img => {
    collect(img);
    const figure = img.closest('figure');
    figure?.querySelector('figcaption')?.remove();
    img.remove();
  });
  (post?.images || []).forEach(src => { const img = document.createElement('img'); img.src = src; img.alt = post?.title || ''; collect(img); });
  const bodyPhotoCount = photos.length;
  const thumbnail = post?.thumbnail;
  const firstVideo = bodyPhotoCount === 0 ? videos.shift() : undefined;
  let hero: HTMLImageElement | undefined;
  if (thumbnail) {
    const index = photos.findIndex(img => photoKey(img.src) === photoKey(thumbnail));
    const img = index >= 0 ? photos.splice(index, 1)[0] : document.createElement('img');
    img.src = thumbnail; img.alt = img.alt || post?.title || '';
    if (firstVideo) photos.unshift(img); else hero = img;
  } else if (!firstVideo) hero = photos.shift();
  // Remove empty legacy media wrappers, keeping prose and its relative order.
  Array.from(root.querySelectorAll('*')).reverse().forEach(el => {
    if (!el.textContent?.trim() && !el.querySelector('hr, table, a') && !el.matches('hr, br, table, a')) el.remove();
  });
  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
  const first = root.querySelector('p');
  if (post?.lede && first && normalize(first.textContent || '') === normalize(post.lede)) first.remove();
  const figureHtml = (img: HTMLImageElement) => `<figure>${img.outerHTML}</figure>`;
  return {
    hero: hero ? figureHtml(hero) : undefined,
    body: root.innerHTML,
    photos: photos.map(figureHtml).join(''),
    photoCount: photos.length + (hero ? 1 : 0),
    firstVideo, videos,
    videoCount: videos.length + (firstVideo ? 1 : 0),
  };
}
