# 婚禮桌次圖 PDF 版型 Phase 0 QA Baseline

日期：2026-06-08  
角色：`.agents/agents.md` 的 `@qa`  
範圍：匯出基線與不變式盤點  
結論：Phase 0 baseline 建立完成；目前既有 export contract 驗證通過，但新的婚禮卡片式版型仍屬後續 Phase 1-4 待實作。

## 來源與讀取範圍

已讀取：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/wedding-floor-pdf-layout-plan-20260608.md`
- `Plan/best-execution-plan-phase0-qa-baseline-20260604.md`
- `Plan/best-execution-plan-phase4-export-contract-20260604.md`
- `src/hooks/useExport.js`
- `src/utils/floorPrintHTMLBuilder.js`
- `src/utils/exportShared.js`
- `src/utils/printWindow.js`
- `scripts/check-phase4-export-contract.mjs`

未讀取完整 `src/`。本 Phase 只依 `@qa` 的單批次 source review 原則檢查 export contract 相關檔案。

## 單批次 Source Review 規劃

本次 Phase 0 只檢查 PDF export contract，不做全專案 code review。

| Batch | 檔案 | 目的 | 狀態 |
| --- | --- | --- | --- |
| PDF Export Contract | `src/hooks/useExport.js`, `src/utils/floorPrintHTMLBuilder.js`, `src/utils/exportShared.js`, `src/utils/printWindow.js`, `scripts/check-phase4-export-contract.mjs` | 確認桌次圖 PDF 是 state-driven print HTML/SVG，且 one-shot print guard 與既有 smoke test 仍成立 | Done |

## 目前桌次圖 PDF Export Contract

| 項目 | 目前行為 | QA 判定 |
| --- | --- | --- |
| Export entry | `useExport(state)` 回傳 `exportFloorPDF()`；由 Toolbar/Dashboard 觸發 | Passed |
| Renderer | `exportFloorPDF()` 呼叫 `buildFloorPrintHTML(state)` 建立完整 HTML | Passed |
| Print mechanism | `openPrintDocument()` 開新視窗，寫入 HTML 後列印 | Passed |
| State source | 只讀 `state.guests`, `state.tables`, `state.tablePositions`, `state.partyRows` 等記憶體 state | Passed |
| Live canvas dependency | 不傳入 `floorPlanRef`，不讀 `FloorPlan` DOM，不做 screenshot | Passed |
| Screenshot packages | 目前 contract 不依賴 `html2canvas` / `jspdf` | Passed |
| One-shot guard | `printWindow.js` 用 `printed` guard 避免 load timer 與 fallback timer 重複列印 | Passed |
| Existing smoke | `node scripts/check-phase4-export-contract.mjs` 驗證 CSV/JSON/座位清單 PDF/桌次圖 PDF/print guard | Passed |

## 目前基線差距

以下不是 Phase 0 要修的問題，而是後續 Phase 必須處理的已知 gap。

| Gap | 目前狀態 | 後續歸屬 |
| --- | --- | --- |
| 婚禮卡片式版型 | 目前是既有 canvas-position SVG 版型，尚不是參考圖風格 | Phase 1 / Phase 3 |
| 主桌特殊排版 | 目前沒有依 `主桌` / `1桌` 規則抽出主桌置中；所有桌依 `tablePositions` 繪製 | Phase 2 |
| 一般桌自然排序 | 目前依 `state.tables` 與 `tablePositions`，不是 export-only 自然桌號排序 | Phase 2 |
| 20 桌內單頁 grid | 目前沒有固定 4 欄婚禮版型，也沒有 20 桌內單頁保證 | Phase 2 / Phase 3 |
| 超過 20 桌分頁 | 目前以單一 SVG canvas 呈現，不保證大量桌次不重疊 | Phase 2 / Phase 3 |
| 未分配 guest 明細 | 目前桌次圖 PDF meta 顯示實際人數，但未分配 guest 沒有明確清單或警示區 | Phase 2 / Phase 3 |
| 本地日期 | `formatExportDate()` 使用 `toISOString().slice(0, 10)`，可能在台灣時區跨日 | Phase 2 |
| 長姓名完整追溯 | 目前座位圓點只截前 4 字，缺少完整名單追溯區 | Phase 3 |

## PDF-LAYOUT QA Matrix

| ID | 驗收目標 | 測試資料 | 驗收標準 | Phase 0 基線狀態 | 後續 Owner |
| --- | --- | --- | --- | --- | --- |
| PDF-LAYOUT-01 | guest count 與 state 一致 | 含已分配、未分配、同行 seat-unit 的 state | PDF meta、明細與可追溯 guest 數皆等於 `state.guests.length` | Existing smoke 只驗 meta；後續需擴充明細驗證 | Phase 2 / Phase 4 / Phase 5 |
| PDF-LAYOUT-02 | 主桌判定正確 | label 為 `主桌`、含 `主桌`、`1桌`、以及 fallback 案例 | 判定順序為完全等於 `主桌` -> 包含 `主桌` -> 可解析 `1桌` -> `tables[0]`；主桌在 PDF 上方中央 | 尚未支援特殊主桌抽取 | Phase 2 / Phase 5 |
| PDF-LAYOUT-03 | 20 桌內單頁不重疊 | 1 主桌 + 19 一般桌，每桌 0-10 人混合 | A4 portrait 內 header、stage、主桌、4 欄桌次 grid、legend 不重疊 | 尚未支援固定 wedding grid | Phase 1 / Phase 2 / Phase 3 / Phase 5 |
| PDF-LAYOUT-04 | 超過 20 桌不重疊或有明確續頁 | 1 主桌 + 20 以上一般桌 | 產生續頁或明確分頁 model；不得壓縮重疊或截斷 | 尚未支援分頁 model | Phase 2 / Phase 3 / Phase 5 |
| PDF-LAYOUT-05 | 類別 legend 與目前 guests 類別一致 | 內建類別與自訂分類混合 | Legend 包含目前 state 會用到的 guest 類別；自訂分類有穩定 fallback 視覺 | 目前 `buildCategoryOptions(guests)` 已依 guests 產生 legend；後續需維持 | Phase 3 / Phase 5 |
| PDF-LAYOUT-06 | 操作畫面 `FloorPlan` 不受匯出樣式影響 | 開啟 app 後匯出桌次圖，再回到座位圖 | Print CSS 只存在 print window，不污染 app dark-mode 工具 UI；`FloorPlan.jsx` 不因版型改造被重寫 | 目前 print CSS 內嵌於 HTML，未污染 app UI；後續需回歸驗證 | Phase 3 / Phase 5 |
| PDF-LAYOUT-07 | 未分配 guests 在 PDF 內有明確提示或清單 | 含 `unassignedGuestIds` 與 `tableId=null` guests | 未分配 seat-unit 不可被靜默遺漏；需有底部警示、清單或續頁完整列出 | 目前桌次圖 PDF 未列出未分配 guest 明細 | Phase 2 / Phase 3 / Phase 5 |
| PDF-LAYOUT-08 | 特殊字元不破版且不可注入 HTML | 姓名、桌名、群組名含 `<`, `&`, `"`, `>` | 所有 visible text 進 HTML/SVG 前必須 escape；特殊字元以文字顯示，不執行、不破壞 DOM | 目前 builder 對桌名與座位姓名使用 `escHtml()`；後續新增欄位必須同樣處理 | Phase 2 / Phase 3 / Phase 4 / Phase 5 |

## 後續 Phase 不可破壞的不變式

| ID | 不變式 | 驗證重點 |
| --- | --- | --- |
| WFP-INV-01 | 桌次圖 PDF 必須維持 state-driven print HTML/SVG | 不可重新引入 live canvas screenshot、`html2canvas` 或 `jspdf` |
| WFP-INV-02 | `FloorPlan` 操作畫面與 export renderer 解耦 | 不因婚禮版型改造修改拖拉 canvas 的日常視覺與互動 |
| WFP-INV-03 | PDF guest count 必須等於 `state.guests.length` | 已分配、未分配、同行 seat-unit 都要被計入且可追溯 |
| WFP-INV-04 | 每桌 10 人硬限制不可被 export model 放寬 | PDF 可顯示空位或警示，但不得把第 11 人塞入同桌 |
| WFP-INV-05 | 未分配 guests 不可靜默遺漏 | PDF 需顯示警示、清單或續頁，讓場地方可追溯 |
| WFP-INV-06 | 主桌判定需使用計畫書規則 | `主桌` 優先於 `1桌`，再 fallback 到 `tables[0]` |
| WFP-INV-07 | 一般桌排序需使用自然排序 | 數字桌號優先，無數字 label 保持原始順序後置 |
| WFP-INV-08 | Print CSS 必須被隔離在 print document | 不匯入 app 全域 CSS，不污染 `App.css` / `FloorPlan.css` |
| WFP-INV-09 | 所有 visible text 必須 HTML escape | 姓名、桌名、群組名、分類 label、warning text 都要 escape |
| WFP-INV-10 | 匯出日期需使用瀏覽器本地日期 | 避免 UTC `toISOString()` 在台灣時區跨日 |
| WFP-INV-11 | `openPrintDocument()` one-shot guard 不可退化 | load handler 與 fallback timer 同時觸發時仍只能 print 一次 |
| WFP-INV-12 | JSON / CSV / 座位清單 PDF contract 不可因桌次圖改造退化 | Phase 4 smoke 必須持續涵蓋既有 EXP-01~EXP-05 |
| WFP-INV-13 | 不新增大型 npm 套件 | 若需花卉資產，使用 print-only CSS/SVG 或專案內靜態資產 |
| WFP-INV-14 | 不改 Google Sheets sync output schema 與 Firebase schema | 本次只改 export-only layout，不影響外部資料契約 |

## 驗證結果

| 指令 | 結果 | 證據 |
| --- | --- | --- |
| `node scripts/check-phase4-export-contract.mjs` | Passed | 輸出 `Phase 4 export contract checks passed` |

本 Phase 未執行 Browser runtime，原因是 Phase 0 只建立基線與 matrix，且不修改 `src/`。Runtime / print preview 應在 Phase 5 QA Gate 執行。

## Review

- 本 Phase 沒有修改 `src/`、`package.json`、Firebase、Google Sheets 或 UI。
- 目前既有桌次圖 PDF contract 可以作為改造前基線：它是 state-driven print HTML/SVG，且 one-shot print guard smoke 通過。
- 後續 Phase 2 必須先建立 export-only layout model，再交由 Phase 3 做 print renderer；不應直接在 `FloorPlan` 或既有 canvas DOM 上套婚禮樣式。
- 若後續任一 Phase 修正 `formatExportDate()`，要同步檢查 JSON / CSV 檔名與其他 export 是否受影響。
- Phase 5 最終 QA 必須重新跑 `PDF-LAYOUT-01` 到 `PDF-LAYOUT-08`，並補桌機 Browser 或 local print HTML 預覽證據。
