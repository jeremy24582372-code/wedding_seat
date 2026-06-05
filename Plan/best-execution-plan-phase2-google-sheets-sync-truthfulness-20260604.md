# Phase 2 Google Sheets 回寫真實性

日期：2026-06-04  
角色：`.agents/agents.md` 的 `@engineer`  
來源：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/best-execution-plan-from-qa-reviews-20260604.md`
- `Plan/best-execution-plan-phase0-qa-baseline-20260604.md`

## 執行範圍

Phase 2 只處理 Google Sheets 回寫可信度，不做大型拆檔、不改 Firebase schema、不新增 npm dependencies。

必守限制：

- 同步回寫 output schema 維持「姓名 / 關係分類 / 飲食 / 桌次」。
- `人數` 只屬於匯入來源，不加入回寫 payload 或同步目標表。
- 成功 toast 只能在 Apps Script response body 明確回傳成功後出現。

## 狀態追蹤

| 項目 | 狀態 | 備註 |
| --- | --- | --- |
| 讀取 `@engineer` 角色與 context | Done | 已確認 Google Sheets → state → Firebase/sync 資料流與 10-seat contract |
| 讀取 Phase 2 與 Phase 0 QA baseline | Done | 對應 SYNC-01 到 SYNC-04、INV-11、INV-12 |
| 修正 `syncToGoogleSheets()` | Done | POST 後解析 Apps Script response body |
| 處理 `{ ok:false }` / `{ success:false }` | Done | HTTP 200 也會回傳 failure，不顯示成功 |
| 保護 sync payload schema | Done | 移除未使用的 `source` 欄位；不包含 `headcount` / `人數` |
| 修正 Apps Script 註解 | Done | 清楚區分 `doGet()` 匯入與 `doPost()` 回寫 |
| Focused smoke | Done | 新增 `scripts/check-phase2-google-sheets-sync.mjs` |
| Build / lint 驗證 | Done | sandbox build 有已知 EPERM；escalated build passed |

## 變更摘要

### `src/hooks/useFirebase.js`

- `syncToGoogleSheets()` 送出 POST 後改為讀取 `fetch()` 回傳的 `Response`。
- 回應交由 `parseGoogleSheetsSyncResponse()` 判定。
- 不再把「fetch 沒 throw」視為同步成功。

### `src/utils/googleSheetsSyncResponse.js`

新增純解析工具：

- 不可讀 opaque response → failure。
- 非 JSON response → failure。
- HTTP 非 2xx → failure，優先取 body 的 `error/message/description`。
- `{ ok:false }` 或 `{ success:false }` → failure。
- `{ ok:true }` 或 `{ success:true }` → success。
- 沒有明確成功旗標 → failure。

### `src/utils/googleSheetsPayload.js`

- 回寫 payload 只輸出：
  - `name`
  - `category`
  - `diet`
  - `tableLabel`
- 移除原本未被 Apps Script 使用的 `source` 欄位。
- 繼續不輸出 `headcount` / `人數`。

### `apps-script-doPost.js`

- 部署註解改為取代舊版 `doGet / doPost`，避免誤以為只換 `doGet`。
- 註明 `doPost()` 是 React App 回寫入口，`人數` 只屬於 `doGet()` 匯入來源。

### 驗證腳本

- 新增 `scripts/check-phase2-google-sheets-sync.mjs`。
- 更新 `scripts/check-phase1-data-integrity.mjs` 的 payload schema 斷言，配合 Phase 2 移除 `source`。

## QA Matrix 回填

| Matrix ID | 結果 | 證據 |
| --- | --- | --- |
| SYNC-01 | Pass | `normalizeGoogleSheetsSyncBody({ ok:true })` 與 `{ success:true }` 都回傳 success |
| SYNC-02 | Pass | `{ ok:false }` / `{ success:false }` 在 HTTP 200 情境仍回傳 failure |
| SYNC-03 | Pass | HTTP 500、非 JSON、空 body 都回傳 failure；fetch reject 仍由 `syncToGoogleSheets()` catch |
| SYNC-04 | Pass | payload keys 僅 `name/category/diet/tableLabel`；不含 `headcount` / `人數` / `source` |
| INV-11 | Pass | 回寫 schema 未新增 `人數` |
| INV-12 | Pass | 未明確成功的 Apps Script response 不會讓 `onSyncSheets()` resolve 為成功 |

## 驗證紀錄

已執行：

- `node scripts/check-phase2-google-sheets-sync.mjs` → Pass
- `node scripts/check-phase1-data-integrity.mjs` → Pass
- `npm run rules:check` → Pass
- `npm run lint` → Pass
- `git diff --check` → Pass；只有既有 CRLF warning
- `npm run build` → sandbox 內命中已知 Vite/Rolldown `spawn EPERM`
- `npm run build`（escalated）→ Pass；只有既有 chunk-size warning

未執行：

- 未點擊正式「同步到試算表」按鈕，避免覆寫實際 Google Sheets 同步目標。
- 未使用 Browser 做 live sync；本 Phase 的 P0 風險已用 response-body smoke 模擬覆蓋。

## Review

`@engineer` 判定：Phase 2 的 P0 已處理。  
沒有新增 `人數` 到同步輸出，且前端不再因 Apps Script HTTP 200 但邏輯失敗而顯示成功。
