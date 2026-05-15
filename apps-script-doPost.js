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

const SYNC_SHEET_NAME = '工作表1'; // 同步回寫目標：維持原本 Apps Script 綁定試算表的頁籤

// 匯入來源：只讀取這份 Google Sheet，不影響同步回寫目標。
// 來源 URL:
// https://docs.google.com/spreadsheets/d/1VLTMQZECG_hQM8VVN9c5cJPQJ5XwJkaacpbV7XIwryU/edit?usp=sharing
const IMPORT_SPREADSHEET_ID = '1VLTMQZECG_hQM8VVN9c5cJPQJ5XwJkaacpbV7XIwryU';
const IMPORT_SHEET_NAME = ''; // 空字串代表讀第一個頁籤；若要指定頁籤可填入頁籤名稱

/**
 * doGet — 讀取賓客清單（現有功能保留）
 * React App 匯入名單時呼叫這個。
 */
function doGet() {
  const importSpreadsheet = SpreadsheetApp.openById(IMPORT_SPREADSHEET_ID);
  const sheet = IMPORT_SHEET_NAME
    ? importSpreadsheet.getSheetByName(IMPORT_SHEET_NAME)
    : importSpreadsheet.getSheets()[0];
  if (!sheet) throw new Error('Import sheet not found');

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
 * doPost — 接收座位排列結果，完整覆蓋同步目標頁籤
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
    if (!Array.isArray(payload)) throw new Error('Payload must be an array');

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SYNC_SHEET_NAME);
    if (!sheet) throw new Error(`Sync sheet not found: ${SYNC_SHEET_NAME}`);

    const rows = [
      ['姓名', '關係分類', '飲食', '桌次'],
      ...payload
        .filter(guest => String(guest.name ?? '').trim().length > 0)
        .map(guest => [
          String(guest.name ?? '').trim(),
          guest.category || '',
          guest.diet || '',
          guest.tableLabel || '',
        ]),
    ];

    sheet.clearContents();
    sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, written: rows.length - 1 }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
