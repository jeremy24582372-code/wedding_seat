/**
 * Google Apps Script — Wedding Seating Write-Back Handler
 * =========================================================
 * 部署方式：
 *   1. 開啟你的 Google 試算表
 *   2. 擴充功能 → Apps Script
 *   3. 把這段程式碼貼到編輯器，取代現有的 doGet（如有）
 *   4. 部署 → 新增部署 → 類型選「網頁應用程式」
 *      - 以我的身分執行
 *      - 存取權：任何人
 *   5. 複製「網頁應用程式 URL」→ 貼到 .env 的 VITE_SHEETS_URL
 *
 * 試算表結構（第一列為標題）：
 *   A: 姓名 | B: 關係分類 | C: 飲食 | D: 桌次
 * =========================================================
 */

const SHEET_NAME = '工作表1'; // ← 修改成你的工作表名稱（頁籤名稱）

/**
 * doGet — 讀取賓客清單（現有功能保留）
 * React App 匯入名單時呼叫這個。
 */
function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => String(h).trim());

  const idx = {
    name: headers.indexOf('姓名'),
    category: headers.indexOf('關係分類'),
    diet: headers.indexOf('飲食'),
    table: headers.indexOf('桌次'),
  };

  const guests = rows.slice(1)
    .filter(r => r[idx.name])
    .map(r => ({
      name: String(r[idx.name]).trim(),
      category: idx.category >= 0 ? String(r[idx.category] ?? '').trim() : '其他',
      diet: idx.diet >= 0 ? String(r[idx.diet] ?? '').trim() : '',
      table: idx.table >= 0 ? String(r[idx.table] ?? '').trim() : '',
    }));

  return ContentService
    .createTextOutput(JSON.stringify(guests))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * doPost — 接收座位排列結果，回寫關係分類 + 桌次到試算表
 * React App 按下「同步到試算表」時呼叫這個。
 *
 * 預期接收的 JSON 格式：
 * [
 *   { "name": "王小明", "category": "男方親友", "diet": "葷食", "tableLabel": "桌 3" },
 *   ...
 * ]
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents); // array of guest objects
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const rows = sheet.getDataRange().getValues();
    const headers = rows[0].map(h => String(h).trim());

    const idx = {
      name: headers.indexOf('姓名'),
      category: headers.indexOf('關係分類'),
      diet: headers.indexOf('飲食'),
      table: headers.indexOf('桌次'),
    };

    // Build a lookup by name → row index (1-based, skipping header)
    const nameRowMap = {};
    rows.slice(1).forEach((r, i) => {
      const name = String(r[idx.name] ?? '').trim();
      if (name) nameRowMap[name] = i + 2; // +2: 1-based + skip header
    });

    // Write back category + diet + tableLabel for each guest
    payload.forEach(guest => {
      const rowNum = nameRowMap[guest.name];
      if (!rowNum) return; // not found → skip

      if (idx.category >= 0) sheet.getRange(rowNum, idx.category + 1).setValue(guest.category || '');
      if (idx.diet >= 0) sheet.getRange(rowNum, idx.diet + 1).setValue(guest.diet || '');
      if (idx.table >= 0) sheet.getRange(rowNum, idx.table + 1).setValue(guest.tableLabel || '');
    });

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, updated: payload.length }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
