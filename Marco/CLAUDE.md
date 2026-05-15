# CLAUDE.md - Marco Studio

# Marco Studio：獨立故事開發與產圖引擎

Marco 已經從單純的「產圖腳本」正式升級為 Debby 生態系中獨立且強大的 **Marco Studio**（視覺化故事開發環境）。
Marco 完全獨立於 Debby 的 LINE 運行環境之外，專注於提供最佳的創作者體驗，負責「內容創作、排版渲染、一鍵部署」。

## 1. 系統定位與核心職責
*   **非 Runtime 系統**：Marco 絕對不接收 LINE webhook，不處理使用者的對話邏輯，不管理即時 Session。
*   **單向部署 (One-Way Deploy)**：Marco 是「生產端」，負責製作故事卡片並一鍵發佈（上傳圖片至 Cloudinary，寫入故事結構至 Vercel/KV）。Debby 是「消費端」，只負責讀取發佈後的結果來回應使用者。

## 2. 核心架構 (Marco Studio Architecture)

Marco Studio 包含三大核心模組：

### A. 視覺化編輯器 (Visual Editor)
一個具備高度互動性的 Web 介面（可視化拖曳），取代舊有在 LINE 或純 JSON 中刻苦編輯的方式。
*   **素材管理**：支援上傳背景底圖 (Backgrounds)、人物頭像 (Characters/Avatars)。
*   **排版編輯**：支援畫面上自由拖曳素材、調整字型 (Font)、字號與顏色，所見即所得 (WYSIWYG)。
*   **故事流編輯 (Story & Node Authoring)**：可建立 Node，並將多張 Page 組合成符合 LINE Carousel 格式的多頁訊息。
*   **匯出系統**：編輯完成後，由前端自動生成精準且標準化的 `manifest.json`。

### B. M1 產圖引擎 (M1 Renderer Engine)
基於 Node.js 與 Canvas 的強大後端壓圖引擎，接收 `manifest.json` 後自動批次生成 `1080x1500` 解析度的高畫質圖片。
支援五種標準卡片版型：
1.  **對話卡 (Dialogue)**：上方插圖 (1000px)，下方含人物頭像、姓名牌與對話文字。
2.  **選項卡 (Choice)**：上方插圖 (800px)，下方含提示語與 A/B 選項按鈕。
3.  **敘事卡 (Narration)**：上方插圖 (1000px)，下方含置中文字訊息。
4.  **旁白卡 (Voiceover)**：無圖片全版底色，含置中三段文字（每段最多 12 字）。
5.  **下頁卡 (Next)**：無圖片全版底色，正中央大型「下一頁」按鈕。

### C. 一鍵發佈管線 (Publisher Pipeline)
負責將製作完成的內容無縫上線。
*   **圖檔上傳**：將 M1 引擎壓製出來的圖片，自動批量上傳至 Cloudinary，並取得 `secure_url`。
*   **資料同步**：將打包好的 Story 結構與圖片網址，自動推播/寫入至 Vercel KV Store。

## 3. 開發規範與禁止事項
1.  **分離原則**：絕對不能將 Marco 的依賴（如 `canvas` 等編輯器相關套件）混入 Debby 主專案的 production dependencies。
2.  **嚴格尺寸**：所有壓圖基底皆為 `w=1080, h=1500`，無論何種版型，最終輸出檔案尺寸必須一致，以確保在 LINE Carousel 中的平移體驗完美無瑕。
3.  **單向資料流**：Marco 只能「寫入/覆蓋」生產環境資料，不能依賴從生產環境動態抓取邏輯。
4.  **先做可播放的最小故事系統**：開發重點優先放在「MVP 功能」的打通（拖拉編輯 -> 壓圖 -> 發佈 -> LINE 預覽），不要陷入過早優化或製作無謂的平台管理功能。

## 4. 大循環工作流程 (Big Loop)

每輪固定六步，所有中間產物留在對話內，只有兩個持久檔：

| 持久檔 | 說明 |
|---|---|
| `task.md` | 當前最小任務，每輪 Step 6 更新 |
| `walkthrough.md` | 累積的實作紀錄，每輪 Step 6 更新 |

**Step 1 — Claude：規劃**（對話內）
讀 `task.md`、`walkthrough.md` 與任務指定檔案。
說明要改哪些檔、不能動哪些範圍、完成條件、給 Codex 的最小執行指令。

**Step 2 — Gemini agent：反對**（對話內）
給 Gemini 同樣的上下文。
找出過度設計、部署風險、漏讀檔案、任務漂移，收斂成更小的指令。

**Step 3 — Codex plugin：執行**
Codex 是唯一改碼者，讀 Step 1+2 的結論完成實作，跑最小驗證。

**Step 4 — Claude：審查**（對話內）
讀最新 diff，判斷是否照任務改、是否漏掉 Gemini objection。
結論只能是 `PASS`、`FIX REQUIRED` 或 `STOP`。

**Step 5 — Gemini agent：終審**（對話內）
給 Gemini diff + Step 4 結論，檢查 runtime、部署、產品方向風險。

**Step 6 — Codex plugin：收束或開下一輪**
若 Step 4/5 要求修補，做最小修補；若通過，更新 `walkthrough.md`，寫下一輪任務到 `task.md`。

## 5. 未來開發路徑 (Roadmap)
- [x] 解耦 Marco 與 Debby。
- [x] 建立 M1 CLI 壓圖引擎與 5 種卡片版型支援。
- [x] 實作拖曳式視覺化圖片編輯器 (Prototype)。
- [ ] 升級視覺編輯器：支援字型更換、自訂上傳背景與人物圖。
- [ ] 升級視覺編輯器：實作 Node 編輯與 Carousel 封裝功能。
- [ ] 實作發佈腳本：串接 Cloudinary API 上傳。
- [ ] 實作發佈腳本：一鍵部署 Manifest 至 Vercel KV。
