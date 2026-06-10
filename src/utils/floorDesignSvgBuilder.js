import { escHtml } from './exportShared.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function formatNumber(value) {
  return Number(value ?? 0).toFixed(3).replace(/\.?0+$/u, '');
}

function cssValue(value, fallback = 'currentColor') {
  return escHtml(value || fallback);
}

function attr(value) {
  return escHtml(value ?? '');
}

function displayTableLabel(label) {
  const normalized = String(label ?? '').trim() || '未命名桌次';
  return normalized.length > 6 ? `${normalized.slice(0, 6)}...` : normalized;
}

function isMainTable(table) {
  const label = String(table?.label ?? '').trim();
  return label === '主桌' || label.includes('主桌') || label === '1桌';
}

function labelCenter(labelBox) {
  return {
    x: labelBox.x + labelBox.width / 2,
    y: labelBox.y + labelBox.height / 2,
  };
}

function textLines(label) {
  const lines = label?.textFit?.lines;
  if (Array.isArray(lines) && lines.length > 0) return lines;
  return [label?.guestName ?? ''];
}

function renderTextLines(lines, center, fontSizePt, lineHeight = 0.34) {
  const yOffset = -((lines.length - 1) * fontSizePt * lineHeight) / 2;

  return lines.map((line, index) => `
    <tspan x="${formatNumber(center.x)}" y="${formatNumber(center.y + yOffset + index * fontSizePt * lineHeight)}">${attr(line)}</tspan>`).join('');
}

function renderFloralCorner(position) {
  const transforms = {
    'top-left': 'translate(-4 -3)',
    'top-right': 'translate(214 -3) scale(-1 1)',
    'bottom-left': 'translate(-5 303) scale(1 -1) rotate(5)',
    'bottom-right': 'translate(216 303) rotate(180)',
  };
  const scale = position.includes('bottom') ? 0.56 : 0.45;

  return `
    <g class="wfp-design-floral wfp-design-floral--${position}" transform="${transforms[position]} scale(${scale})" aria-hidden="true">
      <path class="wfp-design-floral-stem" d="M12 100 C32 72 49 58 73 50 C92 44 105 30 118 12"/>
      <path class="wfp-design-floral-stem wfp-design-floral-stem--fine" d="M20 108 C29 88 41 76 57 68 C70 61 77 49 82 34"/>
      <g opacity="0.9">
        <ellipse cx="35" cy="36" rx="19" ry="10" transform="rotate(-28 35 36)" fill="var(--wfp-rose-soft)"/>
        <ellipse cx="49" cy="27" rx="20" ry="10" transform="rotate(22 49 27)" fill="var(--wfp-rose-petal)"/>
        <ellipse cx="55" cy="45" rx="17" ry="9" transform="rotate(47 55 45)" fill="var(--wfp-rose-soft)"/>
        <ellipse cx="36" cy="51" rx="15" ry="8" transform="rotate(-58 36 51)" fill="var(--wfp-rose-petal)" opacity="0.78"/>
        <circle cx="45" cy="38" r="10" fill="var(--wfp-paper-warm)"/>
        <circle cx="45" cy="38" r="4" fill="var(--wfp-gold-line)" opacity="0.58"/>
      </g>
      <g opacity="0.75">
        <ellipse cx="80" cy="66" rx="10" ry="6" transform="rotate(24 80 66)" fill="var(--wfp-rose-soft)"/>
        <ellipse cx="88" cy="60" rx="9" ry="5" transform="rotate(-28 88 60)" fill="var(--wfp-rose-petal)"/>
        <circle cx="84" cy="63" r="3.4" fill="var(--wfp-gold-line)" opacity="0.42"/>
      </g>
      <ellipse cx="82" cy="34" rx="13" ry="5" transform="rotate(-34 82 34)" fill="var(--wfp-leaf-soft)"/>
      <ellipse cx="101" cy="23" rx="13" ry="5" transform="rotate(-24 101 23)" fill="var(--wfp-leaf-soft)"/>
      <ellipse cx="20" cy="82" rx="11" ry="4.8" transform="rotate(-60 20 82)" fill="var(--wfp-leaf-soft)"/>
      <ellipse cx="34" cy="75" rx="9" ry="4" transform="rotate(-38 34 75)" fill="var(--wfp-leaf-soft)" opacity="0.72"/>
      <ellipse cx="67" cy="75" rx="8" ry="3.8" transform="rotate(28 67 75)" fill="var(--wfp-leaf-soft)" opacity="0.7"/>
      <circle cx="27" cy="58" r="3.2" fill="var(--wfp-rose-petal)" opacity="0.48"/>
      <circle cx="106" cy="41" r="2.8" fill="var(--wfp-rose-soft)" opacity="0.72"/>
      <circle cx="86" cy="73" r="1.8" fill="var(--wfp-gold-line)" opacity="0.45"/>
      <circle cx="98" cy="64" r="1.2" fill="var(--wfp-gold-line)" opacity="0.5"/>
      <circle cx="78" cy="85" r="1.3" fill="var(--wfp-gold-line)" opacity="0.38"/>
    </g>`;
}

function renderHeader(meta) {
  const metaText = [
    `列印日期：${meta.exportDate}`,
    `共 ${meta.tableCount} 桌`,
    `來源筆數：${meta.partyRowCount} 筆`,
    `實際人數：${meta.guestCount} 位`,
  ].join(' ｜ ');

  return `
    <g class="wfp-design-header">
      <text class="wfp-design-couple" x="105" y="24">Jeremy &amp; Yuri</text>
      <line class="wfp-design-gold-rule" x1="62" y1="31" x2="96" y2="31"/>
      <text class="wfp-design-heart" x="105" y="33">&#9829;</text>
      <line class="wfp-design-gold-rule" x1="114" y1="31" x2="148" y2="31"/>
      <text class="wfp-design-title" x="105" y="43">婚 禮 桌 次 位 置 圖</text>
      <text class="wfp-design-subtitle" x="105" y="51">WEDDING SEATING CHART</text>
      <text class="wfp-design-meta" x="105" y="58">${attr(metaText)}</text>
    </g>`;
}

function renderStageRibbon() {
  return `
    <g class="wfp-design-stage" aria-label="主桌 / 舞台">
      <path class="wfp-design-stage-tail" d="M49 64 H62 V74 H49 L54 69 Z"/>
      <path class="wfp-design-stage-tail" d="M161 64 H148 V74 H161 L156 69 Z"/>
      <rect class="wfp-design-stage-ribbon" x="58" y="62" width="94" height="14" rx="1.6"/>
      <line class="wfp-design-stage-line" x1="64" y1="65" x2="146" y2="65"/>
      <line class="wfp-design-stage-line" x1="64" y1="73" x2="146" y2="73"/>
      <text class="wfp-design-stage-text" x="105" y="70.5">主桌 / 舞台</text>
    </g>`;
}

function renderSeatDot(dot) {
  const visual = dot.categoryVisual ?? {};
  const className = dot.isEmpty
    ? 'wfp-seat-dot wfp-seat-dot--empty'
    : 'wfp-seat-dot wfp-seat-dot--occupied';
  const style = dot.isEmpty
    ? ''
    : `style="--wfp-seat-fill:${cssValue(visual.floorBackground || visual.printColor)};--wfp-seat-stroke:${cssValue(visual.floorBorder || visual.printColor)}"`;

  return `
    <circle class="${className}"
      cx="${formatNumber(dot.printPoint.x)}"
      cy="${formatNumber(dot.printPoint.y)}"
      r="${formatNumber(Math.max(0.9, dot.dotRadius))}"
      ${style}
      data-seat-index="${dot.seatIndex}"/>`;
}

function renderSeatConnector(label, variant) {
  if (!label?.connector || label.connector.length <= 0.01) return '';

  const visual = label.categoryVisual ?? {};
  return `
    <path class="wfp-seat-connector wfp-seat-connector--${variant}"
      data-guest-id="${attr(label.guestId)}"
      d="M ${formatNumber(label.connector.fromX)} ${formatNumber(label.connector.fromY)} L ${formatNumber(label.connector.toX)} ${formatNumber(label.connector.toY)}"
      style="--wfp-seat-stroke:${cssValue(visual.floorBorder || visual.printColor || 'var(--wfp-gold-line)')}"/>`;
}

function renderSeatLabel(label, variant) {
  const visual = label.categoryVisual ?? {};
  const center = labelCenter(label.labelBox);
  const lines = textLines(label);
  const fontSize = label.textFit?.fontSizePt ?? (variant === 'main' ? 6.6 : 5.8);

  return `
    <g class="wfp-seat-label wfp-seat-label--${variant} wfp-seat-label--${label.localSector}"
      data-guest-id="${attr(label.guestId)}"
      data-seat-index="${label.seatIndex}"
      style="--wfp-seat-stroke:${cssValue(visual.floorBorder || visual.printColor || 'var(--wfp-gold-line)')};--wfp-label-font-size:${formatNumber(fontSize)}pt">
      <rect class="wfp-design-label-box"
        x="${formatNumber(label.labelBox.x)}"
        y="${formatNumber(label.labelBox.y)}"
        width="${formatNumber(label.labelBox.width)}"
        height="${formatNumber(label.labelBox.height)}"
        rx="${variant === 'main' ? '2.2' : '1.4'}"/>
      <text class="wfp-design-label-text" x="${formatNumber(center.x)}" y="${formatNumber(center.y)}">${renderTextLines(lines, center, fontSize)}</text>
    </g>`;
}

function renderMainMedallion(table) {
  if (!isMainTable(table)) return '';

  const { centerX, centerY, radius } = table.printPosition;
  const medallionRadius = Math.max(6, radius * 0.42);

  return `
    <g class="wfp-design-main-medallion" aria-hidden="true">
      <circle class="wfp-main-medallion-halo" cx="${formatNumber(centerX)}" cy="${formatNumber(centerY)}" r="${formatNumber(medallionRadius + 3)}"/>
      <path class="wfp-main-medallion-leaf" d="M ${formatNumber(centerX - medallionRadius * 0.55)} ${formatNumber(centerY - 1)}
        C ${formatNumber(centerX - medallionRadius * 0.35)} ${formatNumber(centerY - medallionRadius * 0.45)}
          ${formatNumber(centerX + medallionRadius * 0.1)} ${formatNumber(centerY - medallionRadius * 0.45)}
          ${formatNumber(centerX + medallionRadius * 0.32)} ${formatNumber(centerY - 2)}"/>
      <circle class="wfp-main-medallion-bloom" cx="${formatNumber(centerX - medallionRadius * 0.25)}" cy="${formatNumber(centerY - medallionRadius * 0.12)}" r="${formatNumber(Math.max(2, medallionRadius * 0.2))}"/>
      <circle class="wfp-main-medallion-bloom wfp-main-medallion-bloom--soft" cx="${formatNumber(centerX + medallionRadius * 0.18)}" cy="${formatNumber(centerY - medallionRadius * 0.04)}" r="${formatNumber(Math.max(1.8, medallionRadius * 0.17))}"/>
    </g>`;
}

function renderTableCore(table, variant) {
  const { centerX, centerY, radius } = table.printPosition;
  const coreRadius = Math.max(3.2, radius * 0.48);

  return `
    <g class="wfp-design-table-core wfp-design-table-core--${variant}">
      <circle class="wfp-design-table-orbit" cx="${formatNumber(centerX)}" cy="${formatNumber(centerY)}" r="${formatNumber(radius * 0.72)}"/>
      <circle class="wfp-design-table-center" cx="${formatNumber(centerX)}" cy="${formatNumber(centerY)}" r="${formatNumber(coreRadius)}"/>
      <text class="wfp-design-table-label" x="${formatNumber(centerX)}" y="${formatNumber(centerY - coreRadius * 0.15)}">${attr(displayTableLabel(table.label))}</text>
      <text class="wfp-design-table-count" x="${formatNumber(centerX)}" y="${formatNumber(centerY + coreRadius * 0.33)}">${table.occupancy} / ${table.capacity}</text>
    </g>`;
}

function renderTable(table) {
  const variant = isMainTable(table) ? 'main' : 'regular';
  const connectors = table.seatLabels.map(label => renderSeatConnector(label, variant)).join('');
  const dots = table.seatDots.map(renderSeatDot).join('');
  const labels = table.seatLabels.map(label => renderSeatLabel(label, variant)).join('');

  return `
    <g class="wfp-design-table wfp-design-table--${variant}"
      data-table-id="${attr(table.id)}"
      data-table-label="${attr(table.label)}"
      data-position-source="${attr(table.positionSource)}">
      ${renderMainMedallion(table)}
      ${connectors}
      ${dots}
      ${renderTableCore(table, variant)}
      ${labels}
    </g>`;
}

function renderLegend(legendItems = []) {
  const items = legendItems.map((item, index) => {
    const visual = item.visual ?? {};
    const col = index % 4;
    const row = Math.floor(index / 4);
    return `
      <g class="wfp-design-legend-item${item.used ? '' : ' wfp-design-legend-item--unused'}" transform="translate(${formatNumber(col * 30)} ${formatNumber(row * 7)})">
        <circle class="wfp-design-legend-dot" r="2"
          style="--wfp-seat-fill:${cssValue(visual.printColor)};--wfp-seat-stroke:${cssValue(visual.floorBorder || visual.printColor)}"/>
        <text class="wfp-design-legend-text" x="4.4" y="1.2">${attr(item.label)}</text>
      </g>`;
  }).join('');

  return `
    <g class="wfp-design-legend">
      <line class="wfp-design-legend-rule" x1="28" y1="264" x2="86" y2="264"/>
      <text class="wfp-design-legend-title" x="105" y="266.2">座位圖例</text>
      <line class="wfp-design-legend-rule" x1="124" y1="264" x2="182" y2="264"/>
      <g class="wfp-design-legend-list" transform="translate(42 274)">
        ${items}
      </g>
    </g>`;
}

function renderStyles() {
  return `
    <style>
      .wfp-design-svg {
        --wfp-paper: oklch(98.4% 0.014 82);
        --wfp-paper-warm: oklch(96.8% 0.022 78);
        --wfp-gold-line: oklch(68% 0.086 78);
        --wfp-gold-hairline: oklch(74% 0.07 78 / 0.72);
        --wfp-gold-soft: oklch(89% 0.052 78 / 0.46);
        --wfp-gold-ink: oklch(47% 0.095 74);
        --wfp-ribbon-fill: oklch(96.6% 0.032 78 / 0.94);
        --wfp-brown-ink: oklch(30% 0.045 58);
        --wfp-muted-ink: oklch(52% 0.035 58);
        --wfp-rose-petal: oklch(83% 0.075 20);
        --wfp-rose-soft: oklch(94% 0.035 18);
        --wfp-leaf: oklch(58% 0.064 145);
        --wfp-leaf-soft: oklch(82% 0.042 145);
        --wfp-empty-seat-fill: oklch(98% 0.01 78 / 0.72);
        color: var(--wfp-brown-ink);
        background: var(--wfp-paper);
        font-family: 'Noto Sans TC', 'Microsoft JhengHei', 'PingFang TC', system-ui, sans-serif;
        text-rendering: geometricPrecision;
      }
      .wfp-design-paper { fill: var(--wfp-paper); }
      .wfp-design-paper-wash { fill: url(#wfp-design-paper-wash); opacity: 0.84; }
      .wfp-design-floral-stem {
        fill: none;
        stroke: var(--wfp-leaf);
        stroke-width: 3.3;
        stroke-linecap: round;
        opacity: 0.38;
      }
      .wfp-design-floral-stem--fine { stroke-width: 2.2; opacity: 0.28; }
      .wfp-design-couple {
        fill: var(--wfp-gold-ink);
        font-family: 'Imperial Script', 'Segoe Script', 'Times New Roman', cursive;
        font-size: 33px;
        text-anchor: middle;
      }
      .wfp-design-title {
        fill: var(--wfp-brown-ink);
        font-family: 'Noto Serif TC', 'Noto Sans TC', 'Microsoft JhengHei', serif;
        font-size: 14.6px;
        font-weight: 500;
        letter-spacing: 4.8px;
        text-anchor: middle;
      }
      .wfp-design-subtitle {
        fill: var(--wfp-gold-ink);
        font-size: 8.5px;
        font-weight: 500;
        letter-spacing: 3.1px;
        text-anchor: middle;
      }
      .wfp-design-meta {
        fill: var(--wfp-muted-ink);
        font-size: 7px;
        text-anchor: middle;
      }
      .wfp-design-gold-rule,
      .wfp-design-legend-rule {
        stroke: var(--wfp-gold-hairline);
        stroke-width: 0.35;
      }
      .wfp-design-heart {
        fill: var(--wfp-gold-ink);
        font-family: 'Noto Serif TC', 'Times New Roman', serif;
        font-size: 7.2px;
        text-anchor: middle;
      }
      .wfp-design-stage-tail,
      .wfp-design-stage-ribbon {
        fill: var(--wfp-ribbon-fill);
        stroke: var(--wfp-gold-line);
        stroke-width: 0.5;
      }
      .wfp-design-stage-line {
        stroke: var(--wfp-gold-hairline);
        stroke-width: 0.28;
      }
      .wfp-design-stage-text {
        fill: var(--wfp-brown-ink);
        font-family: 'Noto Serif TC', 'Microsoft JhengHei', serif;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 1.8px;
        text-anchor: middle;
        dominant-baseline: central;
      }
      .wfp-design-content-frame {
        fill: none;
        stroke: var(--wfp-gold-hairline);
        stroke-width: 0.25;
        stroke-dasharray: 1.2 2.4;
        opacity: 0.34;
      }
      .wfp-design-table-orbit {
        fill: none;
        stroke: var(--wfp-gold-hairline);
        stroke-width: 0.32;
        stroke-dasharray: 1.2 1.8;
        opacity: 0.48;
      }
      .wfp-design-table-center {
        fill: oklch(99% 0.01 82 / 0.94);
        stroke: var(--wfp-gold-line);
        stroke-width: 0.45;
        filter: url(#wfp-design-soft-shadow);
      }
      .wfp-design-table--regular .wfp-design-table-center {
        fill: oklch(99% 0.008 82 / 0.86);
        stroke-width: 0.36;
      }
      .wfp-design-table-label {
        fill: var(--wfp-brown-ink);
        font-family: 'Noto Serif TC', 'Microsoft JhengHei', serif;
        font-size: 4.6px;
        font-weight: 700;
        text-anchor: middle;
        dominant-baseline: central;
      }
      .wfp-design-table--main .wfp-design-table-label { font-size: 6px; }
      .wfp-design-table-count {
        fill: var(--wfp-gold-ink);
        font-size: 3.6px;
        font-weight: 600;
        text-anchor: middle;
        dominant-baseline: central;
      }
      .wfp-main-medallion-halo {
        fill: var(--wfp-paper-warm);
        stroke: var(--wfp-gold-hairline);
        stroke-width: 0.35;
        opacity: 0.72;
      }
      .wfp-main-medallion-leaf {
        fill: none;
        stroke: var(--wfp-leaf);
        stroke-width: 0.45;
        opacity: 0.5;
      }
      .wfp-main-medallion-bloom {
        fill: var(--wfp-rose-petal);
        opacity: 0.55;
      }
      .wfp-main-medallion-bloom--soft {
        fill: var(--wfp-rose-soft);
        opacity: 0.72;
      }
      .wfp-seat-dot {
        fill: var(--wfp-seat-fill);
        stroke: var(--wfp-seat-stroke);
        stroke-width: 0.45;
        filter: url(#wfp-design-dot-paper);
      }
      .wfp-seat-dot--empty {
        --wfp-seat-fill: var(--wfp-empty-seat-fill);
        --wfp-seat-stroke: var(--wfp-gold-line);
        opacity: 0.68;
      }
      .wfp-seat-connector {
        fill: none;
        stroke: var(--wfp-seat-stroke);
        stroke-width: 0.28;
        stroke-linecap: round;
        opacity: 0.62;
      }
      .wfp-design-label-box {
        fill: oklch(99% 0.008 82 / 0.96);
        stroke: var(--wfp-seat-stroke);
        stroke-width: 0.35;
        filter: url(#wfp-design-label-shadow);
      }
      .wfp-seat-label--regular .wfp-design-label-box {
        fill: oklch(99% 0.006 82 / 0.94);
        stroke-width: 0.3;
      }
      .wfp-design-label-text {
        fill: var(--wfp-brown-ink);
        font-size: var(--wfp-label-font-size);
        font-weight: 600;
        line-height: 1;
        text-anchor: middle;
        dominant-baseline: central;
      }
      .wfp-design-legend-title {
        fill: var(--wfp-gold-ink);
        font-family: 'Noto Serif TC', 'Microsoft JhengHei', serif;
        font-size: 8.2px;
        font-weight: 600;
        letter-spacing: 1.2px;
        text-anchor: middle;
      }
      .wfp-design-legend-dot {
        fill: var(--wfp-seat-fill);
        stroke: var(--wfp-seat-stroke);
        stroke-width: 0.45;
      }
      .wfp-design-legend-text {
        fill: var(--wfp-brown-ink);
        font-size: 6.8px;
      }
      .wfp-design-legend-item--unused { opacity: 0.46; }
    </style>`;
}

function normalizeMeta(model, options) {
  const meta = options.meta ?? {};
  return {
    exportDate: meta.exportDate ?? '',
    tableCount: meta.tableCount ?? model.tables.length,
    partyRowCount: meta.partyRowCount ?? 0,
    guestCount: meta.guestCount ?? model.tables.reduce((sum, table) => sum + table.occupancy, 0),
  };
}

export function buildWeddingFloorDesignSvg(model, options = {}) {
  const legendItems = options.legendItems ?? [];
  const meta = normalizeMeta(model, options);
  const contentFrame = model.contentFrame;

  return `<svg class="wfp-design-svg"
    xmlns="${SVG_NS}"
    viewBox="0 0 ${model.page.width} ${model.page.height}"
    width="${model.page.width}mm"
    height="${model.page.height}mm"
    role="img"
    aria-label="Jeremy and Yuri 婚禮桌次位置圖"
    data-layout-signature="${attr(model.layoutSignature)}">
    <defs>
      <radialGradient id="wfp-design-paper-wash" cx="24%" cy="24%" r="72%">
        <stop offset="0%" stop-color="oklch(99% 0.012 38 / 0.8)"/>
        <stop offset="58%" stop-color="oklch(98.4% 0.014 82 / 0.82)"/>
        <stop offset="100%" stop-color="oklch(96.8% 0.02 96 / 0.72)"/>
      </radialGradient>
      <filter id="wfp-design-soft-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="0.55" stdDeviation="0.55" flood-color="oklch(44% 0.035 58 / 0.12)"/>
      </filter>
      <filter id="wfp-design-label-shadow" x="-20%" y="-30%" width="140%" height="160%">
        <feDropShadow dx="0" dy="0.22" stdDeviation="0.32" flood-color="oklch(45% 0.025 62 / 0.12)"/>
      </filter>
      <filter id="wfp-design-dot-paper" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="0" stdDeviation="0.2" flood-color="oklch(99% 0.008 82 / 0.82)"/>
      </filter>
    </defs>
    ${renderStyles()}
    <rect class="wfp-design-paper" width="${model.page.width}" height="${model.page.height}"/>
    <rect class="wfp-design-paper-wash" width="${model.page.width}" height="${model.page.height}"/>
    ${renderFloralCorner('top-left')}
    ${renderFloralCorner('top-right')}
    ${renderFloralCorner('bottom-left')}
    ${renderFloralCorner('bottom-right')}
    ${renderHeader(meta)}
    ${renderStageRibbon()}
    <rect class="wfp-design-content-frame"
      x="${formatNumber(contentFrame.x)}"
      y="${formatNumber(contentFrame.y)}"
      width="${formatNumber(contentFrame.width)}"
      height="${formatNumber(contentFrame.height)}"/>
    <g class="wfp-design-floor" data-layout-signature="${attr(model.layoutSignature)}">
      ${model.tables.map(renderTable).join('')}
    </g>
    ${renderLegend(legendItems)}
  </svg>`;
}
