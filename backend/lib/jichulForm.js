const path = require('path');
const { fillHwpx, numToKorean, formatKoreanDate } = require('./hwpxFill');
const { buildSignatureItem, linesToItems } = require('./hwpxBlocks');

// ═══════════════════════════════════════════════════════════════
// 서식11 지출결의서 (2026-10 최신판).
//   템플릿 = 5월 지출결의서(용역비, 한컴 저장본)에서 서명·글을 뺀 것.
//   · 결재 칸: 담당자(이한희)·결재자(이화영) 이름 + 서명 그림(제출본 자리). 서명이 없으면 회색 「(서명)」.
//   · 지출내용: 건마다 다른 항목(□ 추 진 명 / □ 용역내용 / - 항목 / □ 필요예산 …)을 여러 줄 그대로.
//     파란 안내 문단·빈 「 - 」·붙임 줄·뒤쪽 증빙 붙임/반납표 쪽은 제출본처럼 없다.
//   · 금액은 amount 하나에서 한글·숫자를 함께 만든다(불일치 방지).
//   · 지출방법 4택 체크(■/□).
// ═══════════════════════════════════════════════════════════════

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'forms', '서식11_지출결의서.hwpx');

// 5월 제출본에서 잰 서명 자리(결재 칸 안)
const SIGNATURE_PLACES = {
  damdangja: { width: 4203, height: 1857, vertOffset: 554, horzOffset: 1108 },
  gyeoljaeja: { width: 4136, height: 2253, vertOffset: 123, horzOffset: 988 },
};

const PAYMENT_METHOD_KEYS = ['계좌이체', '전자계산서', '카드', '기타'];
function buildPaymentMethodBoxes(method) {
  const chosen = PAYMENT_METHOD_KEYS.includes(method) ? method : null;
  const boxes = {};
  for (const k of PAYMENT_METHOD_KEYS) boxes[`{{지출방법_${k}}}`] = k === chosen ? '■' : '□';
  return boxes;
}

// 금액 → 정수. 문자열이면 숫자만 추출(콤마·'원'·통화기호·전각숫자 허용).
function parseAmount(raw) {
  if (raw == null) return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.floor(Math.abs(raw)) : 0;
  const half = String(raw).replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
  const digits = half.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

function fmtDate(v) {
  if (!v) return '';
  const s = String(v);
  if (/^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?$/.test(s)) return s;
  return formatKoreanDate(v);
}

const str = (v) => (v == null ? '' : String(v).trim());

// 지출내용 여러 줄. 예전 입력(추진명·추진일시·주요내용)만 오면 그 셋으로 짠다.
function jichulContentItems(b) {
  if (str(b.지출내용)) return linesToItems(b.지출내용, undefined, { keepIndent: true });
  const lines = [];
  if (str(b.추진명)) lines.push(`□ 추 진 명: ${str(b.추진명)}`);
  if (str(b.추진일시)) lines.push(`□ 추진일시: ${str(b.추진일시)}`);
  if (str(b.주요내용)) lines.push('□ 주요내용', ...str(b.주요내용).split(/\r?\n/).map((l) => ` - ${l.trim()}`));
  return lines;
}

function buildJichulBlocks(body) {
  const b = body || {};
  const amount = parseAmount(b.amount != null ? b.amount : b.금액);
  const images = [];
  const sigBlock = (role) => {
    const sig = buildSignatureItem(role, SIGNATURE_PLACES[role], `jichul_${role}`);
    if (!sig) return ['(서명)'];
    images.push(sig.image);
    return [sig.item];
  };
  const blocks = {
    단체명: [b.단체명 != null ? str(b.단체명) : '노드트리'],
    담당자: [str(b.담당자)],
    결제일: [fmtDate(b.결제일)],
    결의일: [fmtDate(b.결의일)],
    관: [str(b.관) || '꿈다락 문화예술학교'],
    항: [str(b.항)],
    목: [str(b.목)],
    세: [str(b.세)],
    지출내용: jichulContentItems(b),
    금액한글: [numToKorean(amount)],
    금액숫자: [amount.toLocaleString('ko-KR')],
    지급처: [str(b.지급처)],
    서명_담당자: sigBlock('damdangja'),
    서명_결재자: sigBlock('gyeoljaeja'),
  };
  return { blocks, images };
}

function buildJichulReplacements(body) {
  const b = body || {};
  return {
    '{{결재담당자}}': str(b.결재담당자) || str(b.담당자),
    '{{결재자}}': str(b.결재자) || '이화영',
    ...buildPaymentMethodBoxes(b.지출방법),
  };
}

async function generateJichulForm(body) {
  const { blocks, images } = buildJichulBlocks(body);
  const buffer = await fillHwpx(TEMPLATE_PATH, buildJichulReplacements(body), {}, { blocks, extraImages: images });
  const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
  const b = body || {};
  const titlePart = safe(b.파일명 || b.추진명 || b.세 || b.목 || '지출결의서');
  return { buffer, filenameBase: `서식11_지출결의서_${titlePart}` };
}

module.exports = {
  generateJichulForm,
  buildJichulBlocks,
  buildJichulReplacements,
  buildPaymentMethodBoxes,
  parseAmount,
  PAYMENT_METHOD_KEYS,
  TEMPLATE_PATH,
};
