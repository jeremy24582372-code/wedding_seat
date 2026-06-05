# 兩份 QA 計畫合併後的最佳執行解

日期：2026-06-04  
來源：

- `Plan/codex-qa-rereview-improvement-plan-20260604.md`
- `Plan/qa-full-review-improvement-plan.md`

## 目前參考檔案分工

目前整體修改流程以本檔為唯一入口：

- **整體 Phase 順序與每階段範圍**：`Plan/best-execution-plan-from-qa-reviews-20260604.md`
- **Phase 0 已完成的 QA matrix / 不變式 / P0-P1 歸屬**：`Plan/best-execution-plan-phase0-qa-baseline-20260604.md`
- **角色定義**：`.agents/agents.md`
- **專案資料模型與約束**：`.agents/context.md`

後續執行 Phase 1-7 時，請先讀本檔確認整體流程，再讀 Phase 0 baseline 確認驗收矩陣。兩份原始 QA 計畫只作為來源依據，不再作為執行入口。

## 決策結論

最佳執行解採用 `codex-qa-rereview-improvement-plan-20260604.md` 的優先順序，並吸收 `qa-full-review-improvement-plan.md` 的具體重構落點。

原因：

1. 資料完整性與外部同步可信度比大型拆檔更優先。若先拆 `App.jsx`、`useSeatingState.js`、`FloorPlan.jsx`，會把尚未修正的資料風險一起搬動，增加回歸成本。
2. `qa-full-review-improvement-plan.md` 把死碼、依賴瘦身與大型拆檔排在資料完整性之前，這不適合作為第一輪執行順序。
3. 兩份計畫重疊處應保留：`removeTable` 鎖定清理、刪桌確認、匯出欄位、未使用依賴、DnD 去重、Firebase badge 重複、CSS 治理。
4. `codex-qa-rereview` 多補了舊計畫缺少的 P0：Google Sheets 回寫假成功、Firebase rules 10 人限制、手動新增桌重複桌名、自動排位移動主桌。這些必須前置。

## 最佳 Phase 順序

| 順序 | Phase | 角色 | 核心目標 | 來源採納 |
| --- | --- | --- | --- | --- |
| 0 | QA Baseline 與測試矩陣 | `@qa` | 先凍結不變式與驗收矩陣 | 以 Codex QA 為主 |
| 1 | P0 座位資料完整性 Hotfix | `@engineer` | 修刪桌、鎖定、桌名、Firebase normalize、DB rules | Codex Phase 1 + Gemini Phase 9 |
| 2 | Google Sheets 回寫真實性 | `@engineer` | Apps Script 邏輯失敗不可顯示成功 | Codex Phase 2 |
| 3 | 自動排位、主桌與群組語意 | `@engineer` | 主桌保護、群組衝突、非法人數提示、重複 helper 合併 | Codex Phase 3 + Gemini W6 |
| 4 | 匯出契約與依賴瘦身 | `@engineer` | PDF one-shot、CSV/PDF/JSON 契約、移除 unused deps、拆 export builders | Codex Phase 4 + Gemini Phase 6/10 |
| 5 | DnD 與 App/state 模組化 | `@engineer` | 先 DnD 去重，再小步拆 `App.jsx` / `useSeatingState.js` | Codex Phase 5 + Gemini Phase 7 |
| 6 | FloorPlan 與 UI 一致性整理 | `@designer` | 拆互動 hooks、移除重複 Firebase badge、timeout cleanup、CSS token 分離 | Codex Phase 6 + Gemini Phase 8/12 |
| 7 | 最終 QA Gate | `@qa` | 全矩陣驗收，Block/Approve | 兩份計畫合併 |

## Phase 0：QA Baseline 與測試矩陣

角色：`@qa`

狀態：已完成  
產出：`Plan/best-execution-plan-phase0-qa-baseline-20260604.md`

目的：先建立所有 Phase 共用的驗收標準，避免後續每個角色各自定義「完成」。

必做：

1. 建立最小 QA matrix：
   - 匯入。
   - 拖拉。
   - 刪桌。
   - auto-seat。
   - Firebase reload。
   - Google Sheets sync。
   - CSV/PDF/JSON export。
2. 凍結核心不變式：
   - 任一 guest id 只存在於一個位置。
   - 任一桌最多 10 個 seat-unit。
   - `unassignedGuestIds` 不得有不存在或重複 guest id。
   - `lockedAssignments` 不得殘留在已刪除或不合理狀態。
   - `1桌` / `主桌` 預設不得被 auto-seat 重排。
   - Google Sheets sync output schema 不得新增 `人數`。

驗收：

- Phase 1 之後每個 Phase 都可重跑同一份 matrix。
- P0/P1 發現都有明確歸屬 Phase。

## Phase 1：P0 座位資料完整性 Hotfix

角色：`@engineer`

這是第一個實作 Phase。不要先做大型拆檔。

必做：

1. `removeTable`：
   - 釋放該桌 guests 到未分配。
   - 清除 released guests 的 `lockedAssignments`。
   - 移除該桌 `tablePositions[tableId]`。
   - 對 released guest ids 去重並過濾不存在 id。
2. `addTable`：
   - 改成掃描現有桌名，產生下一個未使用的 `N桌`。
   - 避免刪桌後新增出重複桌名。
3. `TableZone`：
   - 空桌可直接刪。
   - 有人的桌必須二次確認，並顯示會釋放幾位賓客。
4. Firebase normalize：
   - 載入時過濾不存在 guest id。
   - 去重 `unassignedGuestIds`。
   - 對 table seats / guestIds 做 10 人防禦性修正。
5. `database.rules.json`：
   - 將 table seats 限制為 app 合約的 10。
   - `guestIds` index 限制為 0..9。
   - 儘可能避免核心 state 空殼覆蓋完整資料。
6. 匯入 skipped 計數：
   - 區分「來源內重複」與「已匯入重複」，或至少在 toast 中說清楚。

驗收：

- 刪除有人的桌後，賓客回未分配、鎖定清除、座標清除。
- 新增桌不會重名。
- Firebase 異常資料不會讓 app 進入超過 10 人桌位。
- 匯入重複提示與實際行為一致。

## Phase 2：Google Sheets 回寫真實性

角色：`@engineer`

必做：

1. `syncToGoogleSheets` 必須讀取 Apps Script response body。
2. Apps Script 回 `{ ok:false }` 或 `{ success:false }` 時，前端必須顯示失敗。
3. 成功 toast 只能在外部系統明確成功後出現。
4. 修正 `apps-script-doPost.js` 註解，避免 `doGet` / `doPost` 混淆。
5. 保持 sync output schema：
   - `姓名`
   - `關係分類`
   - `飲食`
   - `桌次`

驗收：

- 模擬 Apps Script 邏輯失敗時，前端顯示錯誤。
- 成功回寫後，表格桌次與 app state 一致。
- 不新增 `人數` 欄位到回寫 payload。

## Phase 3：自動排位、主桌與群組語意

角色：`@engineer`

必做：

1. 主桌保護：
   - 即使 `respectExistingAssignments=false`，也不得預設移動 `1桌` / `主桌` 既有賓客。
   - 若要允許，必須是明確新選項，預設關閉。
2. 群組規則：
   - 修正文案，`separate` 若已由 auto-seat 執行，不可說只是人工警示。
   - 偵測同一 guest 出現在多個群組的衝突。
   - Preview 要說明規則衝突或略過原因。
3. 人數資料品質：
   - 保留原始 `人數` 值或 import diagnostics。
   - invalid、非整數、超過 10 被截斷時，要在 UI 中提示。
4. 重複 helper 合併：
   - 合併 `autoSeatPlanner.js` 與 `importGuests.js` 重複的 `emptySeats()` / `deriveGuestTableState()`。
   - 只做小型共用工具，不做大型架構搬移。

驗收：

- 主桌既有賓客不會被預設 auto-seat 移走。
- 群組 UI 文案與演算法一致。
- 群組衝突與非法人數可見。
- 匯入、auto-seat、preview 三者統計一致。

## Phase 4：匯出契約與依賴瘦身

角色：`@engineer`

必做：

1. PDF print one-shot guard：
   - 避免 `load` listener 與 fallback timeout 造成重複列印。
2. 匯出契約：
   - JSON 是完整還原級備份。
   - CSV/PDF 是作業交接格式。
   - CSV/PDF 若不含某些欄位，需明確說明；建議 CSV 加入群組與鎖定資訊。
3. CSV 增加欄位：
   - `群組名稱`
   - `群組偏好`
   - `鎖定狀態`
4. Dashboard 增加「匯出桌次圖」入口。
5. 移除未使用 dependencies：
   - `html2canvas`
   - `jspdf`
6. 拆分 `useExport.js`：
   - `printHTMLBuilder`
   - `floorPrintHTMLBuilder`
   - CSV helper
   - JSON helper

驗收：

- PDF 每次只觸發一次列印。
- CSV/PDF/JSON guest count 與 app state 一致。
- `npm run lint`、`npm run build` 通過。
- 移除依賴後匯出功能不退化。

## Phase 5：DnD 與 App/state 模組化

角色：`@engineer`

原則：先消除重複邏輯，再小步拆檔。不要用「行數達標」作為唯一目標。

必做：

1. `App.jsx` 的 DnD：
   - 抽 `resolveDropTarget`。
   - 抽 `moveGuestByDropTarget`。
   - 消除 primary branch 與 fallback branch 的重複 move/swap/toast 邏輯。
   - 移除 production `console.log`。
2. 死 API：
   - 移除 `UnassignedPool.jsx` 未使用的 `onMoveToUnassigned`。
   - 移除 `constants.js` 未使用的 `STORAGE_KEY`。
3. `App.jsx` 拆分：
   - import handler。
   - auto-seat handler。
   - DnD handler。
   - lock prompt handler。
4. `useSeatingState.js` 拆分評估：
   - 若可以安全拆，拆成 focused hooks。
   - 若需要大範圍改 API，先停在 DnD 去重，不硬拆。

驗收：

- 四種拖拉路徑通過：同桌換位、跨桌、桌到未分配、未分配到桌。
- 外部 API 不被無謂改動。
- 沒有新增狀態來源。
- `npm run lint`、`npm run build` 通過。

## Phase 6：FloorPlan 與 UI 一致性整理

角色：`@designer`

必做：

1. `FloorPlan.jsx`：
   - 拆 pan/zoom hook。
   - 拆 table drag/snap/smart guide hook。
   - 拆 selection hook。
   - 保留 TableZone droppable interface 不變。
2. Firebase status：
   - 只保留 `AppShell` 作為單一顯示來源。
   - 移除 `App.jsx` 內重複 badge。
3. Timeout cleanup：
   - `GuestCard.jsx`
   - `TableZone.jsx`
   - `Toolbar.jsx`
   - `DashboardHome.jsx`
   - `PasswordGate.jsx`
4. CSS：
   - 拆 `design-tokens.css`。
   - `App.css` 保留 layout skeleton。
   - 元件樣式歸位或至少清楚分段。
5. 視覺驗收：
   - 桌機。
   - 390px mobile。
   - 不重疊、不溢出、不破壞既有主流程。

驗收：

- Floor plan pan、zoom、snap、guide、multi-select 不退化。
- Firebase badge 只出現一次。
- 快速切換頁面不出現 delayed setState 風險。
- `npm run lint`、`npm run build` 通過。

## Phase 7：最終 QA Gate

角色：`@qa`

必做：

1. 分批讀取修改後 source，不一次讀全專案。
2. 依 QA matrix 驗證：
   - 10 人桌硬限制。
   - guest count 完整性。
   - headcount / party / seat-unit 統計。
   - Firebase fallback / reload。
   - Google Sheets sync success/failure。
   - removeTable → 鎖定清理 → auto-seat。
   - CSV/PDF/JSON 匯出一致性。
   - 桌機與 390px mobile 基本視覺。
3. 輸出：
   - `Approve` 或 `Block`。
   - Block 時列重現步驟、實際結果、預期結果、相關檔案。
   - Approve 時列驗收矩陣與剩餘低風險項。

驗收：

- P0/P1 無未處理項。
- 沒有資料遺失、重複 guest、超過 10 人桌。
- `npm run lint`、`npm run build` 通過。

## 建議 Prompt

### Phase 0 Prompt

Phase 0 已完成，原則上不要重跑；除非 QA baseline 本身要重建。若需重建，使用以下 prompt。

```text
請使用 .agents/agents.md 中的 @qa 角色執行 Phase 0：QA Baseline 與測試矩陣。

必讀：
- .agents/agents.md
- .agents/context.md
- Plan/best-execution-plan-from-qa-reviews-20260604.md

目標：
建立後續所有 Phase 共用的 QA matrix，覆蓋匯入、拖拉、刪桌、auto-seat、Firebase reload、Google Sheets sync、CSV/PDF/JSON export，並列出不可破壞的不變式。

限制：
- 不改 source code。
- 不使用 Browser。
- 輸出需可被 Phase 1–7 重複使用。
```

### Phase 1 Prompt

```text
請使用 .agents/agents.md 中的 @engineer 角色執行 Phase 1：P0 座位資料完整性 Hotfix。

必讀：
- .agents/agents.md
- .agents/context.md
- Plan/best-execution-plan-phase0-qa-baseline-20260604.md
- Plan/best-execution-plan-from-qa-reviews-20260604.md
- src/hooks/useSeatingState.js
- src/components/TableZone.jsx
- src/utils/importGuests.js
- database.rules.json

目標：
修 removeTable 清鎖定與 tablePositions、修 addTable 桌名唯一、有賓客刪桌二次確認、Firebase normalize 守住 10 人上限、database.rules.json 符合 10-seat contract，並修匯入 skipped 計數語意。

限制：
- 不改 Google Sheets sync output schema。
- 不做大型拆檔或 UI redesign。

完成後請依 Phase 0 QA matrix 回報：
- 跑過哪些 matrix ID。
- 哪些未跑與原因。
- 是否仍有 P0/P1 未處理。
- 驗證步驟與結果。
```

### Phase 2 Prompt

```text
請使用 .agents/agents.md 中的 @engineer 角色執行 Phase 2：Google Sheets 回寫真實性。

必讀：
- .agents/agents.md
- .agents/context.md
- Plan/best-execution-plan-phase0-qa-baseline-20260604.md
- Plan/best-execution-plan-from-qa-reviews-20260604.md
- src/hooks/useFirebase.js
- src/utils/googleSheetsPayload.js
- apps-script-doPost.js

目標：
讓 syncToGoogleSheets 解析 Apps Script response body；Apps Script 回 ok:false 或 success:false 時前端必須顯示失敗；成功 toast 只能在明確成功後出現；修正 doPost 註解。

限制：
- 不新增「人數」到 sync output schema。
- 目標欄位維持：姓名、關係分類、飲食、桌次。
```

### Phase 3 Prompt

```text
請使用 .agents/agents.md 中的 @engineer 角色執行 Phase 3：自動排位、主桌與群組語意。

必讀：
- .agents/agents.md
- .agents/context.md
- Plan/best-execution-plan-phase0-qa-baseline-20260604.md
- Plan/best-execution-plan-from-qa-reviews-20260604.md
- src/utils/autoSeatPlanner.js
- src/utils/importGuests.js
- src/utils/guestGroups.js
- src/utils/guestDashboard.js
- src/components/GroupManager.jsx
- src/components/AutoSeatPreview.jsx
- src/components/GuestQualityPanel.jsx

目標：
預設 auto-seat 不得移動主桌既有賓客；修正 separate 文案；偵測多群組衝突；讓非法/截斷人數可見；合併重複的座位狀態 helper。
```

### Phase 4 Prompt

```text
請使用 .agents/agents.md 中的 @engineer 角色執行 Phase 4：匯出契約與依賴瘦身。

必讀：
- .agents/agents.md
- .agents/context.md
- Plan/best-execution-plan-phase0-qa-baseline-20260604.md
- Plan/best-execution-plan-from-qa-reviews-20260604.md
- src/hooks/useExport.js
- src/App.jsx
- src/components/DashboardHome.jsx
- src/components/Toolbar.jsx
- package.json

目標：
修 PDF one-shot print guard；釐清 CSV/PDF/JSON 契約；CSV 加入群組與鎖定資訊；Dashboard 加入桌次圖匯出入口；移除 html2canvas/jspdf；拆分 useExport.js builders。

完成後請驗證 CSV/PDF/JSON guest count 與 app state 一致。
並依 Phase 0 QA matrix 回報跑過哪些 export 相關 matrix ID。
```

### Phase 5 Prompt

```text
請使用 .agents/agents.md 中的 @engineer 角色執行 Phase 5：DnD 與 App/state 模組化。

必讀：
- .agents/agents.md
- .agents/context.md
- Plan/best-execution-plan-phase0-qa-baseline-20260604.md
- Plan/best-execution-plan-from-qa-reviews-20260604.md
- src/App.jsx
- src/hooks/useSeatingState.js
- src/components/UnassignedPool.jsx
- src/utils/constants.js

目標：
先重構 handleDragEnd，抽 resolveDropTarget 與 moveGuestByDropTarget，消除 primary/fallback 重複邏輯；移除 console.log、死 prop、死常數；再小步拆 App.jsx 與 useSeatingState.js，若 API 風險過高則停止在去重。

完成後請用 QA matrix 驗證四種拖拉路徑。
```

### Phase 6 Prompt

```text
請使用 .agents/agents.md 中的 @designer 角色執行 Phase 6：FloorPlan 與 UI 一致性整理。

必讀：
- .agents/agents.md
- .agents/context.md
- Plan/best-execution-plan-phase0-qa-baseline-20260604.md
- Plan/best-execution-plan-from-qa-reviews-20260604.md
- src/components/FloorPlan.jsx
- src/components/AppShell.jsx
- src/App.jsx
- src/components/GuestCard.jsx
- src/components/TableZone.jsx
- src/components/Toolbar.jsx
- src/components/DashboardHome.jsx
- src/components/PasswordGate.jsx
- src/App.css

目標：
拆 FloorPlan pan/zoom/table drag/snap/selection hooks；移除重複 Firebase badge；補 timeout cleanup；拆 design-tokens.css 並整理 App.css。

限制：
- 不改核心座位資料規則。
- 不改 Firebase/Google Sheets schema。
```

### Phase 7 Prompt

```text
請使用 .agents/agents.md 中的 @qa 角色執行 Phase 7：最終 QA Gate。

必讀：
- .agents/agents.md
- .agents/context.md
- Plan/best-execution-plan-phase0-qa-baseline-20260604.md
- Plan/best-execution-plan-from-qa-reviews-20260604.md
- Phase 1–6 的變更 diff

目標：
依 QA matrix 驗證 10 人硬限制、guest count 完整性、Firebase reload、Google Sheets success/failure、removeTable 鎖定清理、CSV/PDF/JSON 匯出一致性、桌機基本視覺。

輸出：
- QA 結論：Approve / Block。
- Block 時列重現步驟、實際結果、預期結果、相關檔案。
- Approve 時列驗收矩陣與剩餘低風險項。
```
