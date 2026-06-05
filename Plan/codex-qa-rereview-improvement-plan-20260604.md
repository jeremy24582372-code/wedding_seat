# Codex @qa 重新研究建議修改計畫書

日期：2026-06-04  
角色：`.agents/agents.md` 的 `@qa`  
範圍：本文件由 Codex 重新閱讀程式碼後產出，未採用既有 Gemini 產出的計畫書作為來源。

## 1. 研究方式

本次依 `@qa` 角色的偏執 QA 準則重新檢查，重點放在：

- 拖拉座位完整性：同桌換位、跨桌移動、桌位到未分配、未分配到桌位。
- 人數與桌容量：任何情境不得超過 10 人，且不得讓賓客消失或重複。
- Firebase 儲存與載入：遠端資料不得破壞本地不變式。
- Google Sheets 匯入與回寫：UI 顯示結果必須符合實際外部系統結果。
- 匯出一致性：CSV、PDF、完整 JSON 必須能反映目前記憶體狀態。

本次逐批閱讀的主要檔案：

- Batch 1：`src/hooks/useSeatingState.js`、`src/hooks/useFirebase.js`、`src/firebase.js`
- Batch 2：`src/hooks/useGoogleSheets.js`、`src/utils/importGuests.js`、`src/utils/googleSheetsRows.js`、`src/utils/googleSheetsPayload.js`、`src/utils/partyRows.js`
- Batch 3：`src/utils/autoSeatPlanner.js`、`src/utils/guestGroups.js`、`src/utils/guestDashboard.js`、`src/utils/constants.js`
- Batch 4：`src/App.jsx`、`src/main.jsx`
- Batch 5：`src/hooks/useExport.js`
- Batch 6：`src/components/FloorPlan.jsx`、`src/components/TableZone.jsx`、`src/components/GuestCard.jsx`、`src/components/UnassignedPool.jsx`、`src/components/Toolbar.jsx`
- Batch 7：`src/components/DashboardHome.jsx`、`src/components/GuestDashboard.jsx`、`src/components/GuestTable.jsx`、`src/components/GuestQualityPanel.jsx`、`src/components/GroupManager.jsx`、`src/components/GroupCard.jsx`、`src/components/AutoSeatRulesModal.jsx`、`src/components/AutoSeatPreview.jsx`
- Batch 8：`src/components/AppShell.jsx`、`src/components/AddGuestModal.jsx`、`src/components/PasswordGate.jsx`、`src/App.css`、`database.rules.json`、`apps-script-doPost.js`、`package.json`

## 2. QA 結論

目前專案功能輪廓完整，但 `@qa` 角度不應直接批准進入穩定版。主要風險不是單一畫面錯誤，而是「外部同步結果不可信」、「刪桌與鎖定狀態可能殘留」、「手動新增桌可能產生重複桌名」、「Firebase 規則未強制 10 人不變式」、「自動排位在特定設定下可能移動主桌既有賓客」。

建議先處理 P0/P1 的資料完整性與同步正確性，再做 UI/重構。不要先大改視覺或拆檔，否則會把目前真正的資料風險藏進重構噪音。

## 3. 主要發現

| 優先級 | 發現 | 證據位置 | 風險 | 建議 Phase |
| --- | --- | --- | --- | --- |
| P0 | Google Sheets 回寫可能「實際失敗但 UI 顯示成功」 | `src/hooks/useFirebase.js` 的 `syncToGoogleSheets` 只檢查 HTTP；`apps-script-doPost.js` 錯誤時回 `{ ok:false }` | 使用者以為已回寫桌次，實際外部表單未更新 | Phase 2 |
| P0 | 刪除有人的桌不需確認，且釋放賓客後未清除 `lockedAssignments` | `src/components/TableZone.jsx` 直接呼叫 `onRemove`；`src/hooks/useSeatingState.js` 的 `removeTable` 未清鎖 | 賓客回到未分配後仍可能被視為鎖定，自動排位跳過；一鍵誤刪整桌 | Phase 1 |
| P0 | 刪桌後未清 `tablePositions` | `src/hooks/useSeatingState.js` 的 `removeTable` 只刪 `tables` | 遠端/匯出資料殘留無效桌位座標 | Phase 1 |
| P0 | 手動新增桌可能產生重複桌名 | `src/hooks/useSeatingState.js` 的 `addTable` 使用 `tables.length + 1` | 匯出、同步、肉眼檢查都會出現歧義桌名 | Phase 1 |
| P0 | Firebase 規則未強制 app 的 10 人硬限制 | `database.rules.json` 允許 `seats` 1..20，`guestIds` index 未限 0..9 | 異常遠端資料可載入超過 app 合約的桌位狀態 | Phase 1 |
| P0 | 自動排位在不保留既有座位時可能移動主桌賓客 | `src/utils/autoSeatPlanner.js` 先移除所有 unlocked 候選人的既有座位，之後才排除主桌 | 主桌保留語意被設定組合破壞 | Phase 3 |
| P1 | 人數欄位被修正或截斷後缺少資料品質提示 | `src/utils/partyRows.js` 會 clamp；儀表板後續很難知道原始值異常 | Google Sheet 人數錯誤時，使用者未必知道資料已被系統修正 | Phase 3 |
| P1 | Firebase 狀態 UI 重複 | `src/components/AppShell.jsx` 已顯示狀態，`src/App.jsx` 又渲染一次 | 畫面冗餘，狀態來源不清楚 | Phase 6 |
| P1 | 群組規則文案與實際行為不一致 | `src/components/GroupManager.jsx` 說分開安排是人工警示，但 `autoSeatPlanner` 已執行 separate | 使用者對自動排位規則信任度下降 | Phase 3 |
| P1 | 同一賓客可被放入多個群組時缺少衝突提示 | `src/components/GroupManager.jsx` 建群時未提示跨群重疊 | 自動排位結果難以解釋 | Phase 3 |
| P1 | 匯出內容未完整呈現群組與鎖定資訊 | `src/hooks/useExport.js` 的 CSV/PDF 主要輸出座位與基本資料 | 作業交接只看 CSV/PDF 時，缺少鎖定與群組脈絡 | Phase 4 |
| P1 | PDF 列印可能被觸發兩次 | `src/hooks/useExport.js` 同時使用 `load` listener 與 fallback `setTimeout` | 使用者可能看到兩次列印對話框或重複動作 | Phase 4 |
| P1 | `html2canvas`、`jspdf` 仍在 dependencies 但目前匯出流程未使用 | `package.json` 與 `src/hooks/useExport.js` | 套件重量與維護成本無意義增加 | Phase 4 |
| P2 | DnD 邏輯重複且有 production `console.log` | `src/App.jsx` 的 `handleDragEnd` | 後續修拖拉 bug 容易漏改分支 | Phase 5 |
| P2 | 多個確認/同步 timeout 沒有 unmount cleanup | `GuestCard.jsx`、`TableZone.jsx`、`Toolbar.jsx`、`DashboardHome.jsx`、`PasswordGate.jsx` | 小型記憶體與狀態殘留風險 | Phase 6 |
| P2 | 大型檔案責任過重 | `App.jsx`、`FloorPlan.jsx`、`useSeatingState.js`、`useExport.js`、`App.css` | 開發者很難用局部推理保證拖拉與匯出正確 | Phase 5/6 |
| P2 | 死參數/未使用常數殘留 | `UnassignedPool.jsx` 的 `onMoveToUnassigned`、`constants.js` 的 `STORAGE_KEY` | API 語意混亂 | Phase 5 |

## 4. 建議修改 Phase

### Phase 0：QA Baseline 凍結

角色：`@qa`  
目的：先建立目前行為與風險基準，避免後續修改時不知道是否修對地方。  
狀態：本次重新研究已完成初版，但正式開發前仍建議補上可執行 QA checklist。

工作項目：

1. 把本文件作為 Phase 1 之前的 QA baseline。
2. 補一份最小 QA matrix：拖拉、匯入、回寫、匯出、Firebase 載入、10 人邊界。
3. 明確列出「不能改壞」的不變式：
   - 任一 guest id 只能存在於一個位置。
   - 任一桌最多 10 個座位單位。
   - 未分配清單不得包含不存在 guest。
   - `lockedAssignments` 不得指向不存在或未分配後不合理的 guest。
   - Google Sheets 回寫不得改變目前 `apps-script-doPost.js` 的目標 schema。

驗收：

- QA checklist 可以被後續每一 Phase 重跑。
- 所有 P0 發現都有對應修復 Phase。

### Phase 1：座位資料完整性 Hotfix

角色：`@engineer`  
目的：先修最容易造成資料錯亂的本地與 Firebase 不變式問題。

工作項目：

1. 修 `removeTable`：
   - 釋放該桌賓客到 `unassignedGuestIds`。
   - 清除這些賓客的 `lockedAssignments`，或明確定義「未分配仍可鎖定」的 UI 語意；以目前產品語意建議清除。
   - 移除該 `tableId` 的 `tablePositions`。
   - 去重並過濾不存在 guest id。
2. 修 `addTable`：
   - 改用現有桌名掃描，產生未使用的下一個 `N桌`。
   - 保持不建立 `1桌`，除非產品明確允許新增主桌。
3. 桌子刪除加確認：
   - 空桌可直接刪。
   - 有賓客的桌需二次確認，文案顯示會釋放幾位賓客。
4. 強化 Firebase load normalization：
   - 過濾不存在 guest id。
   - 去重 `unassignedGuestIds`。
   - 對每桌座位數與 guest id 做防禦性修正。
5. 修 `database.rules.json`：
   - 將 `tables.$tableIndex.seats` 限制回 10。
   - 限制 `guestIds` 只能使用 0..9 index。
   - 盡可能要求核心欄位存在，至少避免空殼 state 覆蓋完整資料。

驗收：

- 刪除有人的桌後，所有被釋放賓客都在未分配，且不再殘留鎖定。
- 新增桌永遠不會產生重複桌名。
- Firebase 載入異常資料後，不會出現超過 10 人桌位。
- 匯出 JSON 不含已刪桌的 `tablePositions`。

### Phase 2：Google Sheets 回寫真實性修復

角色：`@engineer`  
目的：讓 UI 顯示的同步成功/失敗與 Apps Script 實際結果一致。

工作項目：

1. 修改 `syncToGoogleSheets`：
   - 讀取 Apps Script 回傳 body。
   - 若 JSON 為 `{ ok:false }` 或 `{ success:false }`，必須視為失敗。
   - 錯誤訊息帶出 Apps Script 回傳的 message/error。
2. 檢查 CORS 與 Apps Script 部署模式：
   - 若目前可讀 response，直接解析。
   - 若部署環境只能 opaque response，需改成可檢查結果的部署方式或加入明確限制提示，不可假裝成功。
3. 保持目前回寫 schema：
   - `姓名`
   - `關係分類`
   - `飲食`
   - `桌次`
4. 修 `apps-script-doPost.js` 註解：
   - 將「取代 doGet」這類易混淆描述改成清楚的 `doPost` 部署說明。

驗收：

- Apps Script 主動回 `{ ok:false }` 時，前端 toast 必須顯示失敗。
- Apps Script 成功時才顯示同步完成。
- 不新增 `人數` 到回寫 payload，避免破壞既有同步表 schema。

### Phase 3：自動排位與群組規則一致性

角色：`@engineer`  
目的：修正自動排位在特殊設定下違反主桌/群組語意的問題。

工作項目：

1. 主桌防護：
   - 即使 `respectExistingAssignments=false`，也不要自動移動主桌既有賓客。
   - 或新增明確選項「允許重排主桌」，預設關閉。
2. 群組規則文案修正：
   - `separate` 若已被自動排位執行，UI 不應說只是人工警示。
3. 多群組衝突提示：
   - 同一 guest 出現在多個群組時，在群組管理或品質面板中顯示 warning。
   - 自動排位 preview 要能說明哪些群組規則被略過或互相衝突。
4. 人數資料品質：
   - 保留原始 `人數` 欄位值或新增 import diagnostics。
   - invalid、非整數、超過 10 被截斷時，要在儀表板顯示。

驗收：

- 主桌賓客在預設自動排位流程中不會被移走。
- 群組文案與實際演算法一致。
- 有衝突群組時，使用者能在 preview/app UI 看到原因。
- 錯誤人數資料不會被靜默修正而完全無提示。

### Phase 4：匯出契約與依賴清理

角色：`@engineer`  
目的：確保匯出可作為作業交接依據，並移除過時匯出依賴。

工作項目：

1. 修 PDF print 觸發：
   - 建立 one-shot print guard，避免 `load` 與 fallback 造成重複列印。
2. 檢查 CSV/PDF 欄位：
   - 評估加入群組名稱、鎖定狀態、同行角色等資訊。
   - 若不加入，文件要明確說明只有完整 JSON 是還原級備份。
3. 清理匯出 API：
   - `exportPDF(floorPlanRef)` 若不再使用 ref，移除參數與呼叫端假相依。
4. 移除未使用套件：
   - `html2canvas`
   - `jspdf`
5. 拆分 `useExport.js`：
   - 將 CSV、PDF HTML、floor map HTML、JSON export 分成可測試 helper。

驗收：

- 每次 PDF 匯出只觸發一次列印。
- CSV/PDF/JSON 的定位清楚：哪個是交接格式，哪個是完整備份。
- `npm install` 後不再安裝未使用的 PDF canvas 套件。

### Phase 5：DnD 與狀態邏輯可維護性

角色：`@engineer`  
目的：在 P0/P1 修完後，降低後續拖拉 bug 的修復成本。

工作項目：

1. 重構 `App.jsx` 的 `handleDragEnd`：
   - 抽出 `resolveDropTarget`。
   - 抽出 `moveGuestByDropTarget`。
   - 移除 fallback 與 primary branch 的重複移動邏輯。
2. 移除 production `console.log`。
3. 清理死 API：
   - `UnassignedPool.jsx` 未使用的 `onMoveToUnassigned`。
   - `constants.js` 未使用的 `STORAGE_KEY`。
4. 評估拆 `useSeatingState.js`：
   - table mutation
   - guest mutation
   - Firebase persistence
   - import integration

驗收：

- 所有拖拉路徑仍通過 QA matrix。
- `handleDragEnd` 不再需要在兩個分支維護同一批 move/swap/toast 邏輯。
- 沒有新增狀態來源。

### Phase 6：UI 一致性與互動清理

角色：`@designer`  
目的：整理視覺重複、確認互動與大型 UI 檔案，但不碰核心資料規則。

工作項目：

1. 移除重複 Firebase 狀態 UI：
   - 保留 `AppShell.jsx` 作為單一顯示位置。
   - 移除 `App.jsx` 內重複 badge。
2. 補 timeout cleanup：
   - `GuestCard.jsx`
   - `TableZone.jsx`
   - `Toolbar.jsx`
   - `DashboardHome.jsx`
   - `PasswordGate.jsx`
3. 拆分 `FloorPlan.jsx`：
   - pan/zoom hook
   - table drag/snap hook
   - selection/toolbar render
4. CSS 整理：
   - design tokens 保留集中。
   - component-specific 樣式拆分或至少分段。
   - 移除已刪 UI 的樣式。

驗收：

- Firebase 狀態只顯示一次。
- 快速切換頁面或 unmount 元件時，不會有延遲 setState 警告。
- Floor plan 互動視覺不退化。

### Phase 7：完整 QA Gate

角色：`@qa`  
目的：每個實作 Phase 結束後都必須由 QA 獨立驗收，最後做完整回歸。

測試矩陣：

1. 拖拉：
   - 同桌換位。
   - 跨桌移動。
   - 桌位拖回未分配。
   - 未分配拖到桌位。
   - 滿桌第 11 人不得進入。
   - 鎖定賓客被移動時需確認或被拒絕，依產品語意驗證。
2. 桌管理：
   - 空桌刪除。
   - 有人桌刪除確認。
   - 刪桌後賓客、鎖定、座標、匯出一致。
   - 刪桌後再新增桌，不得重複桌名。
3. Google Sheets：
   - 匯入一般資料。
   - 匯入重複姓名。
   - 匯入缺人數、非法人數、超過 10 人。
   - Apps Script 回 `{ ok:false }` 時前端顯示失敗。
   - 成功回寫後表格桌次符合 app state。
4. Firebase：
   - 儲存後重開載入。
   - 遠端資料缺欄位時 normalize。
   - 遠端資料超過 10 人時被拒絕或修正。
   - 兩個 client 修改時，不應靜默覆蓋較新資料。
5. 匯出：
   - CSV 桌次與 app state 一致。
   - PDF 桌圖與賓客清單一致。
   - JSON 可完整還原。
   - 未分配與分桌人數總和等於 guest count。

驗收：

- P0/P1 無未處理項。
- 全部 10 人邊界測試通過。
- 匯出與 Firebase state 的 guest count 完全一致。

## 5. 建議執行順序

建議順序：

1. Phase 1：先修座位資料完整性。
2. Phase 2：修 Google Sheets 回寫真實性。
3. Phase 3：修自動排位與群組語意。
4. Phase 4：修匯出與依賴。
5. Phase 5：重構 DnD 與狀態邏輯。
6. Phase 6：整理 UI 與互動清理。
7. Phase 7：最終 QA gate。

不建議一開始就做大型拆檔。資料完整性問題會影響後續所有測試，必須先處理。

## 6. Phase + Prompt 建議指令

### Phase 1 Prompt

```text
請使用 .agents/agents.md 中的 @engineer 角色執行 Phase 1：座位資料完整性 Hotfix。

請先閱讀：
- .agents/agents.md
- .agents/context.md
- Plan/codex-qa-rereview-improvement-plan-20260604.md
- src/hooks/useSeatingState.js
- src/components/TableZone.jsx
- database.rules.json

目標：
1. 修 removeTable 清除 released guests 的 lockedAssignments 與 tablePositions。
2. 修 addTable，避免刪桌後新增出重複桌名。
3. 有賓客的桌子刪除前必須二次確認。
4. Firebase 載入 normalize 要過濾不存在或重複 guest id，並守住 10 人上限。
5. database.rules.json 要符合 app 的 10-seat contract。

限制：
- 不要改 Google Sheets 回寫 schema。
- 不要做大型 UI redesign。
- 每次只改必要檔案。

完成後請列出驗證步驟與結果，並把剩餘風險交給 @qa。
```

### Phase 2 Prompt

```text
請使用 .agents/agents.md 中的 @engineer 角色執行 Phase 2：Google Sheets 回寫真實性修復。

請先閱讀：
- .agents/agents.md
- .agents/context.md
- Plan/codex-qa-rereview-improvement-plan-20260604.md
- src/hooks/useFirebase.js
- src/utils/googleSheetsPayload.js
- apps-script-doPost.js

目標：
1. 讓 syncToGoogleSheets 解析 Apps Script 回傳 body。
2. Apps Script 回 { ok:false } 或 { success:false } 時，前端必須顯示失敗。
3. 成功回寫時才顯示成功 toast。
4. 修正 apps-script-doPost.js 註解，避免 doGet/doPost 混淆。

限制：
- 回寫 payload 不新增「人數」欄位。
- 不改 Google Sheets 目標欄位 schema：姓名、關係分類、飲食、桌次。

完成後請附上成功與失敗 response 的驗證方式。
```

### Phase 3 Prompt

```text
請使用 .agents/agents.md 中的 @engineer 角色執行 Phase 3：自動排位與群組規則一致性。

請先閱讀：
- .agents/agents.md
- .agents/context.md
- Plan/codex-qa-rereview-improvement-plan-20260604.md
- src/utils/autoSeatPlanner.js
- src/utils/guestGroups.js
- src/utils/guestDashboard.js
- src/components/GroupManager.jsx
- src/components/AutoSeatPreview.jsx
- src/components/GuestQualityPanel.jsx

目標：
1. 預設自動排位不得移動主桌既有賓客，即使 respectExistingAssignments=false。
2. 修正 separate 群組規則的 UI 文案，使其符合實際演算法。
3. 偵測同一 guest 出現在多個群組的衝突並顯示 warning。
4. 匯入人數非法、被截斷或被修正時，儀表板需要可見提示。

完成後請提供至少三組測試案例：主桌保護、群組衝突、非法人數。
```

### Phase 4 Prompt

```text
請使用 .agents/agents.md 中的 @engineer 角色執行 Phase 4：匯出契約與依賴清理。

請先閱讀：
- .agents/agents.md
- .agents/context.md
- Plan/codex-qa-rereview-improvement-plan-20260604.md
- src/hooks/useExport.js
- src/App.jsx
- src/components/DashboardHome.jsx
- src/components/Toolbar.jsx
- package.json

目標：
1. 修 PDF print one-shot guard，避免重複觸發列印。
2. 釐清 CSV/PDF/JSON 匯出契約，必要時補上群組與鎖定資訊。
3. 移除 exportPDF 不再使用的 floorPlanRef 參數。
4. 移除未使用 dependencies：html2canvas、jspdf。
5. 將 useExport.js 拆成較小 helper，方便測試。

完成後請驗證 CSV/PDF/JSON 的 guest count 與 app state 一致。
```

### Phase 5 Prompt

```text
請使用 .agents/agents.md 中的 @engineer 角色執行 Phase 5：DnD 與狀態邏輯可維護性。

請先閱讀：
- .agents/agents.md
- .agents/context.md
- Plan/codex-qa-rereview-improvement-plan-20260604.md
- src/App.jsx
- src/components/UnassignedPool.jsx
- src/utils/constants.js
- src/hooks/useSeatingState.js

目標：
1. 重構 App.jsx 的 handleDragEnd，消除 primary branch 與 fallback branch 的重複拖拉邏輯。
2. 移除 production console.log。
3. 移除 UnassignedPool 的死 prop 與 constants.js 的未使用常數。
4. 評估 useSeatingState.js 是否可安全拆分；若風險過高，本 Phase 只留下拆分建議，不要硬拆。

完成後請用 @qa 的拖拉矩陣驗證四種拖拉路徑。
```

### Phase 6 Prompt

```text
請使用 .agents/agents.md 中的 @designer 角色執行 Phase 6：UI 一致性與互動清理。

請先閱讀：
- .agents/agents.md
- .agents/context.md
- Plan/codex-qa-rereview-improvement-plan-20260604.md
- src/components/AppShell.jsx
- src/App.jsx
- src/components/FloorPlan.jsx
- src/components/GuestCard.jsx
- src/components/TableZone.jsx
- src/components/Toolbar.jsx
- src/components/DashboardHome.jsx
- src/components/PasswordGate.jsx
- src/App.css

目標：
1. 移除重複 Firebase 狀態 UI，只保留 AppShell 作為單一來源。
2. 補上確認與同步 timeout 的 cleanup。
3. 拆分 FloorPlan 的 pan/zoom、table drag/snap、selection render 邏輯。
4. 清理 App.css 中已無使用的樣式與過度混雜區塊。

限制：
- 不改核心座位資料規則。
- 不改 Google Sheets/Firebase 資料 schema。

完成後請提供桌面與手機尺寸的 UI 檢查結果。
```

### Phase 7 Prompt

```text
請使用 .agents/agents.md 中的 @qa 角色執行 Phase 7：完整 QA Gate。

請先閱讀：
- .agents/agents.md
- .agents/context.md
- Plan/codex-qa-rereview-improvement-plan-20260604.md
- 本次所有 Phase 的變更 diff

目標：
1. 依本計畫書第 4 節 Phase 7 的測試矩陣逐項驗證。
2. 特別檢查 10 人上限、guest count 完整性、Firebase 載入、Google Sheets 回寫失敗顯示、CSV/PDF/JSON 匯出一致性。
3. 發現任何 P0/P1 問題時，不要批准，回報給對應角色修正。

輸出：
- QA 結論：Approve / Block。
- Block 時列出重現步驟、實際結果、預期結果、相關檔案。
- Approve 時列出已驗證矩陣與剩餘低風險項。
```

