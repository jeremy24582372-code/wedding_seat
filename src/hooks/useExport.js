import { useCallback } from 'react';
import * as XLSX from 'xlsx';
import { buildCsvExportRows } from '../utils/csvExportBuilder';
import { buildWeddingFloorPrintHTML } from '../utils/floorPrintHTMLBuilder';
import { buildJsonBackup } from '../utils/jsonExportBuilder';
import { buildPrintHTML } from '../utils/printHTMLBuilder';
import { formatExportDate } from '../utils/exportShared';
import { openPrintDocument } from '../utils/printWindow';

/**
 * Export utilities for JSON, CSV/Excel, and print-based PDF.
 * JSON is a restore-grade AppState backup. CSV/Excel and PDFs are handoff formats.
 */
export function useExport(state) {
  const exportJSON = useCallback(() => {
    if (!state) return;

    const json = JSON.stringify(buildJsonBackup(state), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `排座位_${formatExportDate()}.json`);
    URL.revokeObjectURL(url);
  }, [state]);

  const exportCSV = useCallback(() => {
    if (!state) return;

    const rows = buildCsvExportRows(state);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '賓客座位表');
    XLSX.writeFile(wb, `排座位_${formatExportDate()}.xlsx`);
  }, [state]);

  const exportPDF = useCallback(() => {
    if (!state) return;

    try {
      openPrintDocument({
        html: buildPrintHTML(state),
        popupMessage: '請先允許瀏覽器開啟彈出視窗，再點選「匯出座位表」。\n（網址列右方通常有封鎖提示）',
        failureMessage: 'PDF 匯出失敗，請稍後再試',
        logLabel: 'PDF export',
      });
    } catch (err) {
      console.error('[useExport] PDF export failed:', err);
      alert('PDF 匯出失敗，請稍後再試');
    }
  }, [state]);

  const exportFloorPDF = useCallback(() => {
    if (!state) return;

    try {
      openPrintDocument({
        html: buildWeddingFloorPrintHTML(state),
        popupMessage: '請先允許瀏覽器開啟彈出視窗，再點選「匯出桌次圖」。\n（網址列右方通常有封鎖提示）',
        failureMessage: '桌次圖 PDF 匯出失敗，請稍後再試',
        logLabel: 'Floor PDF export',
      });
    } catch (err) {
      console.error('[useExport] Floor PDF export failed:', err);
      alert('桌次圖 PDF 匯出失敗，請稍後再試');
    }
  }, [state]);

  return { exportJSON, exportCSV, exportPDF, exportFloorPDF };
}

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
