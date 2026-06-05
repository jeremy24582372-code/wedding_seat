import assert from 'node:assert/strict';
import { parseGoogleSheetsSyncResponse, normalizeGoogleSheetsSyncBody } from '../src/utils/googleSheetsSyncResponse.js';
import { buildGoogleSheetsPayload } from '../src/utils/googleSheetsPayload.js';

const seatArray = (...ids) => Array.from({ length: 10 }, (_, index) => ids[index] ?? null);

function makeGuest(id, patch = {}) {
  return {
    id,
    name: id,
    category: '新郎親友',
    diet: '',
    source: 'import',
    tableId: null,
    partyId: null,
    partyRole: 'primary',
    ...patch,
  };
}

assert.deepEqual(
  normalizeGoogleSheetsSyncBody({ ok: true, written: 3 }),
  { success: true, written: 3 },
  'ok:true should be treated as explicit Apps Script success'
);

assert.deepEqual(
  normalizeGoogleSheetsSyncBody({ success: true }),
  { success: true, written: undefined },
  'success:true should be treated as explicit Apps Script success'
);

assert.equal(
  normalizeGoogleSheetsSyncBody({ ok: false, error: 'sheet missing' }).success,
  false,
  'ok:false must fail even when HTTP status is 200'
);

assert.equal(
  normalizeGoogleSheetsSyncBody({ success: false, message: 'write failed' }).success,
  false,
  'success:false must fail even when HTTP status is 200'
);

assert.equal(
  normalizeGoogleSheetsSyncBody({ ok: true, success: false }).success,
  false,
  'an explicit false flag must win over a conflicting true flag'
);

{
  const result = await parseGoogleSheetsSyncResponse(
    new Response(JSON.stringify({ ok: true, written: 2 }), { status: 200 })
  );
  assert.deepEqual(result, { success: true, written: 2 });
}

{
  const result = await parseGoogleSheetsSyncResponse(
    new Response(JSON.stringify({ ok: false, error: 'Apps Script validation failed' }), { status: 200 })
  );
  assert.equal(result.success, false);
  assert.match(result.error, /validation failed/);
}

{
  const result = await parseGoogleSheetsSyncResponse(
    new Response(JSON.stringify({ ok: false, error: 'server rejected' }), { status: 500 })
  );
  assert.equal(result.success, false);
  assert.equal(result.error, 'server rejected');
}

{
  const result = await parseGoogleSheetsSyncResponse(
    new Response('not json', { status: 200 })
  );
  assert.equal(result.success, false);
  assert.match(result.error, /有效 JSON/);
}

{
  const result = await parseGoogleSheetsSyncResponse(
    new Response('', { status: 200 })
  );
  assert.equal(result.success, false);
  assert.match(result.error, /未回傳明確成功狀態/);
}

{
  const payload = buildGoogleSheetsPayload({
    guests: [
      makeGuest('g1', { name: '來源主賓', partyId: 'p1', tableId: 't1' }),
      makeGuest('g2', { name: '來源主賓 同行1', partyId: 'p1', partyRole: 'companion', tableId: 't1' }),
      makeGuest('g3', { name: '手動賓客', source: 'manual', tableId: null }),
    ],
    tables: [{ id: 't1', label: '1桌', seats: 10, guestIds: seatArray('g1', 'g2') }],
    partyRows: [{ id: 'p1', sourceName: '來源主賓', category: '新郎親友', tableLabel: '1桌', headcount: 2, guestIds: ['g1', 'g2'], source: 'import' }],
  });

  assert.equal(payload.length, 2);
  for (const row of payload) {
    assert.deepEqual(Object.keys(row).sort(), ['category', 'diet', 'name', 'tableLabel'].sort());
    assert.equal(Object.hasOwn(row, 'headcount'), false);
    assert.equal(Object.hasOwn(row, '人數'), false);
    assert.equal(Object.hasOwn(row, 'source'), false);
  }
}

console.log('Phase 2 Google Sheets sync smoke passed.');
