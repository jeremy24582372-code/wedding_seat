import { formatExportDate } from './exportShared.js';
import { buildFloorDesignLayoutModel } from './floorDesignLayoutModel.js';

export const FLOOR_DESIGN_PROMPT_REQUIRED_PHRASES = [
  'preserve exact table layout and relative positions from the attached reference image',
  'keep all names close to their corresponding seat dots',
  'do not invent, remove, or rename guests',
  'A4 portrait wedding seating chart',
  'watercolor blush rose floral corners',
  'elegant gold typography and ribbon',
];

export function buildFloorDesignPromptFileName(date = new Date()) {
  return `婚禮桌次AI生成提示詞_${formatExportDate(date)}.txt`;
}

export function buildFloorDesignPrompt(state, layoutModel, options = {}) {
  const coupleName = options.coupleName ?? 'Jeremy & Yuri';
  const tableSummary = buildTableSummary(layoutModel);
  const unassignedSummary = buildUnassignedSummary(state);

  return [
    `Create an ${requiredPhrase('A4 portrait wedding seating chart')} for ${coupleName}.`,
    '',
    'Use the attached exported seating chart image as the geometry source.',
    `You must ${requiredPhrase('preserve exact table layout and relative positions from the attached reference image')}.`,
    `You must ${requiredPhrase('keep all names close to their corresponding seat dots')}.`,
    `You must ${requiredPhrase('do not invent, remove, or rename guests')}.`,
    '',
    `Visual direction: ${requiredPhrase('watercolor blush rose floral corners')}, warm ivory paper, ${requiredPhrase('elegant gold typography and ribbon')}, a refined gold stage ribbon, delicate legend dots, and a soft floral medallion for the main table.`,
    'Do not use the sample image as a background. Redraw the design cleanly while preserving the exported table coordinates and the guest names.',
    'Do not move names into side lists. Do not create long connector lines. If a micro leader is needed, keep it very short and local to the seat dot.',
    '',
    `Layout signature: ${layoutModel.layoutSignature}`,
    `Source canvas: ${layoutModel.sourceCanvas.width} x ${layoutModel.sourceCanvas.height}px`,
    `Export frame: ${layoutModel.contentFrame.width} x ${layoutModel.contentFrame.height}mm at (${layoutModel.contentFrame.x}, ${layoutModel.contentFrame.y})`,
    '',
    'Table layout and guest names to preserve:',
    tableSummary,
    '',
    unassignedSummary,
    '',
    '中文補充：請維持附件中的桌位與相對方向；可依匯出桌間距設定做全域等比例拉開，但不可重新排序成固定網格。每個姓名都要貼近原本座位點，不可新增、刪除或改名。',
  ].join('\n');
}

export function buildFloorDesignPromptExport(state, options = {}) {
  const date = options.date ?? new Date();
  const layoutModel = options.layoutModel ?? buildFloorDesignLayoutModel(
    state,
    options.floorDesign ?? {}
  );

  return {
    prompt: buildFloorDesignPrompt(state, layoutModel, options),
    layoutModel,
    layoutSignature: layoutModel.layoutSignature,
    fileName: buildFloorDesignPromptFileName(date),
  };
}

function requiredPhrase(phrase) {
  return phrase;
}

function buildTableSummary(layoutModel) {
  if (!layoutModel.tables.length) {
    return '- No tables are currently present. Preserve the empty A4 seating chart structure.';
  }

  return layoutModel.tables.map(table => {
    const sourceXPct = percent(table.sourcePosition.centerX, layoutModel.sourceCanvas.width);
    const sourceYPct = percent(table.sourcePosition.centerY, layoutModel.sourceCanvas.height);
    const printXPct = percent(table.printPosition.centerX, layoutModel.page.width);
    const printYPct = percent(table.printPosition.centerY, layoutModel.page.height);
    const seats = table.seats
      .filter(seat => !seat.isEmpty)
      .map(seat => `${seat.seatNumber}. ${seat.guestName}`)
      .join('; ');

    return [
      `- ${table.label || table.id}: source center ${sourceXPct}% x / ${sourceYPct}% y, print center ${printXPct}% x / ${printYPct}% y, ${table.occupancy}/${table.capacity} seats.`,
      `  Names: ${seats || 'empty table'}`,
    ].join('\n');
  }).join('\n');
}

function buildUnassignedSummary(state) {
  const guestsById = new Map((state?.guests ?? []).map(guest => [guest.id, guest]));
  const names = (state?.unassignedGuestIds ?? [])
    .map(id => guestsById.get(id)?.name)
    .filter(Boolean);

  if (!names.length) {
    return 'Unassigned guests: none.';
  }

  return `Unassigned guests must remain in the exported guest list only, not as table labels: ${names.join(', ')}.`;
}

function percent(value, total) {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(1));
}
