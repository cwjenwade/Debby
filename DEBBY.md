# DEBBY.md

# Debby D1：LINE 數位繪本主系統

Debby 是 LINE 數位繪本主系統。Debby 負責故事資料、LINE webhook、使用者 session、Cloudinary URL 紀錄、asset 狀態與播放流程。Debby 不負責產圖。產圖由 `marco/` 內的 Marco 子系統處理。

## 1. 系統邊界
Debby 只管理 Story、Node、Page、Asset、Choice、Keyword 與 LINE runtime。Story 是一本繪本。Node 是一段故事事件。Page 是一張圖卡。Asset 是 Page 對應的圖片資源。Choice 負責導向 targetNodeId。

## 2. LINE runtime
使用者在 LINE 輸入關鍵字後，Debby webhook 讀取 story data，進入 startNodeId，播放該 node 的 pages。使用者點選 choice postback 後，Debby 依 choiceId 找到 targetNodeId，進入下一個 node。LINE webhook 只送 text message、image message 與 postback action。

## 3. Asset 狀態
Debby 負責記錄每個 asset 的狀態。狀態只允許 missing、rendered、uploaded、ready、failed。asset 沒有 cloudinaryUrl 時，狀態為 missing，LINE 使用文字 fallback。asset 有 cloudinaryUrl 且可播放時，狀態為 ready。

## 4. 與 Marco 連動
Debby 提供 export manifest 給 Marco。manifest 單位必須是 Page，不是 Node。manifest 至少包含 storyId、nodeId、pageId、pageType、assetId、renderData、targetPublicId。Debby 不呼叫 Marco 產圖，不等待 Marco，不在 webhook 內執行產圖。

## 5. 發布流程
Marco 產生 render-result.json 後，由 Debby 端 publish script 讀取結果、上傳 Cloudinary、取得 secure_url，並回寫 Debby。Debby 收到回寫後更新 asset.cloudinaryUrl、asset.publicId、asset.status = ready。LINE webhook 只讀 Debby 已記錄的 ready asset。

## 6. 禁止事項
Debby 不得執行 Python 產圖。不得在 webhook 內使用 canvas、sharp 或批次 render。不得把產圖、上傳、回寫綁成單一 runtime pipeline。不得讓 Marco 直接控制 LINE。不得把 Node 當成圖片單位。不得導向 /story。不得用 Flex 重畫圖卡。不得讀取 Marco 內部輸出以外的產圖細節。
