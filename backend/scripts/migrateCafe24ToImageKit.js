/**
 * cafe24 -> ImageKit URL 마이그레이션 (라이브 MongoDB)
 * ------------------------------------------------------------------
 * 모든 컬렉션의 모든 문자열 필드(중첩 포함)를 재귀 스캔하여
 * `nodetree.cafe24.com` 이 들어간 cafe24 이미지 URL을
 * url_mapping.tsv 기준으로 ImageKit URL로 치환한다.
 *
 * 안전장치:
 *  - 기본은 DRY-RUN: 영향받는 컬렉션/문서 수만 카운트하고 변경하지 않는다.
 *  - 영향 문서는 변경 적용 여부와 무관하게 항상 JSON 백업한다.
 *  - 매핑표에 없는 cafe24 URL은 치환하지 않고 별도 목록으로 보고한다.
 *  - 실제 쓰기는 `--apply` 플래그가 있을 때만 수행한다.
 *    (전역 정책: DB 마이그레이션은 사용자 명시적 승인 후 실행)
 *
 * 실행:
 *   node backend/scripts/migrateCafe24ToImageKit.js          # dry-run + 백업
 *   node backend/scripts/migrateCafe24ToImageKit.js --apply  # 실제 적용
 *
 * 매핑표 경로는 --map=<path> 로 override 가능.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');
const mapArg = process.argv.find((a) => a.startsWith('--map='));
const MAPPING_PATH = mapArg
  ? mapArg.slice('--map='.length)
  : '/Users/kanghyunjung/Desktop/cafe24-image-backup-2026-06-09/url_mapping.tsv';

const CAFE24_SUBSTR = 'nodetree.cafe24.com';

// ── 매핑 로드 (https + 프로토콜 상대 // + http 변형 포함) ──
function loadMapping() {
  const raw = fs.readFileSync(MAPPING_PATH, 'utf-8');
  const pairs = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const [k, v] = line.replace(/\r$/, '').split('\t');
    if (!k || !v) continue;
    pairs.push([k, v]);
    if (k.startsWith('https://')) {
      const rest = k.slice('https://'.length);
      pairs.push(['//' + rest, v]);
      pairs.push(['http://' + rest, v]);
    }
  }
  // 긴 키 우선 (prefix overlap 방지)
  pairs.sort((a, b) => b[0].length - a[0].length);
  return pairs;
}

const PAIRS = loadMapping();

// 문자열 하나 치환. 반환: { value, replaced, unmapped[] }
const URL_RE = /(?:https?:)?\/\/nodetree\.cafe24\.com[^\s"'<>)]+/g;
function transformString(str) {
  if (typeof str !== 'string' || !str.includes(CAFE24_SUBSTR)) {
    return { value: str, replaced: 0, unmapped: [] };
  }
  let out = str;
  let replaced = 0;
  for (const [k, v] of PAIRS) {
    if (out.includes(k)) {
      const before = out;
      out = out.split(k).join(v);
      // count occurrences replaced
      const cnt = before.split(k).length - 1;
      replaced += cnt;
    }
  }
  // 치환 후에도 남은 cafe24 URL = 매핑에 없는 것
  const unmapped = out.match(URL_RE) || [];
  return { value: out, replaced, unmapped };
}

// 도큐먼트(객체/배열) 재귀 변환. 반환: { changed:bool, replaced:int, unmapped:Set }
function transformDoc(node) {
  let changed = false;
  let replaced = 0;
  const unmapped = new Set();

  function walk(val) {
    if (typeof val === 'string') {
      const r = transformString(val);
      r.unmapped.forEach((u) => unmapped.add(u));
      if (r.replaced > 0) {
        changed = true;
        replaced += r.replaced;
      }
      return r.value;
    }
    if (Array.isArray(val)) {
      return val.map(walk);
    }
    if (val && typeof val === 'object') {
      // ObjectId / Date 등 BSON 특수타입은 그대로 둠
      if (val._bsontype || val instanceof Date) return val;
      for (const key of Object.keys(val)) {
        val[key] = walk(val[key]);
      }
      return val;
    }
    return val;
  }

  const newDoc = walk(node);
  return { newDoc, changed, replaced, unmapped };
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI 미설정 — 실행은 사용자 승인/연결 필요. (값 출력 안 함)');
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`✅ MongoDB 연결 (host=${mongoose.connection.host})`);
  console.log(`모드: ${APPLY ? '🔴 APPLY (실제 쓰기)' : '🟢 DRY-RUN (변경 없음)'}`);
  console.log(`매핑 엔트리: ${PAIRS.length}개\n`);

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  const backupDir = path.join(__dirname, '../../', `cafe24-db-backup-${new Date().toISOString().slice(0, 10)}`);
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  let grandDocs = 0;
  let grandReplacements = 0;
  const allUnmapped = new Set();
  const perColl = [];

  for (const c of collections) {
    const name = c.name;
    if (name.startsWith('system.')) continue;
    const coll = db.collection(name);

    // cafe24 substring 포함 문서만 후보로
    const candidates = await coll.find({}).toArray();
    const affected = [];
    let collReplacements = 0;

    for (const doc of candidates) {
      const json = JSON.stringify(doc);
      if (!json.includes(CAFE24_SUBSTR)) continue;
      const clone = JSON.parse(JSON.stringify(doc)); // _id는 문자열화됨 (백업/판정용)
      const { changed, replaced, unmapped } = transformDoc(clone);
      unmapped.forEach((u) => allUnmapped.add(u));
      if (changed || unmapped.size) {
        affected.push({ _id: doc._id, original: doc, transformed: clone, replaced });
        collReplacements += replaced;
      }
    }

    if (affected.length === 0) continue;

    // 백업 (원본 문서 그대로)
    const backupFile = path.join(backupDir, `${name}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(affected.map((a) => a.original), null, 2), 'utf-8');

    perColl.push({ name, docs: affected.length, replacements: collReplacements });
    grandDocs += affected.length;
    grandReplacements += collReplacements;

    console.log(`📂 ${name}: 영향 문서 ${affected.length}개, 치환 ${collReplacements}건 → 백업 ${path.basename(backupFile)}`);

    if (APPLY) {
      for (const a of affected) {
        if (a.replaced > 0) {
          // 원본 doc에 직접 재귀 변환 적용(ObjectId/Date 보존)
          const { newDoc } = transformDoc(a.original);
          const { _id, ...rest } = newDoc;
          await coll.replaceOne({ _id: a._id }, { ...rest });
        }
      }
      console.log(`   ✅ ${name} 적용 완료`);
    }
  }

  console.log('\n──────── 요약 ────────');
  console.log(`백업 폴더: ${backupDir}`);
  console.table(perColl);
  console.log(`영향 문서 총합: ${grandDocs}`);
  console.log(`치환 건수 총합: ${grandReplacements}`);
  if (allUnmapped.size) {
    console.log(`\n⚠️ 매핑에 없는 cafe24 URL (${allUnmapped.size}개) — 치환되지 않음:`);
    [...allUnmapped].sort().forEach((u) => console.log('   ' + u));
  } else {
    console.log('\n✅ 매핑 누락 cafe24 URL 없음.');
  }
  if (!APPLY) {
    console.log('\n🟢 DRY-RUN 완료 — 실제 변경 없음. 적용하려면 --apply (사용자 승인 후).');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ 실패:', err.message);
  process.exit(1);
});
