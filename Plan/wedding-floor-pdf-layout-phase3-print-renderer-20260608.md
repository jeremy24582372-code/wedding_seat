# 婚禮桌次圖 PDF 版型 Phase 3 Print Renderer

日期：2026-06-08  
角色：`.agents/agents.md` 的 `@designer`  
範圍：婚禮版型 print renderer  
結論：Phase 3 完成。已建立 export-only A4 婚禮版型 renderer 與 focused smoke；正式「匯出桌次圖」按鈕接線仍保留給 Phase 4。

## Sources Read

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-layout-plan-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase0-baseline-20260608.md`
- `Plan/wedding-floor-pdf-layout-visual-spec-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase2-layout-model-20260608.md`
- `src/utils/weddingFloorPrintLayout.js`
- `src/utils/floorPrintHTMLBuilder.js`
- `src/utils/exportShared.js`
- `src/utils/constants.js`
- `src/hooks/useExport.js`

本次依使用者要求未使用子代理或子查詢。

## Files Changed

| File | Change |
| --- | --- |
| `src/utils/weddingFloorPrintRenderer.js` | 新增 print-only wedding renderer，使用 Phase 2 `buildWeddingFloorLayoutModel(state)` 產生 A4 portrait HTML/CSS/SVG |
| `src/utils/floorPrintHTMLBuilder.js` | 導出 `buildWeddingFloorPrintHTML()`，供 Phase 4 正式接線使用；保留既有 `buildFloorPrintHTML()` 行為 |
| `scripts/check-wedding-floor-print-renderer.mjs` | 新增 Phase 3 renderer smoke，驗證 header、stage、main table、regular grid、legend、完整名單、未分配與 HTML escape |
| `package.json` | 新增 `npm run check:floor-pdf-renderer` |

## Renderer Contract

`buildWeddingFloorPrintHTML(state, options)` 目前會：

- 讀取 Phase 2 layout model，不讀取 live DOM、canvas 或 `tablePositions` 來決定 wedding layout。
- 輸出隔離的 print document HTML，CSS 全部以 `.wfp-` namespace 內嵌在 print HTML。
- 使用 A4 portrait：`@page { size: A4 portrait; margin: 0; }`，第一頁有 header、stage ribbon、主桌、4 欄 x 5 列一般桌 grid、legend 與 warning strip。
- 主桌顯示最多 10 個座位點與姓名名牌；長姓名在圖上截短，完整姓名仍出現在「完整桌次名單」。
- 一般桌以 4 欄 grid 顯示座位點、桌號、`已坐 / 10` 與少量可放入的姓名 callout；完整名單由後續 index page 承接。
- 未分配賓客會出現在 warning strip 與「未分配賓客」完整名單區塊。
- 類別 legend 由 current guests 的 category model 產生，支援自訂分類。
- 花卉角落裝飾使用 print-only inline SVG，不依賴使用者 Downloads 圖片，也不污染 app 操作畫面。

## PDF-LAYOUT Coverage

| ID | Phase 3 Status | Evidence |
| --- | --- | --- |
| PDF-LAYOUT-01 | Covered at renderer smoke level | 完整名單頁輸出主桌、一般桌與未分配賓客；guest count meta 由 Phase 2 model 提供 |
| PDF-LAYOUT-02 | Covered by renderer structure | 主桌區使用 `model.mainTable` 並置於第一頁 stage 下方 |
| PDF-LAYOUT-03 | Covered by fixed renderer geometry | 第一頁使用 A4 mm 尺寸與 4 欄 x 5 列 grid；smoke 驗證輸出不再使用舊 canvas viewBox |
| PDF-LAYOUT-04 | Covered by renderer structure | continuation page 使用 Phase 2 regularTablePages，每頁最多 20 桌 |
| PDF-LAYOUT-05 | Covered by renderer smoke | 自訂分類 `長輩貴賓` 進 legend |
| PDF-LAYOUT-06 | Covered by source boundary | 只新增 print renderer helper，不修改 `FloorPlan`、`TableZone`、app CSS 或 DnD 流程 |
| PDF-LAYOUT-07 | Covered by renderer smoke | 未分配賓客出現在 warning 與完整名單 |
| PDF-LAYOUT-08 | Covered by renderer smoke | `自訂貴賓<&">` 輸出為 escaped HTML |

## Verification

| Command | Result |
| --- | --- |
| `npm run check:floor-pdf-renderer` | Passed：`Wedding floor print renderer checks passed` |
| `npm run check:floor-pdf-layout` | Passed：`Wedding floor PDF layout model checks passed` |
| `node scripts/check-phase4-export-contract.mjs` | Passed：`Phase 4 export contract checks passed` |
| `npm run lint` | Passed |
| `git diff --check` | Passed；僅顯示 Windows CRLF warning |
| `npm run build` | Sandbox run failed with known Vite/Rolldown `spawn EPERM`; after reading `D:\AI知識庫\lessons\043-vite-rolldown-build-spawn-eperm.md`, escalated rerun passed |

Build note：production build 成功，但 Vite 顯示 chunk > 500 kB warning；這是 bundle-size warning，不是 Phase 3 regression。

## Not Run

- 未執行 Browser print preview：本回合未暴露可用的 in-app Browser 控制工具，且 Phase 3 尚未把新版 renderer 接到正式按鈕；桌機 Browser / print window 視覺 QA 留給 Phase 5。
- 未修改 `useExport.js`：正式 `exportFloorPDF()` 接到新版 renderer 是 Phase 4 `@engineer` 責任。
- 未新增靜態花卉圖片資產：目前採 inline SVG fallback，避免依賴外部檔案。

## Risk Review

- P0/P1：未發現。
- 主要殘留風險：新版 renderer 尚未正式接線，使用者按「匯出桌次圖」仍會走舊 `buildFloorPrintHTML()`，需由 Phase 4 完成接線與 export contract 擴充。
- 主要視覺風險：未做實際 print preview 截圖；雖然 mm geometry 與 smoke 通過，最終仍需 Phase 5 用桌機瀏覽器確認列印畫面。
- 字體策略：print HTML 引入 Google Fonts 並保留本機 fallback；Phase 4 若正式接線，應確認 `openPrintDocument()` 對 font loading 的等待或 fallback timer 不會造成體驗退化。

## Review

- 本 Phase 維持畫面與匯出解耦：沒有改動操作用 `FloorPlan`、拖拉流程、Firebase、Google Sheets 或 App 主流程。
- Renderer 消費 Phase 2 layout model，不重新實作主桌判定、排序、分頁或 guest accounting。
- 所有 wedding CSS 都在 print HTML 內，使用 `.wfp-` namespace 與 print-local tokens。
- 後續 Phase 4 應把 `exportFloorPDF()` 改為使用 `buildWeddingFloorPrintHTML(state)`，並更新 `scripts/check-phase4-export-contract.mjs` 驗證新版 wedding markers、font/print guard 與未分配完整名單。

## Next Prompt

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 4：匯出接線與契約測試。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-layout-plan-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase0-baseline-20260608.md`
- `Plan/wedding-floor-pdf-layout-visual-spec-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase2-layout-model-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase3-print-renderer-20260608.md`

目標：
- 將 `exportFloorPDF()` 正式接到 `buildWeddingFloorPrintHTML(state)`。
- 擴充 export smoke，確認 `Jeremy & Yuri`、`主桌 / 舞台`、legend、未分配賓客與特殊字元 escape。
- 確認 `openPrintDocument()` one-shot guard 與 font-loading/fallback 行為沒有退化。
```
