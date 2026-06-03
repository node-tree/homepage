const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// 꿈다락 체크리스트(상태 트래커) — key 별 싱글톤. (VillageDiary 싱글톤 패턴)
//   key: 'personnel'(인건비·4대보험 월별 처리상태) | 'settlement'(정산 단계).
//   data: 자유 JSON(체크 상태 { itemKey: true, ... } 등). 민감 금액은 저장 안 함(상태만).
// ─────────────────────────────────────────────────────────────────────────────
const kkumdarakChecklistSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    data: { type: Object, default: {} },
  },
  { timestamps: true, collection: 'kkumdarak_checklist', minimize: false },
);

module.exports =
  mongoose.models.KkumdarakChecklist ||
  mongoose.model('KkumdarakChecklist', kkumdarakChecklistSchema);
