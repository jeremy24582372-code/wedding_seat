# Elegant Wedding Planner Entry Screen 修改計畫書

> 版本：v0.2  
> 日期：2026-06-01  
> 來源：Stitch 專案 `projects/10695919533281101892`，標題 `Elegant Wedding Planner Entry Screen`  
> 目標專案：`D:\Wedding\排座位`
> v0.2 修正：Google Sheets 匯入來源新增 `人數` 欄位，用於支援後續自動排座、群組連動與容量檢查。
> v0.3 補充：新增單一 agent 角色執行政策；每個 Phase 只能由 `.agents/agents.md` 中的一個角色主責執行，Prompt 細節另見 `Plan/stitch-elegant-wedding-planner-prompt-execution-plan.md`。

## 1. 背景與判讀依據

目前本地專案是 React + Vite 的「婚禮排座位幫手」，已具備 Google Sheets 匯入、Firebase Realtime Database 自動同步、拖拉排座畫布、10 人桌限制、Excel/PDF 匯出、密碼入口與本機模式 fallback。

最新資料來源已從 `姓名 / 關係分類 / 桌次` 調整為 `姓名 / 關係分類 / 桌次 / 人數`。其中 `人數` 不應只作為備註欄位，因為它會直接影響每桌 10 人容量、自動排座策略、家庭/同行者群組，以及後續的群組鎖定功能。

Stitch 專案顯示它不是單一首頁，而是一組完整產品化畫面。可辨識的畫面群如下：

| Stitch 畫面 | 對應產品意圖 | 本地專案現況 |
| --- | --- | --- |
| Elegant Wedding Planner Entry Screen | 入口首頁 / 工作台總覽 | 目前登入後直接進入排座工具，缺少總覽入口 |
| Guest Management and Stats Dashboard | 賓客管理與統計儀表板 | Toolbar 只有總賓客、已分配、未分配三個數字 |
| 賓客資料拆分與檢視介面 | 賓客資料表格化、分類、檢查 | 目前主要是左側未分配池，缺少全量資料檢視 |
| Interactive Seating Layout Canvas | 互動式座位畫布 | 已存在 `FloorPlan` / `TableZone`，但資訊層次可再整理 |
| Auto-Fill Logic Settings Overlay | 自動排座規則設定 | 尚未實作自動排座規則 |
| 賓客關聯管理與鎖定設定 | 群組關聯、同桌/分桌/鎖定 | 尚未實作關聯與鎖定資料模型 |
| 團體連動排座畫布介面 | 群組拖拉與同步移動 | 目前桌子可多選拖拉，賓客群組尚未連動 |

限制說明：Stitch 私有圖片與 HTML 下載 URL 在本機 shell 直接下載時回傳 authentication failed，因此本計畫以 Stitch MCP 回傳的專案 metadata、畫面標題、畫面尺寸、目前本地程式架構與既有知識庫紀錄作為依據。

## 2. 修改目標

本次修改不是重寫專案，而是把現有「可用的排座工具」升級成「婚禮排座工作台」。核心目標如下：

1. 建立入口工作台，讓使用者先看到進度、風險與下一步行動，而不是直接進入畫布。
2. 將賓客資料管理從左側清單提升為可檢查、可篩選、可批次整理的資料檢視。
3. 保留既有拖拉排座能力，改善畫布資訊架構與操作入口。
4. 分階段引入自動排座規則，不一次做黑箱演算法。
5. 加入群組關聯與鎖定概念，支援家人、朋友群、同桌偏好與不可同桌限制。
6. 維持現有架構穩定：React、Vite、Firebase RTDB、Google Sheets、dnd-kit，不新增大型狀態管理或後端服務。

## 3. 匯入資料契約修正：新增 `人數`

### 3.1 新來源欄位

Google Sheets 匯入來源應調整為：

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `姓名` | 是 | 主要聯絡人或代表姓名 |
| `關係分類` | 否 | `新郎親友 / 新娘親友 / 共同朋友 / 同事 / 其他` 或自訂分類；空白預設 `其他` |
| `桌次` | 否 | 可預先指定桌次，空白代表未分配 |
| `人數` | 是 | 此列代表的實際座位人數；空白或非法值預設 `1` |

`飲食` 維持舊資料相容欄位，不再是來源必填欄位。

### 3.2 建議資料模型方向

現有 app 把一筆 `guest` 視為一個座位單位；新增 `人數` 後，建議採「來源列 party + 座位單位 guest」雙層模型：

```js
partyRows: [
  {
    id: string,
    sourceName: string,
    category: string,
    tableLabel: string,
    headcount: number,
    guestIds: string[],
    source: 'import' | 'manual'
  }
]

guests: [
  {
    id: string,
    name: string,
    category: string,
    tableId: string | null,
    partyId: string | null,
    partyRole: 'primary' | 'companion',
    source: 'import' | 'manual'
  }
]
```

匯入時：

- `人數 = 1`：建立一個主要 guest。
- `人數 > 1`：建立一個 party，並展開為多個座位單位；主要聯絡人保留原姓名，同行者可用 `姓名 同行 1`、`姓名 同行 2` 這類內部顯示名。
- 同一 party 的座位單位預設建立一個「同桌偏好」群組，供後續群組連動與自動排座使用。
- 若來源列已有 `桌次`，所有展開座位單位應優先安排到該桌；若該桌剩餘容量不足，保留未分配並在資料品質檢視標示。

### 3.3 統計口徑

新增 `人數` 後，總覽與儀表板要同時區分：

| 指標 | 定義 |
| --- | --- |
| 來源筆數 / 戶數 | Google Sheets 的有效資料列數 |
| 實際人數 / 座位數 | `人數` 加總，亦即需要安排的座位總數 |
| 已分配座位 | 已放入桌次的 seat units 數 |
| 未分配座位 | 尚未放入桌次的 seat units 數 |
| 未完整安置 party | 同一來源列部分已分配、部分未分配，或被拆到不同桌的情況 |

## 4. 非目標

以下項目不納入第一輪修改：

- 不把 `人數` 只當成文字備註；它必須進入容量、匯入、統計與後續規則設計。
- 不移除 Firebase 本機模式 fallback。
- 不改 10 人桌硬限制。
- 不引入完整帳號系統、Firebase Auth 或後端 proxy。
- 不一次實作全自動最佳化排座演算法；先做可解釋、可回復的規則式建議。
- 不把 Stitch 畫面逐像素複製到程式碼；以產品意圖和資訊架構對齊為主。

## 5. 建議資訊架構

將現有單頁工具調整為「工作台 + 分頁」結構：

| 分頁 | 功能 | 優先級 |
| --- | --- | --- |
| 總覽 | 婚禮排座進度、來源筆數、實際人數、資料健康度、未完成事項、快速操作 | P0 |
| 賓客 | 全量賓客/party 表格、分類篩選、人數檢查、未分配原因、重複/缺欄檢查 | P0 |
| 座位圖 | 現有拖拉畫布、桌次編輯、未分配池、匯出 | P0 |
| 規則 | 自動排座條件、桌次偏好、分類混合比例 | P1 |
| 群組 | 由 `人數` 自動產生的同行群組、家族/朋友群組、同桌偏好、分桌限制、鎖定 | P1 |
| 匯出 | Excel、座位清單 PDF、桌次圖 PDF、同步 Google Sheets | P1 |

第一輪不一定要做 routing，可先在 `App.jsx` 內用 tab state 控制視圖，避免引入 React Router。

## 6. 分階段實作計畫

### 6.0 Agent 角色執行政策

本計畫執行時採「每個 Phase 只使用一個 `.agents/agents.md` 角色」的規則。角色只代表該 Phase 的主責執行者；若該 Phase 需要驗證，驗證項目仍由同一主責角色先完成並附上證據。跨角色 QA 或設計審查必須拆成獨立 checkpoint 或下一個 Prompt，不可混入同一 Phase。

| Phase | 主責角色 | 選擇理由 |
| --- | --- | --- |
| Phase 0：基線盤點與保護 | `@qa` | 主要任務是建立驗證基線、風險清單與 smoke 流程。 |
| Phase 0.5：`人數` 欄位與 party/seat-unit 模型 | `@engineer` | 主要任務是資料模型、匯入邏輯、容量計算與 Firebase schema 相容。 |
| Phase 1：入口工作台與導覽骨架 | `@designer` | 主要任務是工作台資訊架構、tab/CTA 互動與視覺層次。 |
| Phase 2：賓客管理與資料品質檢視 | `@engineer` | 主要任務是 party/seat-unit 資料檢視、篩選、品質判斷與狀態同步。 |
| Phase 3：座位畫布整理 | `@designer` | 主要任務是保留拖拉核心並改善畫布工具列、側欄與操作回饋。 |
| Phase 4：自動排座規則設定 | `@engineer` | 主要任務是可解釋 preview 演算法、規則資料結構與套用流程。 |
| Phase 5：群組關聯與鎖定 | `@engineer` | 主要任務是 group/lock 資料模型、Firebase 持久化與自動排座互動。 |

### Phase 0：基線盤點與保護

主責角色：`@qa`

目標：先確保目前專案狀態可重現，避免 UI 改造時破壞核心排座。

工作項目：

- 補齊目前畫面與資料流盤點：`App.jsx`、`useSeatingState.js`、`FloorPlan.jsx`、`Toolbar.jsx`、`UnassignedPool.jsx`。
- 建立修改前的基本驗證清單。
- 確認 `.env` 未提交、Firebase fallback 仍可運作。
- 對重要互動建立 smoke 測試腳本或手動 QA 流程。

驗收門檻：

- `npm run lint` 通過。
- `npm run build` 通過；若 sandbox 出現已知 Vite/Rolldown `spawn EPERM`，需用已核准方式重跑並記錄。
- 匯入、拖拉、換座、移回未分配、匯出、Firebase 狀態徽章皆可操作。

### Phase 0.5：`人數` 欄位與 party/seat-unit 模型

主責角色：`@engineer`

目標：先把資料來源的 `人數` 正確納入匯入、容量與統計，避免後續 UI 和自動排座建立在錯誤模型上。

建議修改：

- `apps-script-doPost.js` 的 `doGet()` 讀取 `人數` 欄位並輸出 `headcount`。
- `useGoogleSheets.js` 將 `row.headcount / row['人數']` 正規化為整數，非法或空白預設 `1`。
- `src/utils/importGuests.js` 支援 `headcount`：
  - 以來源列建立 party。
  - 依 `headcount` 展開成座位單位。
  - `headcount > 1` 的同行者保留同一 `partyId`。
  - 指定桌次容量不足時，不可超放，需回報「指定桌次剩餘座位不足」。
- `useSeatingState.js` 載入舊 Firebase state 時要補上 `partyRows: []`、`partyId: null`、`partyRole: 'primary'` 等 fallback。
- 更新 `stats`：同時提供 `partyTotal`、`seatTotal`、`assignedSeats`、`unassignedSeats`。
- 更新 `database.rules.json` 允許並驗證新增欄位。

驗收門檻：

- 來源列 `人數 = 2` 時，實際需要安排的座位數增加 2，而不是 1。
- 指定桌次剩餘容量不足時，不能塞爆 10 人限制。
- 總覽和賓客分頁能清楚區分「來源筆數」與「實際人數」。
- 重複匯入同一姓名且 `人數` 變更時，能修正 party 展開數，不留下孤兒同行者。
- 舊 Firebase 資料沒有 `partyRows` 時仍可正常載入。

### Phase 1：入口工作台與導覽骨架

主責角色：`@designer`

目標：對齊 Stitch 的 `Elegant Wedding Planner Entry Screen`，新增更完整的入口體驗。

建議新增元件：

- `src/components/AppShell.jsx`
- `src/components/AppShell.css`
- `src/components/DashboardHome.jsx`
- `src/components/DashboardHome.css`
- `src/components/ProgressSummary.jsx`
- `src/components/PlannerTabs.jsx`

主要內容：

- 頁首保留品牌：`排座位幫手`，可加上 `Jeremy & Yuri Wedding Seating` 作副標。
- 新增總覽卡片：來源筆數、實際人數、已分配座位、未分配座位、桌次數、滿桌數、最後儲存時間、Firebase 狀態。
- 新增待辦區：尚未匯入、尚未分配、滿桌、party 未完整安置、資料缺分類、尚未同步 Google Sheets。
- 新增主要 CTA：匯入名單、前往座位圖、匯出座位表。
- 將 Toolbar 的操作群拆到對應分頁，避免首頁工具列過度擁擠。

設計方向：

- 保留目前 OKLCH token 系統。
- 降低 emoji 圖示依賴，改用純 CSS icon 或一致的文字標籤；若未引入圖示庫，不新增 lucide 依賴。
- 桌面視覺偏工作台，不做行銷 hero。
- 入口頁要適合掃描，不要只有大圖與裝飾。

驗收門檻：

- 登入後先看到總覽。
- 一鍵可切到座位圖，現有排座流程不中斷。
- 手機寬度下分頁不重疊，CTA 可點擊。

### Phase 2：賓客管理與資料品質檢視

主責角色：`@engineer`

目標：對齊 Stitch 的 `Guest Management and Stats Dashboard` 與 `賓客資料拆分與檢視介面`。

建議新增元件：

- `src/components/GuestDashboard.jsx`
- `src/components/GuestDashboard.css`
- `src/components/GuestTable.jsx`
- `src/components/GuestQualityPanel.jsx`

主要內容：

- 建立全量賓客/party 表格：姓名、分類、`人數`、展開座位數、目前桌次、座位狀態、來源。
- 支援搜尋與分類篩選，沿用 `buildCategoryOptions()` 與 `normalizeCategory()`。
- 顯示資料品質問題：
  - 空姓名資料已過濾但可顯示匯入摘要。
  - `人數` 空白、非數字、小於 1 或超過合理上限。
  - 未分類或 `其他` 比例過高。
  - 重複姓名略過數。
  - 指定桌次已滿而未分配的人。
  - 同一 party 被拆到不同桌或未完整安排。
- 從表格開啟既有 `AddGuestModal` 編輯流程。

資料模型調整：

- `人數` 是容量與群組基礎，不能只從 UI 衍生；需要在 Phase 0.5 先完成 `partyRows` / `partyId` / `partyRole` 或等價模型。
- 若要保留匯入警告歷史，後續再新增 `importSummary`，不要在第一步硬塞進 Firebase。

驗收門檻：

- 表格顯示來源筆數、實際人數與總覽統計一致。
- 編輯賓客後表格、左側未分配池、桌次座位同步更新。
- 匯入後能正確呈現指定桌次與未分配狀態。

### Phase 3：座位畫布整理

主責角色：`@designer`

目標：保留現有 `Interactive Seating Layout Canvas` 能力，改善操作層次。

建議修改：

- `FloorPlan.jsx` 保留為核心畫布，不拆演算法。
- 將畫布控制區整理成固定工具列：重設視圖、縮放、格線吸附、智慧輔助線、加入桌次。
- 將未分配池視為座位圖分頁的側欄，不在其他分頁常駐。
- 桌次卡片的刪除、改名、滿桌狀態維持現有邏輯。
- 對多選桌次拖拉增加更明確的狀態提示。

驗收門檻：

- 拖拉賓客到空位、滿位拒絕、已佔座交換、點擊移回未分配都不回歸。
- 桌子拖拉、pan、zoom、snap、guide 仍正常。
- 匯出桌次圖 PDF 能抓到正確畫布範圍。

### Phase 4：自動排座規則設定

主責角色：`@engineer`

目標：對齊 Stitch 的 `Auto-Fill Logic Settings Overlay`，先做「可解釋的半自動建議」。

建議新增資料結構：

```js
seatingRules: {
  fillStrategy: 'balanced' | 'category-first' | 'keep-existing',
  respectExistingAssignments: true,
  maxPerCategoryPerTable: {},
  preferFillIncompleteTables: true,
  keepGroupsTogether: true
}
```

建議新增元件：

- `src/components/AutoSeatRulesModal.jsx`
- `src/components/AutoSeatPreview.jsx`
- `src/utils/autoSeatPlanner.js`

實作原則：

- 先產生 preview，不直接覆寫目前座位。
- Preview 顯示將移動幾位、會新增幾桌、哪些人因限制無法安排。
- 使用者按確認後才套用。
- 預設尊重既有座位，不搬動已安排的人。
- 自動排座必須以展開後的座位單位計算容量；同一 `partyId` 預設盡量同桌，容量不足時列為待確認衝突。

驗收門檻：

- 自動建議不超過每桌 10 人。
- 已安排且鎖定的人不被移動。
- 使用者取消 preview 時狀態完全不變。
- 套用後可透過既有手動拖拉修正。

### Phase 5：群組關聯與鎖定

主責角色：`@engineer`

目標：對齊 Stitch 的 `賓客關聯管理與鎖定設定` 與 `團體連動排座畫布介面`。

建議新增資料結構：

```js
guestGroups: [
  {
    id: string,
    name: string,
    guestIds: string[],
    sourcePartyId: string | null,
    preference: 'same-table' | 'nearby' | 'separate',
    locked: boolean,
    notes: string
  }
],
lockedAssignments: {
  [guestId]: boolean
}
```

建議新增元件：

- `src/components/GroupManager.jsx`
- `src/components/GroupCard.jsx`
- `src/components/LockBadge.jsx`

實作原則：

- 先支援手動建立群組與鎖定，不急著做複雜群組拖拉。
- `人數 > 1` 的來源列自動產生基礎同行群組，使用者可再改名、拆分或解除。
- 鎖定的賓客在自動排座 preview 中不可被搬動。
- 手動拖拉鎖定賓客時給出明確提示，避免默默失敗。
- 群組是否同桌先作為建議與警示，不阻止使用者手動覆蓋。

驗收門檻：

- 群組資料能保存到 Firebase 並 reload 後存在。
- 鎖定狀態影響自動排座 preview。
- 刪除賓客時群組引用同步清除。

## 7. 資料與 Firebase 變更策略

目前 Firebase app state 包含：

```js
{
  guests,
  tables,
  tablePositions,
  unassignedGuestIds,
  lastSaved
}
```

建議採向後相容擴充：

```js
{
  guests,
  tables,
  tablePositions,
  unassignedGuestIds,
  partyRows: [],
  guestGroups: [],
  lockedAssignments: {},
  seatingRules: {},
  lastSaved
}
```

規則：

- 新欄位必須給預設值，舊 Firebase state 載入不能 crash。
- `database.rules.json` 要同步允許新欄位並限制基本型別。
- `useSeatingState.js` 要集中 normalize app state，避免每個元件自行 fallback。
- Google Sheets sync 第一輪應回寫 `人數`，但不寫入 `guestGroups` 與 `seatingRules`，避免污染現有表格契約。
- 若座位單位被拆桌，同步回寫時需明確表示衝突，例如 `桌次` 顯示多桌摘要或在資料品質面板阻止同步，避免把錯誤結果覆蓋回來源表。

## 8. 建議檔案變更清單

優先新增：

- `src/components/AppShell.jsx`
- `src/components/AppShell.css`
- `src/components/PlannerTabs.jsx`
- `src/components/DashboardHome.jsx`
- `src/components/DashboardHome.css`
- `src/components/GuestDashboard.jsx`
- `src/components/GuestDashboard.css`
- `src/components/GuestTable.jsx`
- `src/components/GuestQualityPanel.jsx`
- `src/utils/partyRows.js`

中期新增：

- `src/components/AutoSeatRulesModal.jsx`
- `src/components/AutoSeatPreview.jsx`
- `src/components/GroupManager.jsx`
- `src/components/GroupCard.jsx`
- `src/components/LockBadge.jsx`
- `src/utils/autoSeatPlanner.js`
- `src/utils/seatingStateSchema.js`

需修改：

- `src/App.jsx`
- `src/App.css`
- `src/hooks/useSeatingState.js`
- `src/hooks/useGoogleSheets.js`
- `src/hooks/useExport.js`
- `src/utils/importGuests.js`
- `src/utils/constants.js`
- `apps-script-doPost.js`
- `database.rules.json`
- `README.md`
- `.agents/context.md`

## 9. 風險與控管

| 風險 | 影響 | 控管方式 |
| --- | --- | --- |
| UI 分頁改造破壞拖拉上下文 | 排座核心不可用 | `DndContext` 先保留在 `App.jsx`，不要過早拆到多層 context |
| Firebase state schema 擴充造成舊資料載入失敗 | 使用者資料消失或白屏 | 新增 normalize state helper，舊欄位全部 fallback |
| 自動排座結果不可解釋 | 使用者不敢套用 | 先做 preview，再確認套用 |
| `人數` 被當成單純顯示欄位 | 桌次容量錯誤，後續自動排座失真 | Phase 0.5 先完成 party/seat-unit 模型，所有統計以實際座位數為準 |
| 同一 party 展開後被拆到多桌 | 家庭或同行者安排不合理 | 預設同桌偏好，容量不足時標為資料品質警示 |
| 重複匯入時 `人數` 變更 | 多出或少掉同行者 seat units | 匯入 helper 要以 party 為單位修正展開結果 |
| 群組鎖定與手動拖拉衝突 | 操作困惑 | 鎖定只限制自動排座，手動拖拉先提示或二次確認 |
| 行動版畫布過擠 | 婚禮現場臨時操作困難 | 手機優先提供搜尋、賓客檢視與簡單移動；大型拖桌以桌機為主 |
| PDF 匯出抓錯 DOM | 交付給場地方的檔案錯誤 | 每次改畫布容器後重測 `exportPDF` 與 `exportFloorPDF` |

## 10. 驗證計畫

每個 Phase 都至少執行：

```bash
npm run lint
npm run build
```

核心互動驗證：

- 密碼 `20270123` 可登入。
- Firebase 未設定時進入本機模式，不卡 loading。
- Google Sheets 匯入空資料、重複資料、`人數` 空白/非法、指定桌次、桌次已滿都能提示。
- `人數 = 2` 的來源列會產生 2 個座位需求，總覽實際人數正確增加。
- `人數` 加總超過指定桌次剩餘容量時，不可超放。
- 拖拉賓客到空位成功。
- 拖到滿桌或非法位置有提示。
- 已佔座交換不產生重複 guest。
- 點擊座位可移回未分配。
- 新增、編輯、刪除賓客後各視圖一致。
- 匯出 Excel、座位清單 PDF、桌次圖 PDF 可產出。
- 同步 Google Sheets 成功與失敗都有 toast。
- Reload 後桌次位置、未分配池、partyRows、群組、鎖定狀態保留。

視覺驗證：

- Desktop：1366x768、1440x900。
- Mobile：390x844。
- 任何按鈕文字不得溢出。
- 分頁與工具列不得遮擋畫布。
- 表格在窄螢幕改為可橫向捲動或卡片式摘要。

## 11. 推薦執行順序

1. 先做 Phase 0，建立可回歸的驗證基線。
2. 先做 Phase 0.5，完成 `人數` 欄位、party/seat-unit 模型與容量統計。這是後續新功能的地基。
3. 接著做 Phase 1 + Phase 2，這兩階段最接近 Stitch 入口與儀表板畫面，也能立即改善使用體驗。
4. Phase 3 整理畫布，但避免重寫拖拉核心。
5. Phase 4 才加入自動排座 preview。
6. Phase 5 加群組與鎖定，因為它會牽涉資料模型與 Firebase rules。

建議第一個實作 PR / commit 只包含：

- AppShell / tabs
- DashboardHome
- GuestDashboard
- `人數` 欄位讀取與 party 展開模型
- 最小 CSS token 整理
- 不動自動排座演算法；群組只建立 `人數 > 1` 的基礎 party 關聯，不先做完整群組管理 UI

這樣能先取得 Stitch 入口設計的主要價值，同時把風險限制在 UI 組織層。

## 12. 完成定義

當以下條件都成立時，可視為 Stitch 入口改造第一階段完成：

- 使用者登入後看到總覽工作台，而不是直接落到畫布。
- 總覽能正確顯示來源筆數、實際人數、桌次、分配狀態與 Firebase 狀態。
- 賓客分頁能檢視全量 party/seat-unit 資料並開啟編輯。
- `人數` 欄位已進入匯入、統計、容量檢查與 Firebase state normalization。
- 座位圖分頁保留所有現有拖拉能力。
- 匯入、同步、匯出流程仍可用。
- `npm run lint` 與 `npm run build` 通過。
- README 或 `.agents/context.md` 已記錄新的資訊架構。
