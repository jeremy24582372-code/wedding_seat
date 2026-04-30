import { useState, useCallback } from 'react';

/**
 * Fetches guest data from Google Apps Script Web App.
 *
 * Expected Google Sheets columns (order independent, matched by header name):
 *   姓名 | 關係分類 | 飲食 | 桌次
 *
 * Expected JSON shape from Apps Script:
 *   [{ name: string, category: string, diet: string, tableLabel?: string }, ...]
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
      return null;
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

      return data.map(row => ({
        name:     String(row.name     || row['姓名']   || '').trim(),
        category: String(row.category || row['關係分類'] || row['關係'] || '其他').trim(),
        // `diet` replaces `note` — supports both English key and Chinese header
        diet:     String(row.diet     || row['飲食']   || '').trim(),
      })).filter(g => g.name.length > 0);

    } catch (err) {
      const msg = `匯入失敗：${err.message}`;
      setError(msg);
      console.error('[useGoogleSheets]', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return { fetchGuests, loading, error };
}
