# 謝嘉宇人數匯入異常修正紀錄

## 問題

Google Sheets 來源列顯示「謝嘉宇」的人數為 2，但前端匯入後只出現 1 位座位需求。

## 根因

線上部署中的 Google Apps Script 仍回傳舊版 JSON 欄位，`謝嘉宇` 該列只有：

```json
{
  "name": "謝嘉宇",
  "category": "新郎親友",
  "tableLabel": ""
}
```

缺少新版需要的 `headcount` 或中文 fallback `人數` 欄位。前端收到缺欄資料後會依規則 fallback 成 `1`，因此 `applyGuestImport()` 只建立 1 個 seat-unit。

本地 `apps-script-doPost.js` 的 `doGet()` 已包含 `人數` 讀取與匯入用 `headcount` 輸出，但這份程式需要重新貼到 Apps Script 編輯器並重新部署 Web App，線上匯入才會取得 `headcount: 2`。

## 本次修正

- 新增 `src/utils/googleSheetsRows.js`，把 Google Sheets row normalization 抽成可測純函式。
- `useGoogleSheets()` 改用 `normalizeSheetGuestRows()`。
- 若來源 JSON 缺少 `headcount` / `人數`，前端會標記 `_sourceMissingHeadcount`。
- 匯入完成後若偵測到缺欄，Toast 會提示「請重新部署 Apps Script」。
- 賓客頁資料品質摘要會保留最近一次匯入缺少 `人數` 欄的警示。
- 同步回寫仍維持排位結果欄位，不回寫 `人數`；`人數` 只用於匯入時展開座位需求。

## 驗證

- `normalizeSheetGuestRows()`：有 `headcount: 2` 或 `人數: "2"` 時會正規化為 `headcount = 2`；缺欄時會標記 `_sourceMissingHeadcount = true` 且暫以 1 位處理。
- `applyGuestImport()`：輸入 `{ name: "謝嘉宇", headcount: 2 }` 會建立 `謝嘉宇` 與 `謝嘉宇 同行1`，`partyRows.headcount = 2`，自動群組數為 1。
- 線上 Apps Script 實測：目前 `謝嘉宇` 回傳 keys 仍只有 `name, category, tableLabel`，未回傳 `headcount`。
- 同步回寫 smoke：`buildGoogleSheetsPayload()` 不輸出 `headcount`，`apps-script-doPost.js` 的 `doPost()` header 維持 `姓名 / 關係分類 / 飲食 / 桌次`。
- `npm run lint`：通過。
- `npm run rules:check`：通過。
- `npm run build`：sandbox 內重現既有 Vite/Rolldown `spawn EPERM`；sandbox 外正式建置通過，僅保留既有 chunk size warning。

## 後續操作

1. 將本地 `D:\Wedding\排座位\apps-script-doPost.js` 全文貼到 Google Apps Script 編輯器。
2. 重新部署 Web App。
3. 保持 `.env` 的 `VITE_SHEETS_URL` 指向最新部署 URL；若 Apps Script 產生新 URL，更新後重啟 dev server 或重新部署前端。
4. 再按一次「從 Google Sheets 匯入賓客」，確認 `謝嘉宇` 會出現 2 位座位需求。
