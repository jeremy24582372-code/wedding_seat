import { useState, useCallback } from 'react';
import { normalizeSheetGuestRows } from '../utils/googleSheetsRows.js';

/**
 * Fetches guest data from Google Apps Script Web App.
 *
 * Expected Google Sheets columns (order independent, matched by header name):
 *   姓名 | 關係分類 | 桌次 | 人數
 * 飲食 is optional legacy data; the current import source no longer includes it.
 * 關係分類 accepts built-in values and guest-provided custom labels.
 *
 * Expected JSON shape from Apps Script:
 *   [{ name: string, category: string, tableLabel?: string, headcount?: number, diet?: string }, ...]
 */
export function useGoogleSheets() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchGuests = useCallback(async () => {
    const url = import.meta.env.VITE_SHEETS_URL;

    if (!url) {
      const msg = '尚未設定 VITE_SHEETS_URL，請在 .env 檔案中填入 Google Apps Script 網址後重啟開發伺服器';
      setError(msg);
      console.error('[useGoogleSheets]', msg);
      throw new Error(msg);
    }

    // Guard: prevent concurrent requests if already loading
    if (loading) return null;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!Array.isArray(data)) throw new Error('回傳資料格式錯誤，預期為陣列');

      return normalizeSheetGuestRows(data);

    } catch (err) {
      const msg = err.message;
      setError(msg);
      console.error('[useGoogleSheets]', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return { fetchGuests, loading, error };
}
