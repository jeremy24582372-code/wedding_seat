import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  buildCategoryOptions,
  defaultTablePosition,
  getCategoryVisual,
} from './constants.js';
import { escHtml, formatExportDate } from './exportShared.js';
import { buildWeddingFloorPrintHTML } from './weddingFloorPrintRenderer.js';

export { buildWeddingFloorPrintHTML };

const SYS_FONT = "'Microsoft JhengHei','PingFang TC','Noto Sans TC',system-ui,sans-serif";

// Geometry must mirror TableZone.jsx.
const TABLE_R = 72;
const SEAT_R = 26;
const SEAT_ORBIT_R = 108;

function seatPositions(cx, cy, n, orbitR) {
  const positions = [];
  for (let i = 0; i < n; i += 1) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n;
    positions.push({
      x: cx + orbitR * Math.cos(angle),
      y: cy + orbitR * Math.sin(angle),
    });
  }
  return positions;
}

export function buildFloorPrintHTML(state, options = {}) {
  return buildWeddingFloorPrintHTML(state, options);
}

export function buildLegacyFloorPrintHTML(state) {
  const date = formatExportDate();
  const guests = state?.guests ?? [];
  const tables = state?.tables ?? [];
  const guestById = Object.fromEntries(guests.map(guest => [guest.id, guest]));
  const positions = state?.tablePositions ?? {};

  const svgDefs = `
  <defs>
    <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.15)"/>
    </filter>
  </defs>`;

  const tableGroups = tables.map((table, idx) => {
    const pos = positions[table.id] ?? defaultTablePosition(idx);
    const cx = pos.x + 130;
    const cy = pos.y + 130;
    const guestIds = table.guestIds ?? Array(10).fill(null);
    const count = guestIds.filter(Boolean).length;
    const isFull = count >= 10;
    const tableFill = isFull ? '#f5edd8' : '#f8f5ef';
    const tableStroke = isFull ? '#c8a44b' : '#b8a07a';
    const allSeatPos = seatPositions(cx, cy, 10, SEAT_ORBIT_R);

    const emptySeats = Array.from({ length: 10 }, (_, i) => {
      if (guestIds[i]) return '';
      const ep = allSeatPos[i];
      return `<circle cx="${ep.x.toFixed(1)}" cy="${ep.y.toFixed(1)}"
                r="${SEAT_R}" fill="#f3f0ea" stroke="#c8c0b0"
                stroke-width="1.5" stroke-dasharray="3 4" opacity="0.7"/>`;
    }).join('');

    const emptyNums = Array.from({ length: 10 }, (_, i) => {
      if (guestIds[i]) return '';
      const ep = allSeatPos[i];
      return `<text x="${ep.x.toFixed(1)}" y="${ep.y.toFixed(1)}"
                text-anchor="middle" dominant-baseline="central"
                font-family="${SYS_FONT}" font-size="9"
                fill="#aaa" font-weight="600">${i + 1}</text>`;
    }).join('');

    const seatEls = guestIds.slice(0, 10).map((guestId, i) => {
      if (!guestId) return '';
      const guest = guestById[guestId];
      if (!guest) return '';
      const sp = allSeatPos[i];
      const cat = getCategoryVisual(guest.category);
      const label = (guest.name ?? '').length > 4 ? guest.name.slice(0, 4) : (guest.name ?? '');
      const line1 = escHtml(label.slice(0, 2));
      const line2 = label.length > 2 ? escHtml(label.slice(2)) : '';
      const yOffset = line2 ? -5 : 0;

      return `
      <g>
        <circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="${SEAT_R}"
                fill="${cat.floorBackground}" stroke="${cat.floorBorder}" stroke-width="2"/>
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

    const orbitRing = `<circle cx="${cx}" cy="${cy}" r="${SEAT_ORBIT_R}"
      fill="none" stroke="#c8c0b0" stroke-width="0.8"
      stroke-dasharray="3 5" opacity="0.4"/>`;

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

  const legendItems = buildCategoryOptions(guests).map(cat => {
    const visual = getCategoryVisual(cat.id);
    return `<span style="display:inline-flex;align-items:center;gap:5px;font-size:8pt;color:#444">
      <span style="width:12px;height:12px;border-radius:50%;background:${visual.floorBackground};border:2px solid ${visual.floorBorder};flex-shrink:0;display:inline-block"></span>
      ${escHtml(visual.label)}
    </span>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <title>婚禮桌次位置圖 - ${date}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Microsoft JhengHei', 'PingFang TC', system-ui, sans-serif;
      background: #fff;
      padding: 10mm 12mm 8mm;
      color: #1a1a1a;
      text-rendering: geometricPrecision;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
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
    .floor-svg {
      display: block;
      width: 100%;
      height: auto;
      background: #fffdf7;
      border: 1px solid #e8dfc8;
      border-radius: 4px;
      shape-rendering: geometricPrecision;
      text-rendering: geometricPrecision;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
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
  <p class="page-meta">列印日期：${date} ｜ 共 ${tables.length} 桌 ｜ 來源筆數：${(state?.partyRows ?? []).length} 筆 ｜ 實際人數：${guests.length} 位</p>
  <hr class="divider">

  <svg class="floor-svg"
       viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}"
       xmlns="http://www.w3.org/2000/svg"
       preserveAspectRatio="xMidYMin meet">
    ${svgDefs}

    <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="#fffdf7"/>
    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
      <circle cx="50" cy="50" r="1.5" fill="#e8dfc8" opacity="0.5"/>
    </pattern>
    <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="url(#grid)"/>

    <g id="stage">
      <rect x="${(CANVAS_WIDTH - 280) / 2}" y="28" width="280" height="52"
            rx="6" ry="6"
            fill="rgba(200,164,75,0.09)" stroke="#c8a44b" stroke-width="1"
            stroke-dasharray="8,5"/>
      <text x="${CANVAS_WIDTH / 2}" y="56"
            text-anchor="middle" dominant-baseline="central"
            font-family="${SYS_FONT}"
            font-size="20" font-weight="500" fill="#7c5c00" letter-spacing="5">
        主桌 / 舞台
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
