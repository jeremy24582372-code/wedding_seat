import { useMemo, useState } from 'react';
import {
  buildFloorDesignSvgExport,
  createFloorDesignSvgBlob,
  renderFloorDesignPngBlob,
} from '../utils/floorDesignImageExport';
import { buildWeddingFloorPrintHTML } from '../utils/floorPrintHTMLBuilder';
import { openPrintDocument } from '../utils/printWindow';
import './FloorDesignExportModal.css';

const EXPORT_MODE = {
  pdf: {
    title: '桌次圖 PDF 預覽',
    description: '先調整桌間距並產生預覽，確認後再列印或另存 PDF。',
    actionLabel: '列印 / 存成 PDF',
  },
  png: {
    title: '桌次圖 PNG 預覽',
    description: '先調整桌間距並產生預覽，確認後下載 PNG。',
    actionLabel: '下載 PNG',
  },
  svg: {
    title: '桌次圖 SVG 預覽',
    description: '先調整桌間距並產生預覽，確認後下載 SVG。',
    actionLabel: '下載 SVG',
  },
};

export default function FloorDesignExportModal({ state, mode = 'pdf', onClose }) {
  const exportConfig = EXPORT_MODE[mode] ?? EXPORT_MODE.pdf;
  const [draftSpacing, setDraftSpacing] = useState({
    horizontal: 4,
    vertical: 4,
  });
  const [preview, setPreview] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const isStale = preview && (
    preview.spacing.horizontal !== draftSpacing.horizontal ||
    preview.spacing.vertical !== draftSpacing.vertical
  );
  const canExport = preview && !isStale && !isExporting;
  const model = preview?.artifact.layoutModel ?? null;
  const spacingMetrics = model?.spacingMetrics ?? null;
  const tableDiameter = model?.tables?.[0]?.printPosition?.seatOrbitRadius != null
    ? Math.round(model.tables[0].printPosition.seatOrbitRadius * 2 * 100) / 100
    : (model?.tables?.[0]?.printPosition?.diameter ?? null);

  const helperText = useMemo(() => {
    if (!preview) return '調整桌間距後，請按「產生預覽」才會重新計算桌位。';
    if (isStale) return '間距已變更，請重新產生預覽；下載與列印會等到預覽更新後才開放。';
    return '目前預覽已套用此桌間距。桌子大小固定，桌位會以互動畫布中心向左右／上下展開。';
  }, [isStale, preview]);

  const handleGeneratePreview = () => {
    try {
      const date = new Date();
      const artifact = buildFloorDesignSvgExport(state, {
        date,
        floorDesign: {
          minHorizontalTableGapMm: draftSpacing.horizontal,
          minVerticalTableGapMm: draftSpacing.vertical,
        },
      });
      setPreview({
        artifact,
        date,
        spacing: { ...draftSpacing },
      });
    } catch (err) {
      console.error('[FloorDesignExportModal] preview failed:', err);
      alert('桌次圖預覽產生失敗，請稍後再試');
    }
  };

  const handleSpacingChange = (axis, value) => {
    setDraftSpacing(current => ({
      ...current,
      [axis]: Number(value),
    }));
  };

  const handleExport = async () => {
    if (!canExport) return;

    setIsExporting(true);
    try {
      const options = {
        date: preview.date,
        floorDesign: {
          minHorizontalTableGapMm: preview.spacing.horizontal,
          minVerticalTableGapMm: preview.spacing.vertical,
        },
      };

      if (mode === 'pdf') {
        openPrintDocument({
          html: buildWeddingFloorPrintHTML(state, options),
          popupMessage: '請先允許瀏覽器開啟彈出視窗，再點選「列印 / 存成 PDF」。\n（網址列右方通常有封鎖提示）',
          failureMessage: '桌次圖 PDF 匯出失敗，請稍後再試',
          logLabel: 'Floor PDF preview export',
        });
        return;
      }

      if (mode === 'png') {
        const blob = await renderFloorDesignPngBlob(preview.artifact.svg);
        const url = URL.createObjectURL(blob);
        triggerDownload(url, preview.artifact.fileNames.png);
        URL.revokeObjectURL(url);
        return;
      }

      const blob = createFloorDesignSvgBlob(preview.artifact.svg);
      const url = URL.createObjectURL(blob);
      triggerDownload(url, preview.artifact.fileNames.svg);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[FloorDesignExportModal] export failed:', err);
      alert(`${exportConfig.actionLabel}失敗，請稍後再試`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="floor-export-modal" role="dialog" aria-modal="true" aria-labelledby="floor-export-title">
      <div className="floor-export-modal__panel">
        <header className="floor-export-modal__header">
          <div>
            <p className="floor-export-modal__kicker">桌次圖匯出預覽</p>
            <h2 id="floor-export-title">{exportConfig.title}</h2>
            <p>{exportConfig.description}</p>
          </div>
          <button className="btn btn-ghost" type="button" onClick={onClose} aria-label="關閉桌次圖預覽">
            關閉
          </button>
        </header>

        <div className="floor-export-modal__body">
          <aside className="floor-export-modal__settings" aria-label="桌次圖匯出設定">
            <label className="floor-export-modal__field" htmlFor="floor-preview-min-gap-x">
              <span>左右最小間距</span>
              <strong>{draftSpacing.horizontal} mm</strong>
              <input
                id="floor-preview-min-gap-x"
                type="range"
                min="0"
                max="40"
                step="1"
                value={draftSpacing.horizontal}
                onInput={event => handleSpacingChange('horizontal', event.target.value)}
                onChange={event => handleSpacingChange('horizontal', event.target.value)}
              />
            </label>

            <label className="floor-export-modal__field" htmlFor="floor-preview-min-gap-y">
              <span>上下最小間距</span>
              <strong>{draftSpacing.vertical} mm</strong>
              <input
                id="floor-preview-min-gap-y"
                type="range"
                min="0"
                max="16"
                step="1"
                value={draftSpacing.vertical}
                onInput={event => handleSpacingChange('vertical', event.target.value)}
                onChange={event => handleSpacingChange('vertical', event.target.value)}
              />
            </label>
            <p className={isStale ? 'floor-export-modal__hint floor-export-modal__hint--stale' : 'floor-export-modal__hint'}>
              {helperText}
            </p>

            <button className="btn btn-secondary" type="button" onClick={handleGeneratePreview}>
              產生預覽
            </button>

            {model && (
              <div className="floor-export-modal__metrics" aria-label="預覽解析結果">
                <span>
                  <small>設定左右間距</small>
                  <strong>{preview.spacing.horizontal} mm</strong>
                </span>
                <span>
                  <small>實際左右間距</small>
                  <strong>{spacingMetrics?.minimumHorizontalTableGapMm ?? '-'} mm</strong>
                </span>
                <span>
                  <small>設定上下間距</small>
                  <strong>{preview.spacing.vertical} mm</strong>
                </span>
                <span>
                  <small>實際上下間距</small>
                  <strong>{spacingMetrics?.minimumVerticalTableGapMm ?? '-'} mm</strong>
                </span>
                <span>
                  <small>桌子直徑</small>
                  <strong>{tableDiameter ?? '-'} mm</strong>
                </span>
                <span>
                  <small>姓名碰撞</small>
                  <strong>{spacingMetrics?.collisionCount ?? 0}</strong>
                </span>
              </div>
            )}

            {model?.warnings?.length > 0 && (
              <div className="floor-export-modal__warning" role="status">
                {model.warnings.map(warning => (
                  <p key={warning.code}>{warning.message}</p>
                ))}
              </div>
            )}
          </aside>

          <section className="floor-export-modal__preview" aria-label="桌次圖預覽">
            {preview ? (
              <div
                className="floor-export-modal__paper"
                dangerouslySetInnerHTML={{ __html: preview.artifact.svg }}
              />
            ) : (
              <div className="floor-export-modal__empty">
                <strong>尚未產生預覽</strong>
                <span>設定間距後按「產生預覽」，這裡才會顯示實際輸出。</span>
              </div>
            )}
          </section>
        </div>

        <footer className="floor-export-modal__footer">
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" type="button" onClick={handleExport} disabled={!canExport}>
            {isExporting ? '處理中…' : exportConfig.actionLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

function triggerDownload(url, filename) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
