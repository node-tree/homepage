const fs = require('fs');
const path = require('path');

const DEFAULT_VAULT_ROOT = process.env.OBSIDIAN_VAULT_PATH ||
  '/Users/kanghyunjung/Documents/Obsidian Vault';

const isVercelEnv = () => process.env.VERCEL === '1' || process.env.VERCEL === 'true';

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const stripFrontmatter = (md) => {
  if (!md.startsWith('---\n')) return md;
  const end = md.indexOf('\n---', 4);
  if (end === -1) return md;
  const after = md.slice(end + 4);
  return after.replace(/^\r?\n/, '');
};

const stripWikilinks = (text) => text.replace(
  /\[\[([^\[\]\n|]{1,200})(?:\|([^\[\]\n]{1,200}))?\]\]/g,
  (_, target, alias) => {
    const display = alias || target.split('/').pop() || target;
    return display;
  }
);

// Use \x00 (null byte) as token boundary — guaranteed not in normal markdown
const TOK = '\x00';
const isSafeUrl = (url) => /^(https?:|mailto:|#|\/)/i.test(String(url).trim());

const renderInline = (text) => {
  // Strip NULL bytes from input — guarantees TOK delimiters can't be forged
  let s = stripWikilinks(text).replace(/\x00/g, '');

  // Step 1: Tokenize code spans BEFORE escape (length-bounded to avoid ReDoS)
  const codeTokens = [];
  s = s.replace(/`([^`\n]{1,500})`/g, (_, code) => {
    codeTokens.push('<code>' + escapeHtml(code) + '</code>');
    return TOK + 'C' + (codeTokens.length - 1) + TOK;
  });

  // Step 2: Tokenize links BEFORE escape — escape label and URL independently
  const linkTokens = [];
  s = s.replace(/\[([^\]\n]{1,500})\]\(([^)\n\s]{1,500})\)/g, (_, label, url) => {
    const safeUrl = isSafeUrl(url) ? url.trim() : '#';
    linkTokens.push(
      '<a href="' + escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer">' +
      escapeHtml(label) + '</a>'
    );
    return TOK + 'L' + (linkTokens.length - 1) + TOK;
  });

  // Step 3: Escape remaining HTML — \x00 tokens pass through unchanged
  s = escapeHtml(s);

  // Step 4: Inline emphasis (operates on already-escaped text)
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  // Step 5: Restore tokens
  s = s.replace(new RegExp(TOK + 'C(\\d+)' + TOK, 'g'), (_, i) => codeTokens[Number(i)]);
  s = s.replace(new RegExp(TOK + 'L(\\d+)' + TOK, 'g'), (_, i) => linkTokens[Number(i)]);
  return s;
};

// 한글·영문 텍스트를 URL anchor로 변환. github 스타일과 유사.
const slugify = (text) => {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
};

const makeUniqueSlug = (base, used) => {
  let slug = base || 'section';
  let n = 1;
  while (used.has(slug)) {
    n++;
    slug = `${base}-${n}`;
  }
  used.add(slug);
  return slug;
};

const markdownToHtml = (md, opts = {}) => {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const toc = opts.collectToc ? [] : null;
  const usedAnchors = opts.usedAnchors || new Set();
  const fileTag = opts.fileTag || '';
  let i = 0;

  const closeList = (stack) => {
    while (stack.length) out.push('</' + stack.pop() + '>');
  };

  let listStack = [];

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    const fenceMatch = line.match(/^```(\w*)\s*$/);
    if (fenceMatch) {
      closeList(listStack);
      const lang = fenceMatch[1];
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      if (lang === 'mermaid') {
        out.push('<pre class="mermaid">' + escapeHtml(buf.join('\n')) + '</pre>');
      } else {
        const cls = lang ? ' class="language-' + escapeHtml(lang) + '"' : '';
        out.push('<pre><code' + cls + '>' + escapeHtml(buf.join('\n')) + '</code></pre>');
      }
      continue;
    }

    // horizontal rule
    if (/^\s*---\s*$/.test(line)) {
      closeList(listStack);
      out.push('<hr/>');
      i++;
      continue;
    }

    // headings
    const h = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (h) {
      closeList(listStack);
      const level = h[1].length;
      const text = h[2];
      const inline = renderInline(text);
      let anchorAttr = '';
      if (toc && level >= 2 && level <= 3) {
        const baseSlug = slugify(text);
        const slug = makeUniqueSlug(baseSlug, usedAnchors);
        anchorAttr = ' id="' + escapeHtml(slug) + '"';
        toc.push({ level, text, anchor: slug, file: fileTag });
      }
      out.push('<h' + level + anchorAttr + '>' + inline + '</h' + level + '>');
      i++;
      continue;
    }

    // table (header line + separator)
    if (/^\|.+\|\s*$/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      closeList(listStack);
      const headers = line.slice(1, -1).split('|').map(c => c.trim());
      const rows = [];
      i += 2;
      while (i < lines.length && /^\|.+\|\s*$/.test(lines[i])) {
        rows.push(lines[i].slice(1, -1).split('|').map(c => c.trim()));
        i++;
      }
      const thead = '<thead><tr>' + headers.map(h => '<th>' + renderInline(h) + '</th>').join('') + '</tr></thead>';
      const tbody = '<tbody>' + rows.map(r => '<tr>' + r.map(c => '<td>' + renderInline(c) + '</td>').join('') + '</tr>').join('') + '</tbody>';
      out.push('<table>' + thead + tbody + '</table>');
      continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      closeList(listStack);
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push('<blockquote>' + renderInline(buf.join(' ')) + '</blockquote>');
      continue;
    }

    // unordered list
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (ulMatch) {
      const depth = Math.floor(ulMatch[1].length / 2);
      while (listStack.length > depth + 1) out.push('</' + listStack.pop() + '>');
      while (listStack.length < depth + 1) {
        out.push('<ul>');
        listStack.push('ul');
      }
      out.push('<li>' + renderInline(ulMatch[2]) + '</li>');
      i++;
      continue;
    }

    // ordered list
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olMatch) {
      const depth = Math.floor(olMatch[1].length / 2);
      while (listStack.length > depth + 1) out.push('</' + listStack.pop() + '>');
      while (listStack.length < depth + 1) {
        out.push('<ol>');
        listStack.push('ol');
      }
      out.push('<li>' + renderInline(olMatch[2]) + '</li>');
      i++;
      continue;
    }

    // empty line
    if (/^\s*$/.test(line)) {
      closeList(listStack);
      i++;
      continue;
    }

    // paragraph
    closeList(listStack);
    const buf = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^#{1,6}\s/.test(lines[i]) &&
           !/^```/.test(lines[i]) && !/^>\s?/.test(lines[i]) &&
           !/^(\s*)[-*+]\s+/.test(lines[i]) && !/^(\s*)\d+\.\s+/.test(lines[i]) &&
           !/^\|.+\|\s*$/.test(lines[i]) && !/^\s*---\s*$/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    out.push('<p>' + renderInline(buf.join(' ')) + '</p>');
  }

  closeList(listStack);
  if (toc) {
    return { html: out.join('\n'), toc };
  }
  return out.join('\n');
};

const resolveVaultPath = (inputPath, vaultRoot = DEFAULT_VAULT_ROOT) => {
  const root = path.resolve(vaultRoot);
  const target = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(root, inputPath);
  const rel = path.relative(root, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('vault 외부 경로는 허용되지 않습니다.');
  }
  return target;
};

const findMasterFile = (folderPath) => {
  const candidates = ['MASTER_OVERVIEW.md', '_INDEX.md'];
  for (const name of candidates) {
    const p = path.join(folderPath, name);
    if (fs.existsSync(p)) return p;
  }
  const items = fs.readdirSync(folderPath, { withFileTypes: true });
  const firstMd = items.find(d => d.isFile() && d.name.endsWith('.md'));
  if (firstMd) return path.join(folderPath, firstMd.name);
  return null;
};

const collectResearchFiles = (folderPath) => {
  if (!fs.existsSync(folderPath)) return [];
  const items = fs.readdirSync(folderPath, { withFileTypes: true });
  const files = [];
  for (const item of items) {
    if (item.name.startsWith('.')) continue;
    const full = path.join(folderPath, item.name);
    let stat;
    try {
      stat = fs.lstatSync(full);
    } catch {
      continue;
    }
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) continue;
    if (stat.isFile() && item.name.endsWith('.md')) {
      files.push({ name: item.name, fullPath: full });
    }
  }
  return files.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
};

const readObsidianFolder = (inputPath, opts = {}) => {
  const vaultRoot = opts.vaultRoot || DEFAULT_VAULT_ROOT;
  const folderPath = resolveVaultPath(inputPath, vaultRoot);
  if (!fs.existsSync(folderPath)) {
    throw new Error('옵시디안 경로를 찾을 수 없습니다: ' + folderPath);
  }
  const stat = fs.statSync(folderPath);
  if (!stat.isDirectory()) {
    throw new Error('옵시디안 경로가 폴더가 아닙니다: ' + folderPath);
  }

  const masterFile = findMasterFile(folderPath);
  if (!masterFile) {
    throw new Error('MASTER_OVERVIEW.md 또는 _INDEX.md를 찾을 수 없습니다.');
  }
  const masterRaw = fs.readFileSync(masterFile, 'utf8');
  const masterMd = stripFrontmatter(masterRaw);

  const researchSubfolders = fs.readdirSync(folderPath, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('리서치'))
    .map(d => path.join(folderPath, d.name));

  const researchFiles = [];
  for (const sub of researchSubfolders) {
    researchFiles.push(...collectResearchFiles(sub));
  }

  let combinedMd = masterMd;
  if (researchFiles.length > 0) {
    combinedMd += '\n\n---\n\n## 리서치 자료 (Research Notes)\n\n';
    combinedMd += '> 옵시디안의 리서치 폴더에서 자동 통합된 노트들입니다.\n\n';
    for (const f of researchFiles) {
      const raw = fs.readFileSync(f.fullPath, 'utf8');
      const md = stripFrontmatter(raw);
      combinedMd += '\n\n---\n\n### 📄 ' + f.name.replace(/\.md$/, '') + '\n\n' + md;
    }
  }

  return {
    masterFile,
    masterFileName: path.basename(masterFile),
    masterMarkdown: masterMd,
    researchFiles: researchFiles.map(f => f.name),
    combinedMarkdown: combinedMd,
    folderPath,
  };
};

const extractImagesFromHTML = (html) => {
  if (!html) return [];
  const imgs = [];
  const regex = /<img[^>]+src=["']([^"']{1,2000})["']/gi;
  let m;
  while ((m = regex.exec(html)) !== null) imgs.push(m[1]);
  return imgs;
};

const buildSyncPayload = (inputPath, opts = {}) => {
  const result = readObsidianFolder(inputPath, opts);
  const html = markdownToHtml(result.combinedMarkdown);
  return {
    contents: result.combinedMarkdown,
    htmlContent: html,
    sourceFile: result.masterFileName,
    folderPath: result.folderPath,
    researchFiles: result.researchFiles,
    charCount: result.combinedMarkdown.length,
    htmlLength: html.length,
    images: extractImagesFromHTML(html),
  };
};

// 리서치 아카이브 페이지 전용 — 메인 description은 건드리지 않음.
// 마스터 노트 + 모든 리서치 파일을 섹션으로 묶고, H2/H3 기반 TOC를 통합 생성.
const buildResearchPayload = (inputPath, opts = {}) => {
  const vaultRoot = opts.vaultRoot || DEFAULT_VAULT_ROOT;
  const folderPath = resolveVaultPath(inputPath, vaultRoot);
  if (!fs.existsSync(folderPath)) {
    throw new Error('옵시디안 경로를 찾을 수 없습니다: ' + folderPath);
  }
  const stat = fs.statSync(folderPath);
  if (!stat.isDirectory()) {
    throw new Error('옵시디안 경로가 폴더가 아닙니다: ' + folderPath);
  }

  const masterFile = findMasterFile(folderPath);
  if (!masterFile) {
    throw new Error('MASTER_OVERVIEW.md 또는 _INDEX.md를 찾을 수 없습니다.');
  }

  const researchSubfolders = fs.readdirSync(folderPath, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('리서치'))
    .map(d => path.join(folderPath, d.name));

  const researchFiles = [];
  for (const sub of researchSubfolders) {
    researchFiles.push(...collectResearchFiles(sub));
  }

  const usedAnchors = new Set();
  const toc = [];
  const sections = [];
  const sourceFiles = [];
  let totalMarkdown = '';

  // 섹션 1: 마스터 노트
  const masterRaw = fs.readFileSync(masterFile, 'utf8');
  const masterMd = stripFrontmatter(masterRaw);
  const masterTag = path.basename(masterFile);
  sourceFiles.push(masterTag);
  totalMarkdown += masterMd + '\n\n';

  const masterRendered = markdownToHtml(masterMd, {
    collectToc: true,
    usedAnchors,
    fileTag: masterTag,
  });
  toc.push(...masterRendered.toc);
  sections.push(
    '<section class="research-section research-master" data-file="' + escapeHtml(masterTag) + '">\n' +
    masterRendered.html +
    '\n</section>'
  );

  // 섹션 2~: 리서치 파일 각각
  for (const f of researchFiles) {
    const raw = fs.readFileSync(f.fullPath, 'utf8');
    const md = stripFrontmatter(raw);
    sourceFiles.push(f.name);
    totalMarkdown += '\n\n---\n\n## ' + f.name.replace(/\.md$/, '') + '\n\n' + md;

    const fileTitle = f.name.replace(/\.md$/, '');
    const headerSlug = makeUniqueSlug('file-' + slugify(fileTitle), usedAnchors);
    toc.push({ level: 2, text: '📄 ' + fileTitle, anchor: headerSlug, file: f.name });

    const rendered = markdownToHtml(md, {
      collectToc: true,
      usedAnchors,
      fileTag: f.name,
    });
    toc.push(...rendered.toc);

    sections.push(
      '<section class="research-section research-file" data-file="' + escapeHtml(f.name) + '">\n' +
      '<h2 id="' + escapeHtml(headerSlug) + '" class="research-file-title">📄 ' + escapeHtml(fileTitle) + '</h2>\n' +
      rendered.html +
      '\n</section>'
    );
  }

  const html = sections.join('\n\n<hr class="research-divider"/>\n\n');

  return {
    html,
    markdown: totalMarkdown,
    toc,
    sourceFiles,
    sourceFile: path.basename(masterFile),
    researchFiles: researchFiles.map(f => f.name),
    folderPath,
    charCount: totalMarkdown.length,
    htmlLength: html.length,
  };
};

module.exports = {
  DEFAULT_VAULT_ROOT,
  isVercelEnv,
  stripFrontmatter,
  markdownToHtml,
  resolveVaultPath,
  readObsidianFolder,
  buildSyncPayload,
  buildResearchPayload,
  extractImagesFromHTML,
  slugify,
};
