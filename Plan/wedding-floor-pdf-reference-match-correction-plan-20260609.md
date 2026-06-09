# 婚禮桌次圖 PDF 參考圖貼近修正計畫書

日期：2026-06-09  
狀態：計畫書，不執行 QA Phase  
主要目標角色：`.agents/agents.md` 的 `@designer`  
輔助角色：`.agents/agents.md` 的 `@engineer`  
不使用角色：`@qa`

## 1. 背景

使用者提供兩張圖：

- 第一張：目前實際匯出結果。
- 第二張：目標參考圖。

目前版本已完成座位姓名標籤與 connector 的基礎修正，但實際輸出仍不像第二張目標圖。這次修正不是資料功能改造，也不是 QA gate；目標是讓正式「匯出桌次圖」更接近第二張的 A4 直式婚禮海報感。

本計畫遵守一個 Phase 只對應一個 `.agents/agents.md` 角色。若某 Phase 發現需要其他角色，必須停止並交棒，不得混用角色。

## 2. 目前落差判斷

| 區塊 | 第一張目前輸出 | 第二張目標圖 | 修正方向 |
| --- | --- | --- | --- |
| 輸出比例 | 畫面像橫向視窗截圖，只看到 A4 上半部，桌 6-20 與底部圖例不可見 | A4 直式完整海報，第一頁可看到主桌、2-20 桌、底部圖例 | 先修正 screen/print 預覽比例，避免匯出或截圖只抓 viewport 上半段 |
| Header | `Jeremy & Yuri` 字級偏小，整體高度偏扁 | 英文姓名大而優雅，是第一視覺焦點 | 放大 script title，壓縮不必要空白，建立更接近目標的上方層級 |
| 花卉 | 角落花卉偏抽象、淡、尺寸不足 | 四角有明確水彩花束與葉片，右下/左下特別豐富 | 建立 print-only floral asset layer 或更細緻 inline SVG，不用參考圖當背景 |
| Stage | 緞帶仍偏細框/膠囊，位置與目標圖不完全一致 | 中央米金色實心緞帶，兩側 tail 明確 | 改成更厚的 ribbon body，減少外框線感 |
| 主桌 | 中央圓桌顯示 `1桌 7/10`，姓名標籤分散較遠，connector 有長斜線與交錯感 | 主桌中央是花束視覺，姓名 chips 緊密環繞，connector 短且方向清楚 | 主桌改成 compact orbit annotation，中央加 floral medallion，弱化 occupancy |
| 一般桌 | 桌與空座位對比很淡；在目前截圖中只看到 2-5 桌 | 2-20 桌以 4 欄 x 5 列完整呈現，空座位金線清楚 | 調整第一頁 vertical map 與 regular table contrast |
| 桌 2 標籤 | 標籤與桌子的關係偏工程線條，斜線較長 | 標籤貼近桌側，視覺上像座位旁的簡潔標註 | 一般桌少量賓客採 edge-aware label lane，避免長斜線 |
| Legend | 已接近但在第一張不可見或被裁切 | 底部細線、標題與分類點完整出現 | 確保第一頁完整高度可見，legend 固定在安全區 |

## 3. 修正邊界

必須做：

1. 保持正式匯出為 state-driven print HTML/SVG。
2. 第一頁必須是 A4 portrait 構圖，不是橫向 viewport 截圖。
3. 第一頁在 20 桌情境下應完整呈現主桌、2-20 桌與圖例。
4. 每位已入座賓客仍保留座位點、姓名標籤、connector 的關係。
5. 所有 wedding print CSS 仍必須限制在 `.wfp-` print document，不污染互動式 `FloorPlan`。

不得做：

1. 不使用 `@qa` Phase。
2. 不把第二張圖或目前截圖當整頁背景。
3. 不重新引入 `html2canvas` / `jspdf`。
4. 不改 Firebase、Google Sheets sync、DnD、互動式 `FloorPlan` 操作畫面。
5. 不為了像參考圖而硬編碼固定姓名、日期或桌次資料。

目前工作區注意事項：

- 本計畫以目前存在的 `.agents/agents.md`、`.agents/context.md` 與 `src/utils/` 原始碼為準。
- 若舊的 2026-06-08 / 2026-06-09 Phase 紀錄檔已不在 `Plan/` 目錄，後續 Phase 不得因此中止；可改讀本計畫、`.agents/context.md`、相關 source files，以及知識庫中的 Wedding Seating Planner 專案紀錄。
- 若舊 Phase 紀錄檔仍存在，才作為補充脈絡讀取，不列為硬性阻塞依賴。

## 4. Phase 總覽

| Phase | 對應角色 | 目的 | 主要輸出 |
| --- | --- | --- | --- |
| Phase 1 | `@designer` | 重新建立第二張圖導向的視覺規格 | 新增 reference-match visual spec，鎖定 A4 區塊、高度、字級、裝飾、主桌/一般桌視覺 |
| Phase 2 | `@engineer` | 修正輸出比例與 layout model 幾何 | 防止上半部裁切；調整主桌 annotation 幾何、regular grid 與 label lane |
| Phase 3 | `@designer` | 實作 reference-match print renderer | 放大 header、重做花卉、stage、主桌花束、桌格與 legend 視覺 |
| Phase 4 | `@engineer` | 更新 smoke contract 與防退化檢查 | 確認正式 export 走新 renderer，且結構上不會回到 cropped/legacy/bottom-chip |
| Phase 5 | `@designer` | 最終設計整理與可接受差異紀錄 | 寫完成紀錄，列出已修正落差與仍不同但可接受的項目 |

## 5. Phase 詳細計畫

### Phase 1：Reference-Match 視覺規格

角色：`@designer`

目標：

- 把第二張圖拆成可實作的 print-only 規格。
- 明確指出目前第一張輸出的裁切、比例、層級與風格落差。
- 產生後續 `@engineer` 可用的尺寸與幾何需求。

必讀：

- `.agents/agents.md`
- `.agents/context.md`
- `src/utils/weddingFloorPrintRenderer.js`
- `src/utils/weddingFloorSeatAnnotations.js`

若存在才補讀：

- `Plan/wedding-floor-pdf-layout-visual-spec-20260608.md`
- `Plan/wedding-floor-pdf-seat-label-visual-spec-20260608.md`
- `Plan/wedding-floor-pdf-seat-label-phase5-polish-20260609.md`

建議新增：

- `Plan/wedding-floor-pdf-reference-match-visual-spec-20260609.md`

必做：

1. 定義 A4 第一頁 vertical map：
   - header 區
   - stage ribbon 區
   - main table 區
   - 2-20 桌 regular grid 區
   - legend 區
2. 定義 screen preview 與 print output 的比例規格：
   - screen preview 可以縮放，但必須完整顯示一張 A4 直式頁。
   - print output 必須保持 `@page { size: A4 portrait; margin: 0; }`。
3. 定義 header：
   - `Jeremy & Yuri` 為第一視覺焦點。
   - script 字體顯著大於中文標題。
   - 上方細線與愛心不可使用 emoji。
4. 定義主桌：
   - 中央改為 floral medallion 或淡金圓盤，不以 `1桌 7/10` 作主要視覺。
   - occupancy 可保留，但必須弱化或移至小字。
   - labels 需 compact orbit，connector 以短線為主。
5. 定義一般桌：
   - 空座位金線要明確可見。
   - 桌 2 少量標籤需貼近桌側，不產生跨越很遠的斜線。
   - 2-20 桌必須可在第一頁完整排列。
6. 定義 floral：
   - 可用 print-only inline SVG 或專案內靜態資產。
   - 不可壓住桌次、姓名或 legend。

自檢：

- 規格內必須明確寫出「第一頁不可只露出上半段」。
- 規格內必須明確寫出「20 桌情境第一頁呈現主桌 + 19 張一般桌」。
- 規格內必須明確寫出「不使用 @qa」。

### Phase 2：輸出比例與 Layout Geometry 修正

角色：`@engineer`

目標：

- 修正第一張輸出像橫向 viewport crop 的問題。
- 調整 layout model，讓第二張圖的主桌與一般桌幾何可被 renderer 穩定實作。

必讀：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-reference-match-correction-plan-20260609.md`
- `Plan/wedding-floor-pdf-reference-match-visual-spec-20260609.md`
- `src/utils/printWindow.js`
- `src/utils/weddingFloorPrintLayout.js`
- `src/utils/weddingFloorSeatAnnotations.js`
- `src/utils/weddingFloorPrintRenderer.js`

建議修改：

- `src/utils/printWindow.js`
- `src/utils/weddingFloorSeatAnnotations.js`
- `src/utils/weddingFloorPrintLayout.js`
- `scripts/check-wedding-floor-pdf-layout.mjs`

必做：

1. Screen preview 防裁切：
   - 調整 print window 或 screen CSS，使 popup 預覽不是只顯示 A4 上半部。
   - 若 popup viewport 小於 A4 高度，screen mode 要能等比縮放或提供完整頁面可見策略；print mode 不可縮放錯誤。
2. A4 page height 固定化：
   - `.wfp-page` 應使用穩定 A4 高度，不只依 `min-height` 撐開。
   - regular grid 與 legend 不得超出第一頁 safe area。
3. 主桌 geometry：
   - 改成 compact annotation ring。
   - label slot 不應貼到 130mm groupBox 的最外緣，避免長斜線。
   - connector 優先短、少交錯。
4. 一般桌 geometry：
   - 保持 4 欄 x 5 列可容納桌 2-20。
   - 加強 edge-aware label lane：靠左欄桌次的少量標籤優先放左側，靠右欄優先放右側，避免標籤跑進鄰桌空間。
   - 空位 seat dots 的座標仍由 seatIndex 決定。
5. Detail page 規則不退化：
   - 人數多或長姓名仍可進詳圖頁。
   - 目前 10 位賓客情境應盡量在第一頁可讀，不應因規則過嚴全部推到 detail page。

限制：

- 不改視覺花卉、字體、顏色細節。
- 不改 Firebase / Google Sheets / DnD。
- 不使用 `@qa`。

自檢命令：

- `npm run check:floor-pdf-layout`
- `npm run check:phase4-export-contract`

### Phase 3：Reference-Match Print Renderer 實作

角色：`@designer`

目標：

- 依 Phase 1 規格與 Phase 2 geometry，改造 print renderer 視覺。
- 讓第一頁接近第二張圖的婚禮海報感。

必讀：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-reference-match-correction-plan-20260609.md`
- `Plan/wedding-floor-pdf-reference-match-visual-spec-20260609.md`
- Phase 2 完成紀錄
- `src/utils/weddingFloorPrintRenderer.js`

建議修改：

- `src/utils/weddingFloorPrintRenderer.js`
- 視需要新增 `public/print/` 下的 print-only 裝飾資產
- `scripts/check-wedding-floor-print-renderer.mjs`

必做：

1. Header：
   - 放大 `Jeremy & Yuri`，讓它成為第一視覺焦點。
   - 中文標題與英文 subtitle 下移並縮小層級。
   - 上方裝飾線與小愛心更接近第二張圖。
2. Floral：
   - 重做四角 floral layer，左上/右上/左下/右下都要有明顯水彩花與葉片層次。
   - 右下與左下可較大，但不可壓住 legend 或桌次。
3. Stage：
   - 改成米金色實心緞帶感。
   - 左右 tail 要比目前更明確。
4. Main table：
   - 中央加入 floral medallion 或淡雅花束符號。
   - `1桌 7/10` 不可再是主桌中央最大焦點。
   - labels 以 compact orbit 呈現，減少長斜線。
5. Regular tables：
   - 空座位金線提高對比。
   - 桌心與座位比例更接近第二張圖。
   - 桌 2 的姓名標籤要像目標圖一樣貼近桌側。
6. Legend：
   - 保持底部細線、分類圓點、文字 label。
   - 確保完整出現在第一頁，不被裁切。

限制：

- 不改 layout model 資料契約；若 geometry 不足，停止交回 Phase 2。
- 不改 export wiring。
- 不使用 `@qa`。

自檢命令：

- `npm run check:floor-pdf-renderer`
- `npm run check:floor-pdf-layout`

### Phase 4：Export Contract 與防退化 Smoke

角色：`@engineer`

目標：

- 確認正式匯出使用 reference-match renderer。
- 用 smoke script 防止之後又變回第一張的裁切、legacy 版型或底部 chips。

必讀：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-reference-match-correction-plan-20260609.md`
- Phase 2 完成紀錄
- Phase 3 完成紀錄
- `src/hooks/useExport.js`
- `src/utils/floorPrintHTMLBuilder.js`
- `src/utils/printWindow.js`
- `scripts/check-phase4-export-contract.mjs`
- `scripts/check-wedding-floor-print-renderer.mjs`

建議修改：

- `scripts/check-phase4-export-contract.mjs`
- `scripts/check-wedding-floor-print-renderer.mjs`
- `package.json`（只有需要新增 script alias 時）

必做：

1. 正式 export path：
   - `exportFloorPDF()` 必須走 `buildWeddingFloorPrintHTML(state)`。
   - `buildFloorPrintHTML(state)` 不可回退到 legacy renderer。
2. 防裁切 contract：
   - HTML 必須含 A4 portrait page marker。
   - screen preview 必須含完整頁面顯示策略的 marker 或 class。
   - 第一頁必須含 legend marker。
3. 防 legacy contract：
   - 不輸出 `.wfp-regular-names` / `.wfp-regular-name`。
   - 不輸出 legacy canvas-style floor SVG 作為正式匯出。
4. 防座位標註退化：
   - occupied guest count = label count。
   - occupied guest count = connector count。
   - empty seats 不產生 name label。
5. 防 20 桌缺頁：
   - 20 桌範例第一頁應含主桌與 19 張一般桌的 render marker。

限制：

- 不做人工 QA。
- 不新增大型 npm 套件。
- 不改 Firebase / Google Sheets / DnD。

自檢命令：

- `npm run check:phase4-export-contract`
- `npm run check:floor-pdf-renderer`
- `npm run check:floor-pdf-layout`
- `npm run lint`

### Phase 5：設計完成紀錄與可接受差異

角色：`@designer`

目標：

- 不做 QA gate，只做設計完成紀錄。
- 清楚說明哪些差異已修，哪些和第二張仍不同但合理保留。

必讀：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-reference-match-correction-plan-20260609.md`
- `Plan/wedding-floor-pdf-reference-match-visual-spec-20260609.md`
- Phase 2、Phase 3、Phase 4 完成紀錄

建議新增：

- `Plan/wedding-floor-pdf-reference-match-phase5-design-summary-20260609.md`

必做：

1. 列出已修正落差：
   - 輸出比例/裁切
   - header 層級
   - floral layer
   - stage ribbon
   - main table compact orbit
   - regular grid 2-20
   - legend 可見性
2. 列出仍不同但可接受項目：
   - 花卉不是直接使用第二張圖背景。
   - 日期與資料統計仍由目前 state 動態產生。
   - 類別色仍以專案資料分類為準。
3. 若仍有第一頁裁切、桌 6-20 不可見、legend 不可見，停止並交回 Phase 2 或 Phase 3。

限制：

- 不使用 `@qa`。
- 不新增功能。
- 不修改 data/export contract。

## 6. 各 Phase 執行提示詞

以下每次只貼一個 Phase。每個 Phase 一次只能使用指定角色；若發現需要其他角色，停止並回報，不要混用角色。

### Phase 1 Prompt

使用角色：`@designer`

```text
請以 `.agents/agents.md` 中的 @designer 角色執行 Phase 1：Reference-Match 視覺規格。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-reference-match-correction-plan-20260609.md`
- `src/utils/weddingFloorPrintRenderer.js`
- `src/utils/weddingFloorSeatAnnotations.js`

若存在才補讀：
- `Plan/wedding-floor-pdf-layout-visual-spec-20260608.md`
- `Plan/wedding-floor-pdf-seat-label-visual-spec-20260608.md`
- `Plan/wedding-floor-pdf-seat-label-phase5-polish-20260609.md`

使用者最新要求：
- 第一張目前匯出圖仍不像第二張目標圖。
- 不使用 @qa。
- 每個 Phase 一次只能對應一個 agents.md 角色。

目標：
- 新增 `Plan/wedding-floor-pdf-reference-match-visual-spec-20260609.md`。
- 把第二張圖拆成可實作的 A4 portrait print-only 規格。
- 明確定義 header、stage、main table、regular grid、floral、legend 的位置、尺寸、視覺層級。
- 明確寫出第一頁不可只露出上半段，20 桌情境需呈現主桌 + 19 張一般桌。

限制：
- 本 Phase 只能由 @designer 執行。
- 不修改產品程式碼。
- 不使用第二張圖或目前輸出圖當整頁背景。
- 不使用 @qa。

完成回報：
- 列出新增/更新文件。
- 列出第一張與第二張的主要落差。
- 列出下一 Phase 交給 @engineer 的 geometry 與輸出比例需求。
```

### Phase 2 Prompt

使用角色：`@engineer`

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 2：輸出比例與 Layout Geometry 修正。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-reference-match-correction-plan-20260609.md`
- `Plan/wedding-floor-pdf-reference-match-visual-spec-20260609.md`
- `src/utils/printWindow.js`
- `src/utils/weddingFloorPrintLayout.js`
- `src/utils/weddingFloorSeatAnnotations.js`
- `src/utils/weddingFloorPrintRenderer.js`

目標：
- 修正目前輸出像橫向 viewport crop、只看到 A4 上半部的問題。
- 保持 print output 為 A4 portrait，但 screen preview 也要能完整看到一張直式頁。
- 調整主桌 annotation geometry，避免姓名標籤貼到 groupBox 外緣造成長斜線。
- 調整 regular table geometry，讓 20 桌情境第一頁能完整呈現主桌 + 2-20 桌 + legend。

建議範圍：
- `src/utils/printWindow.js`
- `src/utils/weddingFloorSeatAnnotations.js`
- `src/utils/weddingFloorPrintLayout.js`
- `scripts/check-wedding-floor-pdf-layout.mjs`

限制：
- 本 Phase 只能由 @engineer 執行。
- 不改花卉、字體、顏色等視覺細節。
- 不改 Firebase、Google Sheets、DnD 或互動式 `FloorPlan`。
- 不使用 @qa。

自檢命令：
- `npm run check:floor-pdf-layout`
- `npm run check:phase4-export-contract`

完成回報：
- 列出修改檔案。
- 說明如何避免 screen/preview 上半部裁切。
- 說明主桌與一般桌 geometry 如何支援 Phase 3 視覺。
```

### Phase 3 Prompt

使用角色：`@designer`

```text
請以 `.agents/agents.md` 中的 @designer 角色執行 Phase 3：Reference-Match Print Renderer 實作。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-reference-match-correction-plan-20260609.md`
- `Plan/wedding-floor-pdf-reference-match-visual-spec-20260609.md`
- Phase 2 完成紀錄
- `src/utils/weddingFloorPrintRenderer.js`

目標：
- 依 Phase 1 規格與 Phase 2 geometry，把 print renderer 視覺調到更接近第二張圖。
- Header 要以 `Jeremy & Yuri` 作為第一視覺焦點。
- 花卉四角要更接近水彩婚禮版型，但不可壓住內容。
- Stage 要更像米金色實心緞帶。
- 主桌中央加入 floral medallion 或淡雅花束，弱化 `1桌 7/10`。
- 一般桌空座位金線清楚，桌 2 標籤貼近桌側。
- Legend 必須完整出現在第一頁底部。

建議範圍：
- `src/utils/weddingFloorPrintRenderer.js`
- 視需要新增 `public/print/` print-only 裝飾資產
- `scripts/check-wedding-floor-print-renderer.mjs`

限制：
- 本 Phase 只能由 @designer 執行。
- 不改 layout model 資料契約；若 geometry 不足，停止交回 Phase 2。
- 不改 export wiring。
- 不使用 @qa。

自檢命令：
- `npm run check:floor-pdf-renderer`
- `npm run check:floor-pdf-layout`

完成回報：
- 列出修改檔案。
- 列出已修正的視覺落差。
- 列出仍和第二張不同但暫時可接受的項目。
```

### Phase 4 Prompt

使用角色：`@engineer`

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 4：Export Contract 與防退化 Smoke。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-reference-match-correction-plan-20260609.md`
- Phase 2 完成紀錄
- Phase 3 完成紀錄
- `src/hooks/useExport.js`
- `src/utils/floorPrintHTMLBuilder.js`
- `src/utils/printWindow.js`
- `scripts/check-phase4-export-contract.mjs`
- `scripts/check-wedding-floor-print-renderer.mjs`

目標：
- 確認正式 `exportFloorPDF()` 使用 reference-match renderer。
- 新增或更新 smoke contract，防止未來退回第一張那種 cropped/legacy/bottom-chip 狀態。

必做：
- `exportFloorPDF()` 必須走 `buildWeddingFloorPrintHTML(state)`。
- HTML 必須含 A4 portrait page marker 與完整頁面顯示策略 marker。
- 第一頁必須含 legend marker。
- 20 桌範例第一頁應含主桌與 19 張一般桌 render marker。
- occupied guest count = label count = connector count。
- empty seats 不產生 name label。
- 不輸出 `.wfp-regular-names` / `.wfp-regular-name`。

限制：
- 本 Phase 只能由 @engineer 執行。
- 不做人工 QA。
- 不新增 `html2canvas` / `jspdf`。
- 不改 Firebase、Google Sheets、DnD。
- 不使用 @qa。

自檢命令：
- `npm run check:phase4-export-contract`
- `npm run check:floor-pdf-renderer`
- `npm run check:floor-pdf-layout`
- `npm run lint`

完成回報：
- 列出修改檔案。
- 列出新增的防退化 smoke 檢查。
- 列出命令結果。
```

### Phase 5 Prompt

使用角色：`@designer`

```text
請以 `.agents/agents.md` 中的 @designer 角色執行 Phase 5：設計完成紀錄與可接受差異。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-reference-match-correction-plan-20260609.md`
- `Plan/wedding-floor-pdf-reference-match-visual-spec-20260609.md`
- Phase 2 完成紀錄
- Phase 3 完成紀錄
- Phase 4 完成紀錄

目標：
- 不做 QA gate，只整理設計完成紀錄。
- 新增 `Plan/wedding-floor-pdf-reference-match-phase5-design-summary-20260609.md`。
- 清楚列出哪些和第一張相比已修正，哪些和第二張仍不同但合理保留。

必做：
- 列出輸出比例/裁切是否已修。
- 列出 header、floral、stage、main table、regular grid、legend 的修正摘要。
- 列出仍不同但可接受項目，例如未直接使用第二張圖背景、日期與統計仍動態、分類色仍由資料決定。
- 若仍有第一頁裁切、桌 6-20 不可見、legend 不可見，停止並交回 Phase 2 或 Phase 3。

限制：
- 本 Phase 只能由 @designer 執行。
- 不使用 @qa。
- 不新增功能。
- 不修改 data/export contract。

完成回報：
- 列出新增文件。
- 列出設計完成摘要。
- 列出需要回交的項目；若沒有，明確寫「無需回交」。
```
