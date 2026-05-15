# Walkthrough — Marco Studio

## 已完成項目

### M1 產圖引擎
- `m1-renderer.js`：5 種版型（dialogue / narration / voiceover / choice / next），輸出 1080×1500 PNG。
- `cli.js`：讀 `manifest.json` → 批次呼叫 M1 → 寫 `output/render-result.json`（含 pageType）。
- `sample-manifest.json`：涵蓋全部 5 種版型的範例，可直接執行驗證。

### 視覺編輯器原型
- `visual-editor.html`：單頁 HTML，支援拖曳素材、預覽卡片，可匯出 manifest.json。
- 目前為 Prototype 層級，尚無背景 / 人物圖片上傳功能。

---

## 完整發佈管線（已打通）

```
node cli.js sample-manifest.json
→ output/rendered-assets/*.png（5 張）
→ output/render-result.json（含 pageType）

node publish.js
→ 上傳 PNG 至 Cloudinary（env: CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET）
→ output/publish-result.json（含 pageType, cloudinaryUrl, public_id）

node deploy.js
→ 讀 publish-result.json，按 storyId→nodeId 分組
→ 寫入 Vercel KV（env: KV_REST_API_URL/KV_REST_API_TOKEN）
→ key: story:{storyId}:node:{nodeId}
→ value: JSON string of [{ pageId, pageType, public_id, cloudinaryUrl }]
```

---

## 關鍵決策紀錄

### publish.js
- `public_id` = `${storyId}_${nodeId}_${pageId}`（assetId 永遠為空，不使用）
- 每筆獨立 try/catch，不讓單筆失敗崩整個 batch
- 非 `rendered` 條目以 `status: "skipped"` 留存，方便 KV writer 偵測部分跑

### deploy.js
- Vercel KV REST API（Upstash）pipeline 格式：`[["SET", key, JSON.stringify(value)]]`，value 必須是字串，不能傳 raw JSON object（會 400）
- pages 按 pageId 數字排序（不用 localeCompare，否則 p10 < p2）
- 每個 pipeline command 的 response body 需另外檢查 `cmdResult.error`（HTTP 200 不等於寫入成功）
- Debby 讀 KV 時需做一次 `JSON.parse()` 取得 pages 陣列

### cli.js（修補）
- 原本 render-result.json 沒有 `pageType`，補上後整條管線才能傳遞卡片類型給 Debby

---

## Round 3（下一輪）
**任務**：待定 — 可能方向：
1. `.env` 整合 dotenv，讓 `node publish.js` / `node deploy.js` 不需要 `source .env`
2. 視覺編輯器升級：支援自訂上傳背景與人物圖
3. 串接 Debby 驗證：讀 KV 確認格式符合 Debby 期待
