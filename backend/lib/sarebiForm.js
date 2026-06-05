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
//   세금 규칙: 사업소득 3.3%(L=K*0.03) / 기타소득 8.8%(L=K*0.08).
//     ⚠️ 대표(isRepresentative=true)는 원천징수 없음(100% 지급):
//        L·M = 0 리터럴, N = K(=세전 그대로). 수식 대신 0/참조로 덮어쓴다.
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

function setCell(ws, addr, value, opts = {}) {
  const c = ws.getCell(addr);
  c.value = value;
  c.border = BORDER_ALL;
  c.alignment = { vertical: 'middle', horizontal: opts.align || 'center', wrapText: true };
  if (opts.numFmt) c.numFmt = opts.numFmt;
  return c;
}

// 안전 병합(이미 병합돼 있으면 무시) — 빈 템플릿이라 충돌 없지만 방어.
function safeMerge(ws, range) {
  try { ws.mergeCells(range); } catch (_) { /* 이미 병합됨 — 무시 */ }
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

  // F~J: 회차별 행
  sessions.forEach((s, i) => {
    const r = startRow + i;
    setCell(ws, `F${r}`, s.date || '');
    setCell(ws, `G${r}`, Number(s.hours) || 0, { numFmt: '#,##0' });
    setCell(ws, `I${r}`, unit, { numFmt: '#,##0', align: 'right' });
    setCell(ws, `J${r}`, { formula: `G${r}*I${r}` }, { numFmt: '#,##0', align: 'right' });
  });

  // 그룹 첫 행(머지 대상) 좌측 식별 정보
  setCell(ws, `A${startRow}`, item.category || '');
  setCell(ws, `B${startRow}`, item.name || '');
  setCell(ws, `C${startRow}`, item.bank || '');
  setCell(ws, `D${startRow}`, item.account || '');
  setCell(ws, `E${startRow}`, item.residentNo || '');
  setCell(ws, `H${startRow}`, item.taxType || '');

  // K 지급액A(세전) = SUM(J그룹)
  setCell(ws, `K${startRow}`, { formula: `SUM(J${startRow}:J${last})` }, { numFmt: '#,##0', align: 'right' });

  // L 소득세 / M 주민세 / N 실지급액B
  if (isRep) {
    // 대표(이화영): 원천징수 없음 → 소득세·주민세 0, 실지급 = 세전.
    setCell(ws, `L${startRow}`, 0, { numFmt: '#,##0', align: 'right' });
    setCell(ws, `M${startRow}`, 0, { numFmt: '#,##0', align: 'right' });
    setCell(ws, `N${startRow}`, { formula: `K${startRow}` }, { numFmt: '#,##0', align: 'right' });
  } else {
    setCell(ws, `L${startRow}`, { formula: `K${startRow}*${rate}` }, { numFmt: '#,##0', align: 'right' });
    setCell(ws, `M${startRow}`, { formula: `ROUNDDOWN(L${startRow}*0.1,-1)` }, { numFmt: '#,##0', align: 'right' });
    setCell(ws, `N${startRow}`, { formula: `K${startRow}-L${startRow}-M${startRow}` }, { numFmt: '#,##0', align: 'right' });
  }

  // O 왕복거리 / P 실지급액C(비과세 교통보조금)
  setCell(ws, `O${startRow}`, Number(item.distanceKm) || 0, { numFmt: '#,##0', align: 'right' });
  setCell(ws, `P${startRow}`, Number(item.transportPay) || 0, { numFmt: '#,##0', align: 'right' });

  // Q 세전총계(A+C) / R 세후총계(B+C)
  setCell(ws, `Q${startRow}`, { formula: `K${startRow}+P${startRow}` }, { numFmt: '#,##0', align: 'right' });
  setCell(ws, `R${startRow}`, { formula: `N${startRow}+P${startRow}` }, { numFmt: '#,##0', align: 'right' });

  // S 비고
  setCell(ws, `S${startRow}`, item.note || '', { align: 'left' });

  // 다회차면 좌측·우측 컬럼 세로 병합(F·G·I·J 제외 — 회차별 값)
  if (n > 1) {
    for (const col of ['A', 'B', 'C', 'D', 'E', 'H', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S']) {
      safeMerge(ws, `${col}${startRow}:${col}${last}`);
    }
    // 회차 행 중 빈 좌측 셀에도 테두리 부여(병합 영역 외관 정리)
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
