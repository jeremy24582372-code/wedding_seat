# Phase 0 QA Baseline 與測試矩陣

日期：2026-06-04  
角色：`.agents/agents.md` 的 `@qa`  
來源：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/best-execution-plan-from-qa-reviews-20260604.md`

## 執行範圍

Phase 0 只建立後續 Phase 1-7 共用的驗收標準與 QA matrix。

- 不修改 `src/` source code。
- 不使用 Browser。
- 不讀完整 source；只做 `src/` 目錄與行數盤點。
- 後續 code review 必須依 `@qa` 角色規則分批讀檔，不一次讀完整專案。

## 狀態追蹤

| 項目 | 狀態 | 備註 |
| --- | --- | --- |
| 讀取 `@qa` 角色 | Done | 已確認 QA 目標、不變式與分批審查限制 |
| 讀取專案 context | Done | 已確認資料模型、10 人硬限制、Firebase/Google Sheets contract |
| 讀取 Phase 0 需求 | Done | 以最佳執行解的 Phase 0 為準 |
| 盤點 `src/` 批次 | Done | 產出 18 個後續 review batch |
| 建立 QA matrix | Done | 覆蓋匯入、拖拉、刪桌、auto-seat、Firebase、Google Sheets、export |
| 凍結核心不變式 | Done | 後續 Phase 不得破壞 |
| P0/P1 歸屬 | Done | 每個風險指向後續 owner phase |

## 後續 Source Review 批次計畫

> Phase 0 不執行 source code review；以下批次供 Phase 7 或獨立 QA review 接續使用。

| Batch | 類別 | 檔案 | 估計行數 | 目的 |
| --- | --- | --- | ---: | --- |
| 1 | State core | `src/hooks/useSeatingState.js` | 611 | guest/table/unassigned/lock normalize 與 mutation 不變式 |
| 2 | Export hook | `src/hooks/useExport.js` | 567 | JSON/CSV/PDF 契約與 one-shot print guard |
| 3 | Integration hooks | `src/hooks/useFirebase.js`, `src/hooks/useGoogleSheets.js`, `src/hooks/useToast.js`, `src/firebase.js` | 242 | Firebase fallback、sync 狀態、Sheets import error |
| 4 | Auto-seat planner | `src/utils/autoSeatPlanner.js` | 561 | preview-first、主桌、群組、capacity |
| 5 | Import/data quality | `src/utils/importGuests.js`, `src/utils/guestDashboard.js` | 508 | headcount、partyRows、重複匯入、品質警示 |
| 6 | Data contract utils | `src/utils/constants.js`, `src/utils/googleSheetsPayload.js`, `src/utils/googleSheetsRows.js`, `src/utils/guestGroups.js`, `src/utils/partyRows.js` | 347 | schema、payload、group/party normalization |
| 7 | App entry | `src/App.jsx`, `src/main.jsx` | 517 | DnD handler、tab state、handler orchestration |
| 8 | Floor plan JSX | `src/components/FloorPlan.jsx` | 583 | pan/zoom/table drag/snap/selection |
| 9 | Table component | `src/components/TableZone.jsx` | 274 | seats、delete table、locked prompt、drop targets |
| 10 | Guest pool/cards | `src/components/GuestCard.jsx`, `src/components/UnassignedPool.jsx`, `src/components/LockBadge.jsx` | 252 | drag card、unassigned target、lock display |
| 11 | Commands/modals | `src/components/Toolbar.jsx`, `src/components/AddGuestModal.jsx`, `src/components/AutoSeatRulesModal.jsx`, `src/components/AutoSeatPreview.jsx` | 540 | import/sync/export/autoseat command states |
| 12 | Dashboard components | `src/components/DashboardHome.jsx`, `src/components/GuestDashboard.jsx`, `src/components/GuestTable.jsx`, `src/components/GuestQualityPanel.jsx`, `src/components/ProgressSummary.jsx` | 562 | stats、quality matrix、management actions |
| 13 | Shell/group/misc | `src/components/GroupManager.jsx`, `src/components/GroupCard.jsx`, `src/components/AppShell.jsx`, `src/components/PlannerTabs.jsx`, `src/components/PasswordGate.jsx`, `src/components/ErrorBoundary.jsx`, `src/components/Toast.jsx` | 566 | group UI、shell status、auth/toast safety |
| 14 | Global CSS | `src/App.css`, `src/index.css` | 626 | design tokens、global layout、overflow risk |
| 15 | Floor/table CSS | `src/components/FloorPlan.css`, `src/components/TableZone.css` | 778 | canvas/table visual states |
| 16 | Dashboard/group CSS | `src/components/GuestDashboard.css`, `src/components/DashboardHome.css`, `src/components/GroupManager.css` | 1069 | dashboard/group responsive behavior |
| 17 | Command/form CSS | `src/components/AddGuestModal.css`, `src/components/AutoSeatRulesModal.css`, `src/components/Toolbar.css`, `src/components/Toast.css`, `src/components/PasswordGate.css` | 908 | modals, toolbar, toast, login responsiveness |
| 18 | Shell/card CSS | `src/components/AppShell.css`, `src/components/GuestCard.css`, `src/components/UnassignedPool.css`, `src/components/LockBadge.css` | 521 | shell/card/pool lock visuals |

## 核心不變式

| ID | 不變式 | 驗證重點 | 破壞時歸屬 |
| --- | --- | --- | --- |
| INV-01 | 任一 guest id 只能存在於一個位置 | 不可同時在多桌、同桌重複、桌上又在未分配 | Phase 1 / Phase 5 |
| INV-02 | 任一桌最多 10 個 seat-unit | UI、state mutation、Firebase normalize、DB rules 都要守住 | Phase 1 |
| INV-03 | `unassignedGuestIds` 必須只含存在且不重複的 guest id | 匯入、刪桌、拖回未分配、Firebase reload 後都成立 | Phase 1 |
| INV-04 | `tables[].guestIds` 必須只含存在且不重複的 guest id | Firebase 異常資料與手動 mutation 後都要修正或拒絕 | Phase 1 |
| INV-05 | `guest.tableId` 必須與實際容器一致 | 在桌上則指向該桌；未分配則為 `null` | Phase 1 / Phase 5 |
| INV-06 | `lockedAssignments` 不得殘留不存在 guest 或已釋放的不合理鎖定 | 刪桌釋放 guest 時必須清除該批鎖定 | Phase 1 |
| INV-07 | `tablePositions` 只可含存在的 table id | 刪桌後座標必須清除 | Phase 1 |
| INV-08 | `1桌` / `主桌` 預設不得被 auto-seat 重排或補入未分配賓客 | 即使 `respectExistingAssignments=false` 也要保護主桌既有賓客 | Phase 3 |
| INV-09 | `partyRows.headcount` 為 1-10 整數，且 `guestIds` 對應存在 seat-unit | 人數變更重匯入不得留下 orphan companion | Phase 1 / Phase 3 |
| INV-10 | `guestGroups[].guestIds` 必須只含存在 guest id | 刪除 guest 或重匯入後不得殘留無效群組成員 | Phase 1 / Phase 3 |
| INV-11 | Google Sheets sync output schema 不得新增 `人數` | 回寫 payload 只允許 `姓名`、`關係分類`、`飲食`、`桌次` | Phase 2 |
| INV-12 | 成功提示只能在外部系統明確成功後出現 | Apps Script 回 `{ ok:false }` / `{ success:false }` 不可顯示成功 | Phase 2 |
| INV-13 | JSON export 是完整還原級備份 | 必須包含 guests/tables/positions/unassigned/partyRows/groups/rules/locks | Phase 4 |
| INV-14 | CSV/PDF/JSON 的 guest count 必須與 in-memory state 一致 | 不可漏 companion、重複 guest、錯桌次 | Phase 4 / Phase 7 |

## 最小 QA Matrix

| ID | 範圍 | 測試情境 | 前置資料 | 驗收標準 | Owner Phase |
| --- | --- | --- | --- | --- | --- |
| IMP-01 | 匯入 | 空列、缺分類、缺 `人數` 的來源資料 | Sheets 回傳混合空列與合法列 | 空列跳過；分類 fallback；缺 `人數` 顯示可理解警示或 diagnostic | Phase 3 |
| IMP-02 | 匯入 | 同名來源列重複匯入 | 已有同名 guest/partyRows | 不新增重複 seat-unit；提示區分來源內重複與已匯入重複 | Phase 1 |
| IMP-03 | 匯入 | `人數` 從 3 改成 1 後重匯入 | 既有 party 有 companions | 多餘 companion 從 tables/unassigned/groups/locks 清除，無 orphan id | Phase 1 |
| IMP-04 | 匯入 | 指定桌次容量不足 | 目標桌已有 9 人，來源列 `人數=3` | 不超過 10 人；未能安置的 seat-unit 有明確結果或警示 | Phase 1 |
| DND-01 | 拖拉 | 未分配拖到空桌 | 1 位未分配，空桌 | guest 從 unassigned 移除、進入 table、`tableId` 正確 | Phase 5 |
| DND-02 | 拖拉 | 10/10 滿桌拖入第 11 位 | 滿桌 + 1 位未分配 | 操作被拒或 swap 規則明確；總數不變；無重複 id | Phase 1 / Phase 5 |
| DND-03 | 拖拉 | 同桌 reorder / swap | 同桌至少 2 位 | seats 順序變更正確；guest count 不變；無重複 id | Phase 5 |
| DND-04 | 拖拉 | 跨桌移動 | 來源桌、目標桌未滿 | 來源移除、目標加入、`tableId` 同步 | Phase 5 |
| DND-05 | 拖拉 | 桌上 guest 拖回未分配 | 已安排 guest | `tableId=null`；unassigned 唯一；鎖定 guest 需確認 | Phase 1 / Phase 5 |
| DEL-01 | 刪桌 | 刪除空桌 | 空桌有 `tablePositions` | table 與 position 同步移除 | Phase 1 |
| DEL-02 | 刪桌 | 刪除有人的桌 | 桌上有人且部分 locked | 二次確認；guest 回未分配；released locks 清除；position 清除 | Phase 1 |
| DEL-03 | 刪桌/新增 | 刪除 `3桌` 後新增桌 | 現有桌名非連續 | 新桌使用下一個未使用 `N桌`，不與既有 label 重名 | Phase 1 |
| AUTO-01 | auto-seat | 產生 preview 但取消 | 有未分配 guest | state 完全不變；只顯示 preview | Phase 3 |
| AUTO-02 | auto-seat | 主桌保護 | `1桌` / `主桌` 已有人，規則關閉 respect existing | 既有主桌 guest 不被移出；未分配不補入主桌 | Phase 3 |
| AUTO-03 | auto-seat | 同行或 same-table group 錨定 | 同群組部分成員已在某桌 | 未分配成員補到錨定桌；容量不足則 blocked，不靜默拆桌 | Phase 3 |
| AUTO-04 | auto-seat | separate / nearby 群組語意 | 同群組多位未分配或已有錨點 | separate 不同桌；nearby 優先參考已安排成員桌次 | Phase 3 |
| AUTO-05 | auto-seat | stale preview | preview 後手動改座位 | 套用時要求重新產生 preview，不套用過期計畫 | Phase 3 |
| FB-01 | Firebase reload | 未設定 Firebase | `db=null` | App 進入本機模式，不 crash，不卡 loading | Phase 7 |
| FB-02 | Firebase reload | 舊資料缺 `partyRows` / `guestGroups` / `locks` | 舊 schema state | fallback 為安全預設；UI 可正常載入 | Phase 1 |
| FB-03 | Firebase reload | 異常資料含重複 guest id、超過 10 人桌、stale lock | 手工 malformed state | normalize 後不超過 10；不存在 id 被移除；不 crash | Phase 1 |
| FB-04 | Firebase sync | 兩個 client 接近同時變更 | A/B client state | 後載入者可 graceful recovery；不得白屏或產生 invalid state | Phase 7 |
| SYNC-01 | Google Sheets sync | Apps Script 明確成功 | response `{ ok:true }` 或 `{ success:true }` | 只在明確成功後顯示成功 toast/label | Phase 2 |
| SYNC-02 | Google Sheets sync | Apps Script 邏輯失敗 | HTTP 200 + `{ ok:false }` 或 `{ success:false }` | 前端顯示失敗；不得顯示成功 | Phase 2 |
| SYNC-03 | Google Sheets sync | HTTP/network failure 或 timeout | fetch reject / non-2xx | 顯示失敗；Toolbar 不殘留成功狀態 | Phase 2 |
| SYNC-04 | Google Sheets sync | 檢查回寫 schema | 任意目前 state | payload 欄位只含 `姓名`、`關係分類`、`飲食`、`桌次`；不含 `人數` | Phase 2 |
| EXP-01 | JSON export | 完整備份 | 含 partyRows/groups/locks/rules 的 state | JSON 可還原所有核心 state，guest count 一致 | Phase 4 |
| EXP-02 | CSV export | 桌次交接 | 多桌、未分配、群組、locked | CSV guest count 一致；桌次正確；缺欄位需明確定義 | Phase 4 |
| EXP-03 | PDF seating list | 座位清單列印 | 多桌 + companion | PDF/print HTML guest count 與桌次一致 | Phase 4 |
| EXP-04 | PDF floor plan | 桌次圖列印 | 有自訂 tablePositions | 每次只觸發一次 print；桌位與畫面一致 | Phase 4 |
| EXP-05 | Export empty state | 無 guest 或本機模式 | 空 state | 不 crash；輸出或提示行為明確 | Phase 4 |
| VIS-01 | 視覺 | 桌機基本流程 | 1366px viewport | 不重疊、不水平溢出、主要 CTA 可見 | Phase 6 / Phase 7 |
| VIS-02 | 視覺 | 390px mobile 基本資訊 | 390px viewport | 不水平溢出；文字不互相遮擋 | Phase 6 / Phase 7 |

## P0/P1 歸屬清單

| 風險 | 嚴重度 | 歸屬 Phase | 依據 |
| --- | --- | --- | --- |
| 刪除有人的桌後 stale lock / stale position / duplicated unassigned | P0 | Phase 1 | 直接造成資料完整性破壞 |
| 桌次超過 10 人可進入 state 或 Firebase | P0 | Phase 1 | 違反核心 table contract |
| Google Sheets 邏輯失敗卻顯示成功 | P0 | Phase 2 | 外部同步可信度破壞 |
| Google Sheets sync output 新增 `人數` | P0 | Phase 2 | 違反已確認 write-back contract |
| auto-seat 預設移動主桌或補入主桌 | P0 | Phase 3 | 婚禮主桌語意錯誤且難以人工察覺 |
| guest id 重複或 orphan reference | P0 | Phase 1 | 會造成消失、重複、匯出錯誤 |
| PDF 重複列印 | P1 | Phase 4 | 使用體驗與交付風險 |
| DnD primary/fallback 重複邏輯導致行為不一致 | P1 | Phase 5 | 回歸風險高，但應在 P0 修完後處理 |
| Firebase status badge 重複或 timeout cleanup | P1 | Phase 6 | UI/穩定性整理，不應早於資料修補 |

## Phase 1-7 重跑規則

每個後續 Phase 完成後，至少要回填：

1. 跑過哪些 matrix ID。
2. 哪些 ID 未跑，原因是工具限制、資料不足或非本 Phase scope。
3. 是否新增不變式；若新增，必須同步到本文件或其後續版本。
4. 是否有 P0/P1 未處理；若有，Phase 不得標記 Approve。

## Review

- `@qa` 判定：Phase 0 本身可作為後續 Phase 的驗收基準。
- 目前沒有 source code 變更，所以不需要執行 Browser 或 production build。
- 本 matrix 對 Phase 1 的要求最嚴格：必須先處理資料完整性，才能開始大型 refactor。
- 後續若進行完整 code review，必須使用上方 18 個 batch，並將每批 findings 寫入 `.agents/qa_scratch/batch_X.md`。

