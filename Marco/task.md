# Task — Round 2

## 目標
實作 `deploy.js`：讀取 `output/publish-result.json`，按 `{storyId, nodeId}` 分組後寫入 Vercel KV，完成發佈管線最後一段。

## 完成條件
1. `node deploy.js` 可執行，不需額外參數（路徑硬編為 `output/publish-result.json`）。
2. 按 `storyId → nodeId` 二層分組，每個 node 寫一筆 KV，key 格式為 `story:{storyId}:node:{nodeId}`。
3. KV 值為該 node 所有 page 的陣列：`[{ pageId, public_id, cloudinaryUrl, status }]`，只含 `status === "uploaded"` 的頁面。
4. KV 憑證從環境變數讀取：`KV_REST_API_URL`、`KV_REST_API_TOKEN`（Vercel KV REST API）。
5. 若環境變數缺失，印出明確錯誤後 `process.exit(1)`，不 crash。
6. 若 `publish-result.json` 不存在，印錯誤提示（先跑 `node publish.js`）後 `process.exit(1)`。
7. 每筆 KV 寫入獨立 try/catch，單筆失敗不崩整個流程。
8. 寫入完成後印出摘要：寫入幾筆、失敗幾筆。

## 禁止範圍
- 不改動 `publish.js`、`m1-renderer.js`、`cli.js`、`visual-editor.html`、`sample-manifest.json`。
- 不建立 Express server 或任何 HTTP endpoint。
- 不引入 `@vercel/kv` npm 套件（使用原生 `https` 或 `node-fetch` 呼叫 REST API，保持依賴輕量）。

## 輸入
- `output/publish-result.json`（由 `publish.js` 產出）

## 輸出
- `deploy.js`（Marco 根目錄）
- Vercel KV 中寫入的 key-value pairs

## 背景知識
Vercel KV REST API 寫入方式：
```
POST {KV_REST_API_URL}/set/{key}
Headers: Authorization: Bearer {KV_REST_API_TOKEN}
Body: {value}（JSON 字串）
```
