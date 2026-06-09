# 婚禮桌次圖匯出最佳解 Phase 0 視覺/版面規格

日期：2026-06-09
執行角色：`@qa`（依使用者本輪最新指令）
狀態：Phase 0 完成；不修改產品程式碼
來源計畫：`Plan/wedding-floor-pdf-best-solution-plan-20260609.md`

## 0. 角色衝突裁決

原計畫書明確指定 Phase 0 角色為 `@designer`，且多處寫明「不使用 `@qa`」。本輪使用者最新指令改為「使用 `.agents/agents.md` 中的 `@qa` 角色，執行 Phase 0」，因此本文件以 `@qa` 角度完成 Phase 0 的規格審查與可交付規格定稿。

此裁決只影響本輪 Phase 0 文件產出。後續 Phase 1-6 若沒有新的使用者指令，仍應依原最佳解計畫使用 `@engineer` / `@designer`，且不新增獨立 `@qa` gate。

## 1. Phase 0 不可退讓驗收目標

1. 匯出結果必須接近範例圖的 A4 直式婚禮桌次圖風格，而不是一般工程表格或橫向截圖。
2. 桌子位置必須保留使用者在「座位圖」設計畫面中排好的版面；`state.tablePositions` 是正式匯出的 source of truth。
3. 姓名必須靠近對應座位點；禁止長距離 connector、跨桌連線、姓名集中左右列表或遠離座位。
4. 不允許出現「完整座位標註見第 N 頁」或同義降級文字；字放不下時使用自動縮放、換行、局部避讓與整體等比例 breathing。
5. 新增座位圖設計畫面圖檔匯出與 AI 生圖提示詞；AI prompt 是輔助，不取代正式 state-driven 匯出。

## 2. 採用與不採用項目

### 採用 Codex 計畫

- 保留 state-driven print HTML/SVG 架構。
- 保留 A4 portrait、wedding print CSS 隔離與 smoke contract 思路。
- 採用 PDF / SVG / PNG 共用 layout model 的防退化方向。
- 採用正式 export 不依賴 live DOM screenshot 的邊界。

### 採用 Claude 計畫

- 採用更接近目標圖的水彩粉玫瑰、金色字體與婚禮海報感。
- 採用姓名直接貼近座位點的視覺方向。
- 採用弱化主桌中心 `1桌 7/10`、改以花束或 medallion 作為主桌視覺中心。

### 不採用項目

- 不採用固定 4 欄 x 5 列 grid 作為正式桌位來源；該方式會覆蓋使用者在 `FloorPlan` 內手動排好的位置。
- 不採用 detail page 或「完整座位標註見第 N 頁」作為姓名 overflow 解法。
- 不採用長 connector 或跨頁、跨桌、跨主桌的連線。
- 不採用 DOM screenshot、`html2canvas`、`jspdf` 或新增大型 dependency。
- 不採用以 `npm run dev` 取代正式 build / smoke 的驗證方式。

## 3. 視覺方向

### 3.1 A4 portrait 版面

- 紙張：A4 portrait，`210mm x 297mm`。
- 安全區：四邊至少保留 `6mm`，花卉可進入邊角裝飾區，但不可遮擋桌子、姓名、legend。
- 主視覺：`Jeremy & Yuri` script title 為第一視覺焦點；中文 `婚禮桌次位置圖` 與英文 subtitle 作為次層級。
- Stage：上方使用米金色 ribbon，可保留「主桌 / 舞台」文字，但不得主導整張圖。
- Legend：底部固定呈現 `座位圖例`、分類圓點與文字；不可因桌數增加被裁切。

### 3.2 花卉與婚禮風格

- 四角使用水彩粉玫瑰、葉片與花苞；以 inline SVG 或 print-only asset 產生，不把範例圖當整頁背景。
- 左上與右下可以較豐富，右上與左下可較輕；透明度需讓內容保持可讀。
- 主桌可加花束 medallion 或淡金圓盤，但桌號與座位數不得成為最大視覺焦點。

### 3.3 桌子與座位點

- 每張桌仍顯示 10 個 seat dot。
- 空座位：金線空心圓，至少 `0.28mm` stroke，列印可辨識。
- 已入座座位：使用 `getCategoryVisual()` 的分類色，不硬編碼只支援內建類別；自訂類別使用現有 fallback 色。
- 桌號可顯示於桌心或桌旁，但應弱化 occupancy，避免 `1桌 7/10` 搶過婚禮視覺。

## 4. 姓名鄰近座位規格

### 4.1 基本規則

- 每一位已入座 guest 必須有且只有一個姓名 label。
- 空位只畫 seat dot，不畫姓名 label。
- label 必須以 seat dot 為錨點，不可以頁面 side lane 或左右集中列表為錨點。
- label 可 1-2 行；中文字可逐字換行；不得溢出 label box。

### 4.2 距離上限

- 一般桌：label 外框離 seat dot 最近點不得超過 `3mm`；label 中心與 seat dot 距離不得超過 `11mm`。
- 主桌：label 外框離 seat dot 最近點不得超過 `4mm`；label 中心與 seat dot 距離不得超過 `14mm`。
- 若需要 micro leader，線長上限為 `8mm`；超過即視為失敗。
- 禁止 connector 穿越其他桌、主桌 medallion、legend 或其他姓名 label。

### 4.3 排版與避讓

- 每個 seat index 需有 local sector，例如 top、top-right、right、bottom-right、bottom、bottom-left、left、top-left。
- 同桌先做局部避讓；跨桌 collision 再觸發整體 proportional breathing。
- 字級可下修，但一般桌姓名不可低於 `5.5pt`，主桌姓名不可低於 `6.2pt`。
- label compact mode 可以縮 padding、改兩行或縮字級，但不得把姓名移到遠離座位的位置。

## 5. 桌位保留規格

### 5.1 Source of Truth

正式匯出桌位以以下資料為準：

```txt
state.tables + state.tablePositions + CANVAS_WIDTH/CANVAS_HEIGHT
```

目前來源確認：

- `CANVAS_WIDTH = 1850`
- `CANVAS_HEIGHT = 2400`
- `FloorPlan.jsx` 以 `positions?.[table.id] ?? defaultTablePosition(index)` 取得桌位。
- `defaultTablePosition(index)` 只能作為缺少 `tablePositions[table.id]` 時的 fallback。

### 5.2 允許的幾何轉換

- 允許：uniform scale、translate、以整體 centroid 為中心的 uniform proportional breathing。
- 禁止：依桌號排序重排、固定 4x5 grid 覆蓋、各桌獨立縮放、非等比例拉伸、只為塞字而改變局部桌距比例。
- 任兩桌 source distance ratio 與 export distance ratio 誤差應低於 `1%`；若套用 breathing，所有桌心必須使用同一 breathing scale。

### 5.3 建議 layout model 欄位

`@engineer` 後續應建立或等價實作：

```txt
buildFloorDesignLayoutModel(state, options)
  -> sourceCanvas
  -> contentFrame
  -> sourceBoundingBox
  -> positionTransform
  -> breathingScale
  -> tables[].sourcePosition
  -> tables[].printPosition
  -> tables[].relativePositionSignature
  -> tables[].seatDots[]
  -> tables[].seatLabels[]
  -> layoutSignature
```

PDF、SVG、PNG 與 AI prompt 必須共用同一份 model 或同一個 `layoutSignature`，避免不同匯出格式產生不同桌位。

## 6. 不接受項目

- HTML/SVG/PDF 不可含 `完整座位標註見第`。
- HTML/SVG/PDF 不可含 `wfp-detail-reference` 作為姓名 overflow 的主要解法。
- 不可輸出 summary-only table mode 取代座位旁姓名。
- 不可將姓名集中在左側、右側、底部列表，再以長線連回座位。
- 不可因要接近範例圖而硬編碼固定桌號、固定姓名、固定日期或固定分類。
- 不可讓 print CSS 污染互動式 `FloorPlan`。

## 7. PNG / SVG / AI Prompt 規格

### 7.1 匯出項目

- `桌次圖 PDF`：使用同一 source-position layout model。
- `座位圖設計圖 PNG`：由同一 SVG 轉 canvas，再輸出 PNG；不新增 screenshot dependency。
- `座位圖設計圖 SVG`：可選，但建議保留以便高解析檢查。
- `AI 生圖提示詞`：輸出 `.txt`，可與 PNG 一鍵下載或分開下載。

建議檔名：

- `婚禮桌次設計圖_YYYY-MM-DD.png`
- `婚禮桌次設計圖_YYYY-MM-DD.svg`
- `婚禮桌次AI生成提示詞_YYYY-MM-DD.txt`

### 7.2 AI Prompt 必含語意

Prompt 必須包含以下英文核心句：

- `preserve exact table layout and relative positions from the attached reference image`
- `keep all names close to their corresponding seat dots`
- `do not invent, remove, or rename guests`
- `A4 portrait wedding seating chart`
- `watercolor blush rose floral corners`
- `elegant gold typography and ribbon`

Prompt 應明確寫出：AI 只能美化同一張桌次圖，不可重排桌位、不新增桌次、不刪除賓客、不改姓名。

## 8. 交給 @engineer 的必要 contract

1. `state.tablePositions` 優先，`defaultTablePosition(index)` 只做缺值 fallback。
2. 桌心映射只能使用同一套 scale + translate；breathing 只能是全域 uniform。
3. `layoutSignature` 必須可被 smoke 比對，並在 PDF/SVG/PNG/prompt 共用。
4. 每個 occupied guest 都要輸出 seat dot + nearby label。
5. label 距離與 micro leader 上限需可被 smoke script 檢查。
6. 不可再產生 `完整座位標註見第 N 頁`、`wfp-detail-reference` 或 summary-only fallback。
7. `scripts/check-floor-design-layout.mjs` 至少要檢查桌距比例、fallback 使用、label 距離、無 detail reference。
8. `scripts/check-floor-design-export.mjs` 至少要檢查 PDF/SVG/PNG/prompt 共用 model signature 與 prompt 必含語意。

## 9. QA 風險記錄

### P0

- 原計畫 Phase 0 指定 `@designer` 且禁止 `@qa`，本輪依使用者最新指令改由 `@qa` 執行。後續若要嚴格回到原計畫，需由 `@designer` 接手確認視覺細節。
- 目前 renderer 仍可輸出 `完整座位標註見第 N 頁` 與 `wfp-detail-reference`，與最佳解不可退讓要求衝突。
- 既有 renderer 依 `buildWeddingFloorLayoutModel()` 與 `regularTablePages` 產生桌次頁面，尚未證明正式桌位完全保留 `state.tablePositions`。

### P1

- 兩份舊計畫都曾偏向固定 grid；後續工程若沿用該方向，會再次違反「保留原設計座標」。
- 若只隱藏 connector CSS 而不約束 label 距離，仍可能保留姓名遠離座位的資料模型問題。
- PNG / SVG / PDF 若各自建立 layout，將造成匯出不一致。

## 10. Phase 0 自檢

- 已覆蓋使用者最新 4 點要求：接近範例圖、保留原桌位、禁止 detail reference、新增圖檔與 AI prompt。
- 已明確記錄本輪使用 `@qa` 與原計畫「不使用 `@qa`」的衝突。
- 已讀取 `.agents/agents.md`、`.agents/context.md`、最佳解計畫、兩份比較計畫與必要 source 片段。
- 本 Phase 未修改產品程式碼。
- 後續 Phase 若沒有新指令，建議回到原計畫角色：Phase 1/2/4/5 使用 `@engineer`，Phase 3/6 使用 `@designer`。
