import { escHtml } from './exportShared.js';
import { buildFloorDesignLayoutModel } from './floorDesignLayoutModel.js';
import { buildWeddingFloorDesignSvg } from './floorDesignSvgBuilder.js';
import { buildWeddingFloorLayoutModel } from './weddingFloorPrintLayout.js';
import {
  buildWeddingFloorFontFaces,
  buildWeddingFloorFontVariables,
} from './weddingFloorTypography.js';

function cssValue(value) {
  return escHtml(value ?? '');
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

function formatNumber(value) {
  return Number(value ?? 0).toFixed(3).replace(/\.?0+$/u, '');
}

function pointRelativeToGroup(point, groupBox) {
  return {
    x: point.x - groupBox.x,
    y: point.y - groupBox.y,
  };
}

function rectRelativeToGroup(rect, groupBox) {
  return {
    x: rect.x - groupBox.x,
    y: rect.y - groupBox.y,
    width: rect.width,
    height: rect.height,
  };
}

function styleBox(rect) {
  return [
    `left:${formatNumber(rect.x)}mm`,
    `top:${formatNumber(rect.y)}mm`,
    `width:${formatNumber(rect.width)}mm`,
    `height:${formatNumber(rect.height)}mm`,
  ].join(';');
}

function stylePoint(point, diameter) {
  return [
    `left:${formatNumber(point.x)}mm`,
    `top:${formatNumber(point.y)}mm`,
    `width:${formatNumber(diameter)}mm`,
    `height:${formatNumber(diameter)}mm`,
  ].join(';');
}

function findSeatByIndex(table, seatIndex) {
  return (table?.seats ?? []).find(seat => seat.seatIndex === seatIndex) ?? null;
}

function findGuestById(table, guestId) {
  return (table?.guests ?? []).find(guest => guest.id === guestId) ?? null;
}

function labelFontSize(name, variant) {
  const length = Array.from(String(name ?? '').trim()).length;

  if (variant === 'regular') {
    if (length > 6) return '5.5pt';
    return '5.9pt';
  }

  if (length > 8) return '6.2pt';
  if (length > 6) return '6.5pt';
  return '7pt';
}

function connectorPath(connector, groupBox) {
  const points = [
    { x: connector.fromX, y: connector.fromY },
    ...(connector.bendPoints ?? []),
    { x: connector.toX, y: connector.toY },
  ].map(point => pointRelativeToGroup(point, groupBox));

  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${formatNumber(point.x)} ${formatNumber(point.y)}`)
    .join(' ');
}

function renderFloralDecorations() {
  const corner = position => `
    <svg class="wfp-floral wfp-floral--${position}" viewBox="0 0 120 108" aria-hidden="true">
      <path class="wfp-floral-stem" d="M10 92 C31 67 46 55 68 48 C88 42 101 29 112 12" fill="none"/>
      <path class="wfp-floral-stem wfp-floral-stem--fine" d="M16 100 C24 84 34 73 48 66 C62 59 67 49 73 35" fill="none"/>
      <g class="wfp-floral-bloom wfp-floral-bloom--primary">
        <ellipse cx="32" cy="34" rx="18" ry="10" fill="var(--wfp-rose-soft)" transform="rotate(-28 32 34)"/>
        <ellipse cx="45" cy="26" rx="19" ry="10" fill="var(--wfp-rose-petal)" transform="rotate(22 45 26)"/>
        <ellipse cx="51" cy="43" rx="16" ry="9" fill="var(--wfp-rose-soft)" transform="rotate(46 51 43)"/>
        <ellipse cx="34" cy="49" rx="14" ry="8" fill="var(--wfp-rose-petal)" transform="rotate(-58 34 49)" opacity="0.78"/>
        <circle cx="42" cy="36" r="10" fill="var(--wfp-paper-warm)"/>
        <circle cx="42" cy="36" r="4" fill="var(--wfp-gold-line)" opacity="0.62"/>
      </g>
      <g class="wfp-floral-bloom wfp-floral-bloom--secondary">
        <ellipse cx="76" cy="64" rx="10" ry="6" fill="var(--wfp-rose-soft)" transform="rotate(24 76 64)"/>
        <ellipse cx="84" cy="58" rx="9" ry="5" fill="var(--wfp-rose-petal)" transform="rotate(-28 84 58)" opacity="0.72"/>
        <circle cx="80" cy="61" r="3.4" fill="var(--wfp-gold-line)" opacity="0.42"/>
      </g>
      <ellipse cx="78" cy="33" rx="12" ry="5" fill="var(--wfp-leaf-soft)" transform="rotate(-34 78 33)"/>
      <ellipse cx="96" cy="22" rx="13" ry="5" fill="var(--wfp-leaf-soft)" transform="rotate(-24 96 22)"/>
      <ellipse cx="18" cy="78" rx="11" ry="4.8" fill="var(--wfp-leaf-soft)" transform="rotate(-60 18 78)"/>
      <ellipse cx="31" cy="72" rx="9" ry="4" fill="var(--wfp-leaf-soft)" transform="rotate(-38 31 72)" opacity="0.72"/>
      <ellipse cx="64" cy="72" rx="8" ry="3.8" fill="var(--wfp-leaf-soft)" transform="rotate(28 64 72)" opacity="0.7"/>
      <circle cx="25" cy="56" r="3.2" fill="var(--wfp-rose-petal)" opacity="0.48"/>
      <circle cx="101" cy="39" r="2.8" fill="var(--wfp-rose-soft)" opacity="0.72"/>
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
      <div class="wfp-header-ornament" aria-hidden="true"><span></span><i>&#9829;</i><span></span></div>
      <h1>婚 禮 桌 次 位 置 圖</h1>
      <p class="wfp-meta">${escHtml(metaText)}</p>
    </header>`;
}

function renderStageRibbon() {
  return `
    <div class="wfp-stage-ribbon" aria-label="舞台">
      <span class="wfp-stage-ribbon__tail wfp-stage-ribbon__tail--left"></span>
      <span>舞台</span>
      <span class="wfp-stage-ribbon__tail wfp-stage-ribbon__tail--right"></span>
    </div>`;
}

function renderMainTable(mainTable) {
  if (!mainTable) {
    return `
      <section class="wfp-main-section" aria-label="主桌">
        <div class="wfp-main-table">
          <div class="wfp-table-core wfp-table-core--main" style="left:65mm;top:25mm;width:24mm;height:24mm">
            <span>主桌</span>
            <small>尚未建立</small>
          </div>
        </div>
      </section>`;
  }

  return renderAnnotatedTable({
    table: mainTable,
    instance: mainTable.overviewTableInstance,
    placementKey: 'overviewPlacement',
    variant: 'main',
  });
}

function renderSeatDots(table, instance) {
  const groupBox = instance.groupBox;

  return instance.seats.map(instanceSeat => {
    const sourceSeat = findSeatByIndex(table, instanceSeat.seatIndex);
    const guest = sourceSeat?.guest ?? null;
    const point = pointRelativeToGroup(instanceSeat.seatPoint, groupBox);
    const diameter = instanceSeat.dotDiameter;

    return `
      <span class="wfp-seat-anchor" style="${stylePoint(point, diameter)}" data-seat-index="${instanceSeat.seatIndex}">
        ${renderSeatDot({ guest })}
      </span>`;
  }).join('');
}

function renderSeatConnectors({ table, placementKey, groupBox, variant }) {
  const paths = (table.annotationRecords ?? [])
    .map(annotation => {
      const placement = annotation[placementKey];
      if (!placement?.connector) return '';

      const guest = findGuestById(table, annotation.guestId);
      return `
        <path class="wfp-seat-connector wfp-seat-connector--${variant}"
          data-guest-id="${escHtml(annotation.guestId)}"
          d="${connectorPath(placement.connector, groupBox)}"
          style="--wfp-seat-stroke:${cssValue(guest?.categoryVisual?.floorBorder)}"/>`;
    }).join('');

  if (!paths) return '';

  return `
    <svg class="wfp-annotation-connectors" viewBox="0 0 ${formatNumber(groupBox.width)} ${formatNumber(groupBox.height)}" aria-hidden="true">
      ${paths}
    </svg>`;
}

function renderSeatLabels({ table, placementKey, groupBox, variant }) {
  return (table.annotationRecords ?? [])
    .map(annotation => {
      const placement = annotation[placementKey];
      if (!placement?.labelBox) return '';

      const guest = findGuestById(table, annotation.guestId);
      const labelBox = rectRelativeToGroup(placement.labelBox, groupBox);
      const guestName = annotation.guestName || guest?.name || '未命名';
      const isLong = Array.from(String(guestName)).length > 6;

      return `
        <span class="wfp-seat-label wfp-seat-label--${variant} wfp-seat-label--${placement.side}${isLong ? ' wfp-seat-label--long' : ''}"
          data-guest-id="${escHtml(annotation.guestId)}"
          data-seat-index="${annotation.seatIndex}"
          style="${styleBox(labelBox)};--wfp-seat-stroke:${cssValue(guest?.categoryVisual?.floorBorder)};--wfp-label-font-size:${labelFontSize(guestName, variant)}"
          title="${escHtml(guestName)}">${escHtml(guestName)}</span>`;
    }).join('');
}

function renderTableCore(table, instance, variant) {
  const groupBox = instance.groupBox;
  const center = pointRelativeToGroup(instance.tableCenter, groupBox);
  const diameter = instance.tableCenter.diameter;

  return `
    <div class="wfp-table-core wfp-table-core--${variant}${table.isFull ? ' wfp-table-core--full' : ''}"
      style="${stylePoint(center, diameter)}">
      <span title="${escHtml(table.label)}">${escHtml(displayTableLabel(table.label))}</span>
      <small>${table.occupancy} / ${table.capacity}</small>
    </div>`;
}

function renderDetailReference(table) {
  if (!table.needsDetailPage || !table.detailPageNumber) return '';
  return '';
}

function renderAnnotatedTable({ table, instance, placementKey, variant }) {
  if (!table || !instance) return '';

  const groupBox = instance.groupBox;
  const isSummary = instance.mode === 'overview-summary';

  return `
    <article class="wfp-annotation-table wfp-annotation-table--${variant}${table.isFull ? ' wfp-annotation-table--full' : ''}${isSummary ? ' wfp-annotation-table--summary' : ''}${table.overflowGuestIds.length ? ' wfp-annotation-table--warning' : ''}"
      style="${styleBox(groupBox)}"
      aria-label="${escHtml(table.label)} ${table.occupancy} / ${table.capacity}">
      ${renderSeatConnectors({ table, placementKey, groupBox, variant })}
      ${renderSeatDots(table, instance)}
      ${renderTableCore(table, instance, variant)}
      ${renderSeatLabels({ table, placementKey, groupBox, variant })}
      ${isSummary ? renderDetailReference(table) : ''}
    </article>`;
}

function renderRegularTable(table) {
  return renderAnnotatedTable({
    table,
    instance: table.overviewTableInstance,
    placementKey: 'overviewPlacement',
    variant: 'regular',
  });
}

function renderRegularGrid(page) {
  return `
    <section class="wfp-regular-grid" aria-label="一般桌次">
      ${page.tables.map(renderRegularTable).join('')}
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

function renderDesignChartPage(model) {
  const designSvg = buildWeddingFloorDesignSvg(model.floorDesignModel, {
    meta: model.meta,
    legendItems: model.legendItems,
  });

  return `
    <section class="wfp-page wfp-page--chart wfp-page--design">
      <div class="wfp-design-chart">
        ${designSvg}
      </div>
    </section>`;
}

function renderChartPage(model, page, index) {
  const isFirst = page.kind === 'first';

  if (isFirst && model.floorDesignModel) {
    return renderDesignChartPage(model);
  }

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

function renderDetailHeader(page) {
  return `
    <header class="wfp-detail-header">
      <p>Jeremy &amp; Yuri</p>
      <h2>桌次詳圖</h2>
      <span>第 ${page.pageNumber} 頁</span>
    </header>`;
}

function renderDetailTable(table) {
  return renderAnnotatedTable({
    table,
    instance: table.detailTableInstance,
    placementKey: 'detailPlacement',
    variant: 'detail',
  });
}

function renderDetailPage(page, pageIndex) {
  return `
    <section class="wfp-page wfp-page--detail">
      ${renderFloralDecorations()}
      <div class="wfp-content">
        ${renderDetailHeader(page)}
        <p class="wfp-detail-subtitle">每位已入座賓客皆以座位點、姓名標籤與連結線呈現</p>
        <div class="wfp-detail-grid" aria-label="桌次詳圖 ${pageIndex + 1}">
          ${page.tables.map(renderDetailTable).join('')}
        </div>
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
  const chartPages = [renderChartPage(model, { pageNumber: 1, kind: 'first', tables: [] }, 0)];
  const detailPages = model.detailPages.map((page, pageIndex) => renderDetailPage(page, pageIndex));
  const indexSections = model.fullGuestIndex.filter(section => section.guests.length > 0);
  const indexPages = paginateIndexSections(indexSections).map((sections, pageIndex, pages) =>
    renderGuestIndexPage(model, sections, pageIndex, pages.length)
  );

  return [...chartPages, ...detailPages, ...indexPages].join('');
}

function renderStyles() {
  return `
  <style>
    ${buildWeddingFloorFontFaces()}
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      ${buildWeddingFloorFontVariables()};
      background: oklch(94% 0.02 78);
      color: var(--wfp-brown-ink);
      font-family: var(--wfp-font-zh);
      text-rendering: geometricPrecision;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .wfp-page {
      --wfp-paper: oklch(98.4% 0.014 82);
      --wfp-paper-warm: oklch(96.8% 0.022 78);
      --wfp-gold-line: oklch(68% 0.086 78);
      --wfp-gold-hairline: oklch(74% 0.07 78 / 0.72);
      --wfp-gold-soft: oklch(89% 0.052 78 / 0.46);
      --wfp-gold-ink: oklch(47% 0.095 74);
      --wfp-ribbon-fill: oklch(96.6% 0.032 78 / 0.9);
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
    .wfp-page--design {
      padding: 0;
      background: var(--wfp-paper);
    }
    .wfp-design-chart,
    .wfp-design-svg {
      display: block;
      width: 210mm;
      height: 297mm;
    }
    .wfp-floral { position: absolute; z-index: 0; overflow: visible; pointer-events: none; }
    .wfp-floral-stem {
      stroke: var(--wfp-leaf);
      stroke-width: 3.3;
      stroke-linecap: round;
      opacity: 0.38;
    }
    .wfp-floral-stem--fine {
      stroke-width: 2.2;
      opacity: 0.28;
    }
    .wfp-floral-bloom--primary { opacity: 0.9; }
    .wfp-floral-bloom--secondary { opacity: 0.76; }
    .wfp-floral--top-left { width: 50mm; height: 46mm; left: -5mm; top: -3mm; opacity: 0.82; }
    .wfp-floral--top-right { width: 43mm; height: 40mm; right: -4mm; top: -2mm; transform: scaleX(-1) rotate(3deg); opacity: 0.68; }
    .wfp-floral--bottom-left { width: 61mm; height: 56mm; left: -7mm; bottom: -7mm; transform: scaleY(-1) rotate(7deg); opacity: 0.7; }
    .wfp-floral--bottom-right { width: 64mm; height: 58mm; right: -7mm; bottom: -7mm; transform: rotate(180deg); opacity: 0.84; }

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
      font-family: var(--wfp-font-en-script);
      font-size: 26.4pt;
      line-height: 0.92;
      letter-spacing: 0;
    }
    .wfp-header-ornament {
      display: grid;
      grid-template-columns: 31mm auto 31mm;
      align-items: center;
      gap: 2.6mm;
      width: 76mm;
      margin-top: 1.4mm;
      color: var(--wfp-gold-ink);
    }
    .wfp-header-ornament span {
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--wfp-gold-hairline), transparent);
    }
    .wfp-header-ornament i {
      display: block;
      font-family: var(--wfp-font-en-text);
      font-size: 7.2pt;
      font-style: normal;
      line-height: 1;
      transform: translateY(-0.1mm);
    }
    .wfp-header h1 {
      margin: 2.7mm 0 0;
      color: var(--wfp-brown-ink);
      font-family: var(--wfp-font-zh);
      font-size: 11.68pt;
      font-weight: 500;
      line-height: 1;
      letter-spacing: 0.336em;
      text-indent: 0.336em;
    }
    .wfp-meta {
      margin: 2mm 0 0;
      color: var(--wfp-muted-ink);
      font-size: 8pt;
      line-height: 1.25;
    }

    .wfp-stage-ribbon {
      position: absolute;
      left: 50mm;
      top: 49mm;
      width: 84mm;
      height: 9.4mm;
      display: grid;
      place-items: center;
      color: var(--wfp-brown-ink);
      font-family: var(--wfp-font-zh);
      font-size: 12pt;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-indent: 0.18em;
      isolation: isolate;
      background:
        linear-gradient(180deg, oklch(99% 0.012 82 / 0.86), transparent 48%),
        linear-gradient(90deg, var(--wfp-gold-soft), var(--wfp-ribbon-fill) 21%, oklch(98% 0.022 78 / 0.96) 50%, var(--wfp-ribbon-fill) 79%, var(--wfp-gold-soft));
      border: 1px solid var(--wfp-gold-line);
      border-radius: 1.1mm;
      box-shadow: 0 0.8mm 2mm oklch(45% 0.03 60 / 0.06);
    }
    .wfp-stage-ribbon::before,
    .wfp-stage-ribbon::after {
      content: '';
      position: absolute;
      left: 5mm;
      right: 5mm;
      height: 1px;
      background: var(--wfp-gold-hairline);
      opacity: 0.7;
      z-index: 1;
    }
    .wfp-stage-ribbon::before { top: 1.5mm; }
    .wfp-stage-ribbon::after { bottom: 1.5mm; }
    .wfp-stage-ribbon > span:not(.wfp-stage-ribbon__tail) {
      position: relative;
      z-index: 2;
    }
    .wfp-stage-ribbon__tail {
      position: absolute;
      top: 1.1mm;
      width: 12.5mm;
      height: 7.2mm;
      background: linear-gradient(90deg, oklch(91% 0.044 78 / 0.72), var(--wfp-gold-soft));
      border: 1px solid var(--wfp-gold-line);
      z-index: 0;
    }
    .wfp-stage-ribbon__tail--left {
      left: -9.4mm;
      clip-path: polygon(0 0, 100% 0, 78% 50%, 100% 100%, 0 100%, 22% 50%);
    }
    .wfp-stage-ribbon__tail--right {
      right: -9.4mm;
      clip-path: polygon(0 0, 100% 0, 78% 50%, 100% 100%, 0 100%, 22% 50%);
      transform: scaleX(-1);
    }

    .wfp-main-section {
      position: absolute;
      left: 27mm;
      top: 62mm;
      width: 130mm;
      height: 50mm;
    }
    .wfp-main-table {
      position: relative;
      width: 130mm;
      height: 50mm;
    }
    .wfp-annotation-table {
      position: absolute;
      isolation: isolate;
    }
    .wfp-annotation-table--main {
      z-index: 3;
    }
    .wfp-annotation-table--regular {
      z-index: 2;
    }
    .wfp-annotation-table--detail {
      z-index: 2;
    }
    .wfp-annotation-table--warning {
      outline: 0.8px dotted var(--wfp-warning);
      outline-offset: 1.2mm;
      border-radius: 2mm;
    }
    .wfp-annotation-connectors {
      position: absolute;
      inset: 0;
      z-index: 1;
      overflow: visible;
      pointer-events: none;
    }
    .wfp-seat-connector {
      fill: none;
      stroke: var(--wfp-gold-line);
      stroke-width: 0.28mm;
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0.64;
      vector-effect: non-scaling-stroke;
    }
    .wfp-seat-connector--main {
      stroke-width: 0.35mm;
      opacity: 0.62;
    }
    .wfp-seat-connector--detail {
      stroke-width: 0.32mm;
      opacity: 0.72;
    }
    .wfp-seat-anchor {
      position: absolute;
      z-index: 2;
      transform: translate(-50%, -50%);
    }
    .wfp-seat-dot {
      width: 100%;
      height: 100%;
      display: block;
      border-radius: 999px;
      background: var(--wfp-seat-fill);
      border: 1.2px solid var(--wfp-seat-stroke);
      box-shadow: 0 0 0 0.45mm oklch(99% 0.008 82 / 0.82);
    }
    .wfp-seat-dot--empty {
      background: var(--wfp-empty-seat-fill);
      border-color: var(--wfp-gold-line);
      opacity: 0.64;
    }
    .wfp-seat-label {
      position: absolute;
      z-index: 4;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 1.1mm;
      border: 0.85px solid var(--wfp-seat-stroke);
      border-radius: 1.6mm;
      background: oklch(99% 0.008 82 / 0.96);
      color: var(--wfp-brown-ink);
      font-size: var(--wfp-label-font-size);
      font-weight: 600;
      line-height: 1.06;
      text-align: center;
      overflow: hidden;
      overflow-wrap: anywhere;
      word-break: break-all;
      white-space: normal;
      box-shadow: 0 0.25mm 1.1mm oklch(45% 0.025 62 / 0.07);
    }
    .wfp-seat-label--main,
    .wfp-seat-label--detail {
      border-radius: 2.4mm;
      padding: 0 1.35mm;
    }
    .wfp-seat-label--regular {
      padding: 0 0.7mm;
      background: oklch(99% 0.006 82 / 0.94);
      box-shadow: 0 0 0 0.35mm oklch(99% 0.01 82 / 0.5);
    }
    .wfp-seat-label--long {
      line-height: 1;
    }
    .wfp-table-core {
      position: absolute;
      transform: translate(-50%, -50%);
      display: grid;
      place-items: center;
      align-content: center;
      gap: 0.8mm;
      border-radius: 999px;
      border: 1px solid var(--wfp-gold-line);
      background: oklch(99% 0.01 82 / 0.94);
      color: var(--wfp-brown-ink);
      text-align: center;
      z-index: 3;
      box-shadow:
        0 0 0 1mm oklch(99% 0.01 82 / 0.56),
        0 0.7mm 2.2mm oklch(44% 0.035 58 / 0.06);
    }
    .wfp-table-core--regular {
      gap: 0.3mm;
      border-width: 0.8px;
      background: oklch(99% 0.008 82 / 0.84);
      box-shadow: 0 0 0 0.55mm oklch(99% 0.01 82 / 0.5);
    }
    .wfp-table-core--full {
      background: var(--wfp-full-table-fill);
      border-color: var(--wfp-gold-line);
    }
    .wfp-table-core span {
      max-width: 80%;
      font-family: var(--wfp-font-zh);
      font-size: 9pt;
      font-weight: 700;
      line-height: 1.1;
      overflow-wrap: anywhere;
    }
    .wfp-table-core small {
      color: var(--wfp-gold-ink);
      font-size: 6.6pt;
      font-weight: 600;
    }
    .wfp-table-core--regular span {
      font-size: 6.2pt;
      max-width: 10mm;
    }
    .wfp-table-core--regular small {
      font-size: 5.3pt;
    }
    .wfp-table-core--detail span {
      font-size: 9pt;
    }

    .wfp-regular-grid {
      position: absolute;
      left: 0;
      top: 0;
      width: 184mm;
      height: 249mm;
    }
    .wfp-detail-header {
      height: 21mm;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: end;
      gap: 5mm;
      border-bottom: 1px solid var(--wfp-gold-line);
      padding-bottom: 4mm;
    }
    .wfp-detail-header p {
      margin: 0;
      color: var(--wfp-gold-ink);
      font-family: var(--wfp-font-en-script);
      font-size: 22pt;
      line-height: 0.9;
    }
    .wfp-detail-header h2 {
      margin: 0;
      color: var(--wfp-brown-ink);
      font-family: var(--wfp-font-zh);
      font-size: 14pt;
      font-weight: 700;
      letter-spacing: 0.26em;
      text-indent: 0.26em;
      text-align: center;
    }
    .wfp-detail-header span {
      justify-self: end;
      color: var(--wfp-muted-ink);
      font-size: 7.5pt;
    }
    .wfp-detail-subtitle {
      margin: 3mm 0 0;
      color: var(--wfp-muted-ink);
      font-size: 7pt;
      text-align: center;
      letter-spacing: 0.12em;
    }
    .wfp-detail-grid {
      position: absolute;
      left: 0;
      top: 0;
      width: 184mm;
      height: 257mm;
    }

    .wfp-legend {
      position: absolute;
      left: 14mm;
      top: 255.5mm;
      width: 156mm;
      text-align: center;
    }
    .wfp-legend-title {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 3.2mm;
      color: var(--wfp-gold-ink);
      font-size: 8.2pt;
      font-weight: 600;
      letter-spacing: 0.13em;
      text-indent: 0.13em;
    }
    .wfp-legend-title span {
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--wfp-gold-hairline), transparent);
    }
    .wfp-legend-title b {
      font-family: var(--wfp-font-zh);
      font-weight: 600;
    }
    .wfp-legend-list {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 2.1mm 6mm;
      margin-top: 2.7mm;
    }
    .wfp-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 1.35mm;
      color: var(--wfp-brown-ink);
      font-size: 7.2pt;
      line-height: 1;
    }
    .wfp-legend-item--unused { opacity: 0.48; }
    .wfp-legend-dot {
      width: 3.7mm;
      height: 3.7mm;
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
      font-family: var(--wfp-font-en-script);
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
      font-family: var(--wfp-font-en-script);
      font-size: 22pt;
      line-height: 0.9;
    }
    .wfp-index-header h2 {
      margin: 0;
      color: var(--wfp-brown-ink);
      font-family: var(--wfp-font-zh);
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
  const layoutModel = buildWeddingFloorLayoutModel(state, options);
  const floorDesignModel = buildFloorDesignLayoutModel(state, options.floorDesign ?? {});

  return renderWeddingFloorPrintHTML({
    ...layoutModel,
    floorDesignModel,
  });
}
