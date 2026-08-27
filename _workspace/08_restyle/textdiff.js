#!/usr/bin/env node
/**
 * textdiff.js — **DB 내용 누락 0** 검증.
 *   v5 페이지에 실린 텍스트가 DB 원문(/api/*)의 텍스트를 전부 포함하는지 본다.
 *   비교 단위는 「의미 있는 낱말 토큰」(2자 이상, 공백·문장부호 정규화).
 *   node _workspace/08_restyle/textdiff.js
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

const SHOTS = path.join(__dirname, 'shots');
const API = 'http://localhost:8000/api';

function get(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => {
          try {
            resolve(JSON.parse(b));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

const strip = (html) =>
  String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/** 한글/영문 경계도 낱말 경계로 본다 — h1+em 처럼 DOM 상 붙어 나오는 경우(활동 이력CV) 대비. */
const norm = (s) =>
  String(s)
    .replace(/([가-힣])([A-Za-z0-9])/g, '$1 $2')
    .replace(/([A-Za-z0-9])([가-힣])/g, '$1 $2');

const tokens = (s) =>
  new Set(
    norm(strip(s))
      .replace(/[\s ]+/g, ' ')
      .split(/[^0-9A-Za-z가-힣ㄱ-ㅎ一-鿿々〆〤]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2),
  );

function report(name, dbText, pageFile) {
  const page = fs.readFileSync(path.join(SHOTS, pageFile), 'utf8');
  // DB 쪽만 태그를 벗긴다 — 페이지 텍스트에 <이물(船首)> 같은 꺾쇠 표기가 있으면
  // 태그로 오인해 지워지고 「누락」으로 잘못 잡힌다(실측).
  const want = tokens(strip(dbText));
  const got = tokens(page);
  const missing = [...want].filter((t) => !got.has(t));
  console.log(
    `${name}: DB토큰 ${want.size} · 페이지토큰 ${got.size} · 누락 ${missing.length}` +
      (missing.length ? ` → ${missing.slice(0, 40).join(', ')}` : ''),
  );
  return missing.length;
}

(async () => {
  let total = 0;

  const about = (await get(`${API}/about`)).data;
  total += report('/about', `${about.title} ${about.content} ${about.htmlContent}`, 'about-desktop.txt');

  const cv = (await get(`${API}/cv`)).data;
  total += report('/cv', `${cv.title} ${cv.subtitle} ${cv.content}`, 'cv-desktop.txt');

  const contact = (await get(`${API}/contact`)).data;
  total += report(
    '/contact',
    [...(contact.emails || []), contact.location, ...(contact.socialLinks || []).map((l) => `${l.name} ${l.url}`)].join(' '),
    'contact-desktop.txt',
  );

  // 목록: 제목 전량이 실렸는지(본문은 상세에서 확인)
  const work = (await get(`${API}/work`)).data;
  const wHead = (await get(`${API}/work/header`)).data;
  total += report('/work 목록', `${wHead.title} ${wHead.subtitle} ${work.map((p) => p.title).join(' ')}`, 'work-desktop.txt');

  const filed = (await get(`${API}/filed`)).data;
  const fHead = (await get(`${API}/filed/header`)).data;
  total += report(
    '/commons 목록',
    `${fHead.title} ${fHead.subtitle} ${filed.map((p) => p.title).join(' ')}`,
    'commons-desktop.txt',
  );

  // 상세 3건(도판·PDF·영상)
  const details = [
    ['wd-corrosia', '69f7f16819e31bf1bef2699d', work],
    ['wd-ediaphonic', '6969e0c950e7b0f6a31e83fa', work],
    ['wd-nakwon', '6969ed442fef7251ebe86598', work],
    ['cd-workbook', '6858a45ca793089c746ee8cb', filed],
  ];
  for (const [slug, id, list] of details) {
    const post = list.find((p) => p.id === id);
    if (!post) {
      console.log(`${slug}: 글 없음`);
      continue;
    }
    total += report(`상세 ${slug}`, `${post.title} ${post.content}`, `${slug}-desktop.txt`);
  }

  console.log(`\n총 누락 토큰 ${total}`);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
