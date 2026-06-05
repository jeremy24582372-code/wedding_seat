# Phase 6 FloorPlan 與 UI 一致性整理執行紀錄

日期：2026-06-05  
角色：`.agents/agents.md` 的 `@designer`  
來源：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/best-execution-plan-phase0-qa-baseline-20260604.md`
- `Plan/best-execution-plan-from-qa-reviews-20260604.md`

## 執行範圍

Phase 6 聚焦 UI/互動結構整理與穩定性，不更動核心座位資料規則。

必做：

- 拆 `FloorPlan.jsx` 的 pan/zoom、桌次拖曳/吸附/輔助線、selection hooks。
- 移除 `App.jsx` 內重複 Firebase status badge，保留 `AppShell` 作為唯一顯示來源。
- 補上 delayed `setState` / timeout cleanup。
- 拆出 `design-tokens.css`，讓 `App.css` 保留 reset、utility 與 layout skeleton。

不做事項：

- 不改 Firebase schema。
- 不改 Google Sheets import/sync schema。
- 不改 `TableZone` droppable interface。
- 不移動 `DndContext` 或 `id="tables-area"`。
- 不做手機 / tablet 驗證；依 `.agents/context.md`，本工具預設只在桌機使用。

## 狀態追蹤

| 項目 | 狀態 | 備註 |
| --- | --- | --- |
| 讀取 `@designer` 與 project context | Done | 已確認桌機-only target、設計 token 與 TableZone 介面約束 |
| FloorPlan hook 拆分 | Done | 新增 viewport / table drag / selection hooks |
| Firebase badge 單一來源 | Done | 移除 `App.jsx` 右下角 legacy badge，保留 `AppShell` header pill |
| Timeout cleanup | Done | `GuestCard`、`Toolbar`、`DashboardHome`、`PasswordGate` 補 cleanup / mounted guard；`TableZone` 已有 cleanup |
| CSS token 分離 | Done | 新增 `src/design-tokens.css`；`src/App.css` 改為 import tokens 並保留 layout skeleton |
| 桌機外部瀏覽器驗證 | Done | Chrome headless + CDP，1366x768 |

## 主要變更

### 1. FloorPlan 互動 hooks

- 新增 `src/hooks/useFloorPlanViewport.js`
  - 管理 pan、zoom、wheel listener、reset view、空白畫布點擊取消選取。
  - 保留「平移剛結束時不誤清選取」行為。
- 新增 `src/hooks/useFloorPlanTableDrag.js`
  - 管理桌次拖曳、群組拖曳、live position、grid snap、smart guides、drag commit。
  - 保留 guide snap 優先於 grid snap 的既有順序。
  - 保留 `livePosGroupRef` 提交「畫面上看到的位置」的語意。
- 新增 `src/hooks/useFloorPlanSelection.js`
  - 管理單選、多選、modifier key toggle、背景取消選取。
- `src/components/FloorPlan.jsx` 保留 inline rename 與 JSX 組合，不拆 `TableZone` 介面。

### 2. Firebase status 單一來源

- `AppShell` 的 `.app-shell__status-pill` 是唯一 Firebase 顯示來源。
- 移除 `App.jsx` children 內的 `.firebase-status` JSX。
- 移除 `App.css` 中已死的 `.firebase-status` CSS 與 print selector。

### 3. Delayed setState cleanup

- `GuestCard.jsx`：刪除確認 reset timer 加上 unmount cleanup。
- `Toolbar.jsx`：Google Sheets sync 狀態 reset timer 加上 cleanup；async 回來後先檢查 mounted。
- `DashboardHome.jsx`：同步按鈕狀態 reset timer 加上 cleanup；async 回來後先檢查 mounted。
- `PasswordGate.jsx`：shake reset timer 加上 cleanup。
- `TableZone.jsx` 已有 SeatSlot 與刪桌確認 cleanup，本 Phase 未重複修改。

### 4. CSS token 分離

- 新增 `src/design-tokens.css`，集中 Google Fonts import 與 `:root` tokens。
- `src/App.css` 第一行 import `design-tokens.css`，其餘保留 reset、utility button、app layout、loading/error boundary、responsive layout。
- 元件 CSS 繼續透過單一 `App.css` 入口取得 token，不在每個 component CSS 重複 import。

## QA Matrix 結果

| Matrix ID | 結果 | 驗證方式 |
| --- | --- | --- |
| VIS-01 桌機基本流程 | Pass | 外部 Chrome 1366x768：總覽與座位圖無水平溢出，無 Vite overlay |
| Phase 6 FloorPlan pan/zoom/snap/guide | Pass | 外部 Chrome：座位圖載入 10 桌；zoom 85% -> 95%；格線吸附開 -> 關；table drag icon smoke 成功 commit |
| Firebase badge 單一來源 | Pass | 外部 Chrome DOM：`.app-shell__status-pill` = 1；legacy `.firebase-status` = 0；狀態為「本機模式」 |
| Timeout cleanup 靜態驗證 | Pass | `rg` 檢查目標元件 timeout；新增 cleanup / mounted guard；`TableZone` 既有 cleanup 保留 |
| VIS-02 390px mobile | Not run | `.agents/context.md` 指定 desktop-only target，mobile/tablet out of scope unless explicitly requested |

## 驗證紀錄

- `npm run lint`：Pass
- `npm run build`：Pass；sandbox 內已知 Vite/Rolldown `spawn EPERM`，依 KB lesson 升權重跑成功；保留既有 chunk-size warning
- `git diff --check`：Pass；只有既有 CRLF warning
- 外部 Chrome + CDP 桌機驗證：
  - URL：`http://127.0.0.1:5186/wedding_seat/`
  - Viewport：1366x768
  - Firebase：本機隔離模式，未載入實際 Firebase URL literal
  - 總覽：AppShell rendered、dashboard rendered、無水平溢出
  - 座位圖：FloorPlan rendered、10 桌、控制按鈕 6 個、無水平溢出
  - 互動：zoom 85% -> 95%；snap mode 開 -> 關；`1桌` drag handle icon 從 `left/top 80/80` 移到約 `221/130`
  - Console：僅 Vite debug 與 Chrome password-form accessibility verbose；無 app error

## Review

- Phase 6 目標已完成：FloorPlan 互動邏輯拆 hook、Firebase badge 單一來源、timeout cleanup、CSS token 分離。
- 沒有新增狀態來源，沒有改 Firebase / Google Sheets schema。
- 桌機驗證通過；手機驗證刻意不執行，因專案 context 明確定義本工具預設只在桌機使用。
- 剩餘低風險項：production bundle 仍有 Vite 500 kB chunk-size warning，這是既有 build warning，非 Phase 6 範圍。
