# Phase 5：群組關聯與鎖定執行紀錄

> 日期：2026-06-02  
> 主責角色：`@engineer`  
> 對應計畫：`Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md` Phase 5  
> 範圍：新增 `guestGroups`、鎖定管理 UI、Firebase 保存與 auto-seat preview 鎖定互動。  
> 備註：本次依使用者要求，不使用子代理／子查詢式分工。

## 1. 必讀與啟動檢查

已讀取：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/stitch-elegant-wedding-planner-modification-plan.md`
- `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`
- `Plan/stitch-elegant-wedding-planner-phase4-auto-seat-rules.md`
- `D:\AI知識庫\_index.md`
- `D:\AI知識庫\profile\_index.md`
- `D:\AI知識庫\profile\user.md`
- `D:\AI知識庫\projects\wedding-seating-planner.md`
- `D:\AI知識庫\lessons\043-vite-rolldown-build-spawn-eperm.md`
- `D:\AI知識庫\lessons\051-browser-viewport-docs-and-readonly-dom.md`

本 Phase 依 `@engineer` 角色執行，並套用 Pipeline、React best-practices 與 frontend-testing-debugging 流程。

## 2. 實作摘要

### 2.1 群組與鎖定資料模型

新增：

- `src/utils/guestGroups.js`

內容：

- 新增 `guestGroups` normalization，支援 `same-table / nearby / separate` 偏好。
- 新增 `ensurePartyGuestGroups()`，讓 `人數 > 1` 的 `partyRows` 自動建立或更新同行群組。
- 新增 `normalizeLockedAssignmentsForGuests()`，清理已刪除賓客的鎖定引用。
- `group.locked` 會依 `lockedAssignments` 中所有成員狀態同步。

修改：

- `src/utils/importGuests.js`
- `src/hooks/useSeatingState.js`

內容：

- 匯入後會保存或更新自動同行群組。
- 刪除賓客時同步清除 `partyRows`、`guestGroups` 與 `lockedAssignments` 引用。
- 新增 `createGuestGroup()`、`updateGuestGroup()`、`removeGuestFromGroup()`、`removeGuestGroup()`、`toggleGuestLock()`、`toggleGroupLock()` state API。

### 2.2 群組管理 UI

新增：

- `src/components/GroupManager.jsx`
- `src/components/GroupManager.css`
- `src/components/GroupCard.jsx`
- `src/components/LockBadge.jsx`
- `src/components/LockBadge.css`

修改：

- `src/App.jsx`
- `src/components/GuestCard.jsx`
- `src/components/GuestCard.css`
- `src/components/TableZone.jsx`
- `src/components/TableZone.css`
- `src/components/UnassignedPool.jsx`
- `src/components/FloorPlan.jsx`

內容：

- PlannerTabs 新增 `群組` 分頁。
- 支援手動建立群組、改名、改偏好、備註、拆出成員、解除群組。
- 支援群組鎖定與單一 seat-unit 鎖定。
- 未分配卡片與桌面座位顯示鎖定徽章。
- 手動拖拉、交換或點擊移回鎖定 seat unit 前會提示確認；確認後仍允許手動覆蓋。

### 2.3 Auto-seat preview 互動

修改：

- `src/utils/autoSeatPlanner.js`

內容：

- `buildAutoSeatFingerprint()` 納入 `guestGroups`，避免套用過期 preview。
- `preference === 'same-table'` 的手動群組會進入 auto-seat 分組。
- `lockedAssignments` 仍是 auto-seat 是否可移動 seat unit 的權威來源。

### 2.4 Firebase schema 擴充

修改：

- `src/hooks/useFirebase.js`
- `database.rules.json`
- `scripts/check-rtdb-rules.mjs`
- `.agents/context.md`

內容：

- Firebase save payload 新增 `guestGroups`。
- RTDB rules 放行並驗證 `guestGroups` 欄位。
- `.agents/context.md` 記錄 Phase 5 資料契約、檔案結構、群組分頁與 auto-seat 互動規則。

## 3. 驗證結果

| 項目 | 結果 | 證據 |
| --- | --- | --- |
| `npm run lint` | PASS | ESLint exit code 0 |
| `npm run rules:check` | PASS | RTDB rules check passed |
| Focused Node smoke | PASS | `人數=2` 產生 2 位 seat units 與 1 組 auto party group；鎖定 seat unit 未出現在 auto-seat moves |
| `npm run build` sandbox | EXPECTED BLOCKED | Vite/Rolldown config load 命中已知 `[plugin externalize-deps] Error: spawn EPERM` |
| KB lesson 查核 | PASS | 已查 `lessons/043-vite-rolldown-build-spawn-eperm.md` |
| `npm run build` escalated | PASS | Vite 8.0.10 build 成功；僅有既有 chunk > 500 kB warning |
| Vite dev server sandbox | EXPECTED BLOCKED | 同一 `spawn EPERM` 問題 |
| Vite dev server escalated | PASS | `http://127.0.0.1:5185/wedding_seat/` ready |
| Browser page identity | PASS | URL 為本機 dev server；title `-` |
| Browser local-mode isolation | PASS | console 僅有預期 Firebase local-only warning |
| Browser group UI | PASS | 登入後顯示 `群組` 分頁；手動建立 `Phase5測試群組` 後 tab meta 變為 `群組 1 組` |
| Browser lock UI | PASS | 群組可 `鎖定全組`，未分配 guest cards 顯示 `鎖` badge |
| Browser auto-seat lock behavior | PASS | 鎖定兩位未分配 seat units 後，auto-seat preview 顯示鎖定原因，`套用預覽` disabled，不移動鎖定賓客 |
| Browser desktop overflow | PASS | active dialog DOM check：無 horizontal overflow，無 Vite overlay |
| Browser mobile overflow | PASS | 390x844：`scrollWidth 384 <= innerWidth 390`，無 horizontal overflow，無 Vite overlay |
| Browser screenshot | TOOL LIMITATION | `Page.captureScreenshot` timeout，依 lesson 051 記為 Browser capture limitation；DOM/console/interaction evidence 仍通過 |

## 4. 殘留風險與後續注意

- Firebase reload 驗證未寫入正式 RTDB；本次 rendered QA 刻意使用本機模式避免污染正式資料。Firebase 保存能力由 `useFirebase.js` payload、RTDB rules 與 rules smoke 佐證。
- `nearby` 與 `separate` 偏好目前是人工規劃資訊；只有 `same-table` 會影響 auto-seat grouping。
- 手動拖拉鎖定賓客的確認流程已接在 App 的 move/swap/move-out code path；Browser 未強制完成 native confirm 對話框拖拉測試。
- Browser 截圖 timeout 屬既有工具限制，非產品阻塞。

## 5. Review

Phase 5 已完成群組關聯與鎖定：`guestGroups` 能與 `lockedAssignments` 一起保存，`人數 > 1` 來源列會自動建立同行群組，手動群組可建立、改名、拆分與解除，鎖定狀態已影響 Phase 4 auto-seat preview。群組偏好保持可解釋、可人工覆蓋，不新增大型套件或後端服務。

建議下一步可執行獨立 `@qa` checkpoint，集中驗證正式 Firebase reload、滿桌拖拉、匯出與 Google Sheets 同步。
