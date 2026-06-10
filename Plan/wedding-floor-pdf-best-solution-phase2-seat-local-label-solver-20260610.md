# 婚禮桌次圖匯出最佳解 Phase 2 Seat-Local Label Solver

日期：2026-06-10
執行角色：`@engineer`
狀態：Phase 2 完成
來源計畫：`Plan/wedding-floor-pdf-best-solution-plan-20260609.md`

## 1. 目標

本 Phase 將姓名標籤改成以座位點為基準的 local label solver，停止使用 detail page、summary-only table mode 或「完整座位標註見第 N 頁」作為姓名放不下時的預設解法。

## 2. 修改檔案

- `src/utils/weddingFloorSeatAnnotations.js`
  - 將一般桌的 overview annotation limit 調整為 `MAX_SEATS`。
  - 建立 10 個 seat index 對應的 local sector：`top`、`top-right`、`right`、`bottom-right`、`bottom`、`bottom-left`、`left`、`top-left`。
  - 每個已入座 guest 都產生 `overviewPlacement`；`detailPlacement` 固定為 `null`。
  - 新增 label distance metrics 與 micro leader 長度上限。
  - 支援姓名 1-2 行、自動字級估算與 compact mode。
- `src/utils/weddingFloorPrintLayout.js`
  - 停用 detail assignment / hydrate detail pages 流程。
  - `detailTables`、`detailPages` 固定為空陣列。
  - `needsDetailPage` 固定為 `false`。
  - `chartPageCount` 不再把 detail pages 納入。
- `src/utils/floorDesignLayoutModel.js`
  - 在 source-position model 中加入 `seatDots` 與 `seatLabels`。
  - label 使用與 Phase 2 相同的 local sector、distance limits、text fit 與 compact collision 檢查。
- `src/utils/weddingFloorPrintRenderer.js`
  - 停止輸出 `wfp-detail-reference` 與「完整座位標註見第 N 頁」。
- `scripts/check-floor-design-layout.mjs`
  - 驗證 source-position model 中已入座 guest 都有鄰近 label。
  - 驗證 label 與 seat dot 距離、connector 長度與 local sector。
- `scripts/check-wedding-floor-pdf-layout.mjs`
  - 驗證每位已入座 guest 都有 overview seat-local placement。
  - 驗證 full table 不會 fallback 到 detail page。
  - 驗證 model 不產生 detail tables / detail pages。
- `scripts/check-wedding-floor-print-renderer.mjs`
  - 驗證 HTML 不含 detail page、`wfp-detail-reference` 或「完整座位標註見第」。
- `scripts/check-phase4-export-contract.mjs`
  - 延伸 export contract，防止 detail fallback 重新出現。

附帶 lint 修正：

- `src/hooks/useGuestDragAndDrop.js`
- `src/utils/dndOverlay.js`

此修正只處理 React hooks ref lint 規則與文件註解一致性，不改變拖曳功能目的。

## 3. 姓名如何靠近座位

每個 seat index 有固定 local sector，label box 直接從該 seat dot 推算位置：

```txt
seat dot
  -> local sector
  -> label text fit
  -> label box
  -> nearest edge micro leader
```

placement 會保留：

- `guestId`
- `guestName`
- `seatIndex`
- `seatPoint`
- `labelBox`
- `textFit`
- `localSector`
- `connector.length`
- `distance.withinLimit`

驗證上限：

- regular label edge distance <= 3mm
- regular label center distance <= 11mm
- connector length <= 8mm
- main label edge distance <= 4mm
- main label center distance <= 14mm
- connector length <= 8mm

## 4. 如何避免「詳見第 N 頁」

Phase 2 停用 detail fallback 的三個入口：

1. annotation helper 不再回傳 `detailTableInstance`。
2. layout model 不再建立 detail assignments / detail pages。
3. renderer 不再輸出 detail reference 文案。

因此長姓名、滿桌與 overflow guest warning 都不會讓 overview table 變成 summary-only table。

## 5. 驗證結果

已通過：

```txt
npm run lint
node scripts/check-floor-design-layout.mjs
npm run check:floor-pdf-layout
npm run check:floor-pdf-renderer
npm run check:phase4-export-contract
git diff --check
npm run build
```

結果：

- `Floor design source-position layout checks passed`
- `Wedding floor PDF layout model checks passed`
- `Wedding floor print renderer checks passed`
- `Phase 4 export contract checks passed`
- `npm run build` 通過；sandbox 內因 Vite/Rolldown `spawn EPERM` 失敗，非 sandbox 重跑通過。
- `git diff --check` 沒有 whitespace error；只出現 Git 的 LF/CRLF 提醒。

## 6. Phase 3 交接

Phase 3 可直接使用：

- `buildWeddingFloorLayoutModel()` 的 overview-only annotation records。
- `buildFloorDesignLayoutModel()` 的 `tables[].seatDots[]` 與 `tables[].seatLabels[]`。
- 每個 label 的 `distance.withinLimit` 與 `connector.length` 作為 renderer guard。

Phase 3 仍需維持禁止：

- `完整座位標註見第 N 頁`
- `wfp-detail-reference`
- `wfp-page--detail`
- summary-only table mode
