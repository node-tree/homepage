/**
 * 꿈다락 교육재료비 program 백필 스크립트
 *
 * 목적: 기존 교육재료비(subItem='교육재료비') 트랜잭션의 description 괄호에서
 *   프로그램 단축명을 추출해 program(programKey)으로 자동 분류한다.
 *
 * 매핑 규칙:
 *   1) description 에서 정규식 \(([^)]+)\) 로 괄호 안 텍스트 추출
 *   2) 공백 제거 후 단축명→programKey 사전으로 매핑
 *   3) 못 찾으면 program=null (미분류) 유지
 *
 * 사용법:
 *   node backend/scripts/backfillKkumdarakProgram.js            # DRY-RUN (기본, DB 미변경)
 *   node backend/scripts/backfillKkumdarakProgram.js --dry-run  # DRY-RUN (명시)
 *   node backend/scripts/backfillKkumdarakProgram.js --apply    # 실제 쓰기 (검수 후에만)
 *
 * ⚠️ 기본은 DRY-RUN — 각 건의 _id·description·현재 program·제안 program 을 출력만 한다.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const KkumdarakTransaction = require('../models/KkumdarakTransaction');

// 단축명(공백제거)→programKey 사전. 정본 6개 + 마을의신호(편성 없음, 안전망).
const SHORTNAME_TO_KEY = {
  장암책정: 'jangam-chaekjeong',
  기억순환: 'gieok-sunhwan',
  손의기억: 'son-gieok',
  소리일기: 'sori-ilgi',
  풍경일기: 'punggyeong-ilgi',
  다시안녕: 'dasi-annyeong',
  마을의신호: 'maeul-signal',
};

function proposeProgram(description) {
  if (!description) return null;
  const m = String(description).match(/\(([^)]+)\)/);
  if (!m) return null;
  const token = m[1].replace(/\s+/g, ''); // 괄호 안 공백 제거
  return SHORTNAME_TO_KEY[token] || null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const mode = apply ? 'APPLY (DB 쓰기)' : 'DRY-RUN (DB 미변경)';
  console.log(`\n══ 꿈다락 교육재료비 program 백필 — ${mode} ══\n`);

  if (!process.env.MONGODB_URI) {
    console.error('✖ MONGODB_URI 미설정 — .env 확인 필요. 종료.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);

  const rows = await KkumdarakTransaction.find({ subItem: '교육재료비' })
    .sort({ date: 1, _id: 1 })
    .lean();

  console.log(`대상(subItem='교육재료비'): ${rows.length}건\n`);

  let willChange = 0;
  const plan = [];
  for (const r of rows) {
    const current = r.program || null;
    const proposed = proposeProgram(r.description);
    const change = proposed && proposed !== current;
    if (change) willChange += 1;
    plan.push({ _id: String(r._id), description: r.description, current, proposed, change });
    console.log(
      `- _id=${String(r._id)}\n` +
      `  description : ${r.description}\n` +
      `  current     : ${current === null ? 'null(미분류)' : current}\n` +
      `  proposed    : ${proposed === null ? 'null(미분류 유지)' : proposed}` +
      `${change ? '   ← 변경' : '   (변경 없음)'}\n`,
    );
  }

  console.log(`요약: 총 ${rows.length}건 중 변경 제안 ${willChange}건, 미분류 유지 ${rows.length - willChange}건\n`);

  if (!apply) {
    console.log('DRY-RUN 종료 — DB 는 변경되지 않았습니다. 적용하려면 --apply 플래그로 재실행하세요.\n');
    await mongoose.disconnect();
    return;
  }

  // --- APPLY: 변경 제안 건만 program 갱신 ---
  let applied = 0;
  for (const p of plan) {
    if (!p.change) continue;
    await KkumdarakTransaction.updateOne({ _id: p._id }, { $set: { program: p.proposed } });
    applied += 1;
    console.log(`✔ 적용: _id=${p._id} → program=${p.proposed}`);
  }
  console.log(`\nAPPLY 완료 — ${applied}건 갱신.\n`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('백필 오류:', err);
  process.exit(1);
});
