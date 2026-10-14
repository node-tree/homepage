const path = require('path');
const ExcelJS = require('exceljs');

// ═══════════════════════════════════════════════════════════════
// 서식 제4-1호 「일반수용비 사례비 지급내역서」 (월별 xlsx 생성).
//   chulgang/hoeuirok/gyeolgwa(hwpx)와 동일한 stateless 매퍼 패턴의 xlsx 판.
//   서버는 클라이언트가 조립한 월(month)·행(rows)을 받아 빈 템플릿(헤더만)에
//   데이터 영역(15행~)을 동적 생성한다. DB 접근 없음(트랜잭션 모델 미참조).
//
//   템플릿: backend/templates/forms/서식4-1_사례비지급내역서.xlsx
//     - 1~14행: 작성가이드 + 2단 헤더(병합 보존). 데이터 영역은 비워둔 빈 양식.
//     - vercel.json includeFiles 로 서버리스 번들에 포함.
//
//   컬럼(헤더 행 13~14 기준):
//     A 지급구분 | B 이름 | C 은행명 | D 계좌번호 | E 주민등록번호
//     F 일자 | G 시간 | H 세금구분 | I 단가 | J 합계(=G*I)
//     K 지급액A(세전, =SUM(J그룹)) | L 소득세 | M 주민세(=ROUNDDOWN(L*0.1,-1))
//     N 실지급액B(세후, =K-L-M) | O 왕복거리 | P 실지급액C(비과세)
//     Q 세전총계(=K+P) | R 세후총계(=N+P) | S 비고
//
//   세금 규칙(2026-10, 8·9월 제출본): 사업소득 3.3%(L=ROUNDDOWN(K*0.03,-1)) /
//     기타소득 8.8%(L=ROUNDDOWN(K*0.08,-1)) — 소득세도 10원 미만 절사.
//     ⚠️ 대표(isRepresentative=true)는 원천징수 없음(100% 지급): H=「대표자」, L·M = 0.
//   특별강의비는 회당 단가 — J = I(시간 무관).
//   firstPayment(최초 지급월)면 비고에 첨부 서류(서식 2-1·2-2·2-3, 교통보조금 증빙) 자동.
//   수식마다 계산 결과도 함께 저장(엑셀 외 미리보기에서도 값이 보이게).
//
//   다회차 강사(sessions 2건 이상): F~J 만 회차별로 행을 늘리고,
//     K/L/M/N/O/P/Q/R/A/B/C/D/E/S 는 그룹 첫 행에만 두고 세로 병합한다.
//     K=SUM(J그룹범위). (샘플 15~18행 구조 재현)
// ═══════════════════════════════════════════════════════════════

const TEMPLATE_PATH = path.join(
  __dirname,
  '..',
  'templates',
  'forms',
  '서식4-1_사례비지급내역서.xlsx',
);

const DATA_START_ROW = 15; // 헤더(1~14) 다음 첫 데이터 행

// 세금구분 라벨 → 소득세율
const TAX_RATE = {
  '사업소득(3.3%)': 0.03,
  '기타소득(8.8%)': 0.08,
};

// 데이터 셀 공통 테두리(얇은 실선) — 헤더 영역 스타일과 시각적 정합.
const THIN = { style: 'thin', color: { argb: 'FF000000' } };
const BORDER_ALL = { top: THIN, left: THIN, bottom: THIN, right: THIN };

// 9월 제출본 서식: 맑은 고딕 9pt, 금액 열(K·N·P·Q·R) 굵게, 숫자 형식 #,##0_);[Red](#,##0).
const NUM_FMT = '#,##0_);[Red](#,##0)';
const BOLD_COLS = new Set(['K', 'N', 'P', 'Q', 'R']);
const ROW_HEIGHT = 16.5;
const NOTE_ROW_HEIGHT = 43.5;

// 최초 1회 첨부 서류(9월 제출본 비고 문구). 교통보조금이 있으면 증빙 한 줄을 더한다.
const FIRST_PAYMENT_DOCS = [
  '(서식 제2-1호) 참여인력이력서',
  '(서식 제2-2호) 부정청탁 및 금품 등 수수금지 서약서',
  '(서식 제2-3호) 개인정보 수집·이용·제공 동의서',
];
const TRANSPORT_DOCS = '(교통보조금 증빙) 주민등록증사본, 왕복거리산출자료';

function setCell(ws, addr, value, opts = {}) {
  const c = ws.getCell(addr);
  c.value = value;
  c.border = BORDER_ALL;
  c.font = { name: '맑은 고딕', size: 9, bold: BOLD_COLS.has(addr.replace(/\d+/g, '')) };
  c.alignment = { vertical: 'middle', horizontal: opts.align || 'center', wrapText: true };
  if (opts.numFmt) c.numFmt = opts.numFmt;
  return c;
}

// 수식 + 계산 결과(미리보기·한컴에서도 값이 보이게)
const f = (formula, result) => ({ formula, result });
// 엑셀 ROUNDDOWN(x,-1) — 양수 10원 미만 절사(부동소수 오차 보정)
const rounddown10 = (x) => Math.floor((x + 1e-7) / 10) * 10;

// 안전 병합(이미 병합돼 있으면 무시) — 빈 템플릿이라 충돌 없지만 방어.
function safeMerge(ws, range) {
  try { ws.mergeCells(range); } catch (_) { /* 이미 병합됨 — 무시 */ }
}

function buildNote(item) {
  const parts = [];
  if (item.firstPayment) {
    parts.push(...FIRST_PAYMENT_DOCS);
    if (Number(item.transportPay) > 0) parts.push(TRANSPORT_DOCS);
  }
  if (item.note && String(item.note).trim()) parts.push(String(item.note).trim());
  return parts.join('\n');
}

// 한 명의 지급 행 그룹을 row 부터 기록하고, 소비한 행 수를 반환한다.
function writeRow(ws, startRow, item) {
  const sessions = Array.isArray(item.sessions) && item.sessions.length
    ? item.sessions
    : [{ date: item.date || '', hours: 1 }];
  const n = sessions.length;
  const last = startRow + n - 1;
  const unit = Number(item.unitPrice) || 0; // I (단가)
  const isRep = !!item.isRepresentative;
  const rate = TAX_RATE[item.taxType] != null ? TAX_RATE[item.taxType] : 0.03;
  // 특별강의비는 회당 단가(등급별) — 시간과 무관하게 J = 단가.
  const perSession = /^특별강의비/.test(String(item.category || ''));

  // F~J: 회차별 행
  let sumJ = 0;
  sessions.forEach((s, i) => {
    const r = startRow + i;
    const hours = Number(s.hours) || 0;
    const j = perSession ? unit : hours * unit;
    sumJ += j;
    setCell(ws, `F${r}`, s.date || '');
    setCell(ws, `G${r}`, hours, { numFmt: NUM_FMT });
    setCell(ws, `I${r}`, unit, { numFmt: NUM_FMT, align: 'right' });
    setCell(ws, `J${r}`, perSession ? f(`I${r}`, j) : f(`G${r}*I${r}`, j), { numFmt: NUM_FMT, align: 'right' });
    ws.getRow(r).height = ROW_HEIGHT;
  });

  // 그룹 첫 행(머지 대상) 좌측 식별 정보
  setCell(ws, `A${startRow}`, item.category || '');
  setCell(ws, `B${startRow}`, item.name || '');
  setCell(ws, `C${startRow}`, item.bank || '');
  setCell(ws, `D${startRow}`, item.account || '');
  setCell(ws, `E${startRow}`, item.residentNo || '');
  // 대표는 세금구분 대신 「대표자」(9월 제출본)
  setCell(ws, `H${startRow}`, isRep ? '대표자' : item.taxType || '');

  // K 지급액A(세전) = SUM(J그룹)
  const K = sumJ;
  setCell(ws, `K${startRow}`, f(n > 1 ? `SUM(J${startRow}:J${last})` : `J${startRow}`, K), { numFmt: NUM_FMT, align: 'right' });

  // L 소득세(10원 미만 절사) / M 주민세 / N 실지급액B
  const L = isRep ? 0 : rounddown10(K * rate);
  const M = isRep ? 0 : rounddown10(L * 0.1);
  const N = K - L - M;
  if (isRep) {
    // 대표(이화영): 원천징수 없음 → 소득세·주민세 0, 실지급 = 세전.
    setCell(ws, `L${startRow}`, 0, { numFmt: NUM_FMT, align: 'right' });
    setCell(ws, `M${startRow}`, 0, { numFmt: NUM_FMT, align: 'right' });
  } else {
    setCell(ws, `L${startRow}`, f(`ROUNDDOWN(K${startRow}*${rate},-1)`, L), { numFmt: NUM_FMT, align: 'right' });
    setCell(ws, `M${startRow}`, f(`ROUNDDOWN(L${startRow}*0.1,-1)`, M), { numFmt: NUM_FMT, align: 'right' });
  }
  setCell(ws, `N${startRow}`, f(`K${startRow}-L${startRow}-M${startRow}`, N), { numFmt: NUM_FMT, align: 'right' });

  // O 왕복거리 / P 실지급액C(비과세 교통보조금)
  const P = Number(item.transportPay) || 0;
  setCell(ws, `O${startRow}`, Number(item.distanceKm) || 0, { numFmt: NUM_FMT, align: 'right' });
  setCell(ws, `P${startRow}`, P, { numFmt: NUM_FMT, align: 'right' });

  // Q 세전총계(A+C) / R 세후총계(B+C)
  setCell(ws, `Q${startRow}`, f(`K${startRow}+P${startRow}`, K + P), { numFmt: NUM_FMT, align: 'right' });
  setCell(ws, `R${startRow}`, f(`N${startRow}+P${startRow}`, N + P), { numFmt: NUM_FMT, align: 'right' });

  // S 비고(최초 지급월이면 첨부 서류 문구 자동)
  const note = buildNote(item);
  setCell(ws, `S${startRow}`, note, { align: 'left' });
  // 비고 줄 수만큼 높이(한 줄 약 14.5pt). 여러 회차 행이면 병합된 행들에 나눠 준다.
  const noteLines = note ? note.split('\n').length : 0;
  if (noteLines > 1) {
    const need = Math.max(NOTE_ROW_HEIGHT, noteLines * 14.5);
    const per = Math.max(ROW_HEIGHT, Math.ceil((need / n) * 10) / 10);
    for (let r = startRow; r <= last; r++) ws.getRow(r).height = per;
  }

  // 다회차면 좌측·우측 컬럼 세로 병합(F·G·I·J 제외 — 회차별 값)
  if (n > 1) {
    for (const col of ['A', 'B', 'C', 'D', 'E', 'H', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S']) {
      safeMerge(ws, `${col}${startRow}:${col}${last}`);
    }
    for (let r = startRow + 1; r <= last; r++) {
      for (const col of ['A', 'B', 'C', 'D', 'E', 'H', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S']) {
        ws.getCell(`${col}${r}`).border = BORDER_ALL;
      }
    }
  }

  return n;
}

// month: 1~12 정수(또는 문자열). rows: 지급 항목 배열.
async function generateSarebiForm({ month, rows } = {}) {
  const m = Number(month);
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    const err = new Error('월(month)은 1~12 사이여야 합니다.');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  const list = Array.isArray(rows) ? rows : [];

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  const ws = wb.worksheets[0];

  // 제목 A1 의 '0월' → 'N월'
  const a1 = ws.getCell('A1');
  if (typeof a1.value === 'string') {
    a1.value = a1.value.replace(/0월/g, `${m}월`);
  }

  // 템플릿에 남은 데이터 영역 행 높이(23·24행 54.75 등)를 기본값으로 되돌린다.
  for (let r = DATA_START_ROW; r <= ws.rowCount; r++) ws.getRow(r).height = ROW_HEIGHT;

  // 데이터 행 작성
  let row = DATA_START_ROW;
  for (const item of list) {
    const consumed = writeRow(ws, row, item);
    row += consumed;
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filenameBase = `[서식 제4-1호] 일반수용비 사례비 지급내역서_${m}월`;
  return { buffer: Buffer.from(buffer), filenameBase };
}

module.exports = { generateSarebiForm, TAX_RATE };
