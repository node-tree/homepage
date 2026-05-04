#!/usr/bin/env node
/**
 * 옵시디안 vault watcher
 *
 * 설정 파일(scripts/obsidian-watch.config.json)에 정의된
 * post ↔ obsidian 폴더 매핑을 감시한다. .md 변경이 감지되면
 * debounce 후 buildResearchPayload를 실행해 work.research 서브문서를 갱신한다.
 *
 * 사용법:
 *   node backend/scripts/obsidian-watcher.js
 *
 * 환경변수:
 *   MONGODB_URI         (필수)
 *   OBSIDIAN_VAULT_PATH (선택)
 *   WATCH_DEBOUNCE_MS   (선택, 기본 2000)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const chokidar = require('chokidar');
const Work = require('../models/Work');
const { buildResearchPayload, DEFAULT_VAULT_ROOT } = require('../utils/obsidian-sync');

const CONFIG_PATH = path.join(__dirname, 'obsidian-watch.config.json');
const DEBOUNCE_MS = parseInt(process.env.WATCH_DEBOUNCE_MS || '2000', 10);

const log = (...args) => console.log(`[${new Date().toISOString()}]`, ...args);
const err = (...args) => console.error(`[${new Date().toISOString()}]`, ...args);

const loadConfig = () => {
  if (!fs.existsSync(CONFIG_PATH)) {
    err(`설정 파일을 찾을 수 없습니다: ${CONFIG_PATH}`);
    err('아래 형식으로 만들어주세요:');
    err(JSON.stringify({
      mappings: [
        {
          postId: '69f7f16819e31bf1bef2699d',
          obsidianPath: 'NODE TREE/작품/2026/공생직조',
          label: '공생직조 (Corrosia)'
        }
      ]
    }, null, 2));
    process.exit(1);
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  let config;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    err('설정 파일 파싱 실패:', e.message);
    process.exit(1);
  }
  if (!Array.isArray(config.mappings) || config.mappings.length === 0) {
    err('config.mappings가 비어있습니다.');
    process.exit(1);
  }
  return config;
};

const resolveAbsPath = (vaultRelative) => {
  if (path.isAbsolute(vaultRelative)) return vaultRelative;
  return path.join(DEFAULT_VAULT_ROOT, vaultRelative);
};

const syncMapping = async (mapping) => {
  const label = mapping.label || mapping.obsidianPath;
  log(`🔄 sync 시작: ${label} → ${mapping.postId}`);
  let payload;
  try {
    payload = buildResearchPayload(mapping.obsidianPath);
  } catch (e) {
    err(`❌ buildResearchPayload 실패 (${label}):`, e.message);
    return;
  }

  const HTML_LIMIT = 2 * 1024 * 1024;
  if (payload.htmlLength > HTML_LIMIT) {
    err(`❌ HTML 너무 큼 (${payload.htmlLength} > ${HTML_LIMIT})`);
    return;
  }

  try {
    const syncedAt = new Date();
    const updated = await Work.findByIdAndUpdate(
      mapping.postId,
      {
        $set: {
          'research.html': payload.html,
          'research.markdown': payload.markdown,
          'research.toc': payload.toc,
          'research.sourceFiles': payload.sourceFiles,
          'research.obsidianPath': mapping.obsidianPath,
          'research.syncedAt': syncedAt,
        }
      },
      { new: true }
    );
    if (!updated) {
      err(`❌ Work 문서 없음: ${mapping.postId}`);
      return;
    }
    log(`✅ sync 완료: ${updated.title} · ${payload.charCount}자 · TOC ${payload.toc.length}개 · ${payload.sourceFiles.length}개 노트`);
  } catch (e) {
    err(`❌ DB 업데이트 실패:`, e.message);
  }
};

const main = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    err('❌ MONGODB_URI 환경변수가 필요합니다.');
    process.exit(1);
  }

  const config = loadConfig();
  log(`📂 vault root: ${DEFAULT_VAULT_ROOT}`);
  log(`📋 매핑 ${config.mappings.length}개:`);
  for (const m of config.mappings) {
    log(`   · ${m.label || m.obsidianPath} → ${m.postId}`);
  }

  await mongoose.connect(mongoUri);
  log('✅ MongoDB 연결');

  // 시작 시 1회 sync
  for (const mapping of config.mappings) {
    await syncMapping(mapping);
  }

  // chokidar로 각 매핑 폴더 감시. debounce per-mapping.
  const debounceTimers = new Map();

  for (const mapping of config.mappings) {
    const absPath = resolveAbsPath(mapping.obsidianPath);
    if (!fs.existsSync(absPath)) {
      err(`⚠️ 폴더 없음, watch 스킵: ${absPath}`);
      continue;
    }
    log(`👀 watching: ${absPath}`);
    const watcher = chokidar.watch(absPath, {
      ignored: /(^|[\/\\])\../, // dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });

    const trigger = (event, filePath) => {
      if (!filePath.endsWith('.md')) return;
      log(`📝 ${event}: ${path.relative(absPath, filePath)}`);
      const key = mapping.postId;
      if (debounceTimers.has(key)) clearTimeout(debounceTimers.get(key));
      debounceTimers.set(key, setTimeout(() => {
        debounceTimers.delete(key);
        syncMapping(mapping).catch(e => err('sync 실행 실패:', e));
      }, DEBOUNCE_MS));
    };

    watcher.on('add', p => trigger('add', p));
    watcher.on('change', p => trigger('change', p));
    watcher.on('unlink', p => trigger('unlink', p));
    watcher.on('error', e => err('watcher 오류:', e));
  }

  log(`🚀 watcher 실행 중 (debounce ${DEBOUNCE_MS}ms). Ctrl+C로 종료.`);

  const shutdown = async (sig) => {
    log(`\n${sig} 수신, 종료 중…`);
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

if (require.main === module) {
  main().catch(e => {
    err('fatal:', e);
    process.exit(1);
  });
}
