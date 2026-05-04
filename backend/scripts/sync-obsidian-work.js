#!/usr/bin/env node
/**
 * 옵시디안 → MongoDB Work 동기화 CLI
 *
 * 사용법:
 *   node backend/scripts/sync-obsidian-work.js \
 *     --post-id 69f7f16819e31bf1bef2699d \
 *     --obsidian "NODE TREE/작품/2026/공생직조"
 *
 * 환경변수:
 *   MONGODB_URI         (필수)
 *   OBSIDIAN_VAULT_PATH (선택, 기본 ~/Documents/Obsidian Vault)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Work = require('../models/Work');
const { buildResearchPayload, DEFAULT_VAULT_ROOT } = require('../utils/obsidian-sync');

const parseArgs = (argv) => {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { args.help = true; continue; }
    if (a === '--post-id') { args.postId = argv[++i]; continue; }
    if (a === '--obsidian') { args.obsidian = argv[++i]; continue; }
    if (a === '--mongodb-uri') { args.mongoUri = argv[++i]; continue; }
  }
  return args;
};

const printHelp = () => {
  console.log(`
옵시디안 → MongoDB Work 동기화 CLI

사용법:
  node backend/scripts/sync-obsidian-work.js --post-id <ID> [--obsidian <PATH>]

옵션:
  --post-id <ID>       대상 Work 문서의 MongoDB ObjectId (필수)
  --obsidian <PATH>    옵시디안 폴더 경로 (vault 상대경로 또는 절대경로)
                       기본: "NODE TREE/작품/2026/공생직조"
  --mongodb-uri <URI>  MongoDB 연결 문자열 (env MONGODB_URI 우선)
  --help, -h           도움말

예시:
  node backend/scripts/sync-obsidian-work.js \\
    --post-id 69f7f16819e31bf1bef2699d \\
    --obsidian "NODE TREE/작품/2026/공생직조"
`);
};

const main = async () => {
  const args = parseArgs(process.argv);
  if (args.help || !args.postId) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const mongoUri = args.mongoUri || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI 환경변수 또는 --mongodb-uri 옵션이 필요합니다.');
    process.exit(1);
  }

  const obsidianPath = args.obsidian || 'NODE TREE/작품/2026/공생직조';
  console.log(`📂 vault: ${DEFAULT_VAULT_ROOT}`);
  console.log(`📂 path:  ${obsidianPath}`);
  console.log(`🎯 post:  ${args.postId}`);

  let payload;
  try {
    payload = buildResearchPayload(obsidianPath);
  } catch (e) {
    console.error(`❌ 옵시디안 읽기 실패: ${e.message}`);
    process.exit(1);
  }

  console.log(`📄 master: ${payload.sourceFile}`);
  console.log(`📄 research files: ${payload.researchFiles.length}`);
  console.log(`📚 TOC entries: ${payload.toc.length}`);
  console.log(`📊 markdown: ${payload.charCount} chars · html: ${payload.htmlLength} bytes`);

  const HTML_LIMIT = 2 * 1024 * 1024;
  if (payload.htmlLength > HTML_LIMIT) {
    console.error(`❌ HTML이 너무 큽니다 (${payload.htmlLength} > ${HTML_LIMIT}).`);
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
  } catch (e) {
    // URI에 자격증명이 포함될 수 있으므로 메시지만 출력
    console.error(`❌ MongoDB 연결 실패: ${e.message}`);
    process.exit(1);
  }
  console.log('✅ MongoDB 연결');

  try {
    const syncedAt = new Date();
    const updated = await Work.findByIdAndUpdate(
      args.postId,
      {
        $set: {
          'research.html': payload.html,
          'research.markdown': payload.markdown,
          'research.toc': payload.toc,
          'research.sourceFiles': payload.sourceFiles,
          'research.obsidianPath': obsidianPath,
          'research.syncedAt': syncedAt,
        }
      },
      { new: true }
    );
    if (!updated) {
      console.error(`❌ Work 문서를 찾을 수 없음: ${args.postId}`);
      process.exit(1);
    }
    console.log(`✅ 리서치 동기화 완료: ${updated.title}`);
    console.log(`   nodetree.kr/work/research/${updated._id}`);
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  main().catch((e) => {
    console.error('❌ 동기화 실패:', e);
    process.exit(1);
  });
}
