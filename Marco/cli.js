#!/usr/bin/env node
/**
 * Marco CLI
 * 負責讀取 Debby 的 render manifest 並產出圖卡與 render-result.json
 * 完全符合 CLAUDE.md 規範：不接 Webhook、不上傳 Cloudinary、不寫入 KV
 */
const fs = require('fs');
const path = require('path');
const { renderCard } = require('./m1-renderer');

const OUTPUT_DIR = path.join(__dirname, 'output', 'rendered-assets');
const RESULT_FILE = path.join(__dirname, 'output', 'render-result.json');

async function main() {
  const args = process.argv.slice(2);
  const manifestPath = args[0];

  if (!manifestPath) {
    console.error('用法: node cli.js <path/to/manifest.json>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(manifestPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ 找不到 manifest 檔案: ${resolvedPath}`);
    process.exit(1);
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  } catch (e) {
    console.error(`❌ 解析 manifest 失敗: ${e.message}`);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`🖼  Marco M1 產圖引擎啟動`);
  console.log(`讀取 manifest: ${resolvedPath}`);
  console.log(`包含 ${manifest.pages ? manifest.pages.length : 0} 個頁面`);

  const results = [];

  // 依序呼叫 M1 Renderer 產圖
  for (const page of (manifest.pages || [])) {
    console.log(`  → [渲染] ${page.pageId} (${page.pageType})...`);
    
    let localFile;
    let status = 'rendered';
    let errorMsg = null;

    try {
      localFile = await renderCard(page, OUTPUT_DIR);
    } catch (err) {
      console.error(`    ❌ 渲染失敗: ${err.message}`);
      status = 'failed';
      errorMsg = err.message;
      localFile = '';
    }

    results.push({
      storyId: page.storyId,
      nodeId: page.nodeId,
      pageId: page.pageId,
      pageType: page.pageType,
      assetId: page.assetId || '',
      localFile: localFile,
      status: status, // 'missing', 'rendered', 'failed'
      renderedAt: new Date().toISOString(),
      error: errorMsg
    });
  }

  const finalResult = {
    results
  };

  fs.writeFileSync(RESULT_FILE, JSON.stringify(finalResult, null, 2));
  console.log(`\n✅ 產圖完成！`);
  console.log(`圖卡已存於: ${OUTPUT_DIR}`);
  console.log(`產出結果已寫入: ${RESULT_FILE}`);
}

main();
