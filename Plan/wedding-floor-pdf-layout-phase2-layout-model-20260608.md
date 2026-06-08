# 婚禮桌次圖 PDF 版型 Phase 2 Layout Model

日期：2026-06-08  
角色：`.agents/agents.md` 的 `@engineer`  
範圍：匯出資料模型與排版演算法  
結論：Phase 2 完成。已建立 export-only layout model 與 Node smoke，尚未實作婚禮視覺 renderer，也尚未接到正式 `exportFloorPDF()` 視覺輸出。

## Sources Read

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-layout-plan-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase0-baseline-20260608.md`
- `Plan/wedding-floor-pdf-layout-visual-spec-20260608.md`
- `src/utils/floorPrintHTMLBuilder.js`
- `src/utils/exportShared.js`
- `src/utils/constants.js`
- `src/hooks/useExport.js`
- `scripts/check-phase4-export-contract.mjs`

## Files Changed

| File | Change |
| --- | --- |
| `src/utils/weddingFloorPrintLayout.js` | 新增純函式 `buildWeddingFloorLayoutModel(state)`，輸出婚禮 PDF layout model |
| `src/utils/exportShared.js` | `formatExportDate()` 改用瀏覽器/本機日期欄位，避免 UTC `toISOString()` 跨日 |
| `scripts/check-wedding-floor-pdf-layout.mjs` | 新增 Phase 2 Node smoke |
| `package.json` | 新增 `npm run check:floor-pdf-layout` |

## Layout Model Contract

`buildWeddingFloorLayoutModel(state, options)` 會回傳：

```js
{
  meta,
  mainTable,
  regularTablePages,
  legendItems,
  categoryVisuals,
  fullGuestIndex,
  unassignedGuests,
  warnings
}
```

已實作規則：

- 主桌判定順序：完全等於 `主桌` -> label 包含 `主桌` -> 可解析為 `1桌` -> fallback `tables[0]`。
- 一般桌排序：數字桌號優先自然排序，非數字桌名依原始順序後置。
- 每桌固定建立 10 個 seat slot；超過 10 個 guest reference 只進 warnings，不建立第 11 個座位。
- 第一頁一般桌容量 19 桌；續頁每頁 20 桌。
- `legendItems` 與 `categoryVisuals` 由現有 `getCategoryVisual()` / `buildCategoryOptions()` 產生，支援自訂分類。
- `fullGuestIndex` 保留主桌、一般桌與未分配賓客的完整姓名資料，供 Phase 3 renderer 處理截斷追溯。
- `warnings` 會標記無桌次、桌次 overflow、missing guest reference、duplicate guest reference、未分配賓客。

## Verification

| Command | Result |
| --- | --- |
| `npm run check:floor-pdf-layout` | Passed：`Wedding floor PDF layout model checks passed` |
| `node scripts/check-phase4-export-contract.mjs` | Passed：`Phase 4 export contract checks passed` |
| `npm run lint` | Passed |
| `git diff --check` | Passed；僅有 Windows CRLF warning |

## PDF-LAYOUT Coverage

| ID | Status | Evidence |
| --- | --- | --- |
| PDF-LAYOUT-01 | Covered by Phase 2 smoke | `meta.guestCount` 等於 `state.guests.length`；overflow 與未分配 guest 仍可追溯 |
| PDF-LAYOUT-02 | Covered by Phase 2 smoke | 驗證 `主桌`、包含 `主桌`、`1桌`、fallback 四種主桌判定 |
| PDF-LAYOUT-03 | Partially covered | layout model 固定第一頁 19 個 regular slots；實際 A4 不重疊屬 Phase 3/5 renderer QA |
| PDF-LAYOUT-04 | Covered by Phase 2 smoke | 驗證 41 個 regular tables 分成 19 / 20 / 2 |
| PDF-LAYOUT-05 | Covered by Phase 2 smoke | 驗證自訂分類 `長輩貴賓` 進 legend 與 category visual map |
| PDF-LAYOUT-06 | Not runtime tested | 本 Phase 未改 `FloorPlan` / `TableZone` / app CSS；操作畫面隔離需 Phase 5 Browser QA |
| PDF-LAYOUT-07 | Covered by Phase 2 smoke | `unassignedGuests` 與 `unassigned-guests` warning 會列出完整 guest IDs |
| PDF-LAYOUT-08 | Covered at helper level | `escHtml()` 特殊字元 smoke 通過；Phase 3 renderer 必須在所有 visible text 使用 escape |

## Not Run

- 未執行 `npm run build`：Phase 2 驗收要求為 layout smoke、既有 export contract 與 lint；正式 build 屬 Phase 4 接線驗收。
- 未執行 Browser / print preview：本 Phase 沒有視覺 renderer 或 export wiring 變更；桌機 Browser QA 留給 Phase 5。
- 未修改 `buildFloorPrintHTML()`：避免提前混入 Phase 3/4 的 renderer 與正式匯出接線責任。

## Risk Review

- P0/P1：未發現。
- 主要殘留風險是 Phase 3 renderer 仍需正確消費 `fullGuestIndex`，避免圖上截斷姓名後沒有完整名單追溯。
- `formatExportDate()` 影響 JSON/CSV/座位清單 PDF 的檔名與 meta，但這是修正既有 UTC 跨日風險；既有 Phase 4 export contract 已通過。

## Next Prompt

```text
請以 `.agents/agents.md` 中的 @designer 角色執行 Phase 3：婚禮版型 print renderer。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-layout-plan-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase0-baseline-20260608.md`
- `Plan/wedding-floor-pdf-layout-visual-spec-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase2-layout-model-20260608.md`

目標：
- 使用 `src/utils/weddingFloorPrintLayout.js` 的 layout model 產生參考圖風格的 A4 print HTML/SVG。
- 不修改 `App.jsx` 主流程、不改 Firebase / Google Sheets / DnD，不依賴 DOM snapshot。
- 驗證 HTML 包含 header、stage、main table、regular tables、legend，且長姓名不溢出名牌。
```
