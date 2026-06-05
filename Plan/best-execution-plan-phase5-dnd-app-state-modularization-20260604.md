# Phase 5 DnD 與 App/state 模組化執行紀錄

日期：2026-06-04  
角色：`.agents/agents.md` 的 `@engineer`  
來源：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/best-execution-plan-phase0-qa-baseline-20260604.md`
- `Plan/best-execution-plan-from-qa-reviews-20260604.md`

## 執行範圍

Phase 5 聚焦在 `App.jsx` 的 handler 去重與座位拖拉路徑穩定化，並小步拆分 `useSeatingState.js` 的內部 persistence/core helper。

不做事項：

- 不改 Firebase schema。
- 不改 Google Sheets import/sync schema。
- 不新增 npm dependency。
- 不將 `useSeatingState()` public API 拆成多個外部 hook。

## 狀態追蹤

| 項目 | 狀態 | 備註 |
| --- | --- | --- |
| 讀取 `@engineer` 與 project context | Done | 已確認資料流、10-seat contract、本機模式 fallback |
| DnD handler 去重 | Done | `resolveDropTarget()` 與 `moveGuestByDropTarget()` 抽到 `src/utils/dndDrop.js` |
| 桌面已安排座位可拖拉 | Done | `TableZone` filled seat 同時註冊 draggable/droppable |
| `App.jsx` handler 拆分 | Done | 匯入、自動排座、鎖定提示、DnD 各自拆 hook |
| `useSeatingState.js` 拆分 | Done | 保留 facade API，抽出 persistence store 與 pure core helper |
| 死 API / dead constant 移除 | Done | 移除 `onMoveToUnassigned` 註解/傳遞與 `STORAGE_KEY` |
| Phase 0 QA matrix 驗證 | Done | DND-01、DND-03、DND-04、DND-05 Browser 驗證；DND-02 utility smoke |

## 主要變更

### 1. DnD 決策集中化

- 新增 `src/utils/dndDrop.js`：
  - `findGuestSeat()`
  - `findSeatDropTarget()`
  - `resolveDropTarget()`
  - `moveGuestByDropTarget()`
- `App.jsx` 不再保留 primary branch / fallback branch 兩份 move/swap/toast 邏輯。
- 移除 production `console.log` / `console.warn` 的 DnD 訊息。

### 2. App orchestration 拆分

- 新增 `src/hooks/useGuestDragAndDrop.js`：管理 active guest、pointer tracking、dnd-kit sensors、drag start/end/cancel。
- 新增 `src/hooks/useLockedSeatMoves.js`：集中鎖定座位手動覆蓋確認。
- 新增 `src/hooks/useGuestImportFlow.js`：集中匯入與 headcount diagnostic toast。
- 新增 `src/hooks/useAutoSeatFlow.js`：集中 auto-seat preview / apply / close 流程。

### 3. State facade 內部拆分

- 新增 `src/hooks/usePersistedSeatingStore.js`：集中 Firebase listener、debounced save、local fallback ready state。
- 新增 `src/utils/seatingStateCore.js`：集中 `buildInitialState()`、`validateTableCapacity()`、`computeGuestMove()`。
- `useSeatingState()` 對外仍維持既有 facade 回傳，不要求 `App.jsx` 或其他消費者改用多個 state hook。

### 4. 桌面座位拖拉補強

- `TableZone` 的 filled seat 改為 `useDraggable()` + `useDroppable()` 共用同一 DOM ref。
- Filled seat 從原本的 native `button` 改為 `div role="button"`，避免拖拉起始事件與 button click 行為互相干擾。
- 保留鍵盤 Enter / Space 將座位移回未分配的既有操作語意。

## QA Matrix 結果

| Matrix ID | 結果 | 驗證方式 |
| --- | --- | --- |
| DND-01 未分配拖到空桌 | Pass | Browser：`Phase5 甲` 從未分配拖到 `1桌` 座位 1，未分配 3 -> 2，`1桌` 0/10 -> 1/10 |
| DND-02 滿桌拖入第 11 位 | Pass | `scripts/check-phase5-dnd-refactor.mjs` 驗證 move rejection 與 toast，不重複/不超量 |
| DND-03 同桌 swap | Pass | Browser：`1桌` 座位 1/2 的 `Phase5 甲`、`Phase5 乙` 成功交換，guest count 不變 |
| DND-04 跨桌移動 | Pass | Browser：`Phase5 乙` 從 `1桌` 移到 `2桌`，兩桌計數各自同步 |
| DND-05 桌上拖回未分配 | Pass | Browser：`Phase5 乙` 從 `2桌` 拖回未分配，`tableId` 回到未分配池語意 |
| INV-01 / INV-03 / INV-05 | Pass | DnD smoke 與 Browser 狀態檢查未發現重複、消失或容器不一致 |

## 驗證紀錄

- `npm run lint`：Pass
- `node scripts/check-phase5-dnd-refactor.mjs`：Pass
- `node scripts/check-phase1-data-integrity.mjs`：Pass
- `node scripts/check-phase2-google-sheets-sync.mjs`：Pass
- `node scripts/check-phase3-auto-seat-groups.mjs`：Pass
- `node scripts/check-phase4-export-contract.mjs`：Pass
- `npm run rules:check`：Pass
- `git diff --check`：Pass；僅有既有 CRLF 轉換警告
- `npm run build`：Pass；沙箱內因 Windows/Vite `spawn EPERM` 失敗，非沙箱重跑成功；保留既有 500 kB chunk warning
- Browser desktop verification：Pass；使用本機模式避免寫入 Firebase，console 僅有預期的 Firebase local-only warning，無本次驗證後新增 error

## Review

- Phase 5 目標已完成：DnD move/swap/drop-back 路徑集中化、`App.jsx` handler 拆分、`useSeatingState()` 內部拆分但外部 API 不變。
- 這次沒有新增狀態來源；Firebase debounce 與 listener 仍由 `useSeatingState()` facade 間接管理。
- 桌面 filled seat 拖拉需使用明確拖曳距離才會觸發 dnd-kit activation，符合目前 `activationConstraint: { distance: 8 }` 設定。
- 剩餘低風險項：production bundle 仍超過 500 kB，此為既有 chunk-size warning，非 Phase 5 範圍。
