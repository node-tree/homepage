import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import playwright from '/Users/kanghyunjung/.nvm/versions/node/v18.17.0/lib/node_modules/playwright/index.js';

const { chromium } = playwright;

const inputPath = '/Users/kanghyunjung/Downloads/busanhang.html';
const outputPath = '/Users/kanghyunjung/Downloads/busanhang-paginated.pdf';
const tempPath = '/private/tmp/busanhang-print.html';

const printCss = `
<style id="codex-print-css">
@page {
  size: A4 landscape;
  margin: 0;
}

@media print {
  :root {
    --bg: #ffffff;
    --bg-deep: #ffffff;
    --paper: #ffffff;
    --paper-shadow: rgba(0, 0, 0, 0);
    --line-faint: #c9c9c9;
  }

  html,
  body {
    width: 297mm;
    min-height: 210mm;
    min-width: 0;
    background: #ffffff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body::before {
    display: none !important;
  }

  main,
  .title-page,
  .section,
  .footer {
    width: 297mm;
  }

  .title-page {
    min-height: 0;
    height: 210mm;
    padding: 14mm 18mm 12mm;
    background: #ffffff !important;
    page-break-after: always;
    break-after: page;
    justify-content: center;
  }

  .title-main {
    margin: 8mm 0;
  }

  .title-main h1 {
    font-size: 39px;
    line-height: 1.08;
  }

  .title-subtitle {
    font-size: 17px !important;
    margin-top: 8px !important;
  }

  .title-meta {
    gap: 10px;
    padding-top: 8px;
  }

  .title-header {
    font-size: 8px;
  }

  .title-eyebrow {
    font-size: 12px;
    margin-bottom: 10px;
  }

  .title-main p {
    font-size: 11px !important;
    line-height: 1.55 !important;
  }

  .meta-label {
    font-size: 7px;
  }

  .meta-value {
    font-size: 11px;
  }

  .section {
    min-height: 210mm;
    padding: 10mm 12mm;
    background: #ffffff !important;
    page-break-before: always;
    break-before: page;
    border-bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .section-header {
    grid-template-columns: 26mm 1fr;
    gap: 8mm;
    margin-bottom: 5mm;
  }

  .section-title {
    font-size: 34px;
    line-height: 1.22;
  }

  .section-description {
    font-size: 14px;
    line-height: 1.55;
    margin-top: 7px;
    max-width: 185mm;
  }

  .diagram-wrap {
    background: #ffffff !important;
    padding: 5mm;
    margin-bottom: 6mm;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .diagram-caption {
    margin-top: 8px;
  }

  .cards-grid,
  .dosang-matrix {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8mm;
    margin-top: 8mm;
  }

  .element-card,
  .dosang-card,
  .procession-step,
  .timeline-item {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .element-card {
    background: #ffffff !important;
    padding: 8mm;
    gap: 5mm;
  }

  .card-title {
    font-size: 22px;
  }

  .card-subtitle {
    font-size: 13px;
  }

  .card-section {
    padding-top: 4mm;
  }

  .card-section-content,
  .card-section-content .em,
  .timeline-content p,
  .timeline-content .accent-text {
    font-size: 11px;
    line-height: 1.55;
  }

  .procession {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    margin-top: 8mm;
  }

  .procession-step {
    min-height: 0;
    padding: 6mm 5mm;
    gap: 3mm;
  }

  .procession-step h5 {
    font-size: 13px;
    line-height: 1.35;
  }

  .procession-step p {
    font-size: 10px;
    line-height: 1.5;
  }

  .timeline {
    padding: 4mm 0 0;
    margin-top: 6mm;
  }

  .timeline::before {
    left: 42mm;
  }

  .timeline-item {
    grid-template-columns: 38mm 8mm 1fr;
    gap: 4mm;
    margin-bottom: 5mm;
  }

  .timeline-content h4 {
    font-size: 15px;
    margin-bottom: 2mm;
  }

  .dosang-card {
    background: #ffffff !important;
    padding: 7mm;
  }

  .dosang-name {
    font-size: 19px;
    margin-bottom: 4mm;
  }

  .dosang-list {
    font-size: 11px;
  }

  .dosang-list li {
    grid-template-columns: 22mm 1fr;
    gap: 4mm;
    padding: 2.5mm 0;
  }

  .footer {
    padding: 14mm 12mm;
    min-height: 210mm;
    background: #ffffff !important;
    color: var(--ink) !important;
    page-break-before: always;
    break-before: page;
    display: flex;
    align-items: center;
  }

  .footer-content {
    width: 100%;
  }

  .footer-left h2,
  .footer-left p,
  .footer-right {
    color: var(--ink) !important;
  }

  /* Keep split sections together: current pages 2-3, 9-10, 11-12, 13-14. */
  .section:nth-of-type(2),
  .section:nth-of-type(7),
  .section:nth-of-type(8),
  .section:nth-of-type(9) {
    height: 210mm;
    min-height: 210mm;
    overflow: hidden;
    justify-content: center;
  }

  .section:nth-of-type(2) .section-header,
  .section:nth-of-type(7) .section-header,
  .section:nth-of-type(8) .section-header,
  .section:nth-of-type(9) .section-header {
    margin-bottom: 3mm;
  }

  .section:nth-of-type(2) .section-title,
  .section:nth-of-type(7) .section-title,
  .section:nth-of-type(8) .section-title,
  .section:nth-of-type(9) .section-title {
    font-size: 28px;
  }

  .section:nth-of-type(2) .section-description,
  .section:nth-of-type(7) .section-description,
  .section:nth-of-type(8) .section-description,
  .section:nth-of-type(9) .section-description {
    font-size: 11px;
    line-height: 1.35;
    margin-top: 3px;
  }

  .section:nth-of-type(2) .diagram-wrap {
    padding: 3mm;
    margin-bottom: 4mm;
  }

  .section:nth-of-type(2) .diagram-svg {
    max-height: 112mm;
  }

  .section:nth-of-type(2) .dosang-matrix {
    gap: 5mm;
    margin-top: 4mm !important;
  }

  .section:nth-of-type(2) .dosang-card {
    padding: 5mm;
  }

  .section:nth-of-type(7) .diagram-wrap {
    padding: 3mm;
    margin-bottom: 4mm;
  }

  .section:nth-of-type(7) .diagram-svg {
    max-height: 82mm;
  }

  .section:nth-of-type(7) .cards-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 4mm;
    margin-top: 5mm !important;
  }

  .section:nth-of-type(7) .element-card {
    padding: 5mm;
    gap: 3mm;
  }

  .section:nth-of-type(7) .card-title {
    font-size: 15px;
  }

  .section:nth-of-type(7) .card-section-content {
    font-size: 9px;
    line-height: 1.4;
  }

  .section:nth-of-type(8) .timeline {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 10mm;
    row-gap: 3mm;
    padding: 2mm 0 0;
    margin-top: 3mm;
  }

  .section:nth-of-type(8) .timeline::before {
    display: none;
  }

  .section:nth-of-type(8) .timeline-item {
    display: grid;
    grid-template-columns: 27mm 1fr;
    gap: 3mm;
    margin-bottom: 0;
    padding-bottom: 2.5mm;
    border-bottom: 1px solid var(--line-faint);
  }

  .section:nth-of-type(8) .timeline-marker {
    display: none;
  }

  .section:nth-of-type(8) .timeline-time {
    text-align: left;
    font-size: 8px;
    line-height: 1.25;
    padding-top: 1mm;
  }

  .section:nth-of-type(8) .timeline-content h4 {
    font-size: 12px;
    margin-bottom: 1mm;
  }

  .section:nth-of-type(8) .timeline-content p,
  .section:nth-of-type(8) .timeline-content .accent-text {
    font-size: 9px;
    line-height: 1.35;
  }

  .section:nth-of-type(9) .dosang-matrix {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4mm;
    margin-top: 4mm;
  }

  .section:nth-of-type(9) .dosang-card {
    padding: 4.5mm;
  }

  .section:nth-of-type(9) .dosang-title {
    font-size: 9px;
    margin-bottom: 2mm;
  }

  .section:nth-of-type(9) .dosang-name {
    font-size: 14px;
    margin-bottom: 2mm;
  }

  .section:nth-of-type(9) .dosang-list {
    font-size: 8.5px;
  }

  .section:nth-of-type(9) .dosang-list li {
    grid-template-columns: 17mm 1fr;
    gap: 2mm;
    padding: 1.6mm 0;
    line-height: 1.35;
  }

  .section:nth-of-type(9) .dosang-list li .term {
    font-size: 7px;
  }

  /* Center the second page fragment of "04 · ELEMENTS" (current page 7). */
  .section:nth-of-type(6) .element-card:nth-child(n + 3) {
    transform: translateY(22mm);
  }
}
</style>`;

const html = await fs.readFile(inputPath, 'utf8');
const printableHtml = html.replace('</head>', `${printCss}\n</head>`);
await fs.writeFile(tempPath, printableHtml, 'utf8');

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
});

page.setDefaultTimeout(15000);
await page.goto(pathToFileURL(tempPath).href, { waitUntil: 'load' });
await page.emulateMedia({ media: 'print' });
await page.evaluate(() => document.fonts?.ready);

await page.pdf({
  path: outputPath,
  format: 'A4',
  landscape: true,
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});

await browser.close();

const stat = await fs.stat(outputPath);
console.log(`${outputPath} (${Math.round(stat.size / 1024)} KB)`);
