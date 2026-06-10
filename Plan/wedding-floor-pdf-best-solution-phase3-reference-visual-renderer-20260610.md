# 婚禮桌次圖匯出最佳解 Phase 3 Reference Visual Renderer

日期：2026-06-10
執行角色：`@designer`
狀態：Phase 3 完成
來源計畫：`Plan/wedding-floor-pdf-best-solution-plan-20260609.md`

## 1. 目標

本 Phase 將正式桌次圖 PDF 首頁改為 source-position SVG 視覺 renderer。視覺方向靠近範例圖的 A4 直式婚禮桌次圖，但桌位與姓名仍完全依 Phase 1/2 的 layout model，不重新排成固定 grid。

## 2. 修改檔案

- `src/utils/floorDesignSvgBuilder.js`
  - 新增 `buildWeddingFloorDesignSvg(model, options)`。
  - 使用 `buildFloorDesignLayoutModel()` 的 `tables[].printPosition`、`seatDots`、`seatLabels` 與 `layoutSignature` 作為唯一幾何來源。
  - 輸出 A4 portrait inline SVG，包含 header、金線與愛心、stage ribbon、水彩花卉四角、主桌花束 medallion、桌次座位點、seat-local 姓名 label、micro leader 與底部 legend。
- `src/utils/weddingFloorPrintRenderer.js`
  - `buildWeddingFloorPrintHTML()` 同時建立既有名單/metadata model 與新的 `floorDesignModel`。
  - 首頁改為嵌入 `buildWeddingFloorDesignSvg()`，不再用 `regularTablePages` 固定 grid 繪製正式桌次圖。
  - 完整桌次名單頁沿用既有輸出，避免影響未分配名單與索引頁。
- `scripts/check-wedding-floor-print-renderer.mjs`
  - 改以 `buildFloorDesignLayoutModel()` 的 source-position `seatLabels` / `seatDots` 為 canonical。
  - 驗證正式 HTML 內含 `wfp-design-svg`、source-position `layoutSignature`、stage、主桌 medallion，且不輸出 detail page 或舊 grid markup。
- `scripts/check-phase4-export-contract.mjs`
  - 將 floor export label/dot/connector 檢查改為 source-position model，避免舊 annotation model 造成 false positive。

## 3. 接近範例圖的視覺項目

- A4 portrait SVG 首頁。
- 大型 `Jeremy & Yuri` script title。
- 中文 `婚 禮 桌 次 位 置 圖` 與英文 `WEDDING SEATING CHART`。
- 細金線與愛心裝飾。
- 米金色 `主桌 / 舞台` ribbon。
- 四角水彩粉玫瑰、花苞與綠葉，且不把範例圖當背景。
- 主桌加花束 medallion，弱化 `1桌 7/10` 這類工程資訊的視覺焦點。
- 底部細線 `座位圖例` 與分類圓點。

## 4. 幾何與姓名 contract

- 正式桌位仍使用 `floorDesignLayoutModel.tables[].printPosition`，不使用固定 4x5 grid。
- 每桌 seat dot 來自 `tables[].seatDots[]`。
- 每個已入座姓名 label 來自 `tables[].seatLabels[]`，並保持 Phase 2 的距離上限：
  - 一般桌 label edge distance <= 3mm。
  - 一般桌 label center distance <= 11mm。
  - 主桌 label edge distance <= 4mm。
  - 主桌 label center distance <= 14mm。
  - micro leader <= 8mm。
- Connector 僅輸出 Phase 2 model 已允許的 micro leader，不畫長距離 connector。
- HTML/SVG 不含 `完整座位標註見第`、`wfp-detail-reference` 或 `wfp-page--detail`。

## 5. 驗證結果

已通過：

```txt
npm run check:floor-pdf-renderer
node scripts/check-floor-design-layout.mjs
npm run check:phase4-export-contract
npm run check:floor-pdf-layout
npm run lint
git diff --check
npm run build
```

結果：

- `Wedding floor print renderer checks passed`
- `Floor design source-position layout checks passed`
- `Phase 4 export contract checks passed`
- `Wedding floor PDF layout model checks passed`
- `npm run lint` 通過。
- `git diff --check` 無 whitespace error，僅有 Git 的 LF/CRLF 提醒。
- sandbox 內 `npm run build` 因 Vite/Rolldown `spawn EPERM` 失敗；非 sandbox 重跑已通過。

## 6. Phase 4 交接

Phase 4 可直接使用：

- `buildWeddingFloorDesignSvg(model, options)` 作為 SVG / PNG 匯出的共用視覺來源。
- `buildFloorDesignLayoutModel(state)` 作為 PDF / SVG / PNG / AI prompt 的共同 layout signature 來源。

仍需保持：

- PNG/SVG 不使用 DOM screenshot dependency。
- AI prompt 只能輔助美化，不得取代正式 state-driven 匯出。
- 不新增 `html2canvas` / `jspdf`。
- 不改 Firebase / Google Sheets / DnD。
