// ikReorganize CLI 순수 로직 단위 테스트
//   실행: node --test backend/scripts/ikReorganize.test.js
//
//   여기서 굳히는 것은 실측으로 드러난 결함 2건이다.
//     결함1: --resume 이 완료 항목을 계획에서 빼지 않아, 이미 옮겨진 원본이
//            존재검사에 걸려 "문제 있는 항목 N건 → 중단" 으로 재개가 막혔다.
//     결함2: 참조 0건이라 로그 배치가 없는 항목을 롤백에서 "실패"로 세어,
//            파일 복원이 끝났는데도 0/1 로 보고됐다.
const test = require('node:test');
const assert = require('node:assert');

const { parseTsv, filterResume, planRollback, looksLikeFile } = require('./ikReorganize');

// ── TSV 파싱(회귀) ─────────────────────────────────────────────
test('parseTsv: 확장자로 file/folder 자동 판별', () => {
  assert.equal(looksLikeFile('/a/b.jpg'), true);
  assert.equal(looksLikeFile('/a/b'), false);
  const { rows } = parseTsv('/a/b.jpg\t/c/b.jpg\n/x\t/y\n');
  assert.deepEqual(rows.map((r) => r.kind), ['file', 'folder']);
});

// ── 결함1: --resume ────────────────────────────────────────────
test('filterResume: 이전 보고서의 완료 항목을 계획에서 제외한다', () => {
  const { rows } = parseTsv('/src/a.jpg\t/dst/a.jpg\n/src/b.jpg\t/dst/b.jpg\n');
  const report = {
    results: [
      { kind: 'file', from: '/src/a.jpg', to: '/dst/a.jpg', ok: true, dbBatchId: 'batch-a' },
      { kind: 'file', from: '/src/b.jpg', to: '/dst/b.jpg', ok: false, error: '충돌' },
    ],
  };
  const { remaining, skipped } = filterResume(rows, report);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].from, '/src/a.jpg');
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].from, '/src/b.jpg', '실패했던 항목만 다시 시도해야 한다');
});

test('filterResume: 완료 항목의 dbBatchId 를 물려받는다(이후 롤백을 위해)', () => {
  const { rows } = parseTsv('/src/a.jpg\t/dst/a.jpg\n');
  const report = { results: [{ kind: 'file', from: '/src/a.jpg', to: '/dst/a.jpg', ok: true, dbBatchId: 'batch-a' }] };
  const { skipped } = filterResume(rows, report);
  assert.equal(skipped[0].prevDbBatchId, 'batch-a');
});

test('filterResume: dbBatchId 가 없던 항목은 null 로 물려받는다', () => {
  const { rows } = parseTsv('/src/a.jpg\t/dst/a.jpg\n');
  const report = { results: [{ kind: 'file', from: '/src/a.jpg', to: '/dst/a.jpg', ok: true }] };
  assert.equal(filterResume(rows, report).skipped[0].prevDbBatchId, null);
});

test('filterResume: 이전에 건너뛴(ok+skipped) 항목도 완료로 본다', () => {
  const { rows } = parseTsv('/src/a.jpg\t/dst/a.jpg\n');
  const report = { results: [{ kind: 'file', from: '/src/a.jpg', to: '/dst/a.jpg', ok: true, skipped: true }] };
  assert.equal(filterResume(rows, report).remaining.length, 0);
});

test('filterResume: 종류(kind)가 다르면 다른 항목으로 취급', () => {
  const { rows } = parseTsv('/src/a\t/dst/a\n'); // folder
  const report = { results: [{ kind: 'file', from: '/src/a', to: '/dst/a', ok: true }] };
  assert.equal(filterResume(rows, report).remaining.length, 1);
});

test('filterResume: 보고서가 비어도 안전하다', () => {
  const { rows } = parseTsv('/src/a.jpg\t/dst/a.jpg\n');
  assert.equal(filterResume(rows, null).remaining.length, 1);
  assert.equal(filterResume(rows, {}).remaining.length, 1);
});

// ── 결함2: --rollback ──────────────────────────────────────────
test('planRollback: 성공 항목만 역순으로, 방향을 뒤집어 만든다', () => {
  const report = {
    results: [
      { kind: 'file', from: '/s/a.jpg', to: '/d/a.jpg', ok: true, dbBatchId: 'b1' },
      { kind: 'file', from: '/s/b.jpg', to: '/d/b.jpg', ok: true, dbBatchId: null },
      { kind: 'file', from: '/s/c.jpg', to: '/d/c.jpg', ok: false, error: 'x' },
    ],
  };
  const plan = planRollback(report);
  assert.equal(plan.length, 2, '실패 항목은 되돌릴 대상이 아니다');
  assert.deepEqual(
    plan.map((p) => `${p.from}->${p.to}`),
    ['/d/b.jpg->/s/b.jpg', '/d/a.jpg->/s/a.jpg'],
    '역순이어야 한다'
  );
});

test('planRollback: dbBatchId 가 없으면 null 로 전달(=DB 단계 해당 없음)', () => {
  const report = { results: [{ kind: 'file', from: '/s/a.jpg', to: '/d/a.jpg', ok: true }] };
  const plan = planRollback(report);
  assert.equal(plan[0].dbBatchId, null);
});

test('planRollback: 이전 실행에서 건너뛴 항목도 파일은 되돌려야 하므로 포함한다', () => {
  const report = {
    results: [{ kind: 'file', from: '/s/a.jpg', to: '/d/a.jpg', ok: true, skipped: true, dbBatchId: 'b0' }],
  };
  const plan = planRollback(report);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].wasSkipped, true);
  assert.equal(plan[0].dbBatchId, 'b0');
});

test('planRollback: 빈 보고서는 빈 계획', () => {
  assert.deepEqual(planRollback({ results: [] }), []);
  assert.deepEqual(planRollback({}), []);
});

// ── 롤백: fileId 승계 & 파일 우선 순서 ──────────────────────────
//   실측 사고: results 에 newFileId 가 없어 롤백이 경로로만 파일을 찾다가
//   목록 인덱스 지연으로 404 → 파일은 그대로인데 DB 만 되돌아가 불일치가 났다.
test('planRollback: newFileId 를 fileId 로 승계한다', () => {
  const report = {
    results: [{ kind: 'file', from: '/s/a.jpg', to: '/d/a.jpg', ok: true, newFileId: 'nf1', dbBatchId: 'b1' }],
  };
  const plan = planRollback(report);
  assert.equal(plan[0].fileId, 'nf1');
  assert.equal(plan[0].dbBatchId, 'b1');
});

test('planRollback: newFileId 가 없던 예전 보고서는 null 로(경로 폴백)', () => {
  const report = { results: [{ kind: 'file', from: '/s/a.jpg', to: '/d/a.jpg', ok: true }] };
  assert.equal(planRollback(report)[0].fileId, null);
});

test('planRollback: 폴더 항목은 fileId 가 null 이다', () => {
  const report = { results: [{ kind: 'folder', from: '/s/x', to: '/d/x', ok: true }] };
  assert.equal(planRollback(report)[0].fileId, null);
  assert.equal(planRollback(report)[0].kind, 'folder');
});

test('filterResume: 완료 항목의 newFileId 도 물려받는다(재개 후 롤백 대비)', () => {
  const { rows } = parseTsv('/src/a.jpg\t/dst/a.jpg\n');
  const report = {
    results: [{ kind: 'file', from: '/src/a.jpg', to: '/dst/a.jpg', ok: true, newFileId: 'nf9', dbBatchId: 'b9' }],
  };
  const { skipped } = filterResume(rows, report);
  assert.equal(skipped[0].prevNewFileId, 'nf9');
  assert.equal(skipped[0].prevDbBatchId, 'b9');
});

test('planRollback: 역순 + fileId 가 각 항목에 정확히 매칭된다', () => {
  const report = {
    results: [
      { kind: 'file', from: '/s/a.jpg', to: '/d/a.jpg', ok: true, newFileId: 'A' },
      { kind: 'file', from: '/s/b.jpg', to: '/d/b.jpg', ok: true, newFileId: 'B' },
    ],
  };
  const plan = planRollback(report);
  assert.deepEqual(plan.map((p) => [p.from, p.fileId]), [['/d/b.jpg', 'B'], ['/d/a.jpg', 'A']]);
});
