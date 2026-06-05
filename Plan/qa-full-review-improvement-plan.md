# QA 全面審查 — 建議修改計畫書

> 審查角色：`@qa`（`.agents/agents.md`）  
> 審查範圍：Phase 0–5 完成後的完整程式碼庫  
> 日期：2026-06-02  
> 版本：v1.0

## 審查摘要

Phase 0–5 已全部完成，核心功能（匯入、拖拉、自動排座、群組鎖定、匯出、Firebase 同步）運作正常。以下是 @qa 角色在全面程式碼審查後發現的改善項目，按嚴重程度分級並規劃為可執行的 Phase。

---

## 發現清單

### 🔴 Critical（必修 — 影響可維護性或正確性）

| # | 檔案 | 問題 | 影響 |
|---|------|------|------|
| C1 | `src/App.jsx` | 552 行，混合 DnD handler、import handler、auto-seat handler、modal state、lock prompt；違反 agents.md「元件 < 150 行」規範 | 任何功能修改都要碰這個巨型檔案，風險擴散 |
| C2 | `src/hooks/useSeatingState.js` | 689 行，包含所有 guest/table/group/lock/import 操作 + Firebase listener + debounce；單一 hook 承載過多職責 | 無法獨立測試子功能，任何改動需 review 整個檔案 |
| C3 | `package.json` | `html2canvas` 與 `jspdf` 仍在 dependencies，但 `useExport.js` 已完全改用 print window 方案，這兩個套件未被使用 | 增加 ~800KB bundle 體積，部署時多下載無用資源 |
| C4 | `src/hooks/useSeatingState.js` (L417–L431) | `removeGuest` 會清理 `partyRows` 和 `guestGroups`，但 `removeTable` 只把賓客移回未分配，**沒有清理 `lockedAssignments`** 中被釋放賓客的鎖定狀態 | 刪桌後鎖定賓客移回未分配池，但鎖定標記仍在，auto-seat 會認為這些未分配賓客被鎖定而跳過 |
| C5 | `src/hooks/useExport.js` | 640 行，`buildPrintHTML` 和 `buildFloorPrintHTML` 各約 200 行 inline HTML/CSS 字串，缺乏結構化與可測試性 | 匯出 PDF 格式微調需要在巨大字串中找位置，容易引入 HTML injection |

### 🟡 Warning（建議修正 — 影響使用者體驗或資料品質）

| # | 檔案 | 問題 | 影響 |
|---|------|------|------|
| W1 | `src/App.jsx` (L283–L333) | DnD `handleDragEnd` 有 primary (dnd-kit `over`) 和 fallback (`elementFromPoint`) 兩套路徑，邏輯完全重複（swap 判斷 + moveGuest），違反 DRY | 修改其中一條路徑時容易漏改另一條 |
| W2 | `src/components/FloorPlan.jsx` | 640 行，混合 canvas pan、wheel zoom、grid snap、smart guide、multi-select、inline rename、table drag 七種互動；遠超 150 行上限 | 互動 bug 難以隔離定位 |
| W3 | `src/components/TableZone.jsx` (L282–L292) | 「刪除此桌」按鈕沒有二次確認，直接 `onRemove(table.id)` — 但桌上可能有 10 位已安排賓客 | 誤觸會一次把整桌賓客移回未分配，且因 C4 鎖定不清理，auto-seat 無法自動恢復 |
| W4 | `src/utils/importGuests.js` (L118–L123) | 匯入來源列內的 `name` 重複時計入 `skipped`，但後續相同 `sourceName` 的 `existingParty` 比對也可能再次 skip — `skipped` 計數可能與使用者理解不一致 | Toast 提示「略過 N 筆重複」可能包含來源端內部重複和已匯入重複，使用者難以判斷 |
| W5 | `src/hooks/useExport.js` (L30–L38) | CSV 匯出不包含群組名稱、群組偏好和鎖定狀態 | 匯出後無法還原群組設定；婚禮當天紙本也看不到鎖定人員 |
| W6 | `src/utils/autoSeatPlanner.js` + `src/utils/importGuests.js` | 兩個檔案各自定義了 `emptySeats()` 和 `deriveGuestTableState()` 函式，完全重複 | 修改一處時必須同步修改另一處，否則行為分歧 |

### 🔵 Info（可延後 — 改善品質但不阻塞使用）

| # | 檔案 | 問題 | 影響 |
|---|------|------|------|
| I1 | `src/hooks/useSeatingState.js` (L197–L211) | Firebase listener 的 `lastSaved` 比較使用 `new Date()` 字串比較，若本地與 Firebase 時鐘有偏移，可能出現 false positive 或 false negative | 跨裝置同步時可能覆蓋較新資料或拒絕較新資料 |
| I2 | `src/components/DashboardHome.jsx` | 匯出 PDF 按鈕只呼叫 `exportPDF`（表格版），沒有提供「匯出桌次圖」的入口 — 必須進座位圖分頁才能用 | 使用者可能不知道桌次圖匯出功能存在 |
| I3 | `src/utils/constants.js` (L127) | `STORAGE_KEY = 'wedding-seating-v1'` 宣告了但搜尋全專案無人使用 | 死碼 |
| I4 | `src/App.jsx` (L409–L420) | Firebase status badge 在 `AppShell` children 內重複渲染 — `AppShell` 已接收 `firebaseStatus` prop 並可能自己渲染 | 可能出現兩個 Firebase badge |
| I5 | 全域 | 缺乏自動化測試：無 unit test、無 integration test、無 snapshot test | 每次修改只能靠人工 smoke test 驗證 |
| I6 | `src/components/UnassignedPool.jsx` (L14) | props 解構中接收了 `onMoveToUnassigned`（在 JSDoc 中定義），但實際 caller `App.jsx` 傳的是 `onMoveToUnassigned`，而 `UnassignedPool` 內部未使用此 prop — 只用 droppable | 誤導閱讀者；可移除 |
| I7 | `src/App.css` | 18KB 單檔包含全域 design token + 多元件樣式，搜尋 token 困難 | token 與元件樣式分離可改善維護性 |

---

## Phase 規劃

> 規則：每個 Phase 只能指定一個 `.agents/agents.md` 角色執行。

| 執行順序 | Phase | 使用角色 | 修正項目 | 主責成果 |
|---------|-------|---------|---------|---------|
| 1 | Phase 6：死碼清理與依賴瘦身 | `@engineer` | C3, I3, I6, W6 | 移除未使用依賴、死碼、重複工具函式 |
| 2 | Phase 7：App.jsx 與 useSeatingState 拆分 | `@engineer` | C1, C2, W1 | 將 App.jsx 拆為 < 150 行 + 子元件/hooks；useSeatingState 拆為多個 focused hooks |
| 3 | Phase 8：FloorPlan 互動邏輯抽離 | `@designer` | W2 | 將 pan/zoom/snap/guide/multiselect 抽為 custom hooks，FloorPlan.jsx 降到 < 200 行 |
| 4 | Phase 9：資料完整性補強 | `@engineer` | C4, W3, W4 | 修正 removeTable 鎖定清理、刪桌二次確認、匯入 skip 計數語意 |
| 5 | Phase 10：匯出功能增強 | `@engineer` | C5, W5, I2 | 拆分匯出 HTML builder、CSV 加入群組/鎖定欄位、總覽加入桌次圖匯出 |
| 6 | Phase 11：Firebase 同步防護 | `@engineer` | I1, I4 | 改進 lastSaved 比較策略、消除重複 Firebase badge |
| 7 | Phase 12：UI 一致性整理 | `@designer` | I7 | 拆分 App.css 為 design-tokens.css + 各元件 CSS 歸位 |
| 8 | Phase 13：QA 綜合驗收 | `@qa` | I5 + 全部 | 建立基礎 smoke test checklist 並驗證所有修正不回歸 |

---

## Phase 詳細說明

### Phase 6：死碼清理與依賴瘦身（`@engineer`）

**目標**：清除未使用的依賴和重複程式碼，降低 bundle 體積並統一工具函式。

**範圍**：
- 移除 `html2canvas` 和 `jspdf` 從 `package.json`（C3）
- 移除 `STORAGE_KEY` 常數（I3）
- 移除 `UnassignedPool` 中未使用的 `onMoveToUnassigned` prop（I6）
- 合併 `autoSeatPlanner.js` 和 `importGuests.js` 中重複的 `emptySeats()` 和 `deriveGuestTableState()` 到共用模組（W6）

**驗收**：
- `npm run lint` 與 `npm run build` 通過
- bundle 體積明顯減少（記錄前後 chunk 大小）
- 所有匯出功能不受影響
- 匯入 → auto-seat → 匯出流程 smoke test 通過

---

### Phase 7：App.jsx 與 useSeatingState 拆分（`@engineer`）

**目標**：將兩個超大檔案拆為職責分明的小模組，遵守「< 150 行 / 元件」原則。

**範圍**：
- `App.jsx` 拆分方向：
  - 抽離 DnD handlers → `hooks/useDndHandlers.js`
  - 抽離 import handler → `hooks/useImportHandler.js`（或合併至 `useGoogleSheets`）
  - 抽離 auto-seat handler → `hooks/useAutoSeatHandler.js`
  - 抽離 lock prompt 邏輯 → `hooks/useLockPrompt.js`
  - 保留 App.jsx 只負責佈局 + props 傳遞
- `useSeatingState.js` 拆分方向：
  - `useSeatingCRUD.js` — guest/table CRUD
  - `useSeatingGroups.js` — group/lock 操作
  - `useSeatingFirebase.js` — Firebase debounce + listener
  - `useSeatingState.js` — 組合上述 hooks + 對外 API
- DnD `handleDragEnd` 去重：提取共用 `resolveDrop(guestId, target)` 函式（W1）

**驗收**：
- App.jsx < 150 行
- 任何單一 hook 檔 < 200 行
- 全部拖拉、匯入、auto-seat、群組鎖定流程 smoke test 不回歸
- `npm run lint` 與 `npm run build` 通過

---

### Phase 8：FloorPlan 互動邏輯抽離（`@designer`）

**目標**：降低 FloorPlan.jsx 複雜度，將七種互動邏輯抽為可測試的 custom hooks。

**範圍**：
- `hooks/useCanvasPan.js` — pan + reset
- `hooks/useCanvasZoom.js` — wheel zoom
- `hooks/useTableDrag.js` — table reposition + multi-select drag
- `hooks/useSmartGuides.js` — snap-to-grid + smart guide computation
- `hooks/useTableSelection.js` — multi-select toggle
- FloorPlan.jsx 只保留佈局 + 組合 hooks

**驗收**：
- FloorPlan.jsx < 200 行
- pan、zoom、snap、guide、multi-select 全部功能不回歸
- 桌子拖拉精度與吸附行為與修改前一致
- `npm run lint` 與 `npm run build` 通過

---

### Phase 9：資料完整性補強（`@engineer`）

**目標**：修正影響資料正確性的邊界情況。

**範圍**：
- `removeTable` 新增 `lockedAssignments` 清理（C4）：
  - 被釋放的賓客 → 清除 `lockedAssignments[guestId]`
- `TableZone` 「刪除此桌」新增二次確認（W3）：
  - 桌上有賓客時顯示 `window.confirm("此桌有 N 位賓客，確定刪除？")`
  - 空桌可直接刪除
- 匯入 `skipped` 計數語意修正（W4）：
  - 區分「來源內部重複」vs「已存在的重複」，Toast 分別顯示
  - 或將兩者合併為「略過 N 筆（M 筆來源重複 + K 筆已匯入）」

**驗收**：
- 刪桌後鎖定賓客回到未分配池 → `lockedAssignments` 不包含該賓客 → auto-seat 可正常處理
- 誤觸「刪除此桌」有機會取消
- 匯入重複提示與實際行為一致
- `npm run lint` 與 `npm run build` 通過

---

### Phase 10：匯出功能增強（`@engineer`）

**目標**：改善匯出品質與可維護性。

**範圍**：
- 拆分 `useExport.js`（C5）：
  - `utils/printHTMLBuilder.js` — 表格版 HTML
  - `utils/floorPrintHTMLBuilder.js` — 桌次圖版 SVG
  - `useExport.js` 只保留 hook interface（< 50 行）
- CSV 匯出增加欄位（W5）：
  - `群組名稱`、`群組偏好`、`鎖定狀態`
- 總覽加入「匯出桌次圖」CTA（I2）

**驗收**：
- 表格版 PDF、桌次圖 PDF、CSV、JSON 匯出內容與修改前一致（+ 新增欄位）
- CSV round-trip 檢驗：匯出後檢查欄位數與資料完整性
- `npm run lint` 與 `npm run build` 通過

---

### Phase 11：Firebase 同步防護（`@engineer`）

**目標**：減少跨裝置同步的 edge case 風險。

**範圍**：
- 改進 `lastSaved` 比較策略（I1）：
  - 考慮使用 Firebase server timestamp 或 monotonic counter 取代 client-side ISO 8601
  - 最小改動：改用 epoch ms 比較取代字串 `new Date()` 比較
- 消除重複 Firebase badge（I4）：
  - 確認 `AppShell` 是否已渲染 badge，若是，移除 `App.jsx` 中的重複區塊

**驗收**：
- 開兩個分頁同步編輯，不出現舊資料覆蓋新資料
- Firebase badge 只出現一個
- `npm run lint` 與 `npm run build` 通過

---

### Phase 12：UI 一致性整理（`@designer`）

**目標**：改善 CSS 架構，方便後續維護。

**範圍**：
- 從 `App.css`（18KB）拆分出 `design-tokens.css`（I7）：
  - 全域 CSS custom properties → `design-tokens.css`
  - 元件樣式歸位至各自 `.css` 檔
  - `App.css` 只保留 layout skeleton
- 檢查 WCAG AA 對比度（agents.md 要求 colorblind simulation）
- 確認 390px 行動寬度下分頁、統計卡、按鈕不重疊

**驗收**：
- `App.css` < 100 行
- `design-tokens.css` 包含所有 `--color-*`、`--font-*`、`--spacing-*` token
- 桌機 + 390px 行動寬度視覺無回歸
- `npm run lint` 與 `npm run build` 通過

---

### Phase 13：QA 綜合驗收（`@qa`）

**目標**：驗證所有修正不回歸，建立可重複使用的 smoke test checklist。

**範圍**：
- 按 @qa Execution Protocol 分批次讀取修改後程式碼
- 驗證重點：
  - 10 人桌硬限制（所有路徑）
  - headcount / party / seat-unit 統計一致性
  - Firebase fallback 與 reload 後資料完整性
  - 匯入 → 拖拉 → auto-seat → 匯出 → sync sheets 全流程
  - 群組/鎖定 → auto-seat → 手動覆蓋 → Firebase reload
  - 刪桌 → 鎖定清理 → auto-seat
  - 匯出 round-trip：JSON 匯出 → 比對記憶體 state
- 產出 `qa_report.md`

**驗收**：
- 所有 🔴 Critical 修正通過驗收
- 所有 🟡 Warning 修正通過驗收
- 不需要回滾任何 Phase
- `npm run lint` 與 `npm run build` 通過

---

## Phase + Prompt 建議指令

### Phase 6 Prompt（`@engineer`）

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 6：死碼清理與依賴瘦身。

必讀：
- `.agents/context.md`
- `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`（Phase 0–5 紀錄）
- `Plan/qa-full-review-improvement-plan.md`（本計畫書）

目標：
- 移除 `html2canvas` 和 `jspdf` 依賴（已改用 print window，不再使用）。
- 移除 `constants.js` 中未使用的 `STORAGE_KEY`。
- 移除 `UnassignedPool.jsx` 中未使用的 `onMoveToUnassigned` prop。
- 合併 `autoSeatPlanner.js` 和 `importGuests.js` 中重複的 `emptySeats()` 和 `deriveGuestTableState()` 到共用模組 `src/utils/stateHelpers.js`。

限制：
- 不做 UI 重構或新功能。
- 所有匯出功能必須不受影響。

驗收：
- `npm uninstall html2canvas jspdf` 後 `npm run build` 通過。
- bundle chunk 體積記錄前後比較。
- 匯入 → auto-seat → 匯出 smoke test 通過。
- `npm run lint` 通過。
```

---

### Phase 7 Prompt（`@engineer`）

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 7：App.jsx 與 useSeatingState 拆分。

必讀：
- `.agents/context.md`
- `Plan/qa-full-review-improvement-plan.md`（C1、C2、W1）

目標：
- 將 App.jsx 從 552 行拆為 < 150 行 + 子 hooks：
  - `hooks/useDndHandlers.js` — DnD start/end/cancel + lock prompt
  - `hooks/useImportHandler.js` — import flow + toast messaging
  - `hooks/useAutoSeatHandler.js` — preview + apply + modal state
  - DnD `handleDragEnd` 去重：提取共用 `resolveDrop()` 消除 primary/fallback 重複邏輯
- 將 useSeatingState.js 從 689 行拆為多個 focused hooks。

限制：
- 對外 API 不變，App.jsx 仍然是唯一入口。
- 不改資料模型或 Firebase schema。
- 所有拖拉、匯入、auto-seat、群組鎖定流程不回歸。

驗收：
- App.jsx < 150 行，任何單一 hook < 200 行。
- `npm run lint` 與 `npm run build` 通過。
- 全流程 smoke test 通過。
```

---

### Phase 8 Prompt（`@designer`）

```text
請以 `.agents/agents.md` 中的 @designer 角色執行 Phase 8：FloorPlan 互動邏輯抽離。

必讀：
- `.agents/context.md`
- `Plan/qa-full-review-improvement-plan.md`（W2）

目標：
- 將 FloorPlan.jsx（640 行）中的互動邏輯抽為 custom hooks：
  - `hooks/useCanvasPan.js` — canvas pan + reset
  - `hooks/useCanvasZoom.js` — wheel zoom
  - `hooks/useTableDrag.js` — table reposition + multi-select drag + smart guide + snap
  - `hooks/useTableSelection.js` — multi-select toggle
- FloorPlan.jsx 只保留佈局 + hooks 組合，目標 < 200 行。

限制：
- 不改 dnd-kit guest drag（那是 App.jsx 的 DndContext 負責）。
- 不改 TableZone 的 droppable 接口。
- 桌子拖拉精度、吸附行為、smart guide 對齊必須與修改前完全一致。

驗收：
- FloorPlan.jsx < 200 行。
- pan、zoom、snap、guide、multi-select 全部功能不回歸。
- `npm run lint` 與 `npm run build` 通過。
```

---

### Phase 9 Prompt（`@engineer`）

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 9：資料完整性補強。

必讀：
- `.agents/context.md`
- `Plan/qa-full-review-improvement-plan.md`（C4、W3、W4）

目標：
1. 修正 `removeTable`：被釋放的賓客必須同時清除 `lockedAssignments` 中的鎖定狀態。
2. `TableZone`「刪除此桌」新增二次確認：桌上有賓客時用 `window.confirm` 提示。
3. 匯入 `skipped` 計數語意修正：區分「來源內部重複」和「已匯入重複」，Toast 分別顯示或合併說明。

限制：
- 不做 UI 重構或新功能。
- 確認 `removeTable` 修正後 auto-seat 可正常處理被釋放的未鎖定賓客。

驗收：
- 刪桌 → 鎖定賓客回未分配 → `lockedAssignments` 已清理 → auto-seat 可處理。
- 空桌可直接刪除，有賓客的桌會跳出確認。
- 匯入重複提示與實際行為一致。
- `npm run lint` 與 `npm run build` 通過。
```

---

### Phase 10 Prompt（`@engineer`）

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 10：匯出功能增強。

必讀：
- `.agents/context.md`
- `Plan/qa-full-review-improvement-plan.md`（C5、W5、I2）

目標：
1. 拆分 `useExport.js` 為：
   - `utils/printHTMLBuilder.js`（表格版 HTML）
   - `utils/floorPrintHTMLBuilder.js`（桌次圖 SVG）
   - `useExport.js` 只保留 hook interface。
2. CSV 匯出增加「群組名稱」「群組偏好」「鎖定狀態」欄位。
3. `DashboardHome` 加入「匯出桌次圖」CTA。

限制：
- 匯出 HTML/SVG 結構不改變，只是拆檔。
- CSV 新增欄位不影響匯入（匯入不讀這些欄位）。

驗收：
- 表格版 PDF、桌次圖 PDF 匯出正常。
- CSV 包含新增欄位且內容正確。
- `npm run lint` 與 `npm run build` 通過。
```

---

### Phase 11 Prompt（`@engineer`）

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 11：Firebase 同步防護。

必讀：
- `.agents/context.md`
- `Plan/qa-full-review-improvement-plan.md`（I1、I4）

目標：
1. 改進 Firebase listener 的 `lastSaved` 比較：改用 epoch ms 數值比較，避免字串解析誤差。
2. 消除 `App.jsx` 中重複的 Firebase status badge（確認 AppShell 是否已渲染）。

限制：
- 不改 Firebase schema。
- 防禦性初始化模式不可移除。

驗收：
- 兩分頁同步編輯不出現舊資料覆蓋。
- Firebase badge 全畫面只出現一次。
- `npm run lint` 與 `npm run build` 通過。
```

---

### Phase 12 Prompt（`@designer`）

```text
請以 `.agents/agents.md` 中的 @designer 角色執行 Phase 12：UI 一致性整理。

必讀：
- `.agents/context.md`
- `Plan/qa-full-review-improvement-plan.md`（I7）

目標：
1. 從 `App.css`（18KB）拆分出 `design-tokens.css`：
   - 全域 CSS custom properties（`--color-*`、`--font-*`、`--spacing-*`）→ `design-tokens.css`
   - 元件專屬樣式歸位到各自 `.css`
   - `App.css` 只保留 layout skeleton
2. 確認色彩系統通過 protanopia/deuteranopia simulation（WCAG AA）。
3. 確認 390px 寬度下分頁、統計卡、按鈕不重疊。

限制：
- 不改元件結構或 JS 邏輯。
- 保留 OKLCH/CSS custom properties 設計 token。

驗收：
- `App.css` < 100 行。
- 桌機與 390px 行動寬度無視覺回歸。
- `npm run lint` 與 `npm run build` 通過。
```

---

### Phase 13 Prompt（`@qa`）

```text
請以 `.agents/agents.md` 中的 @qa 角色執行 Phase 13：QA 綜合驗收。

必讀：
- `.agents/context.md`
- `Plan/qa-full-review-improvement-plan.md`（全文）
- Phase 6–12 各完成紀錄

依照 @qa Execution Protocol 分批次讀取修改後程式碼（不一次讀全部），逐批產出 findings。

驗證重點：
- 10 人桌硬限制（匯入 / 拖拉 / auto-seat / 匯出）
- headcount / party / seat-unit 統計一致性
- Firebase fallback 與 reload 後資料完整性
- removeTable → 鎖定清理 → auto-seat 連動
- 匯出 round-trip：JSON 匯出 → 比對記憶體 state
- CSV 新增欄位正確性
- bundle 體積確認（html2canvas/jspdf 已移除）
- 桌機與 390px 行動寬度基本視覺檢查

輸出：
- `.agents/qa_scratch/batch_*.md`（分批 findings）
- `qa_report.md`（合成報告，by severity）
- 是否允許標記為正式完成
```
