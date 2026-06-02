# Elegant Wedding Planner Prompt 執行計畫書

> 版本：v1.0  
> 日期：2026-06-01  
> 補充來源：`Plan/stitch-elegant-wedding-planner-modification-plan.md` v0.3  
> 目的：把 Stitch 入口改造計畫拆成可直接交給 `.agents/agents.md` 角色執行的 Prompt。每個 Phase 只能使用一個角色。

## 1. 使用規則

1. 每個 Phase 只能指定一個 `.agents/agents.md` 角色執行。
2. 每次 Prompt 開始前，該角色必須先讀 `.agents/context.md`、原修改計畫書與本 Prompt 計畫書。
3. 如果執行中發現該 Phase 必須由另一個角色主責，立即停止，先修改兩份計畫書再繼續。
4. 驗證由該 Phase 主責角色先完成並留下證據；額外 QA 審查必須另開 checkpoint，不混入同一 Phase。
5. 每個 Phase 完成後，回報實際修改檔案、測試結果、殘留風險與下一個建議 Prompt。
6. 所有人類可讀文字維持繁體中文；程式註解維持既有英文慣例。

## 2. Phase 與角色對應

| 執行順序 | Phase | 使用角色 | 狀態 | 主責成果 |
| --- | --- | --- | --- | --- |
| 1 | Phase 0：基線盤點與保護 | `@qa` | 完成 | 建立修改前驗證基線、風險清單與 smoke 流程 |
| 2 | Phase 0.5：`人數` 欄位與 party/seat-unit 模型 | `@engineer` | 完成 | 完成 headcount 匯入、party/seat-unit 模型、容量統計與 Firebase 相容 |
| 3 | Phase 1：入口工作台與導覽骨架 | `@designer` | 完成 | 完成 AppShell、DashboardHome、PlannerTabs 與入口資訊架構 |
| 4 | Phase 2：賓客管理與資料品質檢視 | `@engineer` | 完成 | 完成 GuestDashboard、GuestTable、GuestQualityPanel 與資料品質邏輯 |
| 5 | Phase 3：座位畫布整理 | `@designer` | 完成 | 整理 FloorPlan 工具列、未分配側欄與拖拉視覺回饋 |
| 6 | Phase 4：自動排座規則設定 | `@engineer` | 完成 | 完成規則資料結構、preview-first auto seat planner 與套用流程 |
| 7 | Phase 5：群組關聯與鎖定 | `@engineer` | 完成 | 完成 guestGroups、lockedAssignments、群組 UI 與 Firebase 保存 |

## 3. Prompt 執行模板

每次開新任務時，先貼對應 Phase 的 Prompt。不要一次貼多個 Phase。

### Phase 0 Prompt

使用角色：`@qa`

```text
請以 `.agents/agents.md` 中的 @qa 角色執行 Phase 0：基線盤點與保護。

必讀：
- `.agents/context.md`
- `Plan/stitch-elegant-wedding-planner-modification-plan.md`
- `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`

目標：
- 在不修改產品功能的前提下，建立目前排座位工具的驗證基線。
- 盤點匯入、拖拉、換座、移回未分配、匯出、Firebase fallback 與 Firebase 狀態徽章。
- 產出後續 Phase 必須遵守的 smoke test 清單。

限制：
- 本 Phase 只能由 @qa 執行。
- 不做 UI 重構，不改資料模型，不導入新套件。
- 若測試過程遇到錯誤，先查 `D:\AI知識庫\lessons\` 再修復或記錄阻塞。

驗收：
- `npm run lint` 通過。
- `npm run build` 通過；若 sandbox 出現已知 Vite/Rolldown `spawn EPERM`，用已核准方式重跑並記錄。
- 補上 Phase 0 驗證紀錄，包含測試項目、結果、失敗修正與下一步風險。
```

### Phase 0.5 Prompt

使用角色：`@engineer`

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 0.5：`人數` 欄位與 party/seat-unit 模型。

必讀：
- `.agents/context.md`
- `Plan/stitch-elegant-wedding-planner-modification-plan.md`
- `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`

目標：
- 將 Google Sheets `人數` 欄位正規化為 `headcount`。
- 建立或等價實作 party/seat-unit 模型，讓 `人數 > 1` 會實際佔用多個座位。
- 保持 10 人桌硬限制、舊 Firebase state fallback 與既有匯入/拖拉流程。

建議範圍：
- `apps-script-doPost.js`
- `src/hooks/useGoogleSheets.js`
- `src/utils/importGuests.js`
- `src/hooks/useSeatingState.js`
- `src/hooks/useExport.js`
- `database.rules.json`
- 必要時更新 `.agents/context.md` 的資料契約

限制：
- 本 Phase 只能由 @engineer 執行。
- 不做 dashboard、auto-seat、group manager UI。
- 不把 `人數` 當備註欄位；必須影響容量、統計與匯入結果。

驗收：
- `人數 = 2` 會產生 2 個座位需求。
- 指定桌次容量不足時不可超過 10 人。
- 重複匯入同姓名且 `人數` 變更時，不留下孤兒同行者。
- 舊 Firebase 資料缺少新欄位時仍可載入。
- `npm run lint` 與 `npm run build` 通過。
```

### Phase 1 Prompt

使用角色：`@designer`

```text
請以 `.agents/agents.md` 中的 @designer 角色執行 Phase 1：入口工作台與導覽骨架。

必讀：
- `.agents/context.md`
- `Plan/stitch-elegant-wedding-planner-modification-plan.md`
- `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`

目標：
- 登入後先進入總覽工作台，而不是直接進入座位畫布。
- 新增 AppShell、PlannerTabs、DashboardHome、ProgressSummary 或等價元件。
- 顯示來源筆數、實際人數、已分配座位、未分配座位、桌次數、滿桌數、Firebase 狀態與主要 CTA。

限制：
- 本 Phase 只能由 @designer 執行。
- 不導入新 icon 或 UI 套件。
- 不改核心 drag-and-drop 資料流。
- 保留目前 OKLCH/CSS custom properties 設計 token。

驗收：
- 桌機寬度下分頁、CTA、統計卡不重疊。
- 一鍵可切到座位圖，既有排座流程不中斷。
- `npm run lint` 與 `npm run build` 通過。
```

### Phase 2 Prompt

使用角色：`@engineer`

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 2：賓客管理與資料品質檢視。

必讀：
- `.agents/context.md`
- `Plan/stitch-elegant-wedding-planner-modification-plan.md`
- `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`

目標：
- 建立賓客管理分頁，能檢視 party 與 seat-unit 狀態。
- 支援搜尋、分類篩選、桌次狀態檢視與資料品質警示。
- 資料品質至少涵蓋 `人數` 非法、指定桌次容量不足、party 被拆桌、未分配座位與重複匯入摘要。

建議範圍：
- `src/components/GuestDashboard.jsx`
- `src/components/GuestDashboard.css`
- `src/components/GuestTable.jsx`
- `src/components/GuestQualityPanel.jsx`
- 必要的 selector/helper utils

限制：
- 本 Phase 只能由 @engineer 執行。
- 不做 auto-seat preview。
- 不新增大型 table library。

驗收：
- 表格統計與總覽統計一致。
- 編輯、新增、刪除賓客後，賓客分頁、座位圖、未分配池狀態一致。
- `npm run lint` 與 `npm run build` 通過。
```

### Phase 3 Prompt

使用角色：`@designer`

```text
請以 `.agents/agents.md` 中的 @designer 角色執行 Phase 3：座位畫布整理。

必讀：
- `.agents/context.md`
- `Plan/stitch-elegant-wedding-planner-modification-plan.md`
- `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`

目標：
- 保留現有 FloorPlan 與 TableZone 的拖拉核心，整理畫布工具列、未分配側欄與互動提示。
- 改善滿桌、可放置、不可放置、群組/party 座位單位的視覺辨識。
- 確保 PDF 匯出仍能抓到正確畫布範圍。

限制：
- 本 Phase 只能由 @designer 執行。
- 不重寫 dnd-kit 核心。
- 不新增自動排座或群組管理資料模型。

驗收：
- 拖拉到空位、滿位拒絕、已佔座交換、移回未分配都不回歸。
- 桌子拖拉、pan、zoom、snap、guide 仍正常。
- `npm run lint` 與 `npm run build` 通過。
```

### Phase 4 Prompt

使用角色：`@engineer`

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 4：自動排座規則設定。

必讀：
- `.agents/context.md`
- `Plan/stitch-elegant-wedding-planner-modification-plan.md`
- `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`

目標：
- 實作 preview-first 的自動排座規則，不直接覆寫目前座位。
- 新增 seatingRules 資料結構、AutoSeatRulesModal、AutoSeatPreview 與 `src/utils/autoSeatPlanner.js` 或等價實作。
- 自動排座必須以展開後 seat units 計算容量，並預設盡量保持同一 party 同桌。

限制：
- 本 Phase 只能由 @engineer 執行。
- 不做黑箱最佳化演算法。
- 已安排且鎖定的人不可被 preview 移動。
- 使用者取消 preview 時，狀態必須完全不變。

驗收：
- 自動建議不超過每桌 10 人。
- Preview 明確列出移動人數、新增桌次與無法安排原因。
- 套用後仍可用手動拖拉修正。
- `npm run lint` 與 `npm run build` 通過。
```

### Phase 5 Prompt

使用角色：`@engineer`

```text
請以 `.agents/agents.md` 中的 @engineer 角色執行 Phase 5：群組關聯與鎖定。

必讀：
- `.agents/context.md`
- `Plan/stitch-elegant-wedding-planner-modification-plan.md`
- `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`

目標：
- 新增 guestGroups 與 lockedAssignments 或等價資料結構。
- `人數 > 1` 的來源列自動產生基礎同行群組。
- 支援手動建立、改名、拆分或解除群組，並讓鎖定狀態影響 Phase 4 的 auto-seat preview。

建議範圍：
- `src/components/GroupManager.jsx`
- `src/components/GroupCard.jsx`
- `src/components/LockBadge.jsx`
- `src/hooks/useSeatingState.js`
- `database.rules.json`

限制：
- 本 Phase 只能由 @engineer 執行。
- 群組偏好先作為建議與警示，不強制阻止使用者手動覆蓋。
- 刪除賓客時必須清除 group/lock 引用。

驗收：
- 群組與鎖定狀態能保存到 Firebase 並 reload 後存在。
- 鎖定狀態會影響 auto-seat preview。
- 手動拖拉鎖定賓客時有明確提示或二次確認。
- `npm run lint` 與 `npm run build` 通過。
```

## 4. 可選 QA Checkpoint

這不是產品 Phase，因此不破壞「每個 Phase 只用一個角色」的規則。建議在 Phase 2、Phase 4、Phase 5 完成後另開對話執行。

```text
請以 `.agents/agents.md` 中的 @qa 角色執行獨立 QA checkpoint。

只檢查已完成 Phase，不新增功能。請讀：
- `.agents/context.md`
- `Plan/stitch-elegant-wedding-planner-modification-plan.md`
- `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`
- 前一個 Phase 的完成紀錄

驗證重點：
- 10 人桌硬限制
- headcount/party/seat-unit 統計一致性
- Firebase fallback 與 reload 後資料完整性
- 匯入、拖拉、匯出、同步 Google Sheets
- 桌機與 390px 行動寬度基本視覺檢查

輸出：
- Findings by severity
- 必修項目
- 可延後項目
- 是否允許進入下一個 Phase
```

## 5. 本次文件更新 Review

- 原修改計畫書已補上 v0.3 單一角色執行政策。
- 本 Prompt 計畫書已將 Phase 0、0.5、1、2、3、4、5 各自綁定到單一角色。
- `@qa` 僅主責 Phase 0 與可選獨立 checkpoint；不混入其他 Phase 的執行責任。
- 若後續新增 Phase，必須同步更新原計畫書與本 Prompt 計畫書的角色對應表。

## 6. Phase 執行紀錄

- 2026-06-01：Phase 0 已由 `@qa` 完成，紀錄見 `Plan/stitch-elegant-wedding-planner-phase0-baseline.md`。
- 2026-06-01：Phase 0.5 已由 `@engineer` 完成，紀錄見 `Plan/stitch-elegant-wedding-planner-phase0-5-headcount-model.md`。
- 2026-06-01：Phase 1 已由 `@designer` 完成，紀錄見 `Plan/stitch-elegant-wedding-planner-phase1-entry-workbench.md`。
- 2026-06-01：Phase 2 已由 `@engineer` 完成，紀錄見 `Plan/stitch-elegant-wedding-planner-phase2-guest-dashboard.md`。
- 2026-06-01：Phase 3 已由 `@designer` 完成，紀錄見 `Plan/stitch-elegant-wedding-planner-phase3-canvas-cleanup.md`。
- 2026-06-02：Phase 4 已由 `@engineer` 完成，紀錄見 `Plan/stitch-elegant-wedding-planner-phase4-auto-seat-rules.md`。
- 2026-06-02：Phase 5 已由 `@engineer` 完成，紀錄見 `Plan/stitch-elegant-wedding-planner-phase5-groups-locks.md`。
