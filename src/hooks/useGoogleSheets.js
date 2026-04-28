import { useState, useCallback } from 'react';

/**
 * Fetches guest data from Google Apps Script Web App.
 * Falls back to mock data if VITE_SHEETS_URL is not configured.
 *
 * Expected JSON shape from Apps Script:
 * [{ name: string, category: string, note: string }, ...]
 */
export function useGoogleSheets() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchGuests = useCallback(async () => {
    const url = import.meta.env.VITE_SHEETS_URL;

    if (!url) {
      // Fail fast — silently loading mock data into real state is dangerous.
      // Show an explicit error so the user knows they need to configure the URL.
      const msg = '尚未設定 VITE_SHEETS_URL，請在 .env 檔案中填入 Google Apps Script 網址後重啟開發伺服器';
      setError(msg);
      console.error('[useGoogleSheets]', msg);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Validate shape and normalise
      if (!Array.isArray(data)) throw new Error('回傳資料格式錯誤，預期為陣列');

      return data.map(row => ({
        name: String(row.name || row['姓名'] || '').trim(),
        category: String(row.category || row['關係'] || '其他').trim(),
        note: String(row.note || row['備註'] || '').trim(),
      })).filter(g => g.name.length > 0);

    } catch (err) {
      const msg = `匯入失敗：${err.message}`;
      setError(msg);
      console.error('[useGoogleSheets]', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchGuests, loading, error };
}
