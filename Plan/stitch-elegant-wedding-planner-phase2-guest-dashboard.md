# Phase 2：賓客管理與資料品質檢視執行紀錄

> 日期：2026-06-01  
> 主責角色：`@engineer`  
> 對應計畫：`Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md` Phase 2  
> 範圍：建立賓客管理分頁、party/seat-unit 表格、搜尋篩選、桌次容量檢視與資料品質警示；不做 auto-seat preview，不新增大型 table library。

## 1. 必讀與啟動檢查

已讀取：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/stitch-elegant-wedding-planner-modification-plan.md`
- `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`
- `Plan/stitch-elegant-wedding-planner-phase0-baseline.md`
- `Plan/stitch-elegant-wedding-planner-phase0-5-headcount-model.md`
- `Plan/stitch-elegant-wedding-planner-phase1-entry-workbench.md`
- `D:\AI知識庫\projects\wedding-seating-planner.md`
- `D:\AI知識庫\lessons\043-vite-rolldown-build-spawn-eperm.md`
- `D:\AI知識庫\lessons\076-wedding-seating-headcount-is-capacity-data.md`
- `D:\AI知識庫\lessons\078-wedding-seating-firebase-qa-env-isolation.md`

本 Phase 依 `@engineer` 角色執行，並遵守 React best-practices：資料推導集中到 helper selector，元件只接收派生模型與事件 callback；未新增 dependency。

## 2. 實作摘要

### 2.1 賓客管理分頁

新增：

- `src/components/GuestDashboard.jsx`
- `src/components/GuestDashboard.css`
- `src/components/GuestTable.jsx`
- `src/components/GuestQualityPanel.jsx`
- `src/utils/guestDashboard.js`

修改：

- `src/App.jsx`
- `.agents/context.md`

`App.jsx` 現在新增 `賓客` 分頁，位於 `總覽` 與 `座位圖` 之間。分頁顯示來源筆數、實際人數、已分配、未分配、品質警示，並提供匯入名單、新增賓客、前往座位圖等主要操作。

### 2.2 Party + seat-unit 檢視

`src/utils/guestDashboard.js` 將現有 state 轉成 Guest Dashboard model：

- `partyRows` 轉成 party row。
- 沒有 party 的手動賓客轉成 manual row。
- 每列顯示來源姓名、分類、人數、展開座位單位、指定桌次、目前桌次摘要與品質問題。
- seat-unit 明細列可開啟既有 `AddGuestModal` 編輯，也可用二階段刪除按鈕呼叫既有 `removeGuest()`。

### 2.3 搜尋、分類與狀態篩選

賓客分頁支援：

- 搜尋姓名、桌次、飲食、同行角色。
- 使用 `buildCategoryOptions()` 的分類篩選，保留自訂分類。
- 狀態篩選：全部、已分配、未分配、部分安排、拆桌、指定衝突、有品質警示。

### 2.4 資料品質規則

資料品質檢查集中於 `buildGuestDashboardModel()`：

- `人數` 非法或不是 1-10 整數。
- `partyRows.headcount` 與展開 seat units 數量不一致。
- 指定桌次未完整安置，包含容量不足或後續手動移動造成的指定衝突。
- 同一 party 被拆到多桌。
- seat units 仍未分配。
- 分類為 `其他` 或空白。
- 最近一次匯入摘要：略過重複來源與更新既有來源。

`lastImportSummary` 只存在於 `App.jsx` local UI state，不寫入 Firebase，避免在 Phase 2 擴充持久化契約。

## 3. 驗證結果

| 項目 | 結果 | 證據 |
| --- | --- | --- |
| `npm run lint` | PASS | ESLint exit code 0 |
| focused selector smoke | PASS | Node ESM smoke 偵測到 `重複匯入摘要`、`人數與座位不一致`、`指定桌次未完整安置`、`同行被拆桌`、`分類需確認` |
| `npm run build` sandbox | EXPECTED BLOCKED | Vite/Rolldown config load 出現已知 `[plugin externalize-deps] Error: spawn EPERM` |
| KB lessons 查核 | PASS | 已查 `lessons/043-vite-rolldown-build-spawn-eperm.md` |
| `npm run build` escalated | PASS | Vite 8.0.10 build 成功，僅有既有 chunk > 500 kB warning |
| `npm run rules:check` | PASS | RTDB rules check passed |
| 本機模式 env isolation | PASS | 使用 `C:\tmp\wedding-vite-local.config.mjs` 與 `C:\tmp\wedding-vite-local-env\.env`，Browser 顯示 `本機模式` |
| Browser page identity | PASS | `http://127.0.0.1:5182/wedding_seat/`，title `-` |
| Browser blank / overlay | PASS | 總覽與賓客分頁皆有有效 DOM，未看到 Vite error overlay |
| Browser console health | PASS WITH EXPECTED WARN | 僅有預期的 Firebase local-only warning，無 app error |
| Browser interaction | PASS | 登入、切到賓客分頁、新增 `Phase2測試賓客A`、搜尋、狀態篩選、二階段刪除皆通過 |
| Browser mobile 390x844 | PASS | 賓客分頁 `scrollWidth = 384`、`innerWidth = 390`，無水平 overflow |
| Dev server cleanup | PASS | 停止父程序被拒後，查到 5182 owning process 並停止 Node 子程序；最後 URL 回傳 `stopped` |

## 4. 殘留風險與後續注意

- `人數` 的原始非法值目前在匯入階段會被正規化；賓客分頁可偵測 Firebase/state 中仍存在的非法或不一致資料，但不保留每次匯入前的 raw invalid value。若未來要保留完整匯入稽核，需要新增不寫回 Google Sheets 的 `importSummary` 或 `importDiagnostics` 契約。
- 舊 Firebase 正式資料若沒有 `partyRows`，賓客分頁會把既有 guests 顯示為手動單人列；重新匯入同名來源後才會建立 party row。
- Browser CUA drag 仍沿用 Phase 0 的已知限制；本 Phase 未改 drag-and-drop handler，因此未重測拖拉。
- 本 Phase 的品質警示是資訊與操作指引，不會阻止使用者同步 Google Sheets。是否在拆桌或指定衝突時阻止同步，建議留到 Phase 4/5 或獨立 QA checkpoint 決定。

## 5. Review

Phase 2 已完成賓客管理與資料品質檢視：`賓客` 分頁能檢視 party/seat-unit 狀態、搜尋篩選、桌次容量與品質問題；新增、編輯、刪除賓客後使用同一份 `useSeatingState`，因此賓客分頁、座位圖與未分配池共享狀態來源。實作沒有新增 dependency，也沒有擴充 Firebase schema。

建議下一步可執行獨立 `@qa` checkpoint，或進入 Phase 3（`@designer`）：座位畫布整理。
