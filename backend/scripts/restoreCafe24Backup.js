/**
 * cafe24 -> ImageKit 마이그레이션 롤백(복원) 스크립트
 * ------------------------------------------------------------------
 * cafe24-db-backup-2026-06-09/ 의 각 <collection>.json 을 읽어
 * 마이그레이션 이전(=cafe24 URL) 원본 상태로 되돌린다.
 *
 * 직렬화 캐스팅 (핵심):
 *  - 백업 JSON의 _id 는 hex 문자열 → ObjectId 로 캐스팅.
 *  - 날짜 필드는 ISO8601 문자열 → Date 로 캐스팅.
 *    (replaceOne({_id: ObjectId(...)}, doc) — 문자열 _id 로 하면
 *     매치 실패/중복문서 위험)
 *
 * 안전장치:
 *  - 기본은 DRY-RUN: 복원 대상 문서 수만 리포트, 변경 없음.
 *  - 실제 쓰기는 --apply 플래그가 있을 때만 수행.
 *    (전역 정책: DB 마이그레이션/복원은 사용자 명시적 승인 후 실행)
 *
 * 실행:
 *   node backend/scripts/restoreCafe24Backup.js          # dry-run
 *   node backend/scripts/restoreCafe24Backup.js --apply  # 실제 복원
 *
 * 백업 폴더 경로는 --dir=<path> 로 override 가능.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');

const APPLY = process.argv.includes('--apply');
const dirArg = process.argv.find((a) => a.startsWith('--dir='));
const BACKUP_DIR = dirArg
  ? dirArg.slice('--dir='.length)
  : path.join(__dirname, '../../', 'cafe24-db-backup-2026-06-09');

// 파일명(컬렉션) → mongo 컬렉션명. 백업은 컬렉션명 그대로 저장됨.
function backupFiles() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ collection: f.replace(/\.json$/, ''), file: path.join(BACKUP_DIR, f) }));
}

// ── 날짜 필드 안전 변환 ──
// 과변환 방지: (1) 명백한 날짜 필드명(allowlist) 또는
//             (2) 엄격한 ISO8601(타임존 포함) 패턴인 문자열만 Date 로.
const DATE_KEYS = new Set(['createdAt', 'updatedAt', 'syncedAt', 'date', 'publishedAt', 'deletedAt']);
// 예: 2026-01-21T04:20:15.698Z / 2025-06-14T14:24:06Z / ...+09:00
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function isIsoDateString(s) {
  if (typeof s !== 'string' || !ISO_RE.test(s)) return false;
  const t = Date.parse(s);
  return !Number.isNaN(t);
}

// _id 와 날짜 문자열을 재귀적으로 캐스팅. (key 문맥으로 날짜 판정)
function castValue(key, val) {
  if (key === '_id' && typeof val === 'string' && /^[a-fA-F0-9]{24}$/.test(val)) {
    return new ObjectId(val);
  }
  if (typeof val === 'string') {
    // 명백한 날짜 필드명이면서 ISO 형태일 때만 Date 로
    if (DATE_KEYS.has(key) && isIsoDateString(val)) {
      return new Date(val);
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => castValue(null, item));
  }
  if (val && typeof val === 'object') {
    const out = {};
    for (const k of Object.keys(val)) {
      out[k] = castValue(k, val[k]);
    }
    return out;
  }
  return val;
}

function castDoc(doc) {
  return castValue(null, doc); // 최상위는 객체 → 내부 키 문맥으로 처리
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI 미설정 — 실행은 사용자 승인/연결 필요. (값 출력 안 함)');
    process.exit(2);
  }

  const files = backupFiles();
  if (files.length === 0) {
    console.error(`❌ 백업 파일 없음: ${BACKUP_DIR}`);
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log(`✅ MongoDB 연결 (host=${mongoose.connection.host})`);
  console.log(`모드: ${APPLY ? '🔴 APPLY (실제 복원)' : '🟢 DRY-RUN (변경 없음)'}`);
  console.log(`백업 폴더: ${BACKUP_DIR}\n`);

  const db = mongoose.connection.db;
  const summary = [];
  let grandDocs = 0;

  for (const { collection, file } of files) {
    const docs = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const coll = db.collection(collection);
    let restored = 0;

    for (const raw of docs) {
      const doc = castDoc(raw);
      if (!doc._id) {
        console.warn(`   ⚠️ ${collection}: _id 없는 문서 스킵`);
        continue;
      }
      if (APPLY) {
        const { _id, ...rest } = doc;
        // upsert: 혹시 삭제됐어도 원본 복원되도록
        await coll.replaceOne({ _id }, { _id, ...rest }, { upsert: true });
      }
      restored += 1;
    }

    summary.push({ collection, docs: restored });
    grandDocs += restored;
    console.log(`📂 ${collection}: 복원 대상 ${restored}개${APPLY ? ' → ✅ 적용' : ''}`);
  }

  console.log('\n──────── 요약 ────────');
  console.table(summary);
  console.log(`복원 대상 문서 총합: ${grandDocs}`);
  if (!APPLY) {
    console.log('\n🟢 DRY-RUN 완료 — 실제 변경 없음. 복원하려면 --apply (사용자 승인 후).');
  } else {
    console.log('\n🔴 복원 적용 완료 — DB가 cafe24 URL 상태로 되돌아갔습니다.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ 실패:', err.message);
  process.exit(1);
});
