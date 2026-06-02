# Phase 0.5：`人數` 欄位與 party/seat-unit 模型執行紀錄

> 日期：2026-06-01  
> 主責角色：`@engineer`  
> 對應計畫：`Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md` Phase 0.5  
> 範圍：只處理 `人數` 匯入、party/seat-unit 模型、容量統計、Firebase 相容與基礎驗證；不做 dashboard、auto-seat 或 group manager UI。

## 1. 必讀與啟動檢查

已讀取：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/stitch-elegant-wedding-planner-modification-plan.md`
- `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`
- `Plan/stitch-elegant-wedding-planner-phase0-baseline.md`
- `D:\AI知識庫\projects\wedding-seating-planner.md`
- `D:\AI知識庫\lessons\043-vite-rolldown-build-spawn-eperm.md`
- `D:\AI知識庫\lessons\076-wedding-seating-headcount-is-capacity-data.md`
- `D:\AI知識庫\lessons\078-wedding-seating-firebase-qa-env-isolation.md`

## 2. 實作摘要

### 2.1 Headcount 正規化

- 新增 `src/utils/partyRows.js`：
  - `normalizeHeadcount()`：將 `headcount` / `人數` 正規化為 1-10 的整數；空白、非法、小於 1 預設 1；大於 10 夾到 10。
  - `normalizePartyRows()`：提供舊 Firebase state fallback。
  - `buildCompanionName()`：展開同行座位名稱，例如 `王小明 同行1`。
- `src/hooks/useGoogleSheets.js` 現在讀取 `row.headcount` 或 `row['人數']`，回傳標準 `headcount`。
- `apps-script-doPost.js` 的 `doGet()` 會讀取 `人數` 並輸出 `headcount`。

### 2.2 Party + seat-unit 模型

- `src/utils/importGuests.js` 改為以來源列建立 `partyRows`，再展開為可拖拉的 `guests` seat units。
- `人數 = 1` 建立 1 個 primary seat unit。
- `人數 > 1` 建立 1 個 primary + N 個 companion seat units，所有 seat units 共用同一 `partyId`。
- 指定桌次時，會嘗試把整個 party 依序放入該桌；剩餘座位不足時，不超過 10 人限制，放不下的 seat units 留在未分配池。
- 重複匯入同姓名時會更新既有 party：
  - `人數` 增加：補齊 companion seat units。
  - `人數` 減少：移除多餘 companion seat units，並同步清理桌次與未分配引用。
  - 不留下 orphan companion 或 partyRows stale guestIds。

### 2.3 Firebase 與 state fallback

- `src/hooks/useSeatingState.js`
  - 初始 state 新增 `partyRows: []`。
  - 載入舊 Firebase state 時補上 `partyRows: []`、`partyId: null`、`partyRole: 'primary'`。
  - `removeGuest()` 會清理 `partyRows.guestIds` 並修正 `headcount`。
  - `updateGuest()` 若修改 primary guest，會同步更新對應 party 的 `sourceName` / `category`。
  - `stats` 新增 `partyTotal`、`seatTotal`、`assignedSeats`、`unassignedSeats`，保留舊 `total` / `assigned` / `unassigned` 相容欄位。
- `src/hooks/useFirebase.js` 儲存時新增 `partyRows`。
- `database.rules.json` 允許並驗證 guest 的 `partyId` / `partyRole` 與新的 `partyRows` schema。
- `scripts/check-rtdb-rules.mjs` 已同步檢查 `partyRows` 與 `headcount <= 10`。

### 2.4 匯出與同步

- `src/utils/googleSheetsPayload.js` 現在優先以 `partyRows` 輸出一列一個來源 party，欄位包含 `headcount`。
- `apps-script-doPost.js` 同步回寫目標新增 `人數` 欄。
- `src/hooks/useExport.js` 的 Excel 匯出仍是一列一個 seat unit，但新增 `來源姓名`、`人數`、`同行角色`，方便看出 party 展開關係。
- 座位清單 PDF 與桌次圖 PDF metadata 改顯示 `來源筆數` 與 `實際人數`。

### 2.5 既有 UX 小修

- `src/components/Toolbar.jsx` 的統計改為顯示 `來源筆數 / 實際人數 / 已分配 / 未分配`。
- `src/App.jsx` 匯入 toast 改用「座位需求」語意，並顯示更新來源筆數、滿桌未分配等摘要。
- `src/App.jsx` 同步 Google Sheets 失敗時會 throw，讓 Toolbar 按鈕顯示 `同步失敗`，避免 Phase 0 發現的「toast 失敗但按鈕成功」矛盾。
- `useGoogleSheets()` 缺少 `VITE_SHEETS_URL` 時會丟出錯誤，App 可顯示可見 toast。

## 3. 驗證結果

| 項目 | 結果 | 證據 |
| --- | --- | --- |
| `npm run lint` | PASS | ESLint exit code 0 |
| `npm run rules:check` | PASS | RTDB rules check passed |
| headcount focused smoke | PASS | Node ESM smoke 覆蓋 `人數=2` 展開、重複匯入增/減同行者、滿桌不超放、舊 Firebase 無 `partyRows` fallback、Google Sheets payload party aggregation |
| `npm run build` sandbox | EXPECTED BLOCKED | Vite/Rolldown config load hit `[plugin externalize-deps] Error: spawn EPERM`，符合既有 KB lesson 043 |
| `npm run build` escalated | PASS | Vite 8.0.10 build 成功，僅保留既有 chunk > 500 kB warning |
| 本機模式 env isolation | PASS | `http://127.0.0.1:5180/wedding_seat/src/firebase.js` 的 transformed env 只有 `VITE_PASSWORD_HASH`，沒有 Firebase DB URL |
| Browser local-mode smoke | PASS | 登入後 badge 顯示 `本機模式`；Toolbar 顯示 `來源筆數 / 實際人數 / 已分配 / 未分配` |
| 匯入缺設定 toast | PASS | 點「匯入名單」顯示 `匯入失敗：尚未設定 VITE_SHEETS_URL...` |
| 同步缺設定狀態 | PASS | 點「同步到試算表」顯示失敗 toast，Toolbar 按鈕顯示 `同步失敗` |

## 4. 風險與後續注意

- 目前 Phase 0.5 只建立資料模型與統計口徑，尚未新增 Guest Dashboard，因此 `partyRows` 的完整檢視與資料品質警示留到 Phase 2。
- 舊 Firebase state 沒有 `partyRows` 時會正常載入；再次匯入同名來源後才會建立對應 party row。
- 若同一 party 被手動拆到多桌，Google Sheets payload 會用 `1桌 / 2桌 / 未分配1位` 類摘要回寫；正式的拆桌警示與同步阻擋應由 Phase 2 資料品質面板補上。
- `人數` 單列上限目前與每桌硬限制一致，正規化為 10；若未來來源有超過 10 人的大團體，應在 Phase 2 顯示資料品質警示，而不是靜默視為 10。
- Browser CUA drag smoke 在 Phase 0 已知不可靠；本 Phase 未重測 dnd-kit 拖拉，因為 seat-unit 仍沿用原 `guests` 模型與 `moveGuest()` 容量邏輯。

## 5. Review

Phase 0.5 完成資料地基：`人數` 已進入 Apps Script、React import、party/seat-unit state、Firebase save/load、RTDB rules、統計與匯出/同步 payload。實作沒有新增 npm dependency，也沒有改 dashboard、auto-seat 或 group UI。

建議下一步進入 Phase 1（`@designer`）：入口工作台與導覽骨架。Phase 1 應直接使用本 Phase 的 `stats.partyTotal` / `stats.seatTotal` / `stats.assignedSeats` / `stats.unassignedSeats`，不要回到舊的 `guests.length` 單一統計口徑。
