# Phase 3：自動排位、主桌與群組語意

日期：2026-06-04  
角色：`.agents/agents.md` 的 `@engineer`  
來源：

- `Plan/best-execution-plan-from-qa-reviews-20260604.md`
- `Plan/best-execution-plan-phase0-qa-baseline-20260604.md`
- `.agents/context.md`

## 目標

1. 預設 auto-seat 不得移動或補入 `1桌` / `主桌`。
2. 讓群組偏好文案與實際演算法一致。
3. 偵測同一 guest 出現在多個群組的衝突，並在 preview 說明略過原因。
4. 讓匯入 `人數` 的缺欄、非法、非整數、超過 10 截斷可見。
5. 合併 `autoSeatPlanner.js` 與 `importGuests.js` 重複的座位 helper。

## 變更

- 新增 `src/utils/seatingHelpers.js`，集中 `emptySeats()`、`normalizeSeatArray()`、`deriveGuestTableState()`。
- 更新 `autoSeatPlanner.js`：
  - `respectExistingAssignments=false` 時仍排除主桌既有賓客，並在 preview blocked reason 顯示「主桌保護」。
  - 同一 guest 若同時存在多個群組，該 guest 不進入 auto-seat candidate，preview 顯示群組衝突原因。
  - auto-seat 與 import 共用同一套座位狀態推導 helper。
- 更新 `guestGroups.js` 與 `GroupManager`：
  - 新增 `findGuestGroupConflicts()`。
  - 群組頁顯示「群組衝突」統計與衝突清單。
  - `separate` 文案改為 `auto-seat 會避免同桌`。
- 更新 `partyRows.js`、`googleSheetsRows.js`、`App.jsx`、`guestDashboard.js`：
  - `normalizeHeadcountWithDiagnostics()` 保留最近一次匯入的原始人數狀態。
  - 匯入 toast 與賓客資料品質面板顯示缺欄、非法、小於 1、非整數、超過 10 截斷摘要。
- 新增 `scripts/check-phase3-auto-seat-groups.mjs` focused smoke。

## QA Matrix

| ID | 結果 | 證據 |
| --- | --- | --- |
| IMP-01 | Pass | `normalizeSheetGuestRows()` smoke 驗證缺欄、非法、小於 1、非整數、超過 10 截斷；`GuestDashboard` 品質摘要可見 |
| AUTO-01 | Pass | Phase 3 未改 preview-first commit flow；Browser 開啟 modal 未改動 state |
| AUTO-02 | Pass | focused smoke 驗證 `respectExistingAssignments=false` 時主桌既有賓客不移動，且一般候選不排入 `1桌` |
| AUTO-03 | Pass | 既有 Phase 1/2/3 smoke 保持通過；same-table 錨定邏輯未退化 |
| AUTO-04 | Pass | focused smoke 驗證 `separate` 會避開已有同群組成員的桌次 |
| AUTO-05 | Not run | 本 Phase 未改 stale preview fingerprint/apply flow；由既有 `buildAutoSeatFingerprint()` 保護 |
| VIS-01 | Pass | Browser 桌機驗證群組頁與 auto-seat modal，console warn/error = 0 |

## 驗證

- `node scripts/check-phase1-data-integrity.mjs`：Pass
- `node scripts/check-phase2-google-sheets-sync.mjs`：Pass
- `node scripts/check-phase3-auto-seat-groups.mjs`：Pass
- `npm run rules:check`：Pass
- `npm run lint`：Pass
- `git diff --check`：Pass；僅既有 CRLF warning
- `npm run build`：sandbox 內命中已知 Vite/Rolldown `spawn EPERM`；依 lesson 043 授權重跑後 Pass，僅既有 chunk-size warning
- Browser：`http://127.0.0.1:5173/wedding_seat/`
  - 登入成功。
  - 群組頁顯示 `auto-seat 會避免同桌`、`群組衝突`、`同一賓客多重歸屬`。
  - 舊文案 `目前作為人工警示` 不存在。
  - auto-seat modal 顯示 `套用同行與群組偏好`，舊文案 `同行 party 盡量同桌` 不存在。
  - console warn/error = 0。
  - dev server 已依 lesson 079 清理，5173 port 關閉。

## Review

`@engineer` 判定 Phase 3 可通過。這次改動維持在純 helper、planner、群組 UI 與匯入診斷範圍，未變更 Firebase schema、Google Sheets sync output schema 或 DnD handler。剩餘大型拆檔與 export 契約仍屬 Phase 4/5。
