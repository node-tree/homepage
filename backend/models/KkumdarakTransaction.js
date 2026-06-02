const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// 꿈다락 집행 트랜잭션 (Work.js 문서형 CRUD 패턴).
//   한 건 = 예치형(사전승인형) 집행 1건. 기획서 §1-2 / 흐름 A.
//
// ⚠️ 민감정보 미저장 원칙(기획 §4-1 확정):
//   - 주민번호 필드 없음 (e나라도움·4insure에만 입력, 도구는 상태만)
//   - 계좌번호 이 단계 모델엔 없음 (후속 단계에서 뒷4자리+암호화)
//
// 금액 규칙(기획 §1-2): 집행금액은 항상 "원천징수 전 총액(grossAmount)" 으로 저장.
//   netAmount(실지급) = grossAmount − withholdingAmount 는 파생값 → pre('save')에서 계산·저장.
//   (Mongoose virtual 대신 저장형을 택해, 집계/쿼리·정렬·정합 대사를 단순화한다.)
//   findByIdAndUpdate 경로는 pre('save') 가 발화하지 않으므로, PUT 라우트에서 gross/withholding
//   을 함께 확정해 netAmount 를 직접 $set 한다(routes/kkumdarakBudget.js PUT 참조).
//
// 회의식비 누계 규칙(기획 §1-1 편성제한): subItem === '회의식비' 인 건의 grossAmount 합.
//   (회의식비는 편성 라인이 아니라 트랜잭션 단위 누계로만 검증된다 — summary 라우트 참조)
//   TODO: 후속 단계에서 subItem 을 코드화(코드테이블/enum)할 예정 — 현재는 자유텍스트 일치.
// ─────────────────────────────────────────────────────────────────────────────

const evidenceMetaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // 증빙 파일/서식 표시명
    formCode: { type: String, default: '' }, // 서식 코드 (예: 서식5, 지출결의서)
    status: { type: String, default: '미첨부' }, // 미첨부 | 첨부 | 확인 등 (메타만)
  },
  { _id: false }
);

const kkumdarakTransactionSchema = new mongoose.Schema(
  {
    // 집행일자 = 예탁계좌 출금일 (은행 이체일과 구분, 기획 흐름 A)
    date: { type: Date, required: true },

    // 비목/세목 (e나라도움 코드와 1:1) — kkumdarakBudget.BUDGET_LINES 와 정합
    majorCode: { type: String, required: true }, // 110/210/220/240/320
    subCode: { type: String, required: true }, // 03/01/02/07/14 ...
    subItem: { type: String, default: null }, // 세세목 (일반수용비 등). optional

    description: { type: String, required: true }, // 집행내용

    // 금액 — 항상 총액 기준 저장
    grossAmount: { type: Number, required: true, min: 0 }, // 원천징수 전 총액
    withholdingAmount: { type: Number, default: 0, min: 0 }, // 원천징수액
    netAmount: { type: Number, default: 0, min: 0 }, // 실지급 = 파생(저장)

    payeeName: { type: String, default: '' }, // 수취인 (이름만, 주민번호·계좌 미저장)
    paymentMethod: {
      type: String,
      enum: ['transfer', 'card'],
      required: true,
    },
    incomeType: {
      type: String,
      enum: ['근로', '사업3.3', '기타8.8', null],
      default: null,
    },

    // 예치형 상태머신 (사전승인형):
    //   지출결의 → 집행정보등록 → 증빙첨부 → 집행요청 → 이체실행 → 원천세신고
    status: {
      type: String,
      enum: ['지출결의', '집행정보등록', '증빙첨부', '집행요청', '이체실행', '원천세신고'],
      default: '지출결의',
    },

    // 진흥원(아르떼) 승인상태
    arteApproval: {
      type: String,
      enum: ['대기', '승인', '반려', null],
      default: null,
    },

    // 증빙 메타만 (실제 파일은 흐름 B에서 Google Drive)
    evidenceMeta: { type: [evidenceMetaSchema], default: [] },

    note: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'kkumdarak_transaction',
  }
);

// 파생 netAmount 저장 (총액 − 원천징수액, 0 미만 방지)
kkumdarakTransactionSchema.pre('save', function (next) {
  const gross = this.grossAmount || 0;
  const wh = this.withholdingAmount || 0;
  this.netAmount = Math.max(0, gross - wh);
  next();
});

module.exports = mongoose.model(
  'KkumdarakTransaction',
  kkumdarakTransactionSchema,
  'kkumdarak_transaction'
);
