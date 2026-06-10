# 婚禮桌次圖匯出最佳解 Phase 6 設計完成紀錄

日期：2026-06-10
執行角色：`@designer`
狀態：Phase 6 完成
來源計畫：`Plan/wedding-floor-pdf-best-solution-plan-20260609.md`

## 1. 執行邊界

- 本 Phase 只整理設計完成紀錄，不修改產品程式碼。
- 本 Phase 未使用 `@qa`，也未建立額外 QA gate。
- 本紀錄依據 Phase 0-5 完成 artifact、既有 self-check scripts 與本次重跑驗證結果整理。
- Phase 0 曾依當時使用者指令以 `@qa` 產出視覺/版面規格審查；Phase 6 僅以 `@designer` 角色做最終設計整理。

## 2. 最終修正摘要

### 2.1 桌位保留原設計

正式 PDF、SVG、PNG 與 AI prompt 都已回到同一個 source-position layout model：

- 桌位優先使用 `state.tablePositions[table.id]`。
- `defaultTablePosition(index)` 只在缺少有效桌位座標時作 fallback。
- 桌心映射只允許 uniform scale、translate 與以 centroid 為中心的 uniform proportional breathing。
- 不再用固定 4x5 grid 或 `regularTablePages` 當正式桌次圖的幾何來源。

設計判斷：這符合使用者要求的「匯出結果要跟座位圖設計畫面原本排好的版面一致」。婚禮風格只作用在視覺呈現，不重新決定桌位。

### 2.2 姓名靠近座位

姓名標籤已改為 seat-local placement：

- 每位已入座 guest 都有對應 seat dot 與 nearby label。
- label 以 seat index 的 local sector 為基準，靠近該座位點。
- 一般桌 label edge distance、center distance 與 micro leader 長度有數值上限。
- 主桌使用較寬容但仍受限的距離規格。
- connector 只保留短距離 micro leader，不畫跨桌或跨頁長線。

設計判斷：這比左右列表或長 connector 更接近範例圖的「姓名在座位旁」閱讀方式，也保留可被 smoke script 檢查的幾何 contract。

### 2.3 無「詳見第 N 頁」降級

目前完成狀態：

- 停用 detail page 作為姓名 overflow 的主要解法。
- renderer 不再輸出 `wfp-detail-reference`。
- HTML/SVG 不含 `完整座位標註見第`。
- 滿桌與長姓名仍必須留在第一張正式桌次圖中，以文字 fit、compact label 與 proportional breathing 處理。

設計判斷：這符合使用者「不要完整座位請詳見第 2 頁」的不可退讓要求。完整名單頁可保留作索引，但不能取代第一頁座位旁姓名。

### 2.4 PDF / PNG / SVG / AI Prompt 入口完成

已完成的使用者入口：

- `桌次圖 PDF`
- `座位圖設計圖 PNG`
- `座位圖設計圖 SVG`
- `AI 生圖提示詞`

設計圖與 prompt 的定位：

- PNG/SVG 是正式 state-driven 設計輸出，不依賴 DOM screenshot。
- AI prompt 是輔助美化素材，不是正式資料來源。
- prompt 明確要求保留桌位相對位置、姓名靠近 seat dots、不可新增/刪除/改名。

## 3. 與範例圖相近的設計項目

- A4 portrait 婚禮桌次圖構圖。
- 大型 `Jeremy & Yuri` script title。
- 中文 `婚禮桌次位置圖` 與英文 `WEDDING SEATING CHART`。
- 金色細線與愛心裝飾。
- 米金色 stage ribbon。
- 四角水彩粉玫瑰、花苞與綠葉。
- 主桌花束 medallion，弱化工程感的桌號/人數資訊。
- 空座位使用金線空心圓，已入座 seat dot 使用分類色。
- 底部細線、`座位圖例` 與分類圓點。

整體方向已從「工程匯出表」轉成「婚禮現場可交付的 A4 桌次圖」，同時保留資料正確性與座位對應。

## 4. 仍不同但合理保留

- 不使用範例圖當整頁背景：避免授權風險、列印遮擋與內容可讀性下降。
- 不強迫固定 4x5 桌位：正式輸出以使用者實際 `FloorPlan` 位置為準，這比完全複製範例圖排列更符合產品需求。
- 不讓 AI prompt 取代正式輸出：AI prompt 僅供美化延伸，正式 PDF/PNG/SVG 仍由 app state 與共用 layout model 產生。
- 不追求純手繪海報的不規則桌位：桌位與座位點需保留可驗證的幾何關係，避免姓名與座位對應不清。
- 保留完整名單/索引頁：它是輔助查找資訊，不是姓名 overflow 的替代方案。

## 5. 回交檢查

本次 Phase 6 重跑自檢後，沒有發現需回交 Phase 1-5 的 blocker：

- 桌位保留：通過。
- 姓名靠近座位：通過。
- 無 detail reference：通過。
- PDF / PNG / SVG / prompt 共用 layout signature：通過。
- 匯出選單與總覽入口：Phase 4/5 artifact 已記錄完成。

需回交項目：無需回交。

## 6. 本次驗證結果

已通過：

```txt
npm run check:floor-design-layout
npm run check:floor-design-export
npm run check:phase4-export-contract
npm run check:floor-pdf-renderer
npm run check:floor-pdf-layout
npm run lint
git diff --check
npm run build
```

結果摘要：

- `Floor design source-position layout checks passed`
- `Floor design image and prompt export checks passed`
- `Phase 4 export contract checks passed`
- `Wedding floor print renderer checks passed`
- `Wedding floor PDF layout model checks passed`
- `npm run lint` 通過。
- `git diff --check` 無 whitespace error，僅有既有 LF/CRLF warning。
- sandbox 內 `npm run build` 仍觸發已知 Vite/Rolldown `spawn EPERM`；依既有 lesson 043 升權重跑同一命令後通過，僅保留既有 chunk-size warning。

## 7. Review

Phase 6 的設計結論是通過交付：目前匯出設計已同時滿足「接近範例圖」、「保留原桌位」、「姓名靠近座位」、「不使用詳見第 N 頁降級」、「提供 PNG/SVG/AI prompt」五個核心方向。

後續若要再提升視覺品質，建議只做低風險的視覺微調，例如花卉密度、金線粗細、title 字距與 legend spacing。不得改動 source-position layout model、seat-local label distance contract 或匯出共用 `layoutSignature`。
