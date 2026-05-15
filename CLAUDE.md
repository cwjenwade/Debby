# CLAUDE.md

本 repo 分為兩個子系統。不要混讀規格。

## Debby
規格來源：`DEBBY.md`

Debby 是 LINE 數位繪本主系統。
Debby 只負責 story runtime、LINE webhook、session、asset status、Cloudinary URL 紀錄與播放。

處理 Debby 任務時，只讀：
- `CLAUDE.md`
- `DEBBY.md`
- 本輪任務指定檔案

不得讀 `marco/CLAUDE.md` 覆蓋 Debby 規格。

## Marco
規格來源：`marco/CLAUDE.md`

Marco 是獨立產圖機器。
Marco 只負責讀 Debby manifest、產生本機圖片、輸出 render-result.json。

處理 Marco 任務時，只讀：
- `CLAUDE.md`
- `marco/CLAUDE.md`
- 本輪任務指定檔案

不得讀 `DEBBY.md` 覆蓋 Marco 規格。

## 共同限制
1. 每輪只處理一個小任務。
2. 不做全專案掃描。
3. 不主動重構。
4. 不讀 archive、舊報告、舊 CLAUDE 備份。
5. 不輸出長篇說明。
6. 完成後只回報新增檔案、修改檔案、測試結果、未處理項目。
