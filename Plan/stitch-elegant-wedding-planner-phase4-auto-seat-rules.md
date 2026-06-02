# Phase 4：自動排座規則設定執行紀錄

> 日期：2026-06-02  
> 主責角色：`@engineer`  
> 對應計畫：`Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md` Phase 4  
> 範圍：建立 preview-first 自動排座規則、預覽與套用流程；不實作 Phase 5 的群組管理 UI。

## 1. 必讀與啟動檢查

已讀取：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/stitch-elegant-wedding-planner-modification-plan.md`
- `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`
- `Plan/stitch-elegant-wedding-planner-phase2-guest-dashboard.md`
- `Plan/stitch-elegant-wedding-planner-phase3-canvas-cleanup.md`
- `D:\AI知識庫\projects\wedding-seating-planner.md`
- `D:\AI知識庫\lessons\043-vite-rolldown-build-spawn-eperm.md`
- `D:\AI知識庫\lessons\051-browser-viewport-docs-and-readonly-dom.md`
- `D:\AI知識庫\lessons\078-wedding-seating-firebase-qa-env-isolation.md`
- `D:\AI知識庫\lessons\079-vite-dev-server-child-process-cleanup.md`

本 Phase 依 `@engineer` 角色執行，並套用 Pipeline、React best-practices 與 frontend-testing-debugging 流程。輔助 explorer 只做資料流分析，未修改檔案；主線完成實作與驗證。

## 2. 實作摘要

### 2.1 Preview-first 自動排座 planner

新增：

- `src/utils/autoSeatPlanner.js`

內容：

- 新增 `DEFAULT_SEATING_RULES` 與 `normalizeSeatingRules()`。
- 新增 `normalizeLockedAssignments()`，只作為 Phase 4 對 Phase 5 的相容輸入，不新增鎖定 UI。
- 新增 `createAutoSeatPreview(state, rules)` 純函式，輸出 `plan.nextState`、`summary`、`moves`、`createdTables`、`blocked`。
- 預設只安排未分配且未鎖定的 seat units，尊重既有座位。
- 以展開後 `guests` seat units 計算容量，每桌硬限制 `MAX_SEATS = 10`。
- `partyRows.guestIds` 只用來形成同行群組，預設盡量同桌；超過 10 位或無合規空位時列入 blocked，不靜默拆桌。
- planner 內部使用 `_categorySnapshot` 作分類上限檢查，套用前會清除，不寫入 Firebase。

### 2.2 Bulk apply 狀態 API

修改：

- `src/hooks/useSeatingState.js`

內容：

- 初始 state 新增 `seatingRules` 與 `lockedAssignments` fallback。
- Firebase listener normalize 舊資料，缺少新欄位時不 crash。
- 新增 `applyAutoSeatPlan(plan)`，確認來源 fingerprint 未變、每桌不超過 10 位後，才一次 commit next state 並觸發既有 autosave。
- 避免逐筆呼叫 `moveGuest()` 造成多次 autosave 或 preview 取消後污染狀態。

### 2.3 Auto-seat UI

新增：

- `src/components/AutoSeatRulesModal.jsx`
- `src/components/AutoSeatRulesModal.css`
- `src/components/AutoSeatPreview.jsx`

修改：

- `src/App.jsx`
- `src/components/Toolbar.jsx`

內容：

- 座位圖 Toolbar 新增「自動排座」入口。
- `AutoSeatRulesModal` 支援填位策略、保留既有安排、優先補滿已有桌次、同行 party 盡量同桌、每桌同分類上限。
- 使用者按「產生預覽」才建立 preview；按「取消」或「關閉」不改 state。
- 規則草稿變更會清掉舊 preview，避免套用過期建議。
- `AutoSeatPreview` 明確列出建議安排人數、新增桌次、套用後未分配數與無法安排原因。

### 2.4 Firebase schema 擴充

修改：

- `src/hooks/useFirebase.js`
- `database.rules.json`
- `scripts/check-rtdb-rules.mjs`
- `.agents/context.md`

內容：

- Firebase save payload 新增 `seatingRules` 與 `lockedAssignments`。
- RTDB rules 放行並驗證 `seatingRules` / `lockedAssignments`。
- `maxPerCategoryPerTable` 設為可選 child，避免沒有分類上限時空物件保存造成 write 被拒。
- `scripts/check-rtdb-rules.mjs` 新增自動排座 rules smoke 檢查。

## 3. 驗證結果

| 項目 | 結果 | 證據 |
| --- | --- | --- |
| `npm run lint` | PASS | ESLint exit code 0 |
| `npm run rules:check` | PASS | RTDB rules check passed |
| `autoSeatPlanner` focused smoke | PASS | Node ESM smoke：2 位未分配 seat units 產生 2 位建議安排，且 runtime field 未洩漏 |
| `npm run build` sandbox | EXPECTED BLOCKED | Vite/Rolldown config load 命中已知 `[plugin externalize-deps] Error: spawn EPERM` |
| KB lessons 查核 | PASS | 已查 `lessons/043-vite-rolldown-build-spawn-eperm.md` |
| `npm run build` escalated | PASS | Vite 8.0.10 build 成功；僅有既有 chunk > 500 kB warning |
| Browser env isolation | PASS | `http://127.0.0.1:5184/wedding_seat/` 使用 temp config/envDir；transformed Firebase module 無正式 RTDB URL；畫面顯示 `本機模式` |
| Browser page identity | PASS | URL 為本機 isolated server；title `-` |
| Browser console | PASS WITH EXPECTED WARN | 僅有預期 Firebase local-only warning，無 app error |
| Browser preview-first | PASS | 未產生 preview 前「套用預覽」disabled；產生 preview 後 enabled |
| Browser preview content | PASS | 新增 `Phase4測試賓客A/B` 後，preview 顯示建議安排 2 位、列出兩位移動、無 blocked reason |
| Browser apply flow | PASS | DOM/CUA 點擊「套用預覽」後 modal 關閉、toast 顯示「已套用自動排座」、1 桌顯示 `2/10` |
| Desktop responsive | PASS | 1366x768 開啟自動排座 modal，`scrollWidth 1360 <= innerWidth 1366` |
| Mobile responsive | PASS | 390x844 開啟自動排座 modal，`scrollWidth 384 <= innerWidth 390` |
| Browser screenshot | TOOL LIMITATION | `Page.captureScreenshot` timeout，依 lesson 051 記為 Browser capture limitation；DOM/console/interaction evidence 仍通過 |

## 4. 殘留風險與後續注意

- Phase 4 沒有建立 guestGroups 或鎖定 UI；planner 只讀 `lockedAssignments ?? {}`，供 Phase 5 之後接入。
- 自動排座是可解釋規則，不是最佳化演算法；複雜親友平衡與不可同桌規則仍需 Phase 5 或後續規格。
- 若使用者設定很嚴格的分類上限，planner 會把無法同桌安置的 party 列入 blocked，不會自動拆桌。
- Browser screenshot timeout 屬工具限制；已用 DOM、console、button enabled state、toast 與 scrollWidth 取代截圖證據。
- 本機 Browser 驗證使用隔離 env，沒有寫入正式 Firebase。

## 5. Review

Phase 4 已完成 preview-first 自動排座規則設定：規則、預覽、套用三者分離，取消 preview 不會改 state；套用時會一次 commit 並通過 fingerprint 防止套用過期狀態。容量計算以展開後 seat units 為準，預設尊重既有安排並盡量保留 party 同桌。Firebase schema 與 rules 已向後相容擴充。

建議下一步可執行獨立 `@qa` checkpoint 驗證滿桌、匯出與 Firebase reload，或進入 Phase 5（`@engineer`）：群組關聯與鎖定。
