# Debby × Marco 對接需求清單 (connect.md)

為了確保 Debby runtime 能正確播放 Marco 產出的繪本，Marco 在發布資料時需符合以下契約：

## 1. Vercel KV 寫入規範
- **Key 格式**：必須固定為 `story:{storyId}:node:{nodeId}`。
- **Value 格式**：必須是 `JSON.stringify(pages[])`。

## 2. Page 資料補完需求
目前 Debby 播放 LINE Carousel 時，發現以下欄位缺漏或需統一：

- **`imageUrl` (必填)**：
  - 每個 page 物件必須包含 `imageUrl` 欄位，指向已上傳至 Cloudinary 的安全網址。
  - Debby 不會自動產圖，若缺失此欄位，LINE 將顯示預設破圖。

- **`pageType: "next"` 的路由**：
  - 在 `renderData` 中，請新增 `targetNodeId` 欄位。
  - 目前 Debby 是靠 nodeId 序號（如 n1 -> n2）盲猜，若有明確的 `targetNodeId` 會更精準。

- **`pageType: "monologue"` (獨白卡)**：
  - 請確保輸出的 `renderData` 包含 `paragraphs: string[]` (最多三個字串)。
  - 這是為了對應 Marco Studio 中的多行文字顯示。

- **Choice 欄位名稱統一**：
  - 請確保 `renderData.optionA` 與 `renderData.optionB` 包含 `label` 與 `targetNodeId`。

## 3. 圖文選單連動
- Debby 已設置關鍵字：`開始`、`重來`、`下一步`。
- Marco 的 `richmenu.png` 應確保這三個按鈕的座標與 Debby 的 `api/setup-rich-menu.js` 定義一致（目前採三等分橫排）。

## 4. 錯誤處理建議
- 若 Marco 發現某個 Node 產圖失敗，請不要寫入該 Node 的 KV，或在 `pages[]` 中標記錯誤狀態，以免 Debby 讀取到不完整的資料導致 LINE 報錯。
