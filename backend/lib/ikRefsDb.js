// ═══════════════════════════════════════════════════════════════
// ImageKit URL 참조 — DB 조회/치환/롤백
//
//   원칙
//   · 컬렉션 화이트리스트를 두지 않는다. 새 컬렉션이 생겨도 자동 포함되어야 누락이 없다.
//     (system.* 과 our 로그 컬렉션만 제외)
//   · 쓰기 전 원본 문서 전체를 imagekit_ref_log 에 남긴다 → 언제든 되돌릴 수 있다.
//   · 변경된 문서만 replaceOne. 변경 없으면 아예 쓰지 않는다.
//   · 참조 인덱스는 60초 캐시 — 이동 모달이 열릴 때마다 전수 스캔하면 Render 콜드스타트와
//     겹쳐 체감이 무너진다.
// ═══════════════════════════════════════════════════════════════

const { buildMapper, replaceDeep, scanDeep, canonPath, invertMappings } = require('./ikRefs');

const LOG_COLLECTION = 'imagekit_ref_log';
/** 개발/검증 전용 임시 컬렉션 — 운영 데이터가 아니므로 스캔 대상에서 뺀다. */
const TEST_COLLECTION = 'imagekit_ref_test';
const INDEX_TTL_MS = 60_000;

let indexCache = null; // { at, byPath: Map<canon, ref[]>, stats }

function isScannable(name) {
  return !name.startsWith('system.') && name !== LOG_COLLECTION;
}

/** 스캔 대상 컬렉션 이름 목록 */
async function listScannableCollections(db, { includeTest = false } = {}) {
  const cols = await db.listCollections().toArray();
  return cols
    .map((c) => c.name)
    .filter((n) => isScannable(n) && (includeTest || n !== TEST_COLLECTION))
    .sort();
}

/**
 * 전수 스캔 → canonical 경로별 참조 인덱스.
 *   반환: { byPath: Map<string, [{collection,_id,field,url}]>, stats:{collections,docs,refs,uniquePaths} }
 */
async function buildRefIndex(db, { includeTest = false } = {}) {
  const names = await listScannableCollections(db, { includeTest });
  const byPath = new Map();
  let docs = 0;
  let refs = 0;

  for (const name of names) {
    const cursor = db.collection(name).find({});
    // eslint-disable-next-line no-await-in-loop
    for await (const doc of cursor) {
      docs += 1;
      scanDeep(doc, (r) => {
        refs += 1;
        const list = byPath.get(r.path) || [];
        list.push({ collection: name, _id: String(doc._id), field: r.field, url: r.url });
        byPath.set(r.path, list);
      });
    }
  }
  return {
    byPath,
    stats: { collections: names.length, docs, refs, uniquePaths: byPath.size },
  };
}

/** 캐시된 인덱스(60초). force 로 무효화. */
async function getRefIndex(db, { force = false, includeTest = false } = {}) {
  if (!force && indexCache && Date.now() - indexCache.at < INDEX_TTL_MS) return indexCache;
  const built = await buildRefIndex(db, { includeTest });
  indexCache = { at: Date.now(), ...built };
  return indexCache;
}

function invalidateRefIndex() {
  indexCache = null;
}

/**
 * 경로 목록에 대한 참조 조회.
 *   paths 는 파일 경로 또는 폴더 경로. 폴더면 그 하위 전체를 합산한다.
 *   반환: [{ path, kind, count, refs:[{collection,_id,field}], byCollection:{col:n} }]
 */
async function findRefs(db, paths, { kinds = {}, force = false } = {}) {
  const idx = await getRefIndex(db, { force });
  const out = [];
  for (const raw of paths || []) {
    const p = canonPath(raw);
    const kind = kinds[raw] || kinds[p] || 'auto';
    const collected = [];
    if (kind !== 'folder') {
      for (const r of idx.byPath.get(p) || []) collected.push(r);
    }
    if (kind !== 'file') {
      // 폴더(또는 auto)면 하위 경로도 포함. `/old` 가 `/older/..` 를 먹지 않도록 경계 확인.
      const prefix = `${p}/`;
      for (const [key, list] of idx.byPath) {
        if (key.startsWith(prefix)) collected.push(...list);
      }
    }
    const byCollection = {};
    for (const r of collected) byCollection[r.collection] = (byCollection[r.collection] || 0) + 1;
    out.push({
      path: p,
      kind,
      count: collected.length,
      byCollection,
      refs: collected.map((r) => ({ collection: r.collection, _id: r._id, field: r.field })),
    });
  }
  return out;
}

/**
 * 매핑을 DB 전체에 적용한다.
 *   opts.dryRun  : true 면 쓰지 않고 영향 문서/건수만 계산
 *   opts.batchId : 롤백 단위 식별자(미지정 시 생성)
 *   opts.actor   : 누가 실행했는지(감사 로그)
 *   opts.only    : 특정 컬렉션만(테스트용)
 *   반환: { batchId, dryRun, refsUpdated:{col:n}, documents, logIds, failures:[] }
 */
async function applyMappings(db, mappings, opts = {}) {
  const { dryRun = false, actor = 'unknown', only = null, includeTest = false } = opts;
  const batchId = opts.batchId || `ikref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const mapper = buildMapper(mappings);
  const names = only
    ? [].concat(only)
    : await listScannableCollections(db, { includeTest });

  const refsUpdated = {};
  const failures = [];
  const logIds = [];
  let documents = 0;

  for (const name of names) {
    const col = db.collection(name);
    const cursor = col.find({});
    // eslint-disable-next-line no-await-in-loop
    for await (const doc of cursor) {
      const r = replaceDeep(doc, mapper);
      if (!r.count) continue;
      documents += 1;
      refsUpdated[name] = (refsUpdated[name] || 0) + r.count;
      if (dryRun) continue;
      try {
        // 원본 전체를 먼저 보존 → 그 다음 교체(순서 뒤바뀌면 복구 불가)
        // eslint-disable-next-line no-await-in-loop
        const logRes = await db.collection(LOG_COLLECTION).insertOne({
          ts: new Date(),
          batchId,
          actor,
          collection: name,
          docId: doc._id,
          before: doc,
          mapping: mappings,
          hits: r.hits,
        });
        logIds.push(String(logRes.insertedId));
        // eslint-disable-next-line no-await-in-loop
        await col.replaceOne({ _id: doc._id }, r.value);
      } catch (e) {
        failures.push({ collection: name, _id: String(doc._id), error: e.message });
      }
    }
  }

  if (!dryRun) invalidateRefIndex();
  return { batchId, dryRun, refsUpdated, documents, logIds, failures };
}

/**
 * 로그 1건 또는 배치 전체를 되돌린다(원본 문서로 replaceOne).
 *   이미 되돌린 로그는 건너뛴다.
 */
async function rollback(db, { logId, batchId }) {
  const { ObjectId } = require('mongodb');
  const log = db.collection(LOG_COLLECTION);
  const query = {};
  if (logId) {
    try {
      query._id = new ObjectId(String(logId));
    } catch {
      const err = new Error('유효하지 않은 logId 입니다.');
      err.status = 400;
      throw err;
    }
  } else if (batchId) {
    query.batchId = String(batchId);
  } else {
    const err = new Error('logId 또는 batchId 가 필요합니다.');
    err.status = 400;
    throw err;
  }
  query.rolledBackAt = { $exists: false };

  // 나중 것부터 되돌려야 같은 문서를 여러 번 고친 경우에도 최초 상태로 수렴한다.
  const entries = await log.find(query).sort({ ts: -1, _id: -1 }).toArray();
  if (entries.length === 0) {
    const err = new Error('되돌릴 로그가 없습니다(이미 롤백되었거나 존재하지 않음).');
    err.status = 404;
    throw err;
  }

  const restored = {};
  const failures = [];
  for (const e of entries) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await db.collection(e.collection).replaceOne({ _id: e.docId }, e.before, { upsert: true });
      // eslint-disable-next-line no-await-in-loop
      await log.updateOne({ _id: e._id }, { $set: { rolledBackAt: new Date() } });
      restored[e.collection] = (restored[e.collection] || 0) + 1;
    } catch (err) {
      failures.push({ collection: e.collection, _id: String(e.docId), error: err.message });
    }
  }
  invalidateRefIndex();
  return { entries: entries.length, restored, failures };
}

/** 최근 로그 목록(롤백 UI/CLI 용) */
async function listLogs(db, { limit = 50, batchId } = {}) {
  const q = batchId ? { batchId: String(batchId) } : {};
  const rows = await db
    .collection(LOG_COLLECTION)
    .find(q, { projection: { before: 0 } })
    .sort({ ts: -1 })
    .limit(Math.min(200, Math.max(1, limit)))
    .toArray();
  return rows.map((r) => ({
    logId: String(r._id),
    batchId: r.batchId,
    ts: r.ts,
    actor: r.actor,
    collection: r.collection,
    docId: String(r.docId),
    hits: (r.hits || []).length,
    rolledBackAt: r.rolledBackAt || null,
  }));
}

module.exports = {
  LOG_COLLECTION,
  TEST_COLLECTION,
  listScannableCollections,
  buildRefIndex,
  getRefIndex,
  invalidateRefIndex,
  findRefs,
  applyMappings,
  rollback,
  listLogs,
  invertMappings,
};
