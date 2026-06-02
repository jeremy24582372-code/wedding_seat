# Phase 0：基線盤點與保護驗證紀錄

> 日期：2026-06-01  
> 主責角色：`@qa`  
> 對應計畫：`Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md` Phase 0  
> 範圍：不修改產品功能，只建立目前狀態、驗證證據、風險清單與後續 smoke 流程。

## 1. 啟動與必讀

已讀取：

- `.agents/context.md`
- `.agents/agents.md`
- `Plan/stitch-elegant-wedding-planner-modification-plan.md`
- `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`
- `D:\AI知識庫\projects\wedding-seating-planner.md`
- `D:\AI知識庫\lessons\043-vite-rolldown-build-spawn-eperm.md`

## 2. 目前基線狀態

### 2.1 專案與 Git 狀態

- `package.json` scripts：`dev`、`build`、`lint`、`preview`、`rules:check`、`rules:deploy`。
- `.env` 存在於工作目錄，但 `.gitignore` 已忽略 `.env` / `.env.local`。
- `git status --short` 在 Phase 0 開始時只顯示 `Plan/` 未追蹤，未看到 `.env` 或 secrets 進入 Git。

### 2.2 主要資料流檔案

- `src/App.jsx`
  - 登入後直接渲染 toolbar、未分配池與座位畫布。
  - `DndContext` 仍在 root app，`handleDragEnd` 先用 dnd-kit `over`，再以 `elementsFromPoint` fallback。
  - 匯入結果會顯示新增、略過、依桌次安排、新增桌次、桌滿未分配等摘要。
- `src/hooks/useSeatingState.js`
  - Firebase 未設定時 `fbReady` 初始為 `true`，避免卡在 loading。
  - `moveGuest()` 透過 `computeGuestMove()` 保持純轉換；每桌用固定 10 格 seat array。
  - `stats` 目前以 `guests.length` / `guest.tableId` 計算，尚未支援 `headcount` 或 party/seat-unit。
- `src/utils/importGuests.js`
  - 匯入以姓名去重，會 patch 既有 guest 的分類/飲食。
  - 支援 `tableLabel` 正規化與自動建立缺少桌次。
  - 指定桌次滿位時不超放，新增 guest 保留未分配。
  - 尚未支援 `headcount` / `人數`。
- `src/hooks/useGoogleSheets.js`
  - 目前讀取 `name` / `category` / `tableLabel` / optional `diet`。
  - 尚未讀取 `headcount` / `人數`。
- `src/hooks/useFirebase.js`
  - `saveStateToFirebase()` 寫入 `guests`、`tables`、`tablePositions`、`unassignedGuestIds`、`lastSaved`。
  - `db === null` 時所有 Firebase helper no-op。
- `src/hooks/useExport.js`
  - JSON 直接匯出完整 state。
  - Excel / PDF / 桌次圖 PDF 以目前 seat-unit guest state 匯出。
  - 尚未輸出 `headcount` 或 party 摘要。
- `apps-script-doPost.js`
  - `doGet()` 目前讀取 `姓名 / 關係分類 / 桌次`，飲食為 optional legacy。
  - 尚未讀取或輸出 `人數` / `headcount`。
- `database.rules.json`
  - 目前允許既有 `guests` / `tables` / `unassignedGuestIds` / `tablePositions` / `lastSaved`。
  - 尚未允許 `partyRows`、`headcount`、`guestGroups`、`lockedAssignments`、`seatingRules`。

## 3. 驗證結果

| 項目 | 結果 | 證據 |
| --- | --- | --- |
| `npm run lint` | PASS | ESLint 完成，exit code 0 |
| `npm run build` sandbox | EXPECTED BLOCKED | Vite/Rolldown config load 階段出現 `[plugin externalize-deps] Error: spawn EPERM` |
| KB lessons 查核 | PASS | 已先查 `lessons/043-vite-rolldown-build-spawn-eperm.md`，確認為既有 Codex Desktop sandbox pattern |
| `npm run build` escalated | PASS | Vite 8.0.10 build 成功，輸出 `dist/index.html`、CSS、JS；僅有 chunk > 500 kB warning |
| `.env` 保護 | PASS | `.gitignore` 忽略 `.env` / `.env.local`，Git 未顯示 secrets |
| Firebase connected baseline | PASS | 正式 `.env` 下 badge 顯示 `Firebase 已連線`；reload 後狀態為 9 guests / 9 assigned / 0 unassigned / 20 tables |
| Firebase fallback baseline | PASS | 以 `C:\tmp\wedding-vite-local.config.mjs` 隔離 `envDir`，badge 顯示 `本機模式`，初始 0 guests / 10 tables，無 loading 卡住 |
| 手動新增賓客 | PASS | 隔離本機模式新增 `Phase0本機測試A` 後，stats 變為 1 total / 0 assigned / 1 unassigned |
| 匯出選單 | PASS | 匯出 dropdown 顯示 JSON、Excel、座位清單 PDF、桌次圖 PDF 四項 |
| 匯入 helper：桌次正規化 | PASS | `1`→`1桌`、`第2桌`→`2桌`、`桌3`→`3桌`、`未分配`/`N/A`→空值 |
| 匯入 helper：滿桌保護 | PASS | 10/10 桌指定匯入新賓客時，table count 維持 10，新增 guest 留在 unassigned，`unassignedDueToFullTables = 1` |
| 匯入 helper：重複與建桌 | PASS | 同名重複列被略過；既有 guest 可依 `tableLabel` 安排；缺少的 `2桌` 會建立 |
| Browser drag smoke | BLOCKED | Browser CUA drag 未觸發 dnd-kit pointer sensor；兩次拖拉後狀態仍為 1 unassigned / 0 assigned。需用人工瀏覽器或正式 e2e 工具補測 |
| 390px 行動寬度 | FAIL BASELINE | `body.scrollWidth = 1016`、`innerWidth = 390`；toolbar 在截圖中水平溢出且主要內容被推到畫面外 |

## 4. 發現事項

### P1：390px 行動版目前嚴重水平溢出

- 現象：390x844 viewport 下，toolbar 和主要畫布寬度超出畫面，`document.body.scrollWidth` 為 1016。
- 影響：後續 Phase 1 / Phase 3 若重構入口或畫布，必須避免把既有 overflow 誤判成新回歸；但完成 Stitch 入口工作台時應一併修正。
- 建議歸屬：Phase 1 `@designer` 先處理 AppShell / Toolbar responsive；Phase 3 再處理畫布工具列與側欄。

### P2：未設定 `VITE_SHEETS_URL` 時，匯入按鈕沒有可見 Toast

- 現象：隔離本機模式下點「匯入名單」，`useGoogleSheets()` console error，但 `App.handleImport()` 在 `fetchGuests()` 回傳 `null` 時沒有 toast。
- 影響：使用者只看到沒有反應，難以判斷是設定缺失還是網路問題。
- 建議歸屬：Phase 2 或 Phase 0.5 可補一個錯誤回傳/Toast 通道；不必在 Phase 0 修正。

### P2：同步失敗時 toolbar 狀態會短暫顯示成功

- 現象：未設定 `VITE_SHEETS_URL` 時，toast 正確顯示 `同步失敗：尚未設定 VITE_SHEETS_URL`，但 toolbar 按鈕文字變成 `✓ 同步完成`。
- 可能原因：`Toolbar.handleSyncSheets()` 只要 `onSyncSheets()` 沒 throw 就設為 success；`App.handleSyncSheets()` 目前用 toast 顯示錯誤但沒有向上回傳失敗。
- 建議歸屬：Phase 2 或後續匯出/同步整理時修正。

### P2：Phase 0.5 前，`人數` 欄位尚未進入 app contract

- 現象：`apps-script-doPost.js`、`useGoogleSheets.js`、`importGuests.js`、`useExport.js`、`database.rules.json` 都還是單列 guest = 單座位模型。
- 影響：目前統計與容量只代表 guest 筆數，不代表來源列 `人數` 加總；Phase 0.5 必須先完成 party/seat-unit model。
- 建議歸屬：Phase 0.5 `@engineer`。

### 測試操作修正紀錄

- 曾嘗試以覆寫 `VITE_FIREBASE_DATABASE_URL` 啟動本機 fallback server，但 PowerShell 字串插值與 Vite env loading 造成 5174/5176/5177 仍載入正式 Firebase。
- 因此誤新增了 `Phase0測試A` 到正式 Firebase；已立即透過 UI 二階段刪除，reload 後確認正式狀態恢復為 9 guests / 9 assigned / 0 unassigned。
- 最終安全做法：使用 `C:\tmp\wedding-vite-local.config.mjs` 指定 `envDir: 'C:/tmp/wedding-vite-local-env'`，該 env 僅含 `VITE_PASSWORD_HASH`，成功取得 `本機模式`。

## 5. 後續 Phase 必跑 Smoke Checklist

每個 Phase 完成後至少執行：

1. `npm run lint`
2. `npm run build`
   - 若 sandbox 出現 Vite/Rolldown `spawn EPERM`，先查 KB lessons，再 escalated 重跑並記錄。
3. Firebase 設定存在時：
   - 密碼 `20270123` 可登入。
   - badge 顯示 `Firebase 已連線` 或合理的 `Firebase 斷線`。
   - reload 後桌次、座位與未分配池不消失。
4. Firebase disabled / fallback：
   - 用隔離 envDir 或等價方式避免載入正式 `.env`。
   - badge 顯示 `本機模式`。
   - 不卡在 `連線中…` loading。
5. 匯入：
   - 空資料或設定缺失有可見 toast。
   - 重複姓名不新增第二筆。
   - 指定桌次可安排；缺桌可建立；滿桌不超過 10 人。
   - Phase 0.5 後新增：`人數 = 2` 必須產生 2 個 seat units。
6. 拖拉與座位：
   - unassigned → empty seat。
   - empty/full boundary：10/10 桌不可放第 11 位。
   - occupied seat swap。
   - filled seat click → move back to unassigned。
   - table drag、pan、zoom、snap、guide。
7. 匯出：
   - JSON 可下載目前 state。
   - Excel 欄位與桌次一致。
   - 座位清單 PDF 可開啟列印視窗。
   - 桌次圖 PDF 使用正確 `tablePositions`。
8. 同步 Google Sheets：
   - 成功與失敗狀態不得互相矛盾。
   - Phase 0.5 後新增：同步策略不得把拆桌 party 靜默覆蓋回來源表。
9. 視覺：
   - Desktop：至少 600px 目前瀏覽器基線與後續 1366x768 / 1440x900。
   - Mobile：390x844 不得有不可操作的 toolbar 溢出。
   - 任何按鈕文字不得溢出父容器。

## 6. 本次測試環境與 artifacts

- Browser URL（正式 Firebase）：`http://127.0.0.1:5173/wedding_seat/`
- Browser URL（隔離本機模式）：`http://127.0.0.1:5179/wedding_seat/`
- 臨時 Vite config：`C:\tmp\wedding-vite-local.config.mjs`
- 臨時 envDir：`C:\tmp\wedding-vite-local-env\.env`
- 截圖：
  - `C:\Users\jerem\AppData\Local\Temp\wedding-phase0-local-smoke.png`
  - `C:\Users\jerem\AppData\Local\Temp\wedding-phase0-mobile-390.png`

## 7. Phase 0 結論

Phase 0 基線已建立。靜態檢查與 production build 通過；Firebase fallback 可在隔離 env 下運作；匯入 helper 對既有單座位模型的去重、桌次正規化與滿桌保護可驗證。

不建議直接進 Phase 1。下一步應先執行 Phase 0.5，因為 `人數` / `headcount` 尚未進入資料模型、Firebase rules、匯入、統計與匯出契約。若先做 dashboard，統計口徑會建立在錯誤的單筆 guest 模型上。
