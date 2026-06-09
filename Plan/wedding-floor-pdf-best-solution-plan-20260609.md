# 婚禮桌次圖匯出最佳解計畫書

日期：2026-06-09  
狀態：最佳解計畫書，整合兩份既有計畫與使用者最新 4 點要求  
比較來源：

- `Plan/wedding-floor-pdf-reference-match-correction-plan-20260609.md`
- `Plan/wedding-floor-pdf-reference-match-correction-plan-claude-20260609.md`

使用角色：

- `@designer`
- `@engineer`

不使用角色：

- `@qa`

## 1. 使用者最新不可退讓目標

1. 匯出結果要非常接近範例圖的婚禮桌次圖風格；姓名不可亂跑，必須相近於對應座位。
2. PDF / 圖檔匯出的桌子位置必須保留使用者在「座位圖」設計畫面中原先排好的版面，不可被匯出邏輯改成另一套固定網格。
3. 不接受「完整座位請詳見第 2 頁」這類降級文字。若字放不下，應透過桌距等比例放寬、姓名標籤壓縮、字級/換行/局部避讓等方式處理；整體桌子間距比例仍要保持一致。
4. 新增一個匯出功能：在匯出選單中產出「座位圖設計畫面的圖檔」，並同時附上一段可拿去 AI 生圖工具使用的提示詞。

## 2. 兩份計畫比較結論

| 評估項 | Codex 計畫 | Claude 計畫 | 最佳解採用 |
| --- | --- | --- | --- |
| 接近範例圖 | 有處理 header、花卉、stage、legend，但仍偏工程安全規格 | 對花卉、水彩感、主桌視覺描述較清楚 | 採 Claude 的視覺方向，但補上更嚴格的 source-position 約束 |
| 姓名位置 | 仍保留 connector 模型，容易出現長斜線與姓名遠離座位 | 主張移除 connector，姓名緊貼座位點 | 採「短距離座位鄰接標籤」：姓名靠近座位；connector 可省略或僅限 6-10mm 內，不允許長線 |
| 桌位是否保留原設計 | 原計畫偏 A4 固定 grid，會改變使用者手動桌位 | 仍以 4x5 grid 為主，也會改變使用者手動桌位 | 兩者都不採。正式匯出必須以 `state.tablePositions` / `FloorPlan` 版面為 source of truth |
| 字放不下 | Codex 原計畫允許 detail page 與「詳見第 N 頁」 | Claude 移除 connector，但沒有完整字寬解法 | 不採 detail page。改用 proportional breathing + local label solver + auto-fit text |
| PDF 可靠性 | 有 smoke contract，但偏 PDF | 驗證較弱，且用 `npm run dev` 作為 build 檢查不夠精準 | 採 Codex 的 contract 思路，改成 PDF + PNG/SVG 共用同一 layout model |
| 圖檔匯出 + AI 提示詞 | 未涵蓋 | 未涵蓋 | 新增 Phase：內建 SVG/PNG 匯出與 prompt `.txt` 產生 |

## 3. 最佳解核心決策

### 3.1 匯出版面以使用者原設計為準

目前互動式座位圖的桌位來源是：

- `state.tablePositions`
- `CANVAS_WIDTH = 1850`
- `CANVAS_HEIGHT = 2400`
- `defaultTablePosition(index)` 作為缺失座標 fallback

最佳解不再使用「婚禮參考圖固定 4 欄 x 5 列」作為正式桌位版面。固定 grid 只能作為沒有任何 `tablePositions` 時的 fallback。

正式匯出應建立新的 source-position layout model：

```txt
state.tables + state.tablePositions + CANVAS_WIDTH/CANVAS_HEIGHT
  -> resolve table center positions
  -> compute occupied layout bounding box
  -> map canvas coordinates into A4 / image content frame
  -> apply uniform breathing scale if labels need more room
  -> render PDF / SVG / PNG from the same model
```

### 3.2 姓名標籤不再使用長 connector

姓名顯示規則：

1. 每個座位仍有 seat dot。
2. 已入座 seat dot 旁顯示姓名 label。
3. 姓名 label 的中心點應靠近該 seat dot，優先貼在該座位外側。
4. 若需要線條，只能是短距離 micro leader，長度上限 6-10mm。
5. 禁止跨桌、跨半頁、交錯穿越主桌的長 connector。
6. 若 label 已緊貼座位點，可完全不畫 connector。

這比「完全移除 connector」更穩：視覺上接近範例圖，也保留 seat-label 關係可檢查。

### 3.3 不使用 detail page 當字放不下的解法

移除或停用這類輸出：

- `完整座位標註見第 N 頁`
- `needsDetailPage` 造成第一頁只放 summary
- 桌次詳圖頁作為姓名 overflow 的主要解法

新的 overflow 解法順序：

1. **Local label solver**：每桌 10 個座位各自有鄰近 label sector，姓名先放在 seat dot 外側。
2. **Text auto-fit**：姓名允許 1-2 行、字級下修到安全下限、中文字可逐字換行但不可溢出。
3. **Table-local compact mode**：同桌 label 太密時，label 更貼近座位點，減少膠囊寬度。
4. **Global proportional breathing**：若跨桌 label collision，將所有桌心以同一中心點做等比例放寬，保留相對位置與間距比例。
5. **最後保底**：若 A4 PDF 仍不足，PDF 仍維持完整但字級達最小；同時 PNG/SVG 圖檔可輸出較大尺寸，供 AI 生圖與人工確認使用。不可改成「詳見第 2 頁」。

### 3.4 PDF 與圖檔共用同一個布局模型

避免 PDF 一套、PNG 一套導致結果不一致：

```txt
buildSourcePositionFloorLayoutModel(state)
  -> buildWeddingFloorDesignSvg(model)
  -> PDF print HTML embeds the same SVG / layout data
  -> PNG export serializes same SVG into canvas and downloads image
  -> AI prompt uses same model summary
```

### 3.5 AI 生圖提示詞不是取代正式匯出

新增的 AI prompt 是「額外輔助」，不是讓 AI 自行重排桌位。提示詞必須明確要求：

- preserve exact table layout and relative positions from the attached reference image
- keep all names close to their corresponding seat dots
- do not invent, remove, or rename guests
- A4 portrait wedding seating chart
- watercolor blush rose floral corners
- gold typography and ribbon

## 4. 建議新增/調整檔案

| 檔案 | 角色 | 用途 |
| --- | --- | --- |
| `src/utils/floorDesignLayoutModel.js` | `@engineer` | 新增 source-position layout model，保留 `tablePositions` 版面並做 proportional fit/breathing |
| `src/utils/floorDesignSvgBuilder.js` | `@designer` / `@engineer` | 產生 PDF 與 PNG 共用的 SVG 視覺 |
| `src/utils/floorDesignImageExport.js` | `@engineer` | 將 SVG 轉成 PNG 下載，不新增大型 dependency |
| `src/utils/floorDesignPromptBuilder.js` | `@engineer` | 依 state 與 layout model 產生 AI 生圖提示詞 `.txt` |
| `src/utils/weddingFloorPrintRenderer.js` | `@designer` | 改成使用 source-position SVG / 統一視覺，不再自動 grid 重排 |
| `src/utils/weddingFloorSeatAnnotations.js` | `@engineer` | 改為 seat-local label solver；移除 detail fallback 的主要路徑 |
| `src/hooks/useExport.js` | `@engineer` | 新增 `exportFloorDesignImage()` 與 prompt 下載 |
| `src/components/Toolbar.jsx` | `@engineer` | 匯出選單新增「座位圖設計圖 PNG」與「AI 生圖提示詞」或合併一鍵匯出 |
| `scripts/check-floor-design-layout.mjs` | `@engineer` | 驗證保留桌位比例、無 detail reference、label 靠近 seat |
| `scripts/check-floor-design-export.mjs` | `@engineer` | 驗證 PDF/PNG/SVG/prompt export contract |

## 5. Phase 總覽

| Phase | 對應角色 | 目的 | 主要輸出 |
| --- | --- | --- | --- |
| Phase 0 | `@designer` | 整合兩份計畫與最新需求，建立最終視覺/版面規格 | `Plan/wedding-floor-pdf-best-solution-visual-spec-20260609.md` |
| Phase 1 | `@engineer` | 建立保留原始桌位的 source-position layout model | `floorDesignLayoutModel.js`、layout smoke |
| Phase 2 | `@engineer` | 建立 seat-local label solver，移除 detail page overflow 解法 | 更新 annotation model、無「詳見第 N 頁」 |
| Phase 3 | `@designer` | 實作接近範例圖的 PDF/SVG 視覺 | 水彩花卉、金色標題、主桌花束、短距離姓名標籤 |
| Phase 4 | `@engineer` | 新增座位圖設計畫面 PNG/SVG 匯出與 AI prompt 產生 | 匯出選單、image export、prompt `.txt` |
| Phase 5 | `@engineer` | 匯出 contract self-check，防止桌位跑掉與 detail reference 回歸 | smoke scripts、npm scripts、lint/build |
| Phase 6 | `@designer` | 最終設計整理與執行回報 | 設計完成紀錄，不做 `@qa` |

## 6. Phase 詳細計畫

### Phase 0：最佳解視覺/版面規格

角色：`@designer`

目標：

- 將兩份計畫的優點合併，並以使用者最新 4 點要求為最高優先。
- 建立後續工程可執行的視覺規格。
- 明確宣告：正式匯出桌位必須保留原 `FloorPlan` 設計座標。

必讀：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-best-solution-plan-20260609.md`
- `Plan/wedding-floor-pdf-reference-match-correction-plan-20260609.md`
- `Plan/wedding-floor-pdf-reference-match-correction-plan-claude-20260609.md`
- `src/components/FloorPlan.jsx`
- `src/utils/constants.js`
- `src/utils/weddingFloorPrintRenderer.js`

必做：

1. 新增 `Plan/wedding-floor-pdf-best-solution-visual-spec-20260609.md`。
2. 定義「接近範例圖」但不改動桌位的視覺方向：
   - A4 portrait。
   - 水彩花卉四角。
   - 大型 `Jeremy & Yuri` script title。
   - 金色緞帶 stage。
   - 主桌中央可用花束 medallion。
   - 姓名在座位旁，不使用長線。
3. 定義座位姓名規格：
   - label 必須鄰近 seat dot。
   - label 與 seat dot 的最大距離需有數值上限。
   - connector 若存在，只能是 micro leader。
4. 定義桌位保留規格：
   - 以 `tablePositions` 為正式匯出 source of truth。
   - 沒有座標才使用 `defaultTablePosition(index)` fallback。
   - 匯出只能做 uniform scale / translate / proportional breathing，不可改變相對排列。
5. 定義不接受項：
   - 不允許「完整座位請詳見第 N 頁」。
   - 不允許固定 4x5 grid 蓋掉原設計。
   - 不允許姓名集中到左右列表。

自檢：

- 規格必須明確覆蓋使用者 4 點要求。
- 規格必須明確寫出「不使用 @qa」。

### Phase 1：Source-Position Layout Model

角色：`@engineer`

目標：

- 建立新的匯出 layout model，保留使用者在互動式座位圖排好的桌位。
- 停止把正式匯出重排成固定婚禮 grid。

必讀：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-best-solution-plan-20260609.md`
- `Plan/wedding-floor-pdf-best-solution-visual-spec-20260609.md`
- `src/components/FloorPlan.jsx`
- `src/utils/constants.js`
- `src/utils/weddingFloorPrintLayout.js`
- `src/utils/weddingFloorSeatAnnotations.js`

建議新增：

- `src/utils/floorDesignLayoutModel.js`
- `scripts/check-floor-design-layout.mjs`

必做：

1. 建立 `buildFloorDesignLayoutModel(state, options)`。
2. 解析桌位：
   - `tablePositions[table.id]` 存在時使用它。
   - 不存在時使用 `defaultTablePosition(index)`。
3. 以 `CANVAS_WIDTH` / `CANVAS_HEIGHT` 建立 source canvas coordinate system。
4. 計算所有桌子的 bounding box。
5. 將 source canvas 等比例映射到 A4 content frame。
6. 保留相對位置：
   - 所有桌心只能經過同一套 scale + translate。
   - 若需要放寬，只能以 centroid 做 uniform breathing scale。
   - 不可排序、不可以 table number 重新 grid。
7. 輸出 model 至少包含：
   - `sourceCanvas`
   - `contentFrame`
   - `positionTransform`
   - `breathingScale`
   - `tables[].sourcePosition`
   - `tables[].printPosition`
   - `tables[].relativePositionSignature`
8. smoke 驗證：
   - 任兩桌 source distance ratio 與 print distance ratio 誤差在容許範圍內。
   - 有 `tablePositions` 時不得落回 `defaultTablePosition`。
   - 無 `tablePositions` 時 fallback 可運作。
   - 不產生 `regularTablePages` 固定 grid 作為正式輸出依據。

限制：

- 不改 renderer 美術。
- 不新增 npm dependency。
- 不改 Firebase / Google Sheets / DnD。
- 不使用 `@qa`。

自檢命令：

- `node scripts/check-floor-design-layout.mjs`
- `npm run check:phase4-export-contract`

### Phase 2：Seat-Local Label Solver

角色：`@engineer`

目標：

- 讓姓名靠近座位點，而不是亂跑到遠方或集中成左右列表。
- 移除 detail page / summary reference 作為 overflow 解法。

必讀：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-best-solution-plan-20260609.md`
- `Plan/wedding-floor-pdf-best-solution-visual-spec-20260609.md`
- `src/utils/floorDesignLayoutModel.js`
- `src/utils/weddingFloorSeatAnnotations.js`
- `src/utils/weddingFloorPrintLayout.js`

建議修改：

- `src/utils/weddingFloorSeatAnnotations.js`
- `src/utils/floorDesignLayoutModel.js`
- `scripts/check-floor-design-layout.mjs`

必做：

1. 每桌 10 個座位各自建立 local sector：
   - top
   - top-right
   - right
   - bottom-right
   - bottom
   - bottom-left
   - left
   - top-left
2. label placement 以 seat dot 為基準，不以整頁 side lane 為基準。
3. label 與 seat dot 最大距離設上限；超過即視為失敗。
4. text auto-fit：
   - 中文姓名可 1-2 行。
   - 字級可降到安全下限。
   - label width/height 有 max，不可溢出。
5. collision strategy：
   - 先同桌內局部避讓。
   - 再檢查跨桌 label collision。
   - 若跨桌 collision，觸發 Phase 1 layout model 的 proportional breathing。
6. 移除或停用：
   - `needsDetailPage` 作為姓名放不下的預設結果。
   - `完整座位標註見第 N 頁`。
   - summary-only table mode。
7. 保留完整性：
   - 每個已入座 guest 必須有 label。
   - 每個 label 必須有 seat index / guest id。
   - 空位只畫 seat dot，不畫姓名。

限制：

- 不做花卉/header/stage 視覺。
- 不改互動式 `FloorPlan`。
- 不使用 `@qa`。

自檢命令：

- `node scripts/check-floor-design-layout.mjs`
- `npm run check:floor-pdf-layout`

### Phase 3：Reference Visual Renderer

角色：`@designer`

目標：

- 以 Phase 1/2 的模型建立正式匯出視覺。
- 讓 PDF/SVG/PNG 接近範例圖，但桌位仍保留使用者原本設計。

必讀：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-best-solution-plan-20260609.md`
- `Plan/wedding-floor-pdf-best-solution-visual-spec-20260609.md`
- Phase 1 完成紀錄
- Phase 2 完成紀錄
- `src/utils/floorDesignLayoutModel.js`
- `src/utils/weddingFloorPrintRenderer.js`

建議新增/修改：

- `src/utils/floorDesignSvgBuilder.js`
- `src/utils/weddingFloorPrintRenderer.js`

必做：

1. 建立 `buildWeddingFloorDesignSvg(model, options)` 或等價 renderer。
2. Header：
   - 大型 `Jeremy & Yuri` script title。
   - 中文 `婚禮桌次位置圖` 與英文 subtitle。
   - 細金線、小愛心或等價裝飾。
3. Floral：
   - 四角水彩粉玫瑰與綠葉。
   - 不把範例圖當背景。
   - 不遮住桌位與姓名。
4. Stage：
   - 米金色 ribbon。
   - 位置可由 `FloorPlan` stage 概念映射，也可作為上方固定場地方向元素，但不可重排桌位。
5. Tables：
   - 以 `floorDesignLayoutModel.tables[].printPosition` 放置。
   - 空位為金線空心圓。
   - 已入座座位點以分類色呈現。
   - 姓名 label 靠近 seat dot。
   - 不畫長 connector。
6. Main table：
   - 若 label 為 `主桌` 或 `1桌`，可加花束 medallion。
   - 不讓 `1桌 7/10` 成為最大視覺焦點。
7. Legend：
   - 底部細線 + `座位圖例` + 分類圓點。
   - 第一頁完整可見。

限制：

- 不改 layout model contract。
- 不使用 `@qa`。

自檢命令：

- `npm run check:floor-pdf-renderer`
- `node scripts/check-floor-design-layout.mjs`

### Phase 4：設計畫面圖檔匯出與 AI Prompt

角色：`@engineer`

目標：

- 在匯出功能中新增「座位圖設計畫面」圖檔輸出。
- 同步產出可貼到 AI 生圖工具的提示詞。

必讀：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-best-solution-plan-20260609.md`
- Phase 1、2、3 完成紀錄
- `src/hooks/useExport.js`
- `src/components/Toolbar.jsx`
- `src/components/DashboardHome.jsx`
- `src/utils/floorDesignSvgBuilder.js`

建議新增/修改：

- `src/utils/floorDesignImageExport.js`
- `src/utils/floorDesignPromptBuilder.js`
- `src/hooks/useExport.js`
- `src/components/Toolbar.jsx`
- `src/components/DashboardHome.jsx`（若總覽也有匯出入口）

必做：

1. 新增 `buildFloorDesignPrompt(state, layoutModel)`：
   - 輸出繁體中文或英文皆可，但建議英文為主、中文補充。
   - 明確要求 AI 保留參考圖中的桌位與相對位置。
   - 明確要求姓名靠近座位點。
   - 明確要求不可新增/刪除/改名。
   - 明確描述水彩粉玫瑰、金色字體、A4 portrait wedding seating chart。
2. 新增 SVG / PNG 匯出：
   - 優先使用同一份 `buildWeddingFloorDesignSvg(model)`。
   - SVG 可直接 Blob 下載。
   - PNG 可用瀏覽器內建 `Image + canvas.toBlob()`，不新增 `html2canvas`。
   - 檔名建議：
     - `婚禮桌次設計圖_YYYY-MM-DD.png`
     - `婚禮桌次AI生成提示詞_YYYY-MM-DD.txt`
3. 更新 `useExport(state)`：
   - 新增 `exportFloorDesignImage()`
   - 新增 `exportFloorDesignPrompt()` 或一鍵 `exportFloorDesignImageWithPrompt()`
4. 更新 `Toolbar.jsx` 匯出選單：
   - `桌次圖 PDF`
   - `座位圖設計圖 PNG`
   - `AI 生圖提示詞`
   - 或 `座位圖 PNG + AI 提示詞`
5. 若 DashboardHome 有桌次圖匯出按鈕，也同步補上或保留 toolbar 為唯一入口並在計畫回報說明。

限制：

- 不新增大型 dependency。
- 不使用 DOM screenshot 套件。
- 不改 Firebase / Google Sheets / DnD。
- 不使用 `@qa`。

自檢命令：

- `node scripts/check-floor-design-export.mjs`
- `npm run lint`

### Phase 5：Export Contract Self-Check

角色：`@engineer`

目標：

- 建立防退化檢查，避免 PDF 又變成另一套桌位、姓名亂跑、detail reference 回來、或 PNG 與 PDF 不一致。

必讀：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-best-solution-plan-20260609.md`
- Phase 1-4 完成紀錄
- `scripts/check-phase4-export-contract.mjs`
- `scripts/check-wedding-floor-print-renderer.mjs`
- `scripts/check-floor-design-layout.mjs`
- `scripts/check-floor-design-export.mjs`

建議修改：

- `scripts/check-floor-design-layout.mjs`
- `scripts/check-floor-design-export.mjs`
- `scripts/check-phase4-export-contract.mjs`
- `package.json`

必做檢查：

1. 桌位保留：
   - source table distance ratio 與 export table distance ratio 一致。
   - 不因 table number 排序重排。
2. 姓名靠近座位：
   - 每個 occupied guest 有 label。
   - label 與 seat dot 距離低於上限。
   - 不存在長 connector。
3. 無 detail reference：
   - HTML/SVG 不可含 `完整座位標註見第`。
   - 不可含 `wfp-detail-reference`。
4. PDF/PNG 共用模型：
   - PDF renderer 與 PNG/SVG export 使用相同 layout model signature。
5. AI prompt：
   - prompt 包含 preserve exact table layout。
   - prompt 包含 keep names close to corresponding seat dots。
   - prompt 包含 do not invent/remove/rename guests。

限制：

- 本 Phase 是 `@engineer` self-check，不建立 `@qa` Phase。
- 不做大範圍 refactor。

自檢命令：

- `npm run check:floor-design-layout`
- `npm run check:floor-design-export`
- `npm run check:phase4-export-contract`
- `npm run check:floor-pdf-renderer`
- `npm run lint`
- `npm run build`

### Phase 6：設計完成紀錄

角色：`@designer`

目標：

- 彙整最終結果，不做 QA gate。
- 確認視覺方向與範例圖接近，並列出仍不同但合理保留的地方。

必讀：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-best-solution-plan-20260609.md`
- Phase 0-5 完成紀錄

建議新增：

- `Plan/wedding-floor-pdf-best-solution-phase6-design-summary-20260609.md`

必做：

1. 列出最終修正：
   - 桌位保留原設計。
   - 姓名靠近座位。
   - 無「詳見第 N 頁」。
   - PDF / PNG / AI prompt 入口完成。
   - 範例圖風格靠近：花卉、金色字體、stage ribbon、legend。
2. 列出仍不同但合理：
   - 不使用範例圖當背景。
   - 桌位依使用者實際設計，不強迫 4x5。
   - AI prompt 是輔助，不是正式資料來源。
3. 若仍有姓名遠離座位、桌位跑掉、detail reference，停止並回交對應 Phase。

限制：

- 不使用 `@qa`。
- 不改產品程式碼。

## 7. 各 Phase 執行提示詞

以下每次只貼一個 Phase。每個 Phase 一次只能使用指定角色；若發現需要其他角色，停止並回報，不要混用角色。

### Phase 0 Prompt

使用角色：`@designer`

```text
請以 `.agents/agents.md` 中的 @designer 角色執行 Phase 0：最佳解視覺/版面規格。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-best-solution-plan-20260609.md`
- `Plan/wedding-floor-pdf-reference-match-correction-plan-20260609.md`
- `Plan/wedding-floor-pdf-reference-match-correction-plan-claude-20260609.md`
- `src/components/FloorPlan.jsx`
- `src/utils/constants.js`
- `src/utils/weddingFloorPrintRenderer.js`

使用者最新不可退讓要求：
1. 匯出要跟範例圖很像，姓名不應該亂跑，而是相近於座位。
2. 匯出的桌子位置要跟原先在座位圖設計畫面設定的一樣。
3. 不要出現「完整座位請詳見第2頁」這類文字；字放不下時要用等比例放寬桌距、文字自動縮放/換行/避讓等方式處理，且保持整體桌距比例。
4. 增加匯出座位圖設計畫面圖檔，並附 AI 生圖提示詞。

目標：
- 新增 `Plan/wedding-floor-pdf-best-solution-visual-spec-20260609.md`。
- 明確定義範例圖風格、姓名鄰近座位、保留原桌位、不使用 detail reference、PNG/SVG + prompt 的視覺需求。

限制：
- 本 Phase 只能由 @designer 執行。
- 不修改產品程式碼。
- 不使用 @qa。

完成回報：
- 列出新增文件。
- 列出兩份舊計畫採用/不採用的項目。
- 列出交給 @engineer 的 layout model 必要規格。
```

### Phase 1 Prompt

使用角色：`@engineer`

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 1：Source-Position Layout Model。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-best-solution-plan-20260609.md`
- `Plan/wedding-floor-pdf-best-solution-visual-spec-20260609.md`
- `src/components/FloorPlan.jsx`
- `src/utils/constants.js`
- `src/utils/weddingFloorPrintLayout.js`
- `src/utils/weddingFloorSeatAnnotations.js`

目標：
- 建立 `buildFloorDesignLayoutModel(state, options)`。
- 正式匯出桌位必須以 `state.tablePositions` 為 source of truth。
- 將 `CANVAS_WIDTH/CANVAS_HEIGHT` 中的桌位等比例映射到 A4 / 圖檔 content frame。
- 只能使用 scale + translate + uniform proportional breathing，不可依桌號重新排序成固定 grid。

建議新增：
- `src/utils/floorDesignLayoutModel.js`
- `scripts/check-floor-design-layout.mjs`

限制：
- 本 Phase 只能由 @engineer 執行。
- 不改 renderer 美術。
- 不新增 npm dependency。
- 不改 Firebase / Google Sheets / DnD。
- 不使用 @qa。

自檢命令：
- `node scripts/check-floor-design-layout.mjs`
- `npm run check:phase4-export-contract`

完成回報：
- 列出修改檔案。
- 說明如何保留原始桌位比例。
- 說明 breathing scale 如何保持整體桌距比例。
```

### Phase 2 Prompt

使用角色：`@engineer`

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 2：Seat-Local Label Solver。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-best-solution-plan-20260609.md`
- `Plan/wedding-floor-pdf-best-solution-visual-spec-20260609.md`
- Phase 1 完成紀錄
- `src/utils/floorDesignLayoutModel.js`
- `src/utils/weddingFloorSeatAnnotations.js`
- `src/utils/weddingFloorPrintLayout.js`

目標：
- 姓名 label 必須靠近對應 seat dot，不可亂跑或集中成左右列表。
- 不再使用 `完整座位標註見第 N 頁` 或 detail page 作為字放不下的預設解法。
- 每位已入座 guest 都要有鄰近座位的 label；空位只畫 seat dot。

必做：
- 建立每個 seat index 的 local label sector。
- label 與 seat dot 距離設上限。
- 支援中文字 1-2 行、字級下修、label compact mode。
- 跨桌碰撞時觸發 Phase 1 的 proportional breathing。
- 移除或停用 summary-only/detail-reference fallback。

限制：
- 本 Phase 只能由 @engineer 執行。
- 不做花卉/header/stage 視覺。
- 不改互動式 `FloorPlan`。
- 不使用 @qa。

自檢命令：
- `node scripts/check-floor-design-layout.mjs`
- `npm run check:floor-pdf-layout`

完成回報：
- 列出修改檔案。
- 說明姓名如何靠近座位。
- 說明如何避免「詳見第 N 頁」。
```

### Phase 3 Prompt

使用角色：`@designer`

```text
請以 `.agents/agents.md` 中的 @designer 角色執行 Phase 3：Reference Visual Renderer。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-best-solution-plan-20260609.md`
- `Plan/wedding-floor-pdf-best-solution-visual-spec-20260609.md`
- Phase 1 完成紀錄
- Phase 2 完成紀錄
- `src/utils/floorDesignLayoutModel.js`
- `src/utils/weddingFloorPrintRenderer.js`

目標：
- 建立或改造 renderer，讓 PDF/SVG/PNG 視覺接近範例圖，但桌位仍保留使用者原本設計。
- 使用水彩粉玫瑰四角、金色 script title、米金色 stage ribbon、主桌花束 medallion。
- 姓名 label 靠近 seat dot，不畫長 connector。

建議新增/修改：
- `src/utils/floorDesignSvgBuilder.js`
- `src/utils/weddingFloorPrintRenderer.js`

限制：
- 本 Phase 只能由 @designer 執行。
- 不改 layout model contract。
- 不使用 @qa。

自檢命令：
- `npm run check:floor-pdf-renderer`
- `node scripts/check-floor-design-layout.mjs`

完成回報：
- 列出修改檔案。
- 列出接近範例圖的視覺項目。
- 若 geometry 不足導致姓名仍遠離座位，停止並回交 Phase 1 或 Phase 2。
```

### Phase 4 Prompt

使用角色：`@engineer`

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 4：設計畫面圖檔匯出與 AI Prompt。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-best-solution-plan-20260609.md`
- Phase 1、2、3 完成紀錄
- `src/hooks/useExport.js`
- `src/components/Toolbar.jsx`
- `src/components/DashboardHome.jsx`
- `src/utils/floorDesignSvgBuilder.js`

目標：
- 在匯出選單新增座位圖設計畫面 PNG/SVG 匯出。
- 同時產出 AI 生圖提示詞 `.txt`。
- PNG/SVG 與 PDF 使用同一個 layout model，避免結果不一致。

建議新增/修改：
- `src/utils/floorDesignImageExport.js`
- `src/utils/floorDesignPromptBuilder.js`
- `src/hooks/useExport.js`
- `src/components/Toolbar.jsx`
- `src/components/DashboardHome.jsx`（若總覽也需入口）

AI prompt 必須包含：
- preserve exact table layout and relative positions from the attached reference image
- keep all names close to their corresponding seat dots
- do not invent, remove, or rename guests
- A4 portrait wedding seating chart
- watercolor blush rose floral corners
- elegant gold typography and ribbon

限制：
- 本 Phase 只能由 @engineer 執行。
- 不新增 `html2canvas` / `jspdf`。
- 不新增大型 dependency。
- 不改 Firebase / Google Sheets / DnD。
- 不使用 @qa。

自檢命令：
- `node scripts/check-floor-design-export.mjs`
- `npm run lint`

完成回報：
- 列出新增匯出項目。
- 列出輸出檔名格式。
- 列出 AI prompt 核心內容。
```

### Phase 5 Prompt

使用角色：`@engineer`

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 5：Export Contract Self-Check。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-best-solution-plan-20260609.md`
- Phase 1-4 完成紀錄
- `scripts/check-phase4-export-contract.mjs`
- `scripts/check-wedding-floor-print-renderer.mjs`
- `scripts/check-floor-design-layout.mjs`
- `scripts/check-floor-design-export.mjs`

目標：
- 建立防退化 smoke，確認桌位不跑掉、姓名靠近座位、不出現 detail reference、PDF/PNG/SVG/prompt 共用正確模型。

必做檢查：
- source table distance ratio 與 export table distance ratio 一致。
- 有 `tablePositions` 時不使用固定 grid 重排。
- 每個 occupied guest 有 label，且 label 與 seat dot 距離低於上限。
- 不存在長 connector。
- HTML/SVG 不含 `完整座位標註見第` 與 `wfp-detail-reference`。
- PDF renderer 與 PNG/SVG export 使用相同 layout model signature。
- prompt 包含 preserve exact table layout、keep names close、do not invent/remove/rename guests。

限制：
- 本 Phase 是 @engineer self-check，不建立 @qa Phase。
- 不使用 @qa。

自檢命令：
- `npm run check:floor-design-layout`
- `npm run check:floor-design-export`
- `npm run check:phase4-export-contract`
- `npm run check:floor-pdf-renderer`
- `npm run lint`
- `npm run build`

完成回報：
- 列出新增/更新 smoke。
- 列出命令結果。
- 若任何自檢失敗，停止並回交對應 Phase。
```

### Phase 6 Prompt

使用角色：`@designer`

```text
請以 `.agents/agents.md` 中的 @designer 角色執行 Phase 6：設計完成紀錄。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-best-solution-plan-20260609.md`
- Phase 0-5 完成紀錄

目標：
- 新增 `Plan/wedding-floor-pdf-best-solution-phase6-design-summary-20260609.md`。
- 彙整最終結果，不做 QA gate。

必做：
- 列出桌位是否保留原設計。
- 列出姓名是否靠近座位。
- 列出是否已移除「詳見第 N 頁」。
- 列出 PDF / PNG / AI prompt 入口完成狀態。
- 列出與範例圖相近的設計項目：花卉、金色字體、stage ribbon、legend。
- 列出仍不同但合理保留的項目。
- 若仍有姓名遠離座位、桌位跑掉、detail reference，停止並回交對應 Phase。

限制：
- 本 Phase 只能由 @designer 執行。
- 不使用 @qa。
- 不改產品程式碼。

完成回報：
- 列出新增文件。
- 列出設計完成摘要。
- 列出需回交項目；若沒有，寫「無需回交」。
```

