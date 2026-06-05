# Phase 4 匯出契約與依賴瘦身

日期：2026-06-04  
角色：`.agents/agents.md` 的 `@engineer`  
來源：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/best-execution-plan-from-qa-reviews-20260604.md`
- `Plan/best-execution-plan-phase0-qa-baseline-20260604.md`

## 執行範圍

Phase 4 聚焦匯出契約與 dependency cleanup，不處理 DnD / App state 大型模組化。

## 狀態追蹤

| 項目 | 狀態 | 備註 |
| --- | --- | --- |
| 讀取 `@engineer` 角色與專案 context | Done | 已確認桌次 10 人限制、匯出與 Firebase/Google Sheets contract |
| 讀取 Phase 0 baseline / Phase 4 需求 | Done | 驗收聚焦 EXP-01~EXP-05 |
| PDF one-shot print guard | Done | `printWindow.js` 以 `printOnce()` 防止 load listener 與 fallback timeout 重複觸發 |
| 匯出契約拆分 | Done | `useExport.js` 收斂為 hook；builders 拆至 `src/utils/` |
| CSV 群組與鎖定欄位 | Done | 增加 `群組名稱`、`群組偏好`、`鎖定狀態` |
| Dashboard 桌次圖匯出入口 | Done | 總覽頁 primary actions 與快速處理區都可匯出桌次圖 |
| 移除 unused dependencies | Done | `html2canvas` / `jspdf` 已自 `package.json` 與 lockfile 移除 |
| 驗證 | Done | focused export smoke / Phase 1-3 smoke / rules / lint / build / Browser runtime / diff check |

## 匯出契約

| 格式 | 定位 | 欄位/內容要求 |
| --- | --- | --- |
| JSON | 完整還原級備份 | 保留目前 AppState，包含 guests、tables、tablePositions、unassignedGuestIds、partyRows、guestGroups、seatingRules、lockedAssignments |
| CSV/Excel | 作業交接格式 | 一列一個 seat-unit，含桌次、來源姓名、人數、同行角色、分類、飲食、群組名稱、群組偏好、鎖定狀態 |
| 座位清單 PDF | 列印/場地方作業格式 | 以目前 state 產生座位清單；需顯示總 guest count，未分配名單不得遺漏 |
| 桌次圖 PDF | 列印/場地方作業格式 | 使用 tablePositions 重建桌次位置圖；不可依賴 canvas screenshot |

## 驗收矩陣

| Matrix ID | 本 Phase 處理方式 | 狀態 |
| --- | --- | --- |
| EXP-01 | JSON export 保持完整 state 備份 | Passed |
| EXP-02 | CSV/Excel guest count 與群組/鎖定欄位驗證 | Passed |
| EXP-03 | 座位清單 print HTML guest count 驗證 | Passed |
| EXP-04 | 桌次圖 print HTML guest count 與 one-shot guard 驗證 | Passed |
| EXP-05 | 空 state export 不 crash | Passed |

## Review

### 變更摘要

- 新增 `src/utils/exportShared.js`、`csvExportBuilder.js`、`jsonExportBuilder.js`、`printHTMLBuilder.js`、`floorPrintHTMLBuilder.js`、`printWindow.js`。
- `src/hooks/useExport.js` 只保留 browser-facing export hook；PDF 改由 state-driven print HTML/SVG builder 產生。
- CSV/Excel 現在一列一個 seat-unit，並輸出群組與鎖定資訊。
- `DashboardHome` 新增「匯出桌次圖」入口；`App.jsx` 移除 `exportPDF(floorPlanRef)` 假相依。
- 移除 `html2canvas` / `jspdf` 與其 transitive dependencies。
- `.agents/context.md` 已同步 export contract 與 dependencies。

### 驗證結果

| 指令 | 結果 | 備註 |
| --- | --- | --- |
| `node scripts/check-phase4-export-contract.mjs` | Passed | EXP-01~EXP-05、CSV 欄位、HTML guest count、one-shot print guard |
| `node scripts/check-phase1-data-integrity.mjs` | Passed | Phase 1 回歸 |
| `node scripts/check-phase2-google-sheets-sync.mjs` | Passed | Phase 2 回歸 |
| `node scripts/check-phase3-auto-seat-groups.mjs` | Passed | Phase 3 回歸 |
| `npm run rules:check` | Passed | RTDB rules check passed |
| `npm run lint` | Passed | ESLint 0 errors |
| `git diff --check` | Passed | 只有既有 CRLF warning，無 whitespace error |
| `npm run build` | Passed with known warning | 沙盒內命中已知 Vite/Rolldown `spawn EPERM`；沙盒外 build 成功，保留既有 chunk-size warning |
| Browser runtime | Passed | `http://127.0.0.1:5173/wedding_seat/` 登入後總覽頁顯示「匯出座位表」與「匯出桌次圖」，console 0 error/warn；5173 server 已清理 |

### Matrix 回報

- 已跑：EXP-01、EXP-02、EXP-03、EXP-04、EXP-05。
- 未跑：無。
- 新增不變式：無；沿用 INV-13、INV-14。
- P0/P1 未處理：Phase 4 範圍內無未處理項。`npm audit` 仍顯示 3 個既有 finding，未在本 Phase 自動修正以避免非目標依賴升級。
