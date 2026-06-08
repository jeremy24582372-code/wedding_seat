# 婚禮桌次圖 PDF 版型 Phase 4 Export Wiring

日期：2026-06-08  
角色：`.agents/agents.md` 的 `@engineer`  
範圍：匯出接線與契約測試  
結論：Phase 4 完成。正式「匯出桌次圖」流程已接到新的婚禮版型 renderer；舊現場座標 SVG 版型以 legacy helper 保留，避免命名混淆。

## Sources Read

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-layout-plan-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase0-baseline-20260608.md`
- `Plan/wedding-floor-pdf-layout-visual-spec-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase2-layout-model-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase3-print-renderer-20260608.md`
- `src/hooks/useExport.js`
- `src/utils/floorPrintHTMLBuilder.js`
- `src/utils/weddingFloorPrintRenderer.js`
- `src/utils/weddingFloorPrintLayout.js`
- `src/utils/printWindow.js`
- `scripts/check-phase4-export-contract.mjs`
- `D:\AI知識庫\lessons\043-vite-rolldown-build-spawn-eperm.md`

## Files Changed

| File | Change |
| --- | --- |
| `src/hooks/useExport.js` | `exportFloorPDF()` now calls `buildWeddingFloorPrintHTML(state)` for the official floor-plan PDF export. |
| `src/utils/floorPrintHTMLBuilder.js` | `buildFloorPrintHTML()` now delegates to the wedding renderer; the previous coordinate/canvas-style SVG renderer is preserved as `buildLegacyFloorPrintHTML()`. |
| `scripts/check-phase4-export-contract.mjs` | Expanded smoke coverage for wedding renderer markers, meta, stage ribbon, legend, unassigned guests, special-character escaping, official renderer wiring, legacy helper naming, and one-shot print guard. |

## Export Contract After Phase 4

- Official `exportFloorPDF()` defaults to the wedding stationery print renderer.
- `buildFloorPrintHTML(state, options)` is now the official floor-plan export entry and returns the same HTML as `buildWeddingFloorPrintHTML(state, options)`.
- The old coordinate renderer remains available only as `buildLegacyFloorPrintHTML(state)` and is not used by the current UI export hook.
- The export remains state-driven print HTML/CSS/SVG through `openPrintDocument()`; no `FloorPlan` DOM snapshot, `html2canvas`, or `jspdf` path was introduced.
- `openPrintDocument()` one-shot guard remains unchanged and is still covered by the contract smoke.
- Google Sheets sync output schema, Firebase schema, DnD, `FloorPlan`, `TableZone`, and app CSS were not changed.

## Verification

| Command | Result |
| --- | --- |
| `node scripts/check-phase4-export-contract.mjs` | Passed: `Phase 4 export contract checks passed` |
| `npm run check:floor-pdf-layout` | Passed: `Wedding floor PDF layout model checks passed` |
| `npm run check:floor-pdf-renderer` | Passed: `Wedding floor print renderer checks passed` |
| `npm run lint` | Passed |
| `git diff --check` | Passed with Windows CRLF warnings only |
| `npm run build` | Sandbox run failed with known Vite/Rolldown `spawn EPERM`; after checking lesson 043, escalated rerun passed |

Build note：production build succeeded with the existing Vite chunk-size warning for `dist/assets/index-*.js`; this is not a Phase 4 regression.

## PDF-LAYOUT Coverage

| ID | Phase 4 Status | Evidence |
| --- | --- | --- |
| PDF-LAYOUT-01 | Covered by contract smoke | Wedding floor HTML meta verifies `實際人數：4 位`; existing JSON/CSV/seating-list contracts still match guest count. |
| PDF-LAYOUT-02 | Covered by renderer wiring | Contract sample uses `主桌`; HTML must contain `主桌 / 舞台` and `.wfp-main-table`. |
| PDF-LAYOUT-03 | Partially covered | Official export no longer contains the old `1850 x 2400` canvas viewBox and uses the Phase 3 A4 renderer; final visual overlap check remains Phase 5 Browser/print QA. |
| PDF-LAYOUT-04 | Covered by layout/renderer smoke | Phase 2/3 smoke still verifies pagination structure; final visual continuation-page QA remains Phase 5. |
| PDF-LAYOUT-05 | Covered by contract smoke | Contract sample includes custom category `長輩貴賓`, and HTML must include it in the wedding output. |
| PDF-LAYOUT-06 | Covered by source boundary | Phase 4 changed only export hook, export builder entry, and smoke script; no app UI CSS or `FloorPlan` files changed. |
| PDF-LAYOUT-07 | Covered by contract smoke | Contract sample includes unassigned guests; HTML must include `未分配賓客`. |
| PDF-LAYOUT-08 | Covered by contract smoke | Contract sample includes `自訂貴賓<&">`; HTML must include escaped `自訂貴賓&lt;&amp;&quot;&gt;`. |

## Not Run

- Desktop Browser print-preview verification was not run in this phase. Phase 4 scope is wiring plus contract tests; final visual and no-UI-regression proof belongs to Phase 5 `@qa`.
- Production Google Sheets/Firebase integration was not run because this phase does not touch those contracts and should not mutate live data.

## Risk Review

- P0/P1：未發現。
- Residual risk：actual browser print dialog and rendered page overlap still need Phase 5 QA evidence.
- Residual risk：remote Google Fonts may load after the bounded print fallback in slow networks; renderer keeps local font fallback, and Phase 5 should check the print window behavior.

## Next Prompt

```text
請以 `.agents/agents.md` 中的 @qa 角色執行 Phase 5：最終視覺與資料 QA Gate。

必讀：
- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-layout-plan-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase0-baseline-20260608.md`
- `Plan/wedding-floor-pdf-layout-visual-spec-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase2-layout-model-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase3-print-renderer-20260608.md`
- `Plan/wedding-floor-pdf-layout-phase4-export-wiring-20260608.md`

目標：
- 驗證正式「匯出桌次圖」PDF 已自動轉為婚禮版型。
- 以桌機 Browser/print HTML 預覽確認資料一致性、版面不重疊、未分配清單、特殊字元 escape，以及 `FloorPlan` 操作畫面未被 print CSS 影響。
```
