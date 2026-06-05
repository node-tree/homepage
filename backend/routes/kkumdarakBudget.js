const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const KkumdarakTransaction = require('../models/KkumdarakTransaction');
const KkumdarakProgram = require('../models/KkumdarakProgram');
const KkumdarakSession = require('../models/KkumdarakSession');
const budget = require('../data/kkumdarakBudget');
const { PROGRAM_MAP, TOTAL_QUOTA, TOTAL_SESSIONS } = require('../data/kkumdarakPrograms');
const { generateChulgangForm } = require('../lib/chulgangForm');
const { generateHoeuirokForm } = require('../lib/hoeuirokForm');
const { generateGyeolgwaForm } = require('../lib/gyeolgwaForm');
const { generateJichulForm } = require('../lib/jichulForm');
const { generateGeomsuForm } = require('../lib/geomsuForm');
const { generateSarebiForm } = require('../lib/sarebiForm');
const KkumdarakChecklist = require('../models/KkumdarakChecklist');
const KkumdarakEvidence = require('../models/KkumdarakEvidence');
const { PERSONNEL, SETTLEMENT } = require('../data/checklistTemplates');
const { buildProgramStats } = require('../lib/programStats');
const { runAiDraft } = require('../lib/aiDraft');
const { decodePhoto } = require('../lib/photoDecode');

const router = express.Router();

// DB 연결 확인 — 캐싱된 연결 재사용 (work.js / villageDiary.js 동일 패턴)
const connectDB = require('../db');
const ensureDBConnection = async () => {
  if (mongoose.connection.readyState === 1) return true;
  await connectDB();
  return true;
};

// 쓰기 핸들러 공통 에러 응답: Mongoose ValidationError/CastError(잘못된 enum·타입 등
//   클라이언트 입력오류)는 400, 그 외(서버/DB 오류)는 500 으로 분기한다.
function handleWriteError(res, error, fallbackMessage) {
  if (error && (error.name === 'ValidationError' || error.name === 'CastError')) {
    return res.status(400).json({
      success: false,
      message: '입력값이 올바르지 않습니다.',
      error: error.message,
    });
  }
  return res.status(500).json({ success: false, message: fallbackMessage, error: error.message });
}

// ── 꿈다락 전용 인증 미들웨어 (villageDiary.js 의 requireKkumdarakAuth 와 동일 로직) ──
//   villageDiary.js 가 이 미들웨어를 export 하지 않고, 이 코드베이스는 ensureDBConnection
//   처럼 헬퍼를 라우트별로 복제하는 스타일이므로 — 동일 scope:'kkumdarak' 검증을 인라인 복제한다.
//   (작동 중인 villageDiary.js 를 건드리지 않기 위함)
const requireKkumdarakAuth = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ success: false, message: '꿈다락 인증이 필요합니다.' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token) {
    return res.status(401).json({ success: false, message: '꿈다락 인증이 필요합니다.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || decoded.scope !== 'kkumdarak') {
      return res.status(403).json({ success: false, message: '꿈다락 사업관리 권한이 없습니다.' });
    }
    req.kkumdarak = decoded;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: '꿈다락 인증이 만료되었습니다. 다시 로그인해주세요.' });
    }
    return res.status(401).json({ success: false, message: '유효하지 않은 꿈다락 인증입니다.' });
  }
};

// 회계 데이터이므로 읽기도 동일 게이트 적용 (기획 §4-1: 공개 금지).
//   인증 게이트 최종방식은 추후 결정이나, 지금은 기존 kkumdarak 미들웨어로 막아둔다.
router.use(requireKkumdarakAuth);

// ── 검증 헬퍼 ────────────────────────────────────────────────────────────────

// 사업기간 밖 일자 경고 (예탁계좌 출금일 기준). YYYY-MM-DD 문자열 비교.
function isOutsideProjectPeriod(dateInput) {
  if (!dateInput) return false;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  const ymd = d.toISOString().slice(0, 10);
  return ymd < budget.PROJECT_PERIOD.start || ymd > budget.PROJECT_PERIOD.end;
}

// 특정 비목(majorCode-subCode) 의 기집행 grossAmount 합 (특정 id 제외 가능 — 수정 시)
async function sumExecutedForLine(majorCode, subCode, excludeId) {
  const match = { majorCode, subCode };
  if (excludeId) match._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
  const rows = await KkumdarakTransaction.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$grossAmount' } } },
  ]);
  return rows.length ? rows[0].total : 0;
}

// 저장 전 경고 계산 (차단 아님 — 경고 플래그만 반환).
async function buildWarnings({ majorCode, subCode, grossAmount, date, excludeId }) {
  const warnings = [];
  const lineKey = budget.lineKeyOf(majorCode, subCode);
  const line = budget.BUDGET_LINE_MAP[lineKey];

  if (!line) {
    warnings.push({
      code: 'UNKNOWN_LINE',
      message: `편성에 없는 비목/세목입니다 (${lineKey}).`,
    });
  } else {
    const executed = await sumExecutedForLine(majorCode, subCode, excludeId);
    const projected = executed + (Number(grossAmount) || 0);
    if (projected > line.amount) {
      warnings.push({
        code: 'BUDGET_EXCEEDED',
        message: `${line.majorName}/${line.subName} 잔액 초과: 집행예정 누계 ${projected.toLocaleString('ko-KR')}원 > 편성액 ${line.amount.toLocaleString('ko-KR')}원`,
        lineKey,
        projected,
        budget: line.amount,
      });
    }
  }

  if (isOutsideProjectPeriod(date)) {
    warnings.push({
      code: 'OUT_OF_PERIOD',
      message: `사업기간(${budget.PROJECT_PERIOD.start} ~ ${budget.PROJECT_PERIOD.end}) 밖의 일자입니다.`,
    });
  }

  return warnings;
}

// ── GET /api/kkumdarak/budget/summary ────────────────────────────────────────
//   비목별 {편성액, 집행액(grossAmount 합), 잔액, 진척%} + 일반수용비 세세목별
//   + 편성제한 검증결과(인력활동비%·회의식비 누계, 초과여부).
router.get('/budget/summary', async (req, res) => {
  try {
    await ensureDBConnection();

    // 1) 비목(major-sub 쌍)별 집행액 집계
    const byLine = await KkumdarakTransaction.aggregate([
      {
        $group: {
          _id: { majorCode: '$majorCode', subCode: '$subCode' },
          executed: { $sum: '$grossAmount' },
          count: { $sum: 1 },
        },
      },
    ]);
    const executedMap = byLine.reduce((m, r) => {
      m[`${r._id.majorCode}-${r._id.subCode}`] = { executed: r.executed, count: r.count };
      return m;
    }, {});

    // 2) 라인별 요약
    const lines = budget.BUDGET_LINES.map((line) => {
      const ex = executedMap[line.lineKey] || { executed: 0, count: 0 };
      const balance = line.amount - ex.executed;
      const progress = line.amount > 0 ? ex.executed / line.amount : 0;
      const out = {
        lineKey: line.lineKey,
        majorCode: line.majorCode,
        majorName: line.majorName,
        subCode: line.subCode,
        subName: line.subName,
        paymentHint: line.paymentHint,
        budget: line.amount,
        executed: ex.executed,
        balance,
        progress: Math.round(progress * 10000) / 100, // % (소수 2자리)
        count: ex.count,
      };
      return out;
    });

    // 3) 일반수용비(210-01) 세세목별 집행액
    const subAgg = await KkumdarakTransaction.aggregate([
      { $match: { majorCode: '210', subCode: '01', subItem: { $ne: null } } },
      { $group: { _id: '$subItem', executed: { $sum: '$grossAmount' }, count: { $sum: 1 } } },
    ]);
    const subExecMap = subAgg.reduce((m, r) => {
      m[r._id] = { executed: r.executed, count: r.count };
      return m;
    }, {});
    const generalSupplySubItems = budget.GENERAL_SUPPLY_SUBITEMS.map((si) => {
      const ex = subExecMap[si.key] || { executed: 0, count: 0 };
      const balance = si.amount - ex.executed;
      return {
        key: si.key,
        label: si.label,
        budget: si.amount,
        executed: ex.executed,
        balance,
        progress: si.amount > 0 ? Math.round((ex.executed / si.amount) * 10000) / 100 : 0,
        count: ex.count,
        isPersonnelActivity: si.isPersonnelActivity,
      };
    });

    // 4) 편성제한 검증결과
    //   - 인력활동비: 편성 기준 합계(PERSONNEL_ACTIVITY_TOTAL)로 % 표시(편성제한은 편성 기준).
    //   - 회의식비 누계: subItem === '회의식비' 인 트랜잭션 grossAmount 합 (집행 기준 누계).
    //     (subItem 자유텍스트 일치 — 후속 단계에서 코드화 예정, 모델 주석 참조)
    const meetingAgg = await KkumdarakTransaction.aggregate([
      { $match: { subItem: '회의식비' } },
      { $group: { _id: null, total: { $sum: '$grossAmount' } } },
    ]);
    const meetingMealTotal = meetingAgg.length ? meetingAgg[0].total : 0;

    const personnelRatio = budget.PERSONNEL_ACTIVITY_TOTAL / budget.TOTAL_BUDGET;
    const constraints = {
      personnelActivity: {
        total: budget.PERSONNEL_ACTIVITY_TOTAL,
        limit: budget.PERSONNEL_ACTIVITY_LIMIT,
        ratioPercent: Math.round(personnelRatio * 10000) / 100, // 39.84
        limitPercent: budget.PERSONNEL_LIMIT_RATIO * 100, // 40
        exceeded: budget.PERSONNEL_ACTIVITY_TOTAL > budget.PERSONNEL_ACTIVITY_LIMIT,
      },
      meetingMeal: {
        total: meetingMealTotal,
        limit: budget.MEETING_MEAL_LIMIT,
        exceeded: meetingMealTotal > budget.MEETING_MEAL_LIMIT,
      },
    };

    // 총괄 합계
    const totalExecuted = lines.reduce((s, l) => s + l.executed, 0);

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: {
        totalBudget: budget.TOTAL_BUDGET,
        totalExecuted,
        totalBalance: budget.TOTAL_BUDGET - totalExecuted,
        totalProgress: Math.round((totalExecuted / budget.TOTAL_BUDGET) * 10000) / 100,
        lines,
        generalSupplySubItems,
        constraints,
        projectPeriod: budget.PROJECT_PERIOD,
      },
    });
  } catch (error) {
    console.error('꿈다락 예산 요약 오류:', error);
    res.status(500).json({ success: false, message: '예산 요약 조회에 실패했습니다.', error: error.message });
  }
});

// ── GET /api/kkumdarak/transactions ──────────────────────────────────────────
//   목록 + 필터(majorCode, month=YYYY-MM, paymentMethod, status).
router.get('/transactions', async (req, res) => {
  try {
    await ensureDBConnection();

    const { majorCode, month, paymentMethod, status } = req.query;
    const filter = {};
    if (majorCode) filter.majorCode = majorCode;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (status) filter.status = status;

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const start = new Date(`${month}-01T00:00:00.000Z`);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      filter.date = { $gte: start, $lt: end };
    }

    const rows = await KkumdarakTransaction.find(filter).sort({ date: -1, _id: -1 });

    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    console.error('꿈다락 집행 목록 오류:', error);
    res.status(500).json({ success: false, message: '집행 목록 조회에 실패했습니다.', error: error.message });
  }
});

// ── POST /api/kkumdarak/transactions ─────────────────────────────────────────
//   생성. 저장 전 검증(잔액 초과·사업기간 밖) → 경고 플래그 반환(차단 아님).
router.post('/transactions', async (req, res) => {
  try {
    await ensureDBConnection();

    const {
      date, majorCode, subCode, subItem, description,
      grossAmount, withholdingAmount, payeeName, paymentMethod,
      incomeType, status, arteApproval, evidenceMeta, note,
    } = req.body || {};

    if (!date || !majorCode || !subCode || !description || grossAmount === undefined || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: '필수 항목(일자·비목·세목·집행내용·총액·결제수단)을 입력해주세요.',
      });
    }

    const warnings = await buildWarnings({ majorCode, subCode, grossAmount, date });

    const tx = new KkumdarakTransaction({
      date,
      majorCode,
      subCode,
      subItem: subItem || null,
      description,
      grossAmount: Number(grossAmount) || 0,
      withholdingAmount: Number(withholdingAmount) || 0,
      payeeName: payeeName || '',
      paymentMethod,
      incomeType: incomeType || null,
      status: status || undefined, // 미지정 시 모델 default('지출결의')
      arteApproval: arteApproval || null,
      evidenceMeta: Array.isArray(evidenceMeta) ? evidenceMeta : [],
      note: note || '',
    });

    const saved = await tx.save();

    res.json({
      success: true,
      message: '집행 건이 저장되었습니다.',
      data: saved,
      warnings, // 경고는 차단하지 않고 함께 반환
    });
  } catch (error) {
    console.error('꿈다락 집행 생성 오류:', error);
    // ValidationError/CastError(잘못된 enum 등 클라이언트 입력오류)는 400, 그 외 500.
    handleWriteError(res, error, '집행 건 저장에 실패했습니다.');
  }
});

// ── PUT /api/kkumdarak/transactions/:id ──────────────────────────────────────
router.put('/transactions/:id', async (req, res) => {
  try {
    await ensureDBConnection();
    const { id } = req.params;

    const existing = await KkumdarakTransaction.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: '집행 건을 찾을 수 없습니다.' });
    }

    const b = req.body || {};
    const $set = {};
    const fields = [
      'date', 'majorCode', 'subCode', 'subItem', 'description',
      'payeeName', 'paymentMethod', 'incomeType', 'status', 'arteApproval', 'note', 'evidenceMeta',
    ];
    for (const f of fields) {
      if (b[f] !== undefined) $set[f] = b[f];
    }

    // 금액: netAmount 파생 재계산을 위해 gross/withholding 을 함께 확정한다.
    const gross = b.grossAmount !== undefined ? Number(b.grossAmount) : existing.grossAmount;
    const wh = b.withholdingAmount !== undefined ? Number(b.withholdingAmount) : existing.withholdingAmount;
    if (b.grossAmount !== undefined || b.withholdingAmount !== undefined) {
      $set.grossAmount = gross;
      $set.withholdingAmount = wh;
      $set.netAmount = Math.max(0, (gross || 0) - (wh || 0));
    }

    // 변경 후 값 기준 경고 재계산
    const effMajor = $set.majorCode || existing.majorCode;
    const effSub = $set.subCode || existing.subCode;
    const effGross = $set.grossAmount !== undefined ? $set.grossAmount : existing.grossAmount;
    const effDate = $set.date || existing.date;
    const warnings = await buildWarnings({
      majorCode: effMajor, subCode: effSub, grossAmount: effGross, date: effDate, excludeId: id,
    });

    const updated = await KkumdarakTransaction.findByIdAndUpdate(
      id, { $set }, { new: true, runValidators: true }
    );

    res.json({ success: true, message: '집행 건이 수정되었습니다.', data: updated, warnings });
  } catch (error) {
    console.error('꿈다락 집행 수정 오류:', error);
    // ValidationError/CastError(잘못된 enum 등 클라이언트 입력오류)는 400, 그 외 500.
    handleWriteError(res, error, '집행 건 수정에 실패했습니다.');
  }
});

// ── DELETE /api/kkumdarak/transactions/:id ───────────────────────────────────
router.delete('/transactions/:id', async (req, res) => {
  try {
    await ensureDBConnection();
    const { id } = req.params;
    const deleted = await KkumdarakTransaction.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: '집행 건을 찾을 수 없습니다.' });
    }
    res.json({ success: true, message: '집행 건이 삭제되었습니다.', data: { id: deleted._id.toString() } });
  } catch (error) {
    console.error('꿈다락 집행 삭제 오류:', error);
    // 잘못된 ObjectId 등 CastError 는 400, 그 외 500.
    handleWriteError(res, error, '집행 건 삭제에 실패했습니다.');
  }
});

// ── POST /api/kkumdarak/transactions/:id/evidence ────────────────────────────
//   증빙 파일(base64) → GridFS(앱 클라우드) 저장 + (자격증명 있으면) Google Drive 미러.
//   GridFS 가 기본 저장소라 자격증명 없이도 업로드·다운로드 동작.
router.post('/transactions/:id/evidence', async (req, res) => {
  try {
    await ensureDBConnection();
    const { id } = req.params;
    const { file, filename, formCode } = req.body || {};
    if (!file || typeof file !== 'string') {
      return res.status(400).json({ success: false, message: '증빙 파일(base64)이 필요합니다.' });
    }
    const buffer = Buffer.from(file.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (!buffer.length) return res.status(400).json({ success: false, message: '빈 파일입니다.' });
    if (buffer.length > 7 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: '증빙 파일은 7MB 이하만 가능합니다.' });
    }
    const tx = await KkumdarakTransaction.findById(id);
    if (!tx) return res.status(404).json({ success: false, message: '집행 건을 찾을 수 없습니다.' });

    // 서식명 규칙 파일명: {비목}_{세목}_{서식}_{날짜}_{내용}.ext
    const ext = (filename && filename.includes('.')) ? filename.split('.').pop() : 'pdf';
    const ymd = tx.date ? new Date(tx.date).toISOString().slice(0, 10) : '';
    const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '').slice(0, 30);
    const evName = [safe(tx.majorName), safe(tx.subName), safe(formCode || '증빙'), ymd, safe(tx.description)]
      .filter(Boolean).join('_') + '.' + ext;
    const mimeType = extToMime(ext);

    // 1) GridFS(기본 저장) — 항상
    const { put } = require('../lib/evidenceStore');
    const stored = await put(buffer, evName, mimeType);

    // 2) Google Drive 미러(자격증명 있을 때만 — 없으면 조용히 건너뜀)
    let driveFileId = '';
    let webViewLink = '';
    try {
      const { uploadEvidence } = require('../lib/driveUpload');
      const up = await uploadEvidence({ buffer, filename: evName, mimeType, majorName: `${tx.majorName}-${tx.subName}` });
      driveFileId = up.fileId;
      webViewLink = up.webViewLink;
    } catch (e) {
      if (e.code !== 'NO_DRIVE') console.error('Drive 미러 실패(GridFS 저장은 성공):', e.message);
    }

    tx.evidenceMeta.push({
      name: evName, formCode: formCode || '', status: '첨부',
      storageId: stored.fileId, driveFileId, webViewLink,
      uploadedAt: new Date(), size: buffer.length,
    });
    const saved = await tx.save();
    res.json({ success: true, message: '증빙을 업로드했습니다.', data: saved });
  } catch (error) {
    console.error('꿈다락 증빙 업로드 오류:', error);
    handleWriteError(res, error, '증빙 업로드에 실패했습니다.');
  }
});

// ── GET /api/kkumdarak/transactions/:id/evidence/:evId/download ───────────────
//   GridFS 에서 파일 스트림 다운로드.
router.get('/transactions/:id/evidence/:evId/download', async (req, res) => {
  try {
    await ensureDBConnection();
    const { id, evId } = req.params;
    const tx = await KkumdarakTransaction.findById(id);
    if (!tx) return res.status(404).json({ success: false, message: '집행 건을 찾을 수 없습니다.' });
    const ev = tx.evidenceMeta.id(evId);
    if (!ev || !ev.storageId) return res.status(404).json({ success: false, message: '증빙 파일을 찾을 수 없습니다.' });

    const { openDownload } = require('../lib/evidenceStore');
    const dl = await openDownload(ev.storageId);
    if (!dl) return res.status(404).json({ success: false, message: '저장된 파일이 없습니다.' });

    res.setHeader('Content-Type', dl.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="evidence"; filename*=UTF-8''${encodeURIComponent(ev.name)}`);
    if (dl.length) res.setHeader('Content-Length', dl.length);
    dl.stream.on('error', () => { if (!res.headersSent) res.status(500).end(); }).pipe(res);
  } catch (error) {
    console.error('꿈다락 증빙 다운로드 오류:', error);
    if (!res.headersSent) res.status(500).json({ success: false, message: '증빙 다운로드에 실패했습니다.' });
  }
});

// ── DELETE /api/kkumdarak/transactions/:id/evidence/:evId ─────────────────────
router.delete('/transactions/:id/evidence/:evId', async (req, res) => {
  try {
    await ensureDBConnection();
    const { id, evId } = req.params;
    const tx = await KkumdarakTransaction.findById(id);
    if (!tx) return res.status(404).json({ success: false, message: '집행 건을 찾을 수 없습니다.' });
    const ev = tx.evidenceMeta.id(evId);
    if (!ev) return res.status(404).json({ success: false, message: '증빙 항목을 찾을 수 없습니다.' });
    if (ev.storageId) {
      try { await require('../lib/evidenceStore').remove(ev.storageId); }
      catch (e) { console.error('GridFS 삭제 실패(메타는 제거):', e.message); }
    }
    if (ev.driveFileId) {
      try { await require('../lib/driveUpload').deleteEvidence(ev.driveFileId); }
      catch (e) { console.error('Drive 삭제 실패(메타는 제거):', e.message); }
    }
    ev.deleteOne();
    const saved = await tx.save();
    res.json({ success: true, message: '증빙을 삭제했습니다.', data: saved });
  } catch (error) {
    console.error('꿈다락 증빙 삭제 오류:', error);
    handleWriteError(res, error, '증빙 삭제에 실패했습니다.');
  }
});

// ── 증빙 라이브러리(독립 메뉴) — 집행 건과 분리된 증빙 파일 관리 ───────────────
// GET /api/kkumdarak/evidences?majorCode= — 목록(비목 필터). 본문 제외 메타만.
router.get('/evidences', async (req, res) => {
  try {
    await ensureDBConnection();
    const q = {};
    if (req.query.majorCode) q.majorCode = req.query.majorCode;
    if (req.query.subCode) q.subCode = req.query.subCode;
    const rows = await KkumdarakEvidence.find(q).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    console.error('꿈다락 증빙 목록 오류:', error);
    res.status(500).json({ success: false, message: '증빙 목록 조회에 실패했습니다.', error: error.message });
  }
});

// POST /api/kkumdarak/evidences — 파일(base64) 업로드 또는 링크(url) → 레코드.
router.post('/evidences', async (req, res) => {
  try {
    await ensureDBConnection();
    const { file, url, filename, majorCode, subCode, formCode, note } = req.body || {};

    // 링크(URL) 증빙 — 파일 없이 외부 링크만 등록
    if (url && typeof url === 'string' && !file) {
      const trimmed = url.trim();
      if (!/^https?:\/\//i.test(trimmed)) {
        return res.status(400).json({ success: false, message: '링크는 http(s):// 로 시작해야 합니다.' });
      }
      const doc = await KkumdarakEvidence.create({
        filename: (filename && filename.trim()) || trimmed.slice(0, 80),
        kind: 'link', url: trimmed,
        majorCode: majorCode || '', subCode: subCode || '',
        formCode: formCode || '', note: note || '', size: 0,
      });
      return res.json({ success: true, message: '링크 증빙을 추가했습니다.', data: doc });
    }

    if (!file || typeof file !== 'string') {
      return res.status(400).json({ success: false, message: '증빙 파일(base64) 또는 링크(url)가 필요합니다.' });
    }
    const buffer = Buffer.from(file.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (!buffer.length) return res.status(400).json({ success: false, message: '빈 파일입니다.' });
    if (buffer.length > 7 * 1024 * 1024) return res.status(400).json({ success: false, message: '증빙 파일은 7MB 이하만 가능합니다.' });

    const ext = (filename && filename.includes('.')) ? filename.split('.').pop() : 'pdf';
    const mimeType = extToMime(ext);
    const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
    const displayName = filename ? safe(filename) : `${safe(formCode || '증빙')}.${ext}`;

    const { put } = require('../lib/evidenceStore');
    const stored = await put(buffer, displayName, mimeType);

    let driveFileId = '', webViewLink = '';
    try {
      const { uploadEvidence } = require('../lib/driveUpload');
      const major = (budget.BUDGET_LINE_MAP[`${majorCode}-${subCode}`] || {});
      const up = await uploadEvidence({ buffer, filename: displayName, mimeType, majorName: major.majorName || '증빙' });
      driveFileId = up.fileId; webViewLink = up.webViewLink;
    } catch (e) { if (e.code !== 'NO_DRIVE') console.error('Drive 미러 실패(GridFS 성공):', e.message); }

    const doc = await KkumdarakEvidence.create({
      filename: displayName, majorCode: majorCode || '', subCode: subCode || '',
      formCode: formCode || '', note: note || '', storageId: stored.fileId,
      driveFileId, webViewLink, size: buffer.length, mimeType,
    });
    res.json({ success: true, message: '증빙을 업로드했습니다.', data: doc });
  } catch (error) {
    console.error('꿈다락 증빙 업로드 오류:', error);
    handleWriteError(res, error, '증빙 업로드에 실패했습니다.');
  }
});

// GET /api/kkumdarak/evidences/:id/download — GridFS 스트림.
router.get('/evidences/:id/download', async (req, res) => {
  try {
    await ensureDBConnection();
    const doc = await KkumdarakEvidence.findById(req.params.id);
    if (!doc || !doc.storageId) return res.status(404).json({ success: false, message: '증빙 파일을 찾을 수 없습니다.' });
    const { openDownload } = require('../lib/evidenceStore');
    const dl = await openDownload(doc.storageId);
    if (!dl) return res.status(404).json({ success: false, message: '저장된 파일이 없습니다.' });
    res.setHeader('Content-Type', dl.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="evidence"; filename*=UTF-8''${encodeURIComponent(doc.filename)}`);
    if (dl.length) res.setHeader('Content-Length', dl.length);
    dl.stream.on('error', () => { if (!res.headersSent) res.status(500).end(); }).pipe(res);
  } catch (error) {
    console.error('꿈다락 증빙 다운로드 오류:', error);
    if (!res.headersSent) res.status(500).json({ success: false, message: '증빙 다운로드에 실패했습니다.' });
  }
});

// DELETE /api/kkumdarak/evidences/:id
router.delete('/evidences/:id', async (req, res) => {
  try {
    await ensureDBConnection();
    const doc = await KkumdarakEvidence.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: '증빙을 찾을 수 없습니다.' });
    if (doc.storageId) { try { await require('../lib/evidenceStore').remove(doc.storageId); } catch (e) { console.error('GridFS 삭제 실패:', e.message); } }
    if (doc.driveFileId) { try { await require('../lib/driveUpload').deleteEvidence(doc.driveFileId); } catch (e) { console.error('Drive 삭제 실패:', e.message); } }
    await doc.deleteOne();
    res.json({ success: true, message: '증빙을 삭제했습니다.', data: { id: doc._id.toString() } });
  } catch (error) {
    console.error('꿈다락 증빙 삭제 오류:', error);
    handleWriteError(res, error, '증빙 삭제에 실패했습니다.');
  }
});

// ── GET /api/kkumdarak/evidence/checklist ─────────────────────────────────────
//   비목별 필수 증빙 체크리스트(정본 기준) — 프론트가 첨부 formCode 와 대조.
router.get('/evidence/checklist', async (req, res) => {
  const { EVIDENCE_CHECKLIST } = require('../data/evidenceChecklist');
  res.json({ success: true, data: EVIDENCE_CHECKLIST });
});

// 확장자 → MIME (Drive 업로드용)
function extToMime(ext) {
  const m = {
    pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', hwp: 'application/x-hwp', hwpx: 'application/haansofthwp+zip',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return m[String(ext || '').toLowerCase()] || 'application/octet-stream';
}

// ── POST /api/kkumdarak/forms/chulgang ───────────────────────────────────────
//   body(클라이언트가 조립한 21개 값) + 선택 photo(base64 PNG)로 서식5 출강확인서 HWPX 다운로드.
//   photo 있으면 BinData/chulgang_photo.png 교체. (/forms prefix — 충돌 없음)
router.post('/forms/chulgang', async (req, res) => {
  try {
    const body = req.body || {};
    const photo = decodePhoto(body.photo);
    if (photo.error) {
      return res.status(400).json({ success: false, message: photo.error });
    }

    const { buffer, filenameBase } = await generateChulgangForm(body, photo.buffer);

    // RFC5987 — ascii fallback + UTF-8 인코딩 둘 다 제공
    const asciiFallback = 'chulgang.hwpx';
    const utf8Name = `${filenameBase}.hwpx`;
    const encoded = encodeURIComponent(utf8Name);

    res.setHeader('Content-Type', 'application/haansofthwp+zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('꿈다락 출강확인서 생성 오류:', error);
    // 치환 누락·템플릿 누락 등 → 500
    return res.status(500).json({
      success: false,
      message: '출강확인서 생성에 실패했습니다.',
      error: error.message,
    });
  }
});

// ── POST /api/kkumdarak/forms/hoeuirok ───────────────────────────────────────
//   body(클라이언트가 조립한 21개 값) + 선택 photo(base64 PNG)로 서식7 회의록 HWPX 다운로드.
//   photo 있으면 BinData/hoeuirok_photo.png 교체. chulgang 과 동일 패턴.
router.post('/forms/hoeuirok', async (req, res) => {
  try {
    const body = req.body || {};
    const photo = decodePhoto(body.photo);
    if (photo.error) {
      return res.status(400).json({ success: false, message: photo.error });
    }

    const { buffer, filenameBase } = await generateHoeuirokForm(body, photo.buffer);

    // RFC5987 — ascii fallback + UTF-8 인코딩 둘 다 제공
    const asciiFallback = 'hoeuirok.hwpx';
    const utf8Name = `${filenameBase}.hwpx`;
    const encoded = encodeURIComponent(utf8Name);

    res.setHeader('Content-Type', 'application/haansofthwp+zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('꿈다락 회의록 생성 오류:', error);
    return res.status(500).json({
      success: false,
      message: '회의록 생성에 실패했습니다.',
      error: error.message,
    });
  }
});

// ── POST /api/kkumdarak/forms/gyeolgwa ───────────────────────────────────────
//   서식6 기획·개발 결과보고서 — body(32개 값) → HWPX 다운로드. (chulgang/hoeuirok 동일 패턴)
router.post('/forms/gyeolgwa', async (req, res) => {
  try {
    const body = req.body || {};
    const { buffer, filenameBase } = await generateGyeolgwaForm(body);
    const utf8Name = `${filenameBase}.hwpx`;
    res.setHeader('Content-Type', 'application/haansofthwp+zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="gyeolgwa.hwpx"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('꿈다락 결과보고서 생성 오류:', error);
    return res.status(500).json({ success: false, message: '결과보고서 생성에 실패했습니다.', error: error.message });
  }
});

// ── POST /api/kkumdarak/forms/sarebi ─────────────────────────────────────────
//   서식 제4-1호 「일반수용비 사례비 지급내역서」 — body { month(1~12), rows[] } → xlsx 다운로드.
//   chulgang/hoeuirok/gyeolgwa(hwpx)와 동일한 stateless 매퍼 패턴의 xlsx 판(exceljs).
//   rows 각 항목: { category, name, bank, account, residentNo, taxType, unitPrice,
//     sessions:[{date,hours}], distanceKm, transportPay, isRepresentative, note }.
//   대표(isRepresentative)는 원천징수 없음(소득세·주민세 0, 실지급=세전) — sarebiForm 이 처리.
//   DB 미접근(트랜잭션 모델 미참조) — 스키마 변경 없음.
router.post('/forms/sarebi', async (req, res) => {
  try {
    const { month, rows } = req.body || {};
    const { buffer, filenameBase } = await generateSarebiForm({ month, rows });
    const utf8Name = `${filenameBase}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sarebi.xlsx"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('꿈다락 사례비 지급내역서 생성 오류:', error);
    if (error.code === 'BAD_REQUEST') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: '사례비 지급내역서 생성에 실패했습니다.', error: error.message });
  }
});

// ── POST /api/kkumdarak/forms/jichul ─────────────────────────────────────────
//   서식11 지출결의서 — body(단체명·담당자·결제일·결의일·항·목·세·추진명·추진일시·
//   amount·지급처) → HWPX 다운로드. chulgang/hoeuirok/gyeolgwa 동일 패턴.
//   금액은 amount 하나에서 한글/숫자 파생(jichulForm). 미치환 토큰은 fillHwpx 가 throw → 500.
router.post('/forms/jichul', async (req, res) => {
  try {
    const body = req.body || {};
    const { buffer, filenameBase } = await generateJichulForm(body);
    const utf8Name = `${filenameBase}.hwpx`;
    res.setHeader('Content-Type', 'application/haansofthwp+zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="jichul.hwpx"; filename*=UTF-8''${encodeURIComponent(utf8Name)}`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('꿈다락 지출결의서 생성 오류:', error);
    return res.status(500).json({ success: false, message: '지출결의서 생성에 실패했습니다.', error: error.message });
  }
});

// ── POST /api/kkumdarak/forms/geomsu ─────────────────────────────────────────
//   검수조서(일반용역비) — body(용역명·계약상대자·amount·검수일자·산출물링크·검수결과·검수의견)
//   + 선택 photo1/photo2(base64 PNG) → HWPX 다운로드. jichul(텍스트)+chulgang(photo) 결합.
//   사진 2슬롯은 BinData/geomsu_photo1.png·geomsu_photo2.png 교체. 무저장 즉시 다운로드.
//   미치환 토큰은 fillHwpx 가 throw → 500. 잘못된 사진 → 400.
router.post('/forms/geomsu', async (req, res) => {
  try {
    const body = req.body || {};
    const p1 = decodePhoto(body.photo1);
    if (p1.error) {
      return res.status(400).json({ success: false, message: p1.error });
    }
    const p2 = decodePhoto(body.photo2);
    if (p2.error) {
      return res.status(400).json({ success: false, message: p2.error });
    }

    const { buffer, filenameBase } = await generateGeomsuForm(body, p1.buffer, p2.buffer);

    const asciiFallback = 'geomsu.hwpx';
    const utf8Name = `${filenameBase}.hwpx`;
    const encoded = encodeURIComponent(utf8Name);

    res.setHeader('Content-Type', 'application/haansofthwp+zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('꿈다락 검수조서 생성 오류:', error);
    return res.status(500).json({ success: false, message: '검수조서 생성에 실패했습니다.', error: error.message });
  }
});

// ── POST /api/kkumdarak/forms/ai-draft ───────────────────────────────────────
//   AI 초안(KNUH). body { docType, programKey, 회차?, 교육주제?, 회의주제?, 키워드 }.
//   grounding 은 백엔드 PROGRAM_MAP 에서만 읽어 프롬프트에 주입(클라이언트 미노출).
//   반환: { success, data(파싱된 JSON|null), raw?(파싱 실패 시 원문) }.
//   KNUH 키 미설정/타임아웃/HTTP 오류 → 503 + 사용자 안내. 잘못된 입력 → 400.
router.post('/forms/ai-draft', async (req, res) => {
  try {
    const result = await runAiDraft(req.body || {});
    if (result.parsed === null) {
      // 파싱 실패 — 원문 동봉해 수동 붙여넣기 가능하게
      return res.json({
        success: true,
        data: null,
        raw: result.raw,
        message: 'AI 응답을 JSON 으로 해석하지 못했습니다. 원문을 확인해 수동 입력하세요.',
      });
    }
    return res.json({ success: true, data: result.parsed });
  } catch (error) {
    console.error('꿈다락 AI 초안 오류:', error);
    if (error.code === 'BAD_REQUEST' || error.code === 'PROGRAM_NOT_FOUND') {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.code === 'KNUH_NO_KEY') {
      return res.status(503).json({
        success: false,
        message: 'AI 기능이 설정되지 않았습니다(KNUH_API_KEY 미설정). 관리자에게 문의하세요.',
      });
    }
    // KNUH_TIMEOUT / KNUH_HTTP_ERROR / KNUH_BAD_RESPONSE / 네트워크 등 → 503
    return res.status(503).json({
      success: false,
      message: 'AI 초안 생성에 실패했습니다. 잠시 후 다시 시도하거나 직접 입력하세요.',
      error: error.message,
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// 프로그램·실적 (프로그램 마스터=상수, 세션 집계 오버레이)
//   경로 prefix(/programs, /sessions, /dashboard)는 /transactions·/budget·/forms 과
//   완전히 분리되어 충돌 없음.
// ═══════════════════════════════════════════════════════════════

// ── GET /api/kkumdarak/programs ──────────────────────────────────────────────
//   7개 프로그램 + 각 {정원, 총회차, 실참여(=Σ세션 attendance), 등록회차수, 잔여회차, 진척%, 주강사}.
router.get('/programs', async (req, res) => {
  try {
    await ensureDBConnection();
    const programs = await buildProgramStats();
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: programs, count: programs.length });
  } catch (error) {
    console.error('꿈다락 프로그램 조회 오류:', error);
    res.status(500).json({ success: false, message: '프로그램 조회에 실패했습니다.', error: error.message });
  }
});

// ── PUT /api/kkumdarak/programs/:key ─────────────────────────────────────────
//   (참고) 실참여는 이제 세션 attendance 합으로 산출되어 이 엔드포인트의 actualParticipants
//   오버레이는 buildProgramStats 에서 더 이상 읽지 않는다. note 등 향후 가변값 보관용으로 유지.
//   :key 는 상수에 존재해야 함(미존재 → 404). 시드 전엔 도큐먼트가 없으므로 upsert.
router.put('/programs/:key', async (req, res) => {
  try {
    await ensureDBConnection();
    const { key } = req.params;
    if (!PROGRAM_MAP[key]) {
      return res.status(404).json({ success: false, message: '존재하지 않는 프로그램입니다.' });
    }

    const b = req.body || {};
    const $set = { programKey: key };
    if (b.actualParticipants !== undefined) {
      $set.actualParticipants = Math.max(0, Number(b.actualParticipants) || 0);
    }
    if (b.note !== undefined) $set.note = String(b.note);

    const updated = await KkumdarakProgram.findOneAndUpdate(
      { programKey: key },
      { $set },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    );

    res.json({ success: true, message: '프로그램이 수정되었습니다.', data: updated });
  } catch (error) {
    console.error('꿈다락 프로그램 수정 오류:', error);
    handleWriteError(res, error, '프로그램 수정에 실패했습니다.');
  }
});

// ── GET /api/kkumdarak/sessions?programKey= ──────────────────────────────────
router.get('/sessions', async (req, res) => {
  try {
    await ensureDBConnection();
    const { programKey } = req.query;
    const filter = {};
    if (programKey) filter.programKey = programKey;
    const rows = await KkumdarakSession.find(filter).sort({ sessionNo: 1, date: 1, _id: 1 });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    console.error('꿈다락 회차 조회 오류:', error);
    res.status(500).json({ success: false, message: '회차 조회에 실패했습니다.', error: error.message });
  }
});

// ── POST /api/kkumdarak/sessions ─────────────────────────────────────────────
//   회차 등록 = 도큐먼트 1건 생성. attendance(실참여)는 회차 단위 입력(미지정 0).
//   {programKey, sessionNo} 중복이면 409(사전 조회 + E11000 매핑 둘 다).
router.post('/sessions', async (req, res) => {
  try {
    await ensureDBConnection();
    const { programKey, sessionNo, date, title, content, attendance, status, note } = req.body || {};

    if (!programKey || sessionNo === undefined || sessionNo === '') {
      return res.status(400).json({ success: false, message: '프로그램과 회차번호는 필수입니다.' });
    }
    if (!PROGRAM_MAP[programKey]) {
      return res.status(404).json({ success: false, message: '존재하지 않는 프로그램입니다.' });
    }

    const sessionNoNum = Number(sessionNo);

    // 중복 사전 검사(빠른 안내). 경합 시엔 아래 E11000 매핑이 최종 방어.
    const dup = await KkumdarakSession.findOne({ programKey, sessionNo: sessionNoNum });
    if (dup) {
      return res.status(409).json({ success: false, message: '이미 등록된 회차번호입니다.' });
    }

    const session = new KkumdarakSession({
      programKey,
      sessionNo: sessionNoNum,
      date: date || null,
      title: title || '',
      content: content || '',
      attendance: Math.max(0, Number(attendance) || 0),
      status: status || undefined, // 미지정 시 모델 default('예정')
      note: note || '',
    });
    const saved = await session.save();
    res.json({ success: true, message: '회차가 등록되었습니다.', data: saved });
  } catch (error) {
    console.error('꿈다락 회차 등록 오류:', error);
    // 복합 unique 위반(경합 포함) → 409
    if (error && (error.code === 11000 || error.code === 11001)) {
      return res.status(409).json({ success: false, message: '이미 등록된 회차번호입니다.' });
    }
    handleWriteError(res, error, '회차 등록에 실패했습니다.');
  }
});

// ── DELETE /api/kkumdarak/sessions/:id ───────────────────────────────────────
router.delete('/sessions/:id', async (req, res) => {
  try {
    await ensureDBConnection();
    const { id } = req.params;
    const deleted = await KkumdarakSession.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: '회차를 찾을 수 없습니다.' });
    }
    res.json({ success: true, message: '회차가 삭제되었습니다.', data: { id: deleted._id.toString() } });
  } catch (error) {
    console.error('꿈다락 회차 삭제 오류:', error);
    handleWriteError(res, error, '회차 삭제에 실패했습니다.');
  }
});

// ── GET /api/kkumdarak/dashboard/summary ─────────────────────────────────────
//   대시보드 집계: 총 정원합·총 실참여합(Σ세션 attendance)·총 회차(63) 대비 총 등록, 프로그램별 진척.
router.get('/dashboard/summary', async (req, res) => {
  try {
    await ensureDBConnection();
    const programs = await buildProgramStats();

    const totalActualParticipants = programs.reduce((s, p) => s + p.actualParticipants, 0);
    const totalRegisteredSessions = programs.reduce((s, p) => s + p.registeredSessions, 0);

    const participantRatio = TOTAL_QUOTA > 0 ? totalActualParticipants / TOTAL_QUOTA : 0;
    const sessionRatio = TOTAL_SESSIONS > 0 ? totalRegisteredSessions / TOTAL_SESSIONS : 0;

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: {
        totalQuota: TOTAL_QUOTA, // 222
        totalActualParticipants,
        participantProgress: Math.round(participantRatio * 10000) / 100, // % (소수 2자리)
        totalSessions: TOTAL_SESSIONS, // 63
        totalRegisteredSessions,
        totalRemainingSessions: TOTAL_SESSIONS - totalRegisteredSessions,
        sessionProgress: Math.round(sessionRatio * 10000) / 100,
        programs, // 프로그램별 진척(등록/총/잔여·실참여)
      },
    });
  } catch (error) {
    console.error('꿈다락 대시보드 집계 오류:', error);
    res.status(500).json({ success: false, message: '대시보드 집계에 실패했습니다.', error: error.message });
  }
});

// ── 체크리스트(인건비·정산 상태 트래커) ─────────────────────────────────────
const CHECKLIST_TEMPLATES = { personnel: PERSONNEL, settlement: SETTLEMENT };

// GET /api/kkumdarak/checklist/:key — 템플릿 + 저장된 체크 상태
router.get('/checklist/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const template = CHECKLIST_TEMPLATES[key];
    if (!template) return res.status(404).json({ success: false, message: '존재하지 않는 체크리스트입니다.' });
    await ensureDBConnection();
    const doc = await KkumdarakChecklist.findOne({ key });
    res.json({ success: true, data: { template, checked: (doc && doc.data) || {} } });
  } catch (error) {
    console.error('꿈다락 체크리스트 조회 오류:', error);
    res.status(500).json({ success: false, message: '체크리스트 조회에 실패했습니다.', error: error.message });
  }
});

// PUT /api/kkumdarak/checklist/:key — 체크 상태 저장(전체 교체)
router.put('/checklist/:key', async (req, res) => {
  try {
    const { key } = req.params;
    if (!CHECKLIST_TEMPLATES[key]) return res.status(404).json({ success: false, message: '존재하지 않는 체크리스트입니다.' });
    await ensureDBConnection();
    const data = (req.body && req.body.checked) || {};
    const doc = await KkumdarakChecklist.findOneAndUpdate(
      { key },
      { $set: { data } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    res.json({ success: true, message: '저장되었습니다.', data: { checked: doc.data } });
  } catch (error) {
    console.error('꿈다락 체크리스트 저장 오류:', error);
    handleWriteError(res, error, '체크리스트 저장에 실패했습니다.');
  }
});

module.exports = router;
