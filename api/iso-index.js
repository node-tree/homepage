// ═══════════════════════════════════════════════════════════════
// isoartlab.com 루트 HTML 서버사이드 OG 주입 (크롤러 대응)
//   · 문제: OG/메타를 클라이언트 useEffect 로 주입하면 JS 미실행 크롤러
//     (카카오·페이스북·트위터 등)는 정적 index.html 의 기본(nodetree) OG 만 본다.
//   · 해결: 이 서버리스 함수가 build/index.html 을 읽어, Host 가 isoartlab 이면
//     <title>/description/og:*/twitter:* 를 iso 값으로 치환해 응답한다.
//   · 스코프: vercel.json 의 host 조건부 route 로 isoartlab.com·www 루트 '/'만
//     이 함수에 연결한다. nodetree.kr·www·saengsanso.com 루트는 기존 정적
//     index.html(catch-all) 그대로 → 회귀 없음. 여기서도 Host 를 한 번 더 가드한다.
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// iso 브랜딩 값(클라이언트 useIsoArtLabBranding 과 동일하게 유지).
const ISO = {
  title: '문화예술학교 이소異素',
  siteName: '문화예술학교 이소異素',
  description:
    '서로 다른 빛이 모여 마을을 밝히는 문화예술학교 이소(異素). ' +
    '작은 변화와 이야기를 기록하고 사람과 사람을 잇습니다.',
  url: 'https://isoartlab.com/',
  image: 'https://isoartlab.com/iso-og.png',
};

// build/index.html 후보 경로(@vercel/node 번들 / 로컬 dev 양쪽 대응).
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

// 속성 순서에 무관하게 특정 meta 의 content 를 교체.
function replaceMetaByProperty(html, prop, value) {
  const re = new RegExp(
    `<meta([^>]*?)property="${prop}"([^>]*?)content="[^"]*"([^>]*?)/?>`,
    'i',
  );
  if (re.test(html)) {
    return html.replace(re, `<meta$1property="${prop}"$2content="${esc(value)}"$3/>`);
  }
  // content 가 property 앞에 오는 변형도 대응.
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

function injectIsoOg(html) {
  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${esc(ISO.title)}</title>`);
  out = replaceMetaByName(out, 'description', ISO.description);
  out = replaceMetaByProperty(out, 'og:site_name', ISO.siteName);
  out = replaceMetaByProperty(out, 'og:title', ISO.title);
  out = replaceMetaByProperty(out, 'og:description', ISO.description);
  out = replaceMetaByProperty(out, 'og:url', ISO.url);
  out = replaceMetaByProperty(out, 'og:image', ISO.image);
  out = replaceMetaByName(out, 'twitter:title', ISO.title);
  out = replaceMetaByName(out, 'twitter:description', ISO.description);
  out = replaceMetaByName(out, 'twitter:image', ISO.image);
  // canonical 도 iso 로(있으면 교체).
  out = out.replace(
    /<link([^>]*?)rel="canonical"([^>]*?)href="[^"]*"([^>]*?)\/?>/i,
    `<link$1rel="canonical"$2href="${esc(ISO.url)}"$3/>`,
  );
  // og:image 크기 힌트가 없으면 추가(1200x630).
  if (!/og:image:width/i.test(out)) {
    out = out.replace(
      /(<meta[^>]*property="og:image"[^>]*\/?>)/i,
      `$1<meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/>`,
    );
  }
  // twitter:card 가 없으면 추가.
  if (!/twitter:card/i.test(out)) {
    out = out.replace(
      /<\/head>/i,
      `<meta name="twitter:card" content="summary_large_image"/></head>`,
    );
  }
  return out;
}

module.exports = (req, res) => {
  const host = String(req.headers.host || '').toLowerCase();
  const isIso = host === 'isoartlab.com' || host === 'www.isoartlab.com';

  const base = readBaseHtml();
  if (!base) {
    // 빌드 HTML 을 못 찾으면 안전하게 SPA 로 폴백시키도록 502 대신 최소 HTML.
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('index.html not found');
    return;
  }

  const html = isIso ? injectIsoOg(base) : base;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // 크롤러 캐시는 짧게(브랜딩 변경 반영). SPA 셸이라 본문은 정적.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  res.end(html);
};
