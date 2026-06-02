# Phase 3：座位畫布整理執行紀錄

> 日期：2026-06-01  
> 主責角色：`@designer`  
> 對應計畫：`Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md` Phase 3  
> 範圍：整理座位圖分頁的工具列、未分配側欄、畫布控制與拖拉視覺回饋；不重寫 dnd-kit 核心，不新增自動排座或群組管理資料模型。

## 1. 必讀與啟動檢查

已讀取：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/stitch-elegant-wedding-planner-modification-plan.md`
- `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`
- `Plan/stitch-elegant-wedding-planner-phase2-guest-dashboard.md`
- `D:\AI知識庫\projects\wedding-seating-planner.md`
- `D:\AI知識庫\lessons\043-vite-rolldown-build-spawn-eperm.md`
- `D:\AI知識庫\lessons\051-browser-viewport-docs-and-readonly-dom.md`
- `D:\AI知識庫\lessons\079-vite-dev-server-child-process-cleanup.md`

本 Phase 依 `@designer` 角色執行，並套用 Taste / frontend-testing-debugging 準則。實作保留 `App.jsx` 外層 `DndContext`、`FloorPlan` 內部 pointer-based table drag、`TableZone` droppable seat slots、`floorPlanRef` 與 `id="tables-area"`。

## 2. 實作摘要

### 2.1 座位圖工作區狀態列

修改：

- `src/App.jsx`
- `src/App.css`

座位圖分頁新增 `seating-workspace__statusbar`，顯示：

- 操作提示：拖曳賓客到空位、滿桌可交換、點擊已安排座位移回未分配。
- 座位圖統計：未分配座位、滿桌數、來源列數。

### 2.2 畫布控制整理

修改：

- `src/components/FloorPlan.jsx`
- `src/components/FloorPlan.css`

保留原 pan / zoom / snap / smart-guide 核心，將控制整理為：

- 縮放與重置視角控制群。
- 格線吸附開關。
- 智慧輔助線開關。
- 畫布內新增桌次快捷按鈕。
- 模式狀態 chips：`格線吸附 開/關`、`輔助線 開/關`。

PDF 匯出的資料來源仍使用 state-based `exportFloorPDF()`，不依賴 live canvas DOM 擷取；`floorPlanRef` 與 `id="tables-area"` 未移除。

### 2.3 未分配側欄整理

修改：

- `src/components/UnassignedPool.jsx`
- `src/components/UnassignedPool.css`

未分配池改為「未分配座位」語意，補上可拖回此區取消安排的提示、同行 party 統計、drop active 邊框與背景回饋。空狀態移除 emoji，改為穩定文字。

### 2.4 座位、滿桌與 party 視覺辨識

修改：

- `src/components/TableZone.jsx`
- `src/components/TableZone.css`
- `src/components/GuestCard.jsx`
- `src/components/GuestCard.css`

新增或整理：

- 滿桌維持 `已滿 · 10 人` 與「只能交換座位」提示。
- 剩 1-2 位的桌次顯示「剩 N 位」接近滿桌狀態。
- 已佔座位被拖曳 hover 時顯示 swap target 視覺。
- party seat-unit 顯示 `主` / `同` 小標記；同行座位使用 double border 輔助辨識。
- 未分配 guest card 使用 category token 設定 CSS variable，party card 加上 `主要` / `同行` badge。
- 修正 `GuestCard` drag overlay className 沒有被 component 接收的問題。
- 工作區內主要操作圖示移除 emoji，改用文字與 CSS marker。

## 3. 驗證結果

| 項目 | 結果 | 證據 |
| --- | --- | --- |
| `npm run lint` | PASS | ESLint exit code 0 |
| `npm run build` sandbox | EXPECTED BLOCKED | Vite/Rolldown config load 出現已知 `[plugin externalize-deps] Error: spawn EPERM` |
| KB lessons 查核 | PASS | 已查 `lessons/043-vite-rolldown-build-spawn-eperm.md` |
| `npm run build` escalated | PASS | Vite 8.0.10 build 成功，僅有既有 chunk > 500 kB warning |
| Browser page identity | PASS | `http://127.0.0.1:5183/wedding_seat/`，title `-` |
| Browser blank / overlay | PASS | DOM snapshot 有 app 內容；1366x768 無 Vite/framework overlay |
| Browser console | PASS WITH EXPECTED WARN | 僅有隔離本機模式預期 Firebase warning，無 app error |
| 桌機座位圖視覺 | PASS | 1366x768：Toolbar、statusbar、未分配側欄、mode panel、FloorPlan 都渲染；`overflowX = 0` |
| 新增賓客 | PASS | 新增 `Phase3拖曳測試` 後未分配統計從 0 變 1 |
| 拖曳到空位 | PASS | CUA drag 將 `Phase3拖曳測試` 放入 1 桌空位；1 桌變 `1/10`，未分配變 0 |
| 點擊移回未分配 | PASS | 點擊已安排座位後，1 桌回到 `0/10`，未分配回 1 |
| 畫布控制 | PASS | 格線吸附與輔助線可切到關閉；畫布內 `加桌` 後桌數 10 -> 11 |
| 390px mobile DOM | PASS | 390x844：`scrollWidth = 384`、`overflowX = 0`、statusbar / toolbar / sidebar / mode panel 存在 |
| Browser screenshot | PARTIAL | 桌機截圖曾成功產出；切換 mobile viewport 後 Browser `Page.captureScreenshot` timeout，依 lesson 051 記為 Browser capture limitation，不作為 app failure |
| Dev server cleanup | PASS | port 5183 owning Node PID stopped with escalation；最後 URL 回傳 `stopped` |

## 4. 殘留風險與後續注意

- Browser screenshot 在 mobile viewport 後 timeout，但 DOM、console、overflow 與互動驗證皆通過；這符合既有 lesson 051 的工具限制模式。
- 本 Phase 沒有建立真正的 guestGroups / lockedAssignments，因此 `主` / `同` 只反映 Phase 0.5 的 party seat-unit，不是 Phase 5 群組管理狀態。
- 滿桌拒絕與已佔座交換邏輯沿用既有 `moveGuest()` / `swapGuestsBetweenSeats()`；本 Phase 驗證了空位拖入與點擊移回，完整滿桌邊界建議交給下一個獨立 `@qa` checkpoint。
- 本機 Browser 驗證使用隔離 env，避免寫入正式 Firebase。正式 Firebase 現有資料仍可能因舊 state 缺少 `partyRows` 而顯示來源列 0，屬 Phase 0.5 fallback 行為。

## 5. Review

Phase 3 已完成座位畫布整理：座位圖分頁有更清楚的工作區狀態列、未分配側欄、畫布控制群、模式狀態提示、滿桌/接近滿桌/交換目標/party seat-unit 視覺辨識。核心 dnd-kit 與 FloorPlan 拖桌、pan、zoom、snap、guide 流程保留，PDF 匯出範圍契約未破壞。

建議下一步可執行獨立 `@qa` checkpoint 檢查滿桌、交換、匯出與跨視圖一致性，或進入 Phase 4（`@engineer`）：自動排座規則設定。
