const fs = require('fs');
const path = require('path');

// Env validation
const REQUIRED_ENV = ['KV_REST_API_URL', 'KV_REST_API_TOKEN'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const publishResultPath = path.join(__dirname, 'output', 'publish-result.json');

if (!fs.existsSync(publishResultPath)) {
  console.error(`publish-result.json not found at ${publishResultPath}\nRun: node publish.js first.`);
  process.exit(1);
}

async function kvSet(key, value) {
  const body = JSON.stringify([['SET', key, JSON.stringify(value)]]);
  const url = `${KV_URL}/pipeline`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KV write failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  const cmdResult = Array.isArray(data) ? data[0] : data;
  if (cmdResult && cmdResult.error) {
    throw new Error(`KV command error: ${cmdResult.error}`);
  }
  return cmdResult;
}

async function main() {
  const records = JSON.parse(fs.readFileSync(publishResultPath, 'utf8'));

  const groups = {};
  for (const r of records) {
    if (r.status !== 'uploaded') continue;
    const groupKey = `${r.storyId}::${r.nodeId}`;
    if (!groups[groupKey]) {
      groups[groupKey] = { storyId: r.storyId, nodeId: r.nodeId, pages: [] };
    }
    groups[groupKey].pages.push({
      pageId: r.pageId,
      pageType: r.pageType || null,
      public_id: r.public_id,
      cloudinaryUrl: r.cloudinaryUrl,
    });
  }

  for (const g of Object.values(groups)) {
    g.pages.sort((a, b) => {
      const numA = parseInt(a.pageId.replace(/^p(\d+).*/, '$1'), 10);
      const numB = parseInt(b.pageId.replace(/^p(\d+).*/, '$1'), 10);
      return (isNaN(numA) || isNaN(numB)) ? a.pageId.localeCompare(b.pageId) : numA - numB;
    });
  }

  let written = 0;
  let failed = 0;

  for (const { storyId, nodeId, pages } of Object.values(groups)) {
    const kvKey = `story:${storyId}:node:${nodeId}`;
    try {
      await kvSet(kvKey, pages);
      console.log(`  ✓ ${kvKey} (${pages.length} pages)`);
      written++;
    } catch (err) {
      console.error(`  ✗ ${kvKey}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${written} written, ${failed} failed.`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
