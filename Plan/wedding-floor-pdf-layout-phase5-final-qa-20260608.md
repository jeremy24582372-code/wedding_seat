# 婚禮桌次圖 PDF 版型 Phase 5 Final QA Gate

日期：2026-06-08  
角色：`.agents/agents.md` 的 `@qa`  
結論：`Approve`

## Sources Read

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-layout-plan-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase0-baseline-20260608.md`
- `Plan/wedding-floor-pdf-layout-visual-spec-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase2-layout-model-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase3-print-renderer-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase4-export-wiring-20260608.md`
- `Plan/best-execution-plan-phase4-export-contract-20260604.md`
- 匯出與列印契約 source batch
- wedding layout / renderer / export smoke scripts

## QA Matrix

| ID | Result | Evidence |
| --- | --- | --- |
| PDF-LAYOUT-01 | Pass | layout smoke 驗證 `meta.guestCount === state.guests.length`；preview meta 與完整名單頁可追溯所有賓客 |
| PDF-LAYOUT-02 | Pass | layout smoke 驗證 `主桌`、包含 `主桌`、`1桌`、fallback 四種判定；preview 顯示 `主桌 / 舞台` 與主桌 10 seat |
| PDF-LAYOUT-03 | Pass | 20 桌 preview 第一頁 19 個一般桌 slot，Browser bounding-box overlap pairs `[]`，out-of-page count 0 |
| PDF-LAYOUT-04 | Pass | 42 regular-table preview 產生 3 個 chart pages，分布 19 / 20 / 3，所有頁 overlap pairs `[]`、out-of-page count 0 |
| PDF-LAYOUT-05 | Pass | renderer smoke 與 preview legend 包含 built-in 類別與自訂 `長輩貴賓` |
| PDF-LAYOUT-06 | Pass | App runtime `wfpElementsInApp = 0`、`hasWeddingPrintTitleInApp = false`；`FloorPlan` / `TableZone` 未被 print CSS 污染 |
| PDF-LAYOUT-07 | Pass | layout / renderer smoke 與 preview warning 顯示未分配賓客，完整名單包含未分配區塊 |
| PDF-LAYOUT-08 | Pass | smoke 驗證 `自訂貴賓<&">` escape；preview DOM 正常顯示特殊字元姓名，無 HTML 注入或破版 |

## Verification Commands

| Command | Result |
| --- | --- |
| `npm run check:floor-pdf-layout` | Passed：`Wedding floor PDF layout model checks passed` |
| `npm run check:floor-pdf-renderer` | Passed：`Wedding floor print renderer checks passed` |
| `node scripts/check-phase4-export-contract.mjs` | Passed：`Phase 4 export contract checks passed` |
| `node scripts/check-phase1-data-integrity.mjs` | Passed：10 人桌資料完整性 smoke passed |
| `node scripts/check-phase5-dnd-refactor.mjs` | Passed：DnD refactor smoke passed |
| `npm run lint` | Passed |
| `npm run rules:check` | Passed |
| `git diff --check` | Passed；僅 Windows CRLF warning |
| `npm run build` | Sandbox failed with known Vite/Rolldown `spawn EPERM`; after reading lesson 043, escalated rerun passed |

Build note：production build 成功，仍有既有 chunk > 500 kB warning；不是本次 PDF 版型回歸。

## Browser / Preview Evidence

Local print HTML preview：

- 20 桌：`.wfp-page` 2 頁；第一頁一般桌 19；overlap pairs `[]`；out-of-page count 0；主桌 seat 10；legend 含自訂類別；未分配 warning 存在；console warn/error 0。
- 42 regular tables：總頁數 5；chart pages 3；桌數 19 / 20 / 3；各頁 overlap pairs `[]`；各頁 out-of-page count 0；續頁 compact header 2；完整名單與未分配賓客存在；console warn/error 0。

App runtime：

- Target：`http://127.0.0.1:5195/wedding_seat/`
- Viewport：1366 desktop
- 登入成功，`座位圖` tab 可渲染。
- `floorPlanCount = 1`、`tableZoneCount = 20`、`workspaceCount = 1`。
- `wfpElementsInApp = 0`、`hasWeddingPrintTitleInApp = false`、horizontal overflow false。
- export menu 可開啟，包含 `匯出 JSON / 匯出 Excel / 座位清單 PDF / 桌次圖 PDF`。
- console warn/error 0。

正式 `桌次圖 PDF` popup 在 in-app Browser 中點擊後只留下空白 `about:blank`，無法直接檢查 popup document。由於 source wiring 與 `check-phase4-export-contract` 已證明正式 export 使用 `buildWeddingFloorPrintHTML(state)`，且 local HTTP preview 已驗證同一 renderer 的版面，這項列為低風險 Browser-surface 限制，不列為產品阻塞。

## Scope Review

- 未修改 `FloorPlan.jsx`、`TableZone.jsx`、Firebase schema、Google Sheets sync schema 或 DnD 邏輯。
- 本次新增的 QA scratch script 只產生暫存 preview HTML，不進入產品 bundle。
- 未執行真實 Google Sheets write-back，也未做跨裝置 Firebase concurrent edit；外部資料寫入不屬本次 PDF 版型 Gate 的必要動作。

## Remaining Low-risk Items

- 若要 100% 覆蓋真實 print dialog，可在人工桌機 Chrome 中手動點一次 `桌次圖 PDF`，確認瀏覽器列印對話框與 PDF preview；目前 in-app Browser 無法可靠檢查 `window.open + document.write + print()` popup。

## Verdict

`Approve`

沒有 P0/P1。新版桌次圖 PDF 的資料一致性、主桌排序、legend、20 桌版面、續頁、未分配、特殊字元與 print CSS 隔離均通過；原本 `座位圖` 操作畫面沒有被 wedding print CSS 污染。
