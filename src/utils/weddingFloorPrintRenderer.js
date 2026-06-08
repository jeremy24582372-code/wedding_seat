import { MAX_SEATS } from './constants.js';
import { escHtml } from './exportShared.js';
import { buildWeddingFloorLayoutModel } from './weddingFloorPrintLayout.js';

const MAIN_SEAT_LAYOUT = [
  { dotX: 65, dotY: 5.5, plateX: 51, plateY: 0.5, plateW: 28 },
  { dotX: 43, dotY: 10.5, plateX: 13, plateY: 6.5, plateW: 25 },
  { dotX: 39, dotY: 17, plateX: 9, plateY: 13.5, plateW: 25 },
  { dotX: 39, dotY: 25, plateX: 9, plateY: 22, plateW: 25 },
  { dotX: 43, dotY: 31.5, plateX: 13, plateY: 30, plateW: 25 },
  { dotX: 65, dotY: 38.5, plateX: 51, plateY: 35.5, plateW: 28 },
  { dotX: 87, dotY: 31.5, plateX: 92, plateY: 30, plateW: 25 },
  { dotX: 91, dotY: 25, plateX: 96, plateY: 22, plateW: 25 },
  { dotX: 91, dotY: 17, plateX: 96, plateY: 13.5, plateW: 25 },
  { dotX: 87, dotY: 10.5, plateX: 92, plateY: 6.5, plateW: 25 },
];

const REGULAR_SEAT_POSITIONS = Array.from({ length: MAX_SEATS }, (_, index) => {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / MAX_SEATS;
  return {
    x: 50 + 31 * Math.cos(angle),
    y: 39 + 23 * Math.sin(angle),
  };
});

function cssValue(value) {
  return escHtml(value ?? '');
}

function displayName(name, maxLength = 6) {
  const normalized = String(name ?? '').trim() || '未命名';
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}...`
    : normalized;
}

function displayTableLabel(label) {
  const normalized = String(label ?? '').trim() || '未命名桌次';
  return normalized.length > 6
    ? `${normalized.slice(0, 6)}...`
    : normalized;
}

function guestStyle(guest) {
  const visual = guest?.categoryVisual ?? {};
  return [
    `--wfp-seat-fill:${cssValue(visual.floorBackground || visual.printColor || 'transparent')}`,
    `--wfp-seat-stroke:${cssValue(visual.floorBorder || visual.printColor || 'var(--wfp-gold-line)')}`,
    `--wfp-seat-print:${cssValue(visual.printColor || visual.floorBorder || 'var(--wfp-gold-line)')}`,
  ].join(';');
}

function renderFloralDecorations() {
  const corner = position => `
    <svg class="wfp-floral wfp-floral--${position}" viewBox="0 0 120 108" aria-hidden="true">
      <g opacity="0.92">
        <ellipse cx="32" cy="34" rx="18" ry="10" fill="var(--wfp-rose-soft)" transform="rotate(-28 32 34)"/>
        <ellipse cx="45" cy="26" rx="19" ry="10" fill="var(--wfp-rose-petal)" transform="rotate(22 45 26)"/>
        <ellipse cx="51" cy="43" rx="16" ry="9" fill="var(--wfp-rose-soft)" transform="rotate(46 51 43)"/>
        <circle cx="42" cy="36" r="10" fill="var(--wfp-paper-warm)"/>
        <circle cx="42" cy="36" r="4" fill="var(--wfp-gold-line)" opacity="0.62"/>
      </g>
      <path d="M64 47 C80 23 93 17 110 13" fill="none" stroke="var(--wfp-leaf)" stroke-width="4" stroke-linecap="round" opacity="0.52"/>
      <ellipse cx="78" cy="33" rx="12" ry="5" fill="var(--wfp-leaf-soft)" transform="rotate(-34 78 33)"/>
      <ellipse cx="96" cy="22" rx="13" ry="5" fill="var(--wfp-leaf-soft)" transform="rotate(-24 96 22)"/>
      <path d="M27 62 C14 74 10 86 6 101" fill="none" stroke="var(--wfp-leaf)" stroke-width="3.4" stroke-linecap="round" opacity="0.42"/>
      <ellipse cx="18" cy="78" rx="11" ry="4.8" fill="var(--wfp-leaf-soft)" transform="rotate(-60 18 78)"/>
      <circle cx="82" cy="70" r="1.8" fill="var(--wfp-gold-line)" opacity="0.45"/>
      <circle cx="94" cy="61" r="1.2" fill="var(--wfp-gold-line)" opacity="0.5"/>
      <circle cx="74" cy="82" r="1.3" fill="var(--wfp-gold-line)" opacity="0.38"/>
    </svg>`;

  return `
    ${corner('top-left')}
    ${corner('top-right')}
    ${corner('bottom-left')}
    ${corner('bottom-right')}`;
}

function renderSeatDot(seat, className = '') {
  if (!seat?.guest) {
    return `<span class="wfp-seat-dot wfp-seat-dot--empty ${className}" aria-hidden="true"></span>`;
  }

  return `<span class="wfp-seat-dot ${className}" style="${guestStyle(seat.guest)}" title="${escHtml(seat.guest.name)}"></span>`;
}

function renderHeader(model, compact = false) {
  const meta = model.meta;
  const metaText = [
    `列印日期：${meta.exportDate}`,
    `共 ${meta.tableCount} 桌`,
    `來源筆數：${meta.partyRowCount} 筆`,
    `實際人數：${meta.guestCount} 位`,
  ].join(' ｜ ');

  if (compact) {
    return `
      <header class="wfp-compact-header">
        <span class="wfp-compact-mark">Jeremy &amp; Yuri</span>
        <span>婚禮桌次位置圖</span>
        <span>第 ${compact} 頁</span>
      </header>`;
  }

  return `
    <header class="wfp-header">
      <p class="wfp-couple">Jeremy &amp; Yuri</p>
      <h1>婚 禮 桌 次 位 置 圖</h1>
      <p class="wfp-subtitle">WEDDING SEATING CHART</p>
      <p class="wfp-meta">${escHtml(metaText)}</p>
    </header>`;
}

function renderStageRibbon() {
  return `
    <div class="wfp-stage-ribbon" aria-label="主桌 / 舞台">
      <span>主桌 / 舞台</span>
    </div>`;
}

function renderMainTable(mainTable) {
  if (!mainTable) {
    return `
      <section class="wfp-main-section" aria-label="主桌">
        <div class="wfp-main-table">
          <div class="wfp-main-center">
            <span>主桌</span>
            <small>尚未建立</small>
          </div>
        </div>
      </section>`;
  }

  const seats = Array.from({ length: MAX_SEATS }, (_, index) =>
    mainTable.seats[index] ?? { seatNumber: index + 1, guest: null, isEmpty: true }
  );

  const seatEls = seats.map((seat, index) => {
    const layout = MAIN_SEAT_LAYOUT[index];
    const guest = seat.guest;
    const isLong = String(guest?.name ?? '').length > 6;
    const nameplate = guest
      ? `<span class="wfp-main-name${isLong ? ' wfp-main-name--long' : ''}"
              style="left:${layout.plateX}mm;top:${layout.plateY}mm;width:${layout.plateW}mm;--wfp-seat-stroke:${cssValue(guest.categoryVisual.floorBorder)}"
              title="${escHtml(guest.name)}">${escHtml(displayName(guest.name))}</span>`
      : '';

    return `
      <span class="wfp-main-seat" style="left:${layout.dotX}mm;top:${layout.dotY}mm">
        ${renderSeatDot(seat)}
      </span>
      ${nameplate}`;
  }).join('');

  return `
    <section class="wfp-main-section" aria-label="主桌 ${escHtml(mainTable.label)}">
      <div class="wfp-main-table">
        ${seatEls}
        <div class="wfp-main-center">
          <span>${escHtml(displayTableLabel(mainTable.label))}</span>
          <small>${mainTable.occupancy} / ${mainTable.capacity}</small>
        </div>
      </div>
    </section>`;
}

function renderRegularSeatCircle(seat, index) {
  const position = REGULAR_SEAT_POSITIONS[index];
  if (!seat?.guest) {
    return `<circle cx="${position.x.toFixed(1)}" cy="${position.y.toFixed(1)}" r="5.8" class="wfp-svg-seat wfp-svg-seat--empty"/>`;
  }

  const visual = seat.guest.categoryVisual;
  return `<circle cx="${position.x.toFixed(1)}" cy="${position.y.toFixed(1)}" r="5.8"
    fill="${cssValue(visual.floorBackground || visual.printColor)}"
    stroke="${cssValue(visual.floorBorder || visual.printColor)}"
    stroke-width="1.5"/>`;
}

function renderRegularTable(table) {
  const nameplates = table.displayNameplates.map(guest => {
    const isLong = String(guest.name ?? '').length > 6;
    return `<span class="wfp-regular-name${isLong ? ' wfp-regular-name--long' : ''}"
      style="--wfp-seat-stroke:${cssValue(guest.categoryVisual.floorBorder)}"
      title="${escHtml(guest.name)}">${escHtml(displayName(guest.name, 5))}</span>`;
  }).join('');

  return `
    <article class="wfp-regular-table${table.isFull ? ' wfp-regular-table--full' : ''}${table.overflowGuestIds.length ? ' wfp-regular-table--warning' : ''}">
      <div class="wfp-regular-head">
        <strong title="${escHtml(table.label)}">${escHtml(displayTableLabel(table.label))}</strong>
        <span>${table.occupancy} / ${table.capacity}</span>
      </div>
      <svg class="wfp-regular-svg" viewBox="0 0 100 72" aria-hidden="true">
        <circle cx="50" cy="39" r="17.5" class="wfp-svg-table${table.isFull ? ' wfp-svg-table--full' : ''}"/>
        ${table.seats.map((seat, index) => renderRegularSeatCircle(seat, index)).join('')}
        <text x="50" y="36" text-anchor="middle" dominant-baseline="middle" class="wfp-svg-label">${escHtml(displayTableLabel(table.label))}</text>
        <text x="50" y="48" text-anchor="middle" dominant-baseline="middle" class="wfp-svg-count">${table.occupancy}/${table.capacity}</text>
      </svg>
      <div class="wfp-regular-names">
        ${nameplates || (table.requiresFullIndex ? '<span class="wfp-index-note">完整名單見後頁</span>' : '')}
      </div>
    </article>`;
}

function renderRegularGrid(page) {
  const placeholders = Array.from(
    { length: Math.max(0, page.capacity - page.tables.length) },
    (_, index) => `<div class="wfp-regular-placeholder" aria-hidden="true" data-slot="${index + 1}"></div>`
  ).join('');

  return `
    <section class="wfp-regular-grid" aria-label="一般桌次">
      ${page.tables.map(renderRegularTable).join('')}
      ${placeholders}
    </section>`;
}

function renderLegend(model) {
  const items = model.legendItems.map(item => {
    const visual = item.visual;
    return `
      <span class="wfp-legend-item${item.used ? '' : ' wfp-legend-item--unused'}">
        <span class="wfp-legend-dot" style="--wfp-seat-print:${cssValue(visual.printColor)};--wfp-seat-stroke:${cssValue(visual.floorBorder)}"></span>
        <span>${escHtml(item.label)}</span>
      </span>`;
  }).join('');

  return `
    <footer class="wfp-legend">
      <div class="wfp-legend-title"><span></span><b>座位圖例</b><span></span></div>
      <div class="wfp-legend-list">${items}</div>
    </footer>`;
}

function renderWarningStrip(model) {
  if (model.warnings.length === 0) return '<div class="wfp-warning-strip wfp-warning-strip--empty"></div>';

  const summary = model.warnings.slice(0, 2).map(warning => escHtml(warning.message)).join('　');
  const more = model.warnings.length > 2 ? `另有 ${model.warnings.length - 2} 項提醒，詳見完整名單。` : '詳見完整名單。';

  return `
    <div class="wfp-warning-strip">
      <strong>提醒</strong>
      <span>${summary} ${escHtml(more)}</span>
    </div>`;
}

function renderChartPage(model, page, index) {
  const isFirst = page.kind === 'first';

  return `
    <section class="wfp-page wfp-page--chart wfp-page--${page.kind}">
      ${renderFloralDecorations()}
      <div class="wfp-content">
        ${isFirst ? renderHeader(model) : renderHeader(model, page.pageNumber)}
        ${isFirst ? renderStageRibbon() : ''}
        ${isFirst ? renderMainTable(model.mainTable) : ''}
        ${!isFirst ? `<p class="wfp-continuation-label">一般桌次續頁 ${index + 1}</p>` : ''}
        ${renderRegularGrid(page)}
        ${isFirst ? renderLegend(model) : ''}
        ${isFirst ? renderWarningStrip(model) : ''}
      </div>
    </section>`;
}

function indexLineCount(section) {
  return 2 + Math.max(1, section.guests.length);
}

function paginateIndexSections(sections) {
  const pages = [];
  let current = [];
  let lineCount = 0;
  const maxLines = 205;

  sections.forEach(section => {
    const nextLines = indexLineCount(section);
    if (current.length > 0 && lineCount + nextLines > maxLines) {
      pages.push(current);
      current = [];
      lineCount = 0;
    }
    current.push(section);
    lineCount += nextLines;
  });

  if (current.length > 0) pages.push(current);
  return pages;
}

function renderGuestIndexSection(section) {
  const guests = section.guests.map(guest => `
    <li>
      <span class="wfp-index-dot" style="--wfp-seat-print:${cssValue(guest.categoryVisual.printColor)}"></span>
      <span>${escHtml(guest.name)}</span>
      <small>${escHtml(guest.categoryVisual.label)}${guest.contextLabel ? `｜${escHtml(guest.contextLabel)}` : ''}</small>
    </li>`).join('');

  return `
    <section class="wfp-index-section">
      <h3>${escHtml(section.tableLabel || '未命名桌次')} <span>${section.occupancy}${section.capacity ? ` / ${section.capacity}` : ''}</span></h3>
      <ol>${guests || '<li><span>尚無賓客</span></li>'}</ol>
    </section>`;
}

function renderGuestIndexPage(model, sections, pageIndex, totalPages) {
  return `
    <section class="wfp-page wfp-page--index">
      ${renderFloralDecorations()}
      <div class="wfp-content">
        <header class="wfp-index-header">
          <p>Jeremy &amp; Yuri</p>
          <h2>完整桌次名單</h2>
          <span>第 ${pageIndex + 1} / ${totalPages} 頁</span>
        </header>
        <div class="wfp-index-grid">
          ${sections.map(renderGuestIndexSection).join('')}
        </div>
      </div>
    </section>`;
}

function renderPages(model) {
  const chartPages = model.regularTablePages.map((page, index) => renderChartPage(model, page, index));
  const indexSections = model.fullGuestIndex.filter(section => section.guests.length > 0);
  const indexPages = paginateIndexSections(indexSections).map((sections, pageIndex, pages) =>
    renderGuestIndexPage(model, sections, pageIndex, pages.length)
  );

  return [...chartPages, ...indexPages].join('');
}

function renderStyles() {
  return `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Imperial+Script&family=Noto+Sans+TC:wght@400;500;600;700&family=Noto+Serif+TC:wght@500;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      background: oklch(94% 0.02 78);
      color: var(--wfp-brown-ink);
      font-family: 'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', system-ui, sans-serif;
      text-rendering: geometricPrecision;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .wfp-page {
      --wfp-paper: oklch(98.4% 0.014 82);
      --wfp-paper-warm: oklch(96.8% 0.022 78);
      --wfp-gold-line: oklch(68% 0.086 78);
      --wfp-gold-soft: oklch(89% 0.052 78 / 0.46);
      --wfp-gold-ink: oklch(47% 0.095 74);
      --wfp-brown-ink: oklch(30% 0.045 58);
      --wfp-muted-ink: oklch(52% 0.035 58);
      --wfp-rose-petal: oklch(83% 0.075 20);
      --wfp-rose-soft: oklch(94% 0.035 18);
      --wfp-leaf: oklch(58% 0.064 145);
      --wfp-leaf-soft: oklch(82% 0.042 145);
      --wfp-empty-seat-fill: oklch(98% 0.01 78 / 0.72);
      --wfp-full-table-fill: oklch(94% 0.038 78);
      --wfp-warning: oklch(55% 0.13 35);
      width: 210mm;
      min-height: 297mm;
      position: relative;
      overflow: hidden;
      padding: 8mm 13mm;
      background:
        radial-gradient(circle at 18% 20%, oklch(99% 0.012 38 / 0.78), transparent 38mm),
        radial-gradient(circle at 78% 84%, oklch(97% 0.02 98 / 0.72), transparent 42mm),
        var(--wfp-paper);
      break-after: page;
      page-break-after: always;
    }
    .wfp-page:last-child { break-after: auto; page-break-after: auto; }
    .wfp-content { position: relative; z-index: 1; min-height: 281mm; }
    .wfp-floral { position: absolute; z-index: 0; pointer-events: none; }
    .wfp-floral--top-left { width: 50mm; height: 46mm; left: -3mm; top: -2mm; }
    .wfp-floral--top-right { width: 42mm; height: 40mm; right: -2mm; top: -1mm; transform: scaleX(-1) rotate(3deg); opacity: 0.78; }
    .wfp-floral--bottom-left { width: 56mm; height: 52mm; left: -4mm; bottom: -5mm; transform: scaleY(-1) rotate(7deg); opacity: 0.72; }
    .wfp-floral--bottom-right { width: 58mm; height: 54mm; right: -4mm; bottom: -5mm; transform: rotate(180deg); opacity: 0.86; }

    .wfp-header {
      height: 44mm;
      display: grid;
      align-content: start;
      justify-items: center;
      padding-top: 0.5mm;
      text-align: center;
    }
    .wfp-couple {
      margin: 0;
      color: var(--wfp-gold-ink);
      font-family: 'Imperial Script', 'Segoe Script', 'Times New Roman', cursive;
      font-size: 31pt;
      line-height: 0.95;
      letter-spacing: 0;
    }
    .wfp-header h1 {
      margin: 4mm 0 0;
      color: var(--wfp-brown-ink);
      font-family: 'Noto Serif TC', 'Noto Sans TC', 'Microsoft JhengHei', serif;
      font-size: 15pt;
      font-weight: 500;
      line-height: 1;
      letter-spacing: 0.42em;
      text-indent: 0.42em;
    }
    .wfp-subtitle {
      margin: 1.8mm 0 0;
      color: var(--wfp-gold-ink);
      font-size: 8.5pt;
      font-weight: 500;
      letter-spacing: 0.36em;
      text-indent: 0.36em;
    }
    .wfp-meta {
      margin: 3mm 0 0;
      color: var(--wfp-muted-ink);
      font-size: 8pt;
      line-height: 1.25;
    }

    .wfp-stage-ribbon {
      position: absolute;
      left: 48mm;
      top: 49mm;
      width: 88mm;
      height: 10mm;
      display: grid;
      place-items: center;
      color: var(--wfp-brown-ink);
      font-family: 'Noto Serif TC', 'Microsoft JhengHei', serif;
      font-size: 12pt;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-indent: 0.18em;
      background: linear-gradient(90deg, transparent, var(--wfp-gold-soft) 12%, oklch(96% 0.033 78 / 0.82) 50%, var(--wfp-gold-soft) 88%, transparent);
      border: 1px solid var(--wfp-gold-line);
      border-radius: 999px;
    }
    .wfp-stage-ribbon::before,
    .wfp-stage-ribbon::after {
      content: '';
      position: absolute;
      top: 2.2mm;
      width: 6mm;
      height: 5.6mm;
      border-top: 1px solid var(--wfp-gold-line);
      border-bottom: 1px solid var(--wfp-gold-line);
    }
    .wfp-stage-ribbon::before { left: -6mm; transform: skewY(-22deg); border-left: 1px solid var(--wfp-gold-line); }
    .wfp-stage-ribbon::after { right: -6mm; transform: skewY(22deg); border-right: 1px solid var(--wfp-gold-line); }

    .wfp-main-section {
      position: absolute;
      left: 27mm;
      top: 62mm;
      width: 130mm;
      height: 44mm;
    }
    .wfp-main-table {
      position: relative;
      width: 130mm;
      height: 44mm;
    }
    .wfp-main-seat { position: absolute; width: 6.2mm; height: 6.2mm; transform: translate(-50%, -50%); }
    .wfp-seat-dot {
      width: 100%;
      height: 100%;
      display: block;
      border-radius: 999px;
      background: var(--wfp-seat-fill);
      border: 1.2px solid var(--wfp-seat-stroke);
    }
    .wfp-seat-dot--empty {
      background: var(--wfp-empty-seat-fill);
      border-color: var(--wfp-gold-line);
      opacity: 0.64;
    }
    .wfp-main-name {
      position: absolute;
      height: 7mm;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 1.4mm;
      border: 1px solid var(--wfp-seat-stroke);
      border-radius: 999px;
      background: oklch(99% 0.008 82 / 0.96);
      color: var(--wfp-brown-ink);
      font-size: 7pt;
      font-weight: 600;
      line-height: 1.05;
      text-align: center;
      overflow: hidden;
      overflow-wrap: anywhere;
      word-break: break-all;
    }
    .wfp-main-name--long { font-size: 6.2pt; }
    .wfp-main-center {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 24mm;
      height: 24mm;
      transform: translate(-50%, -50%);
      display: grid;
      place-items: center;
      align-content: center;
      gap: 1mm;
      border-radius: 999px;
      border: 1.2px solid var(--wfp-gold-line);
      background: oklch(99% 0.01 82 / 0.94);
      color: var(--wfp-brown-ink);
      text-align: center;
    }
    .wfp-main-center span {
      max-width: 18mm;
      font-family: 'Noto Serif TC', 'Microsoft JhengHei', serif;
      font-size: 9.2pt;
      font-weight: 700;
      line-height: 1.12;
      overflow-wrap: anywhere;
    }
    .wfp-main-center small {
      color: var(--wfp-gold-ink);
      font-size: 6.8pt;
      font-weight: 600;
    }

    .wfp-regular-grid {
      position: absolute;
      left: 0;
      top: 111mm;
      width: 184mm;
      height: 138mm;
      display: grid;
      grid-template-columns: repeat(4, 38.5mm);
      grid-template-rows: repeat(5, 24.4mm);
      gap: 4mm 10mm;
    }
    .wfp-page--continuation .wfp-regular-grid { top: 31mm; }
    .wfp-regular-table,
    .wfp-regular-placeholder {
      width: 38.5mm;
      height: 24.4mm;
      position: relative;
    }
    .wfp-regular-table {
      border: 1px solid oklch(83% 0.04 76 / 0.72);
      border-radius: 2mm;
      background: oklch(99% 0.008 82 / 0.68);
      padding: 1.2mm 1.3mm;
    }
    .wfp-regular-table--full {
      background: var(--wfp-full-table-fill);
      border-color: var(--wfp-gold-line);
    }
    .wfp-regular-table--warning { outline: 1px solid var(--wfp-warning); outline-offset: -1px; }
    .wfp-regular-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1.5mm;
      height: 4mm;
      color: var(--wfp-brown-ink);
      font-size: 7pt;
      line-height: 1;
    }
    .wfp-regular-head strong {
      max-width: 24mm;
      font-size: 8.4pt;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .wfp-regular-head span {
      color: var(--wfp-gold-ink);
      font-size: 6.8pt;
      font-weight: 600;
    }
    .wfp-regular-svg {
      width: 100%;
      height: 14mm;
      display: block;
      margin-top: -0.6mm;
      overflow: visible;
    }
    .wfp-svg-table {
      fill: oklch(99% 0.01 82);
      stroke: var(--wfp-gold-line);
      stroke-width: 1.1;
    }
    .wfp-svg-table--full { fill: var(--wfp-full-table-fill); stroke-width: 1.4; }
    .wfp-svg-seat--empty {
      fill: var(--wfp-empty-seat-fill);
      stroke: var(--wfp-gold-line);
      stroke-width: 1;
      stroke-dasharray: 2 2;
      opacity: 0.66;
    }
    .wfp-svg-label {
      fill: var(--wfp-brown-ink);
      font-family: 'Noto Sans TC', 'Microsoft JhengHei', sans-serif;
      font-size: 8px;
      font-weight: 700;
    }
    .wfp-svg-count {
      fill: var(--wfp-gold-ink);
      font-family: 'Noto Sans TC', 'Microsoft JhengHei', sans-serif;
      font-size: 6.5px;
      font-weight: 600;
    }
    .wfp-regular-names {
      height: 4.7mm;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.7mm;
      overflow: hidden;
    }
    .wfp-regular-name {
      min-width: 0;
      max-width: 11.4mm;
      height: 4mm;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 0.8mm;
      border: 1px solid var(--wfp-seat-stroke);
      border-radius: 999px;
      background: oklch(99% 0.006 82 / 0.9);
      color: var(--wfp-brown-ink);
      font-size: 5.8pt;
      font-weight: 600;
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .wfp-regular-name--long { font-size: 5.2pt; }
    .wfp-index-note {
      color: var(--wfp-muted-ink);
      font-size: 5.8pt;
      letter-spacing: 0.05em;
    }
    .wfp-regular-placeholder {
      border: 1px dashed oklch(86% 0.036 76 / 0.24);
      border-radius: 2mm;
      opacity: 0.42;
    }

    .wfp-legend {
      position: absolute;
      left: 22mm;
      top: 256mm;
      width: 140mm;
      text-align: center;
    }
    .wfp-legend-title {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 4mm;
      color: var(--wfp-gold-ink);
      font-size: 8.8pt;
      font-weight: 600;
      letter-spacing: 0.16em;
      text-indent: 0.16em;
    }
    .wfp-legend-title span {
      height: 1px;
      background: var(--wfp-gold-line);
    }
    .wfp-legend-list {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 2.4mm 7mm;
      margin-top: 4mm;
    }
    .wfp-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 1.5mm;
      color: var(--wfp-brown-ink);
      font-size: 7.5pt;
      line-height: 1;
    }
    .wfp-legend-item--unused { opacity: 0.48; }
    .wfp-legend-dot {
      width: 4.2mm;
      height: 4.2mm;
      border-radius: 999px;
      background: var(--wfp-seat-print);
      border: 1px solid var(--wfp-seat-stroke);
      flex: 0 0 auto;
    }
    .wfp-warning-strip {
      position: absolute;
      left: 0;
      top: 277mm;
      width: 184mm;
      min-height: 6mm;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2mm;
      color: var(--wfp-warning);
      font-size: 6.8pt;
      line-height: 1.25;
      text-align: center;
    }
    .wfp-warning-strip strong {
      font-size: 7pt;
      letter-spacing: 0.1em;
      text-indent: 0.1em;
    }
    .wfp-warning-strip--empty { visibility: hidden; }

    .wfp-compact-header {
      height: 18mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--wfp-gold-line);
      color: var(--wfp-muted-ink);
      font-size: 8pt;
      letter-spacing: 0.12em;
    }
    .wfp-compact-mark {
      color: var(--wfp-gold-ink);
      font-family: 'Imperial Script', 'Segoe Script', cursive;
      font-size: 19pt;
      letter-spacing: 0;
    }
    .wfp-continuation-label {
      margin: 3mm 0 0;
      color: var(--wfp-gold-ink);
      font-size: 8pt;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-align: center;
    }

    .wfp-index-header {
      height: 21mm;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: end;
      gap: 5mm;
      border-bottom: 1px solid var(--wfp-gold-line);
      padding-bottom: 4mm;
    }
    .wfp-index-header p {
      margin: 0;
      color: var(--wfp-gold-ink);
      font-family: 'Imperial Script', 'Segoe Script', cursive;
      font-size: 22pt;
      line-height: 0.9;
    }
    .wfp-index-header h2 {
      margin: 0;
      color: var(--wfp-brown-ink);
      font-family: 'Noto Serif TC', 'Microsoft JhengHei', serif;
      font-size: 14pt;
      font-weight: 700;
      letter-spacing: 0.26em;
      text-indent: 0.26em;
      text-align: center;
    }
    .wfp-index-header span {
      justify-self: end;
      color: var(--wfp-muted-ink);
      font-size: 7.5pt;
    }
    .wfp-index-grid {
      margin-top: 6mm;
      column-count: 4;
      column-gap: 6mm;
    }
    .wfp-index-section {
      break-inside: avoid;
      display: inline-block;
      width: 100%;
      margin: 0 0 4mm;
      padding: 2mm;
      border: 1px solid oklch(84% 0.042 76 / 0.72);
      border-radius: 2mm;
      background: oklch(99% 0.008 82 / 0.66);
    }
    .wfp-index-section h3 {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 2mm;
      margin: 0 0 1.5mm;
      color: var(--wfp-brown-ink);
      font-size: 7.6pt;
      line-height: 1.25;
    }
    .wfp-index-section h3 span {
      color: var(--wfp-gold-ink);
      font-size: 6.5pt;
      white-space: nowrap;
    }
    .wfp-index-section ol {
      display: grid;
      gap: 1mm;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .wfp-index-section li {
      display: grid;
      grid-template-columns: 2.3mm 1fr;
      align-items: baseline;
      gap: 1mm;
      color: var(--wfp-brown-ink);
      font-size: 7pt;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }
    .wfp-index-section li small {
      grid-column: 2;
      color: var(--wfp-muted-ink);
      font-size: 5.8pt;
      line-height: 1.2;
    }
    .wfp-index-dot {
      width: 2.2mm;
      height: 2.2mm;
      border-radius: 999px;
      background: var(--wfp-seat-print);
      transform: translateY(0.6mm);
    }

    @page { size: A4 portrait; margin: 0; }
    @media print {
      body { background: var(--wfp-paper); }
      .wfp-page { box-shadow: none; }
    }
  </style>`;
}

export function renderWeddingFloorPrintHTML(model) {
  const date = model.meta.exportDate;

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <title>婚禮桌次位置圖 - ${escHtml(date)}</title>
  ${renderStyles()}
</head>
<body>
  ${renderPages(model)}
</body>
</html>`;
}

export function buildWeddingFloorPrintHTML(state, options = {}) {
  return renderWeddingFloorPrintHTML(buildWeddingFloorLayoutModel(state, options));
}
