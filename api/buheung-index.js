// ═══════════════════════════════════════════════════════════════
// 부흥여지도 공유 카드(OG) — nodetree.kr/buheung 전용 (크롤러 대응)
//   · 카톡·페북 크롤러는 JS를 돌리지 않아 정적 index.html 의 NODE TREE 카드를 본다.
//     이 함수가 build/index.html 을 읽어 부흥여지도 title·description·og:*·twitter:* 를 넣어 돌려준다.
//   · 연결: vercel.json 의 host 조건부 route(nodetree.kr · www, 경로 /buheung)만. 다른 경로·호스트 무영향.
//   · og-index.js 와 같은 치환 방식을 따로 둔다(기존 홈 카드 함수에 회귀를 만들지 않으려고).
//   · 카드 그림을 바꾸면 파일명도 바꾼다(og-v2.png…) — 카톡이 그림을 URL로 캐시한다.
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const OG = {
  title: '부흥여지도',
  siteName: '부흥여지도',
  description: '청소년이 찾아낸 부여의 가능성 · 우리가 자주 가는 장소 39곳',
  url: 'https://nodetree.kr/buheung',
  image: 'https://nodetree.kr/buheung/og-v1.png',
  imageAlt: '노랑 판 위 손 글씨 「부흥여지도」와 먹선으로 그린 부여 지도',
};

const HTML_CANDIDATES = [
  path.join(process.cwd(), 'build', 'index.html'),
  path.join(__dirname, '..', 'build', 'index.html'),
];

let cachedHtml = null;
function readBaseHtml() {
  if (cachedHtml) return cachedHtml;
  for (const p of HTML_CANDIDATES) {
    try {
      cachedHtml = fs.readFileSync(p, 'utf8');
      return cachedHtml;
    } catch (_) {
      /* 다음 후보 */
    }
  }
  return null;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function setMeta(html, attr, key, value) {
  const a = new RegExp(`<meta([^>]*?)${attr}="${key}"([^>]*?)content="[^"]*"([^>]*?)/?>`, 'i');
  if (a.test(html)) return html.replace(a, `<meta$1${attr}="${key}"$2content="${esc(value)}"$3/>`);
  const b = new RegExp(`<meta([^>]*?)content="[^"]*"([^>]*?)${attr}="${key}"([^>]*?)/?>`, 'i');
  if (b.test(html)) return html.replace(b, `<meta$1content="${esc(value)}"$2${attr}="${key}"$3/>`);
  return html.replace(/<\/head>/i, `<meta ${attr}="${key}" content="${esc(value)}"/></head>`);
}

function inject(html) {
  let out = html.replace(/<title>[^<]*<\/title>/i, `<title>${esc(OG.title)}</title>`);
  out = setMeta(out, 'name', 'description', OG.description);
  out = setMeta(out, 'property', 'og:type', 'website');
  out = setMeta(out, 'property', 'og:site_name', OG.siteName);
  out = setMeta(out, 'property', 'og:title', OG.title);
  out = setMeta(out, 'property', 'og:description', OG.description);
  out = setMeta(out, 'property', 'og:url', OG.url);
  out = setMeta(out, 'property', 'og:image', OG.image);
  out = setMeta(out, 'property', 'og:image:width', '1200');
  out = setMeta(out, 'property', 'og:image:height', '630');
  out = setMeta(out, 'property', 'og:image:alt', OG.imageAlt);
  out = setMeta(out, 'name', 'twitter:card', 'summary_large_image');
  out = setMeta(out, 'name', 'twitter:title', OG.title);
  out = setMeta(out, 'name', 'twitter:description', OG.description);
  out = setMeta(out, 'name', 'twitter:image', OG.image);
  out = out.replace(
    /<link([^>]*?)rel="canonical"([^>]*?)href="[^"]*"([^>]*?)\/?>/i,
    `<link$1rel="canonical"$2href="${esc(OG.url)}"$3/>`,
  );
  return out;
}

module.exports = (req, res) => {
  const base = readBaseHtml();
  if (!base) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('index.html not found');
    return;
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  res.end(inject(base));
};
