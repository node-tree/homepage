// ═══════════════════════════════════════════════════════════════
// 호스트별 OG 주입 (크롤러 대응) — nodetree.kr / saengsanso.com
//   · 문제: 정적 index.html 은 NODE TREE OG 하나뿐이라, 같은 배포를 공유하는
//     saengsanso.com 크롤러도 NODE TREE 카드를 본다(클라이언트 SeoHead 는 JS
//     미실행 크롤러에 무효).
//   · 해결: 이 서버리스 함수가 build/index.html 을 읽어 Host 에 맞는 OG(title/
//     description/og:*/twitter:*)를 주입해 응답한다.
//   · 스코프: vercel.json 의 host 조건부 route 로 nodetree.kr·www·saengsanso.com·www
//     루트 '/'만 이 함수에 연결한다. isoartlab.com 은 기존 api/iso-index.js 가
//     그대로 담당(이 함수는 isoartlab 을 다루지 않음 → iso 회귀 0).
//   · 알 수 없는 호스트는 정적 기본(NODE TREE) 그대로 반환(안전 폴백).
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// 호스트 → OG 값 매핑(코드 근거: App.tsx SEO_DATA, Saengsanso SSO_SEO_MAP).
const OG_BY_HOST = {
  'nodetree.kr': {
    title: 'NODE TREE — 도시기록 아티스트 듀오',
    siteName: 'NODE TREE',
    description:
      '이화영+정강현으로 구성된 도시기록 아티스트 듀오. ' +
      '사운드, 영상, 설치를 통해 도시와 장소의 기억을 기록합니다.',
    url: 'https://nodetree.kr/',
    image: 'https://nodetree.kr/nodetree-og.png',
  },
  'saengsanso.com': {
    title: '생산소 省算所 SAENGSANSO — 충남 부여 대안예술공간',
    siteName: '생산소 省算所 SAENGSANSO',
    description:
      '충남 부여에 위치한 대안예술공간. 사운드스케이프, 커뮤니티 프로젝트, ' +
      '도시기록, 워크숍 등 다양한 문화예술 활동을 기획합니다.',
    url: 'https://saengsanso.com/',
    image: 'https://saengsanso.com/saengsanso-og.png',
  },
};

// www. 접두 정규화.
function resolveOg(hostRaw) {
  const host = String(hostRaw || '').toLowerCase().replace(/^www\./, '');
  return OG_BY_HOST[host] || null;
}

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
      /* try next */
    }
  }
  return null;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function replaceMetaByProperty(html, prop, value) {
  const re = new RegExp(
    `<meta([^>]*?)property="${prop}"([^>]*?)content="[^"]*"([^>]*?)/?>`,
    'i',
  );
  if (re.test(html)) {
    return html.replace(re, `<meta$1property="${prop}"$2content="${esc(value)}"$3/>`);
  }
  const re2 = new RegExp(
    `<meta([^>]*?)content="[^"]*"([^>]*?)property="${prop}"([^>]*?)/?>`,
    'i',
  );
  if (re2.test(html)) {
    return html.replace(re2, `<meta$1content="${esc(value)}"$2property="${prop}"$3/>`);
  }
  return html;
}

function replaceMetaByName(html, name, value) {
  const re = new RegExp(
    `<meta([^>]*?)name="${name}"([^>]*?)content="[^"]*"([^>]*?)/?>`,
    'i',
  );
  if (re.test(html)) {
    return html.replace(re, `<meta$1name="${name}"$2content="${esc(value)}"$3/>`);
  }
  const re2 = new RegExp(
    `<meta([^>]*?)content="[^"]*"([^>]*?)name="${name}"([^>]*?)/?>`,
    'i',
  );
  if (re2.test(html)) {
    return html.replace(re2, `<meta$1content="${esc(value)}"$2name="${name}"$3/>`);
  }
  return html;
}

function injectOg(html, og) {
  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${esc(og.title)}</title>`);
  out = replaceMetaByName(out, 'description', og.description);
  out = replaceMetaByProperty(out, 'og:site_name', og.siteName);
  out = replaceMetaByProperty(out, 'og:title', og.title);
  out = replaceMetaByProperty(out, 'og:description', og.description);
  out = replaceMetaByProperty(out, 'og:url', og.url);
  out = replaceMetaByProperty(out, 'og:image', og.image);
  out = replaceMetaByName(out, 'twitter:title', og.title);
  out = replaceMetaByName(out, 'twitter:description', og.description);
  out = replaceMetaByName(out, 'twitter:image', og.image);
  out = out.replace(
    /<link([^>]*?)rel="canonical"([^>]*?)href="[^"]*"([^>]*?)\/?>/i,
    `<link$1rel="canonical"$2href="${esc(og.url)}"$3/>`,
  );
  if (!/og:image:width/i.test(out)) {
    out = out.replace(
      /(<meta[^>]*property="og:image"[^>]*\/?>)/i,
      `$1<meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/>`,
    );
  }
  if (!/twitter:card/i.test(out)) {
    out = out.replace(
      /<\/head>/i,
      `<meta name="twitter:card" content="summary_large_image"/></head>`,
    );
  }
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
  const og = resolveOg(req.headers.host);
  const html = og ? injectOg(base, og) : base; // 미매칭 호스트는 정적 기본 그대로.
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  res.end(html);
};
