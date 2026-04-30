import { useCallback } from 'react';
import * as XLSX from 'xlsx';
import { CANVAS_WIDTH, CANVAS_HEIGHT, defaultTablePosition } from '../utils/constants';

/**
 * Export utilities for JSON, CSV/Excel, and PDF.
 * @param {object} state - current AppState
 */
export function useExport(state) {
  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `排座位_${formatDate()}.json`);
    URL.revokeObjectURL(url);
  }, [state]);

  const exportCSV = useCallback(() => {
    if (!state) return;

    // Build rows: one per guest, with table label
    const tableMap = Object.fromEntries(state.tables.map(t => [t.id, t.label]));

    const rows = state.guests.map(g => ({
      姓名: g.name,
      關係分類: g.category,
      飲食: g.diet || '',
      桌次: g.tableId ? tableMap[g.tableId] || '未知' : '未分配',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '賓客座位表');
    XLSX.writeFile(wb, `排座位_${formatDate()}.xlsx`);
  }, [state]);

  /**
   * PDF export via print window.
   *
   * Why not html2canvas + jsPDF?
   *  - html2canvas fails when the target element has CSS transform (translate + scale),
   *    which the FloorPlan canvas uses for pan/zoom.
   *  - oklch() colours and Google Fonts can trigger CORS errors inside html2canvas.
   *
   * This approach generates a clean, data-driven HTML seating chart in a new window
   * and calls window.print(), which browsers can save as PDF. Native Chinese font
   * support, zero CORS issues, always up-to-date with the current in-memory state.
   *
   * Note: the `containerRef` parameter is accepted for API compatibility but is
   * intentionally unused — the PDF is built from `state` directly.
   */
  // eslint-disable-next-line no-unused-vars
  const exportPDF = useCallback((_containerRef) => {
    if (!state) return;

    try {
      const html = buildPrintHTML(state);
      const win = window.open('', '_blank', 'width=960,height=760');

      if (!win) {
        alert('請先允許瀏覽器開啟彈出視窗，再點選「匯出 PDF」。\n（網址列右方通常有封鎖提示）');
        return;
      }

      win.document.write(html);
      win.document.close();

      // Trigger print after fonts have a moment to settle
      win.addEventListener('load', () => setTimeout(() => win.print(), 400));
      // Fallback — some browsers fire load before document.write resolves
      setTimeout(() => { try { win.print(); } catch { /* already triggered */ } }, 800);
    } catch (err) {
      console.error('[useExport] PDF export failed:', err);
      alert('PDF 匯出失敗，請稍後再試');
    }
  }, [state]);

  /**
   * Floor-plan PDF export.
   *
   * Reads state.tablePositions (user-dragged positions) and re-renders the
   * entire canvas as a scaled-down, absolutely-positioned HTML page in a new
   * print window. No html2canvas — no CORS, no transform issues.
   *
   * Scaling: CANVAS_WIDTH × CANVAS_HEIGHT  →  A4 page width (≈ 750px usable)
   */
  const exportFloorPDF = useCallback(() => {
    if (!state) return;

    try {
      const html = buildFloorPrintHTML(state);
      const win = window.open('', '_blank', 'width=960,height=760');

      if (!win) {
        alert('請先允許瀏覽器開啟彈出視窗，再點選「匯出桌次圖」。\n（網址列右方通常有封鎖提示）');
        return;
      }

      win.document.write(html);
      win.document.close();

      win.addEventListener('load', () => setTimeout(() => win.print(), 400));
      setTimeout(() => { try { win.print(); } catch { /* already triggered */ } }, 800);
    } catch (err) {
      console.error('[useExport] Floor PDF export failed:', err);
      alert('桌次圖 PDF 匯出失敗，請稍後再試');
    }
  }, [state]);

  return { exportJSON, exportCSV, exportPDF, exportFloorPDF };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate() {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Guest-category dot colours (print-safe hex values). */
const CAT_COLORS = {
  '男方親友': '#6b5ce7',
  '女方親友': '#d9567a',
  '共同朋友': '#3aaa6e',
  '同事':     '#c49a2a',
  '其他':     '#888888',
};

function guestDot(category) {
  const color = CAT_COLORS[category] || '#888888';
  return `<span class="dot" style="background:${color}"></span>`;
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Build the full print-ready HTML document from current AppState. */
function buildPrintHTML(state) {
  const date = formatDate();

  // Group guests by tableId
  const byTable = {};
  state.tables.forEach(t => { byTable[t.id] = []; });
  state.guests.forEach(g => {
    if (g.tableId && byTable[g.tableId] !== undefined) {
      byTable[g.tableId].push(g);
    }
  });
  const unassigned = state.guests.filter(g => !g.tableId);

  // ── Table cards ────────────────────────────────────────────────
  const tableCards = state.tables.map(table => {
    const tableGuests = byTable[table.id] ?? [];
    const emptyCount  = Math.max(0, 10 - tableGuests.length);
    const isFull      = tableGuests.length >= 10;

    const guestRows = tableGuests.map(g => `
      <li class="guest-row">
        ${guestDot(g.category)}
        <span class="guest-name">${escHtml(g.name)}</span>
        ${g.category ? `<span class="guest-cat">${escHtml(g.category)}</span>` : ''}
        ${g.diet     ? `<span class="guest-note">${escHtml(g.diet)}</span>`     : ''}
      </li>`).join('');

    const emptyRows = Array(emptyCount)
      .fill('<li class="guest-row guest-empty"><span class="dot dot--empty"></span><span class="empty-label">空位</span></li>')
      .join('');

    return `
      <div class="table-card${isFull ? ' table-card--full' : ''}">
        <div class="table-head">
          <span class="table-name">${escHtml(table.label)}</span>
          <span class="table-count">${tableGuests.length}&thinsp;/&thinsp;10</span>
        </div>
        <ul class="guest-list">${guestRows}${emptyRows}</ul>
      </div>`;
  }).join('');

  // ── Unassigned section ─────────────────────────────────────────
  const unassignedSection = unassigned.length === 0 ? '' : `
    <section class="unassigned">
      <h2 class="unassigned-title">⚠ 尚未分配座位（${unassigned.length} 位）</h2>
      <ul class="guest-list unassigned-list">
        ${unassigned.map(g => `
          <li class="guest-row">
            ${guestDot(g.category)}
            <span class="guest-name">${escHtml(g.name)}</span>
            ${g.category ? `<span class="guest-cat">${escHtml(g.category)}</span>` : ''}
          </li>`).join('')}
      </ul>
    </section>`;

  // ── Legend ─────────────────────────────────────────────────────
  const legendItems = Object.entries(CAT_COLORS).map(([cat, color]) =>
    `<span class="legend-item"><span class="dot" style="background:${color}"></span>${escHtml(cat)}</span>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <title>婚禮賓客座位表 — ${date}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Microsoft JhengHei', 'PingFang TC', 'Noto Sans TC',
                   'Hiragino Sans GB', system-ui, sans-serif;
      font-size: 9.5pt;
      line-height: 1.55;
      color: #1a1a1a;
      background: #fff;
      padding: 16mm 14mm 12mm;
    }

    /* ── Header ── */
    .page-title {
      font-size: 20pt;
      font-weight: 700;
      text-align: center;
      letter-spacing: 6px;
      margin-bottom: 3px;
    }
    .page-meta {
      font-size: 8.5pt;
      text-align: center;
      color: #666;
      margin-bottom: 14px;
    }
    .divider {
      border: none;
      border-top: 1.5px solid #c8b472;
      margin-bottom: 14px;
    }

    /* ── Grid of table cards ── */
    .tables-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .table-card {
      border: 1px solid #ccc;
      border-radius: 5px;
      overflow: hidden;
      break-inside: avoid;
    }
    .table-card--full .table-head { background: #f0e8d0; }

    .table-head {
      background: #f7f3ea;
      padding: 4px 9px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #ddd;
    }
    .table-name  { font-weight: 700; font-size: 10pt; }
    .table-count { font-size: 8pt; color: #777; }

    /* ── Guest list ── */
    .guest-list { list-style: none; padding: 3px 0; }

    .guest-row {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 1.5px 9px;
      font-size: 9pt;
    }
    .guest-empty { opacity: 0.28; }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
      display: inline-block;
    }
    .dot--empty { background: #bbb; }

    .guest-name  { font-weight: 500; }
    .guest-cat   { font-size: 7.5pt; color: #888; margin-left: 1px; }
    .guest-note  { font-size: 7.5pt; color: #aaa; font-style: italic; }
    .empty-label { font-size: 8pt; color: #bbb; }

    /* ── Unassigned section ── */
    .unassigned {
      margin-top: 16px;
      border: 1.5px dashed #d9567a;
      border-radius: 5px;
      padding: 10px 12px;
      break-before: avoid;
    }
    .unassigned-title {
      font-size: 10pt;
      font-weight: 700;
      color: #b83060;
      margin-bottom: 7px;
    }
    .unassigned-list { columns: 3; column-gap: 10px; }

    /* ── Legend ── */
    .legend {
      margin-top: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px 18px;
      font-size: 8pt;
      color: #555;
      border-top: 1px solid #eee;
      padding-top: 8px;
    }
    .legend-item { display: flex; align-items: center; gap: 4px; }

    /* ── Print overrides ── */
    @media print {
      body { padding: 10mm; }
      @page { margin: 12mm; size: A4; }
      .tables-grid { grid-template-columns: repeat(3, 1fr); }
      .unassigned-list { columns: 4; }
    }
  </style>
</head>
<body>
  <h1 class="page-title">婚禮賓客座位表</h1>
  <p class="page-meta">列印日期：${date} ｜ 總賓客：${state.guests.length} 位 ｜ 共 ${state.tables.length} 桌</p>
  <hr class="divider">

  <div class="tables-grid">
    ${tableCards}
  </div>

  ${unassignedSection}

  <div class="legend">
    <span style="color:#999">圖例：</span>
    ${legendItems}
  </div>
</body>
</html>`;
}

// ─── Floor Plan Print Builder (SVG-based) ────────────────────────────────────
//
// Renders the entire floor-plan as a single inline <svg> element whose
// viewBox matches the live canvas coordinate space (CANVAS_WIDTH × CANVAS_HEIGHT).
// The SVG scales to fit the A4 page via CSS, so every table's position is used
// AS-IS — no manual scaling, no CORS issues, crisp at any DPI.
//
// Design principles:
//  • Geometry matches TableZone.jsx exactly: SIZE=260, TABLE_R=72, SEAT_R=26, SEAT_ORBIT=108.
//  • Stage bar mirrors FloorPlan.jsx .floor-plan__stage (top=28, width=280, height=52).
//  • Empty seats: dashed circle (matches CSS table-zone__seat--empty).
//  • Filled seats: semi-transparent fill + coloured border (matches CSS cat-* classes).
//  • Names in 9px equivalent — scaled to SVG units.

/** Guest category colours — mirrors TableZone.css cat-* border colours. */
const FLOOR_CAT_COLORS = {
  '男方親友': { border: '#6b5ce7', bg: 'rgba(107,92,231,0.18)' },  // indigo
  '女方親友': { border: '#c2255c', bg: 'rgba(194,37,92,0.18)' },   // rose
  '共同朋友': { border: '#2f9e44', bg: 'rgba(47,158,68,0.18)' },   // green
  '同事':     { border: '#c49a2a', bg: 'rgba(196,154,42,0.18)' },  // amber
  '其他':     { border: '#777',    bg: 'rgba(100,100,100,0.10)' }, // grey
};

/**
 * Shared font stack — Microsoft JhengHei for CJK on Windows, PingFang TC for macOS.
 */
const SYS_FONT = "'Microsoft JhengHei','PingFang TC','Noto Sans TC',system-ui,sans-serif";

// ── Geometry constants — MUST mirror TableZone.jsx exactly ───────────────────
// TableZone.jsx:  SIZE=260, CENTER=130, TABLE_R=72, SEAT_ORBIT=108, SEAT_R=26
// The canvas uses these pixel values directly as SVG coordinate units.

const TABLE_R    = 72;    // matches TableZone.jsx TABLE_R
const SEAT_R     = 26;    // matches TableZone.jsx SEAT_R
const SEAT_ORBIT_R = 108; // matches TableZone.jsx SEAT_ORBIT

/**
 * Place n circles evenly around a circle.
 * startAngle = -π/2 → first seat always at top (12 o'clock), clockwise.
 * Mirrors seatPosition() in TableZone.jsx.
 */
function seatPositions(cx, cy, n, orbitR) {
  const positions = [];
  for (let i = 0; i < n; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    positions.push({
      x: cx + orbitR * Math.cos(angle),
      y: cy + orbitR * Math.sin(angle),
    });
  }
  return positions;
}

function buildFloorPrintHTML(state) {
  const date = formatDate();

  // Build a fast guest lookup by id
  const guestById = {};
  state.guests.forEach(g => { guestById[g.id] = g; });

  const positions = state.tablePositions ?? {};

  // ── SVG defs ────────────────────────────────────────────────────────────
  const svgDefs = `
  <defs>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.15)"/>
    </filter>
  </defs>`;

  // ── Per-table SVG groups ─────────────────────────────────────────────────
  // Layout: table centre circle (TABLE_R=72) + 10 seat circles (SEAT_R=26)
  // at orbit radius 108. Matches TableZone.jsx layout exactly.
  const tableGroups = state.tables.map((table, idx) => {
    const pos    = positions[table.id] ?? defaultTablePosition(idx);
    // In the canvas, the wrapper is positioned at (pos.x, pos.y) which is the
    // top-left of the 260×260 diagram. The centre is at pos.x+130, pos.y+130.
    const cx     = pos.x + 130;
    const cy     = pos.y + 130;

    // [P1 FIX] Use table.guestIds (fixed-length 10 array, null = empty)
    // instead of re-grouping from state.guests by tableId.  This preserves
    // the exact seat index that was set during drag-and-drop assignment.
    const guestIds = table.guestIds ?? Array(10).fill(null);
    const count    = guestIds.filter(Boolean).length;
    const isFull   = count >= 10;

    const tableFill   = isFull ? '#f5edd8' : '#f8f5ef';
    const tableStroke = isFull ? '#c8a44b' : '#b8a07a';

    const allSeatPos = seatPositions(cx, cy, 10, SEAT_ORBIT_R);

    // ── Empty seat placeholders — seats where guestIds[i] is null ──────────
    const emptySeats = Array.from({ length: 10 }, (_, i) => {
      if (guestIds[i]) return ''; // filled — rendered separately
      const ep = allSeatPos[i];
      return `<circle cx="${ep.x.toFixed(1)}" cy="${ep.y.toFixed(1)}"
                r="${SEAT_R}" fill="#f3f0ea" stroke="#c8c0b0"
                stroke-width="1.5" stroke-dasharray="3 4" opacity="0.7"/>`;
    }).join('');

    // ── Seat number inside empty slot ───────────────────────────────────────
    const emptyNums = Array.from({ length: 10 }, (_, i) => {
      if (guestIds[i]) return '';
      const ep = allSeatPos[i];
      return `<text x="${ep.x.toFixed(1)}" y="${ep.y.toFixed(1)}"
                text-anchor="middle" dominant-baseline="central"
                font-family="${SYS_FONT}" font-size="9"
                fill="#aaa" font-weight="600">${i + 1}</text>`;
    }).join('');

    // ── Filled seats — iterate by seat index so positions are exact ─────────
    const seatEls = guestIds.slice(0, 10).map((gid, i) => {
      if (!gid) return '';
      const g = guestById[gid];
      if (!g) return '';
      const sp      = allSeatPos[i];
      const cat     = FLOOR_CAT_COLORS[g.category] ?? FLOOR_CAT_COLORS['其他'];
      const rawName = g.name ?? '';
      // Truncate: max 4 chars, wrap to 2 lines of 2 chars each
      const label   = rawName.length > 4 ? rawName.slice(0, 4) : rawName;
      // Split into two lines if ≥3 chars (matches CSS word-break: break-all)
      const line1   = escHtml(label.slice(0, 2));
      const line2   = label.length > 2 ? escHtml(label.slice(2)) : '';
      const yOffset = line2 ? -5 : 0; // shift up to centre two lines
      return `
      <g>
        <circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="${SEAT_R}"
                fill="${cat.bg}" stroke="${cat.border}" stroke-width="2"/>
        <text x="${sp.x.toFixed(1)}" y="${(sp.y + yOffset).toFixed(1)}"
              text-anchor="middle" dominant-baseline="central"
              font-family="${SYS_FONT}" font-size="9"
              fill="#1a1a1a" font-weight="600">${line1}</text>
        ${line2 ? `<text x="${sp.x.toFixed(1)}" y="${(sp.y + yOffset + 11).toFixed(1)}"
              text-anchor="middle" dominant-baseline="central"
              font-family="${SYS_FONT}" font-size="9"
              fill="#1a1a1a" font-weight="600">${line2}</text>` : ''}
      </g>`;
    }).join('');

    // ── Dashed orbit guide ring (matches SVG in TableZone.jsx) ──────────
    const orbitRing = `<circle cx="${cx}" cy="${cy}" r="${SEAT_ORBIT_R}"
      fill="none" stroke="#c8c0b0" stroke-width="0.8"
      stroke-dasharray="3 5" opacity="0.4"/>`;

    // ── Table centre circle + label ──────────────────────────────────────
    const tableEl = `
      <circle cx="${cx}" cy="${cy}" r="${TABLE_R}"
              fill="${tableFill}" stroke="${tableStroke}" stroke-width="1.5"
              filter="url(#shadow)"/>
      <text x="${cx}" y="${cy - 9}" text-anchor="middle"
            font-family="${SYS_FONT}"
            font-size="16" font-weight="500" fill="#1a1a1a" letter-spacing="2">${escHtml(table.label)}</text>
      <text x="${cx}" y="${cy + 11}" text-anchor="middle"
            font-family="${SYS_FONT}"
            font-size="10" font-weight="400" fill="${isFull ? '#8a5c00' : '#777'}">${count}/${10}</text>`;

    return `<g id="table-${escHtml(String(table.id))}">${orbitRing}${emptySeats}${emptyNums}${seatEls}${tableEl}</g>`;
  }).join('\n');

  // ── Legend items ─────────────────────────────────────────────────────────
  const legendItems = Object.entries(FLOOR_CAT_COLORS).map(([cat, cat_colors]) =>
    `<span style="display:inline-flex;align-items:center;gap:5px;font-size:8pt;color:#444">
      <span style="width:12px;height:12px;border-radius:50%;background:${cat_colors.bg};border:2px solid ${cat_colors.border};flex-shrink:0;display:inline-block"></span>
      ${escHtml(cat)}
    </span>`
  ).join('');

  // ── Assemble final HTML ──────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <title>婚禮桌次位置圖 — ${date}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Microsoft JhengHei', 'PingFang TC', system-ui, sans-serif;
      background: #fff;
      padding: 10mm 12mm 8mm;
      color: #1a1a1a;
    }
    .page-title {
      font-size: 18pt;
      font-weight: 700;
      text-align: center;
      letter-spacing: 5px;
      margin-bottom: 2px;
    }
    .page-meta {
      font-size: 8.5pt;
      text-align: center;
      color: #888;
      margin-bottom: 8px;
    }
    .divider {
      border: none;
      border-top: 1.5px solid #c8b472;
      margin-bottom: 10px;
    }
    /* SVG fills available width — NO max-height cap so nothing gets cropped */
    .floor-svg {
      display: block;
      width: 100%;
      height: auto;
      background: #fffdf7;
      border: 1px solid #e8dfc8;
      border-radius: 4px;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 18px;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid #eee;
      justify-content: center;
    }
    @media print {
      body { padding: 6mm 8mm; }
      @page { margin: 8mm; size: A4 portrait; }
      .floor-svg { border: none; }
    }
  </style>
</head>
<body>
  <h1 class="page-title">婚禮桌次位置圖</h1>
  <p class="page-meta">列印日期：${date} ｜ 共 ${state.tables.length} 桌 ｜ 總賓客：${state.guests.length} 位</p>
  <hr class="divider">

  <svg class="floor-svg"
       viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}"
       xmlns="http://www.w3.org/2000/svg"
       preserveAspectRatio="xMidYMin meet">
    ${svgDefs}

    <!-- Venue background + subtle dot grid -->
    <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="#fffdf7"/>
    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
      <circle cx="50" cy="50" r="1.5" fill="#e8dfc8" opacity="0.5"/>
    </pattern>
    <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="url(#grid)"/>

    <!-- ♡ Stage / Head Table — mirrors FloorPlan.jsx .floor-plan__stage
         FloorPlan.css: top=28, width=280, height=52, horizontally centred -->
    <g id="stage">
      <rect x="${(CANVAS_WIDTH - 280) / 2}" y="28" width="280" height="52"
            rx="6" ry="6"
            fill="rgba(200,164,75,0.09)" stroke="#c8a44b" stroke-width="1"
            stroke-dasharray="8,5"/>
      <text x="${CANVAS_WIDTH / 2}" y="56"
            text-anchor="middle" dominant-baseline="central"
            font-family="${SYS_FONT}"
            font-size="20" font-weight="500" fill="#7c5c00" letter-spacing="5">
        ♡ 主桌 / 舞台
      </text>
    </g>

    ${tableGroups}
  </svg>

  <div class="legend">
    <span style="font-size:8pt;color:#999;align-self:center">座位圖例：</span>
    ${legendItems}
  </div>
</body>
</html>`;
}

