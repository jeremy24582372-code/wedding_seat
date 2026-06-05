import {
  MAX_SEATS,
  buildCategoryOptions,
  normalizeCategory,
} from './constants.js';
import {
  buildGuestContextLabel,
  escHtml,
  formatExportDate,
  guestDot,
} from './exportShared.js';

function buildGuestPrintRow(state, guest) {
  const contextLabel = buildGuestContextLabel(state, guest.id);

  return `
    <li class="guest-row">
      ${guestDot(guest.category)}
      <span class="guest-name">${escHtml(guest.name)}</span>
      ${guest.category ? `<span class="guest-cat">${escHtml(normalizeCategory(guest.category))}</span>` : ''}
      ${guest.diet ? `<span class="guest-note">${escHtml(guest.diet)}</span>` : ''}
      ${contextLabel ? `<span class="guest-extra">${escHtml(contextLabel)}</span>` : ''}
    </li>`;
}

export function buildPrintHTML(state) {
  const date = formatExportDate();
  const guests = state?.guests ?? [];
  const tables = state?.tables ?? [];
  const guestById = new Map(guests.map(guest => [guest.id, guest]));

  const tableCards = tables.map(table => {
    const tableGuests = (table.guestIds ?? [])
      .map(guestId => guestById.get(guestId))
      .filter(Boolean);
    const tableCapacity = table.seats ?? MAX_SEATS;
    const emptyCount = Math.max(0, tableCapacity - tableGuests.length);
    const isFull = tableGuests.length >= tableCapacity;

    const guestRows = tableGuests.map(guest => buildGuestPrintRow(state, guest)).join('');
    const emptyRows = Array(emptyCount)
      .fill('<li class="guest-row guest-empty"><span class="dot dot--empty"></span><span class="empty-label">空位</span></li>')
      .join('');

    return `
      <div class="table-card${isFull ? ' table-card--full' : ''}">
        <div class="table-head">
          <span class="table-name">${escHtml(table.label)}</span>
          <span class="table-count">${tableGuests.length}&thinsp;/&thinsp;${tableCapacity}</span>
        </div>
        <ul class="guest-list">${guestRows}${emptyRows}</ul>
      </div>`;
  }).join('');

  const unassignedFromState = (state?.unassignedGuestIds ?? [])
    .map(guestId => guestById.get(guestId))
    .filter(Boolean);
  const unassigned = unassignedFromState.length > 0
    ? unassignedFromState
    : guests.filter(guest => !guest.tableId);

  const unassignedSection = unassigned.length === 0 ? '' : `
    <section class="unassigned">
      <h2 class="unassigned-title">尚未分配座位（${unassigned.length} 位）</h2>
      <ul class="guest-list unassigned-list">
        ${unassigned.map(guest => buildGuestPrintRow(state, guest)).join('')}
      </ul>
    </section>`;

  const legendItems = buildCategoryOptions(guests).map(cat => {
    const visual = guestDot(cat.id);
    return `<span class="legend-item">${visual}${escHtml(cat.label)}</span>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <title>婚禮賓客座位表 - ${date}</title>
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
      text-rendering: geometricPrecision;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

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
      page-break-inside: avoid;
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

    .guest-list { list-style: none; padding: 3px 0; }

    .guest-row {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 1.5px 9px;
      font-size: 9pt;
      min-height: 16px;
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
    .guest-extra { font-size: 7.3pt; color: #8a5c00; margin-left: auto; }
    .empty-label { font-size: 8pt; color: #bbb; }

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

    @media print {
      body { padding: 10mm; }
      @page { margin: 12mm; size: A4; }
      .tables-grid { grid-template-columns: repeat(3, 1fr); }
      .unassigned-list { columns: 4; }
      .table-card,
      .unassigned {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <h1 class="page-title">婚禮賓客座位表</h1>
  <p class="page-meta">列印日期：${date} ｜ 來源筆數：${(state?.partyRows ?? []).length} 筆 ｜ 實際人數：${guests.length} 位 ｜ 共 ${tables.length} 桌</p>
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
