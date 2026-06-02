# Phase 1：入口工作台與導覽骨架執行紀錄

> 日期：2026-06-01  
> 主責角色：`@designer`  
> 對應計畫：`Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md` Phase 1  
> 範圍：只處理登入後入口工作台、分頁導覽、總覽統計與主要 CTA；不改核心 drag-and-drop 資料流、不新增 icon/UI 套件。

## 1. 必讀與啟動檢查

已讀取：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/stitch-elegant-wedding-planner-modification-plan.md`
- `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`
- `Plan/stitch-elegant-wedding-planner-phase0-baseline.md`
- `Plan/stitch-elegant-wedding-planner-phase0-5-headcount-model.md`
- `D:\AI知識庫\projects\wedding-seating-planner.md`
- `D:\AI知識庫\lessons\043-vite-rolldown-build-spawn-eperm.md`
- `D:\AI知識庫\lessons\078-wedding-seating-firebase-qa-env-isolation.md`

本 Phase 依 `@designer` 角色執行，並載入 Taste / frontend testing / React best-practices 相關規則。另啟用一個唯讀 explorer 子代理盤點安全插入點；結論為保留 `App.jsx` 外層 `DndContext` 與 `FloorPlan` 內部 pointer/DnD 邏輯，只在 `#root-layout` 內新增 shell 與 tab。

## 2. 實作摘要

### 2.1 入口工作台

新增：

- `src/components/AppShell.jsx`
- `src/components/AppShell.css`
- `src/components/PlannerTabs.jsx`
- `src/components/DashboardHome.jsx`
- `src/components/DashboardHome.css`
- `src/components/ProgressSummary.jsx`

登入後預設顯示「總覽」分頁，內容包含：

- 來源筆數
- 實際人數
- 已分配座位
- 未分配座位
- 桌次數
- 滿桌數
- 排座完成度
- Firebase 狀態
- 最後儲存時間
- 主要 CTA：匯入名單、前往座位圖、匯出座位表

### 2.2 分頁骨架

- `PlannerTabs` 目前提供 `總覽` 與 `座位圖` 兩個可用分頁。
- `總覽` meta 顯示 `已分配 / 實際人數`。
- `座位圖` meta 顯示目前桌次數。
- 點擊「前往座位圖」或分頁會切換到原本的座位畫布流程。

### 2.3 保留既有排座流程

`App.jsx` 的以下區塊未改動核心邏輯：

- `DndContext` 仍包住主要 app 與 `DragOverlay`。
- `PointerSensor` activation distance 未改。
- `lastPointer` / `document.elementsFromPoint()` fallback 未改。
- `handleDragEnd()` 的 `over` 主路徑與 pointer fallback 未改。
- `FloorPlan.jsx` 未修改。

座位圖分頁仍渲染原本的：

- `Toolbar`
- `UnassignedPool`
- `FloorPlan`
- `floorPlanRef`
- `id="tables-area"`

### 2.4 視覺與響應式整理

- 新元件沿用 `App.css` 既有 OKLCH / CSS custom properties token。
- 未新增任何 icon 或 UI 套件。
- `Toolbar.jsx` 移除主要可見 emoji 標籤，改為一致的文字與 CSS brand mark。
- `Toolbar.css` 新增 wrap / grid responsive 行為，修正 Phase 0 發現的手機寬度工具列溢出風險。

## 3. 驗證結果

| 項目 | 結果 | 證據 |
| --- | --- | --- |
| `npm run lint` | PASS | ESLint exit code 0 |
| `npm run build` sandbox | EXPECTED BLOCKED | Vite/Rolldown config load 出現已知 `[plugin externalize-deps] Error: spawn EPERM` |
| KB lessons 查核 | PASS | 已查 `lessons/043-vite-rolldown-build-spawn-eperm.md` |
| `npm run build` escalated | PASS | Vite 8.0.10 build 成功，僅有既有 chunk > 500 kB warning |
| Dev server sandbox | EXPECTED BLOCKED | `npm run dev` 同樣因 Rolldown `spawn EPERM` 失敗 |
| Dev server escalated | PASS | `http://127.0.0.1:5181/wedding_seat/` 啟動成功 |
| Browser console | PASS | 桌機與 390px 檢查期間無 error/warn |
| 桌機總覽 | PASS | 1366x768：總覽預設頁渲染，6 張統計卡、3 個主要 CTA；未偵測重疊 |
| 切到座位圖 | PASS | 點「前往座位圖」後顯示座位圖分頁、Toolbar、UnassignedPool、FloorPlan |
| 390px 總覽 | PASS | 390x844：`scrollWidth = 384`、無水平 overflow；CTA 寬度 352px，可點擊 |
| 390px 座位圖 | PASS | 390x844：`scrollWidth = 384`、無水平 overflow；Toolbar / UnassignedPool / FloorPlan 存在 |

## 4. 風險與後續注意

- 目前正式 Firebase 既有資料缺少 `partyRows`，因此總覽的「來源筆數」可能為 0，但「實際人數」仍正確顯示 seat-unit 數。這是 Phase 0.5 的舊資料 fallback 行為，不在 Phase 1 修改。
- Phase 1 未新增賓客管理分頁；完整 party/seat-unit 表格與資料品質檢視留到 Phase 2。
- Phase 1 未重測 dnd-kit 拖拉，因本 Phase 未改 DnD handler 與 `FloorPlan`。座位圖渲染與入口切換已用 Browser 驗證。
- Dev server 目前跑在 `http://127.0.0.1:5181/wedding_seat/` 供人工檢查。

## 5. Review

Phase 1 完成入口工作台與導覽骨架：登入後先看到總覽，能掃描來源筆數、實際人數、分配狀態、桌次與 Firebase 狀態；一鍵可切到座位圖，既有排座流程未中斷。實作沒有新增 dependency，並保留 OKLCH token 與目前資料/拖拉核心。

建議下一步進入 Phase 2（`@engineer`）：賓客管理與資料品質檢視，補上 party/seat-unit 表格、搜尋篩選與拆桌/未分配原因警示。
