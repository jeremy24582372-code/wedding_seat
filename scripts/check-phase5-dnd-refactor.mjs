import assert from 'node:assert/strict';
import {
  findGuestSeat,
  moveGuestByDropTarget,
  resolveDropTarget,
} from '../src/utils/dndDrop.js';

function createOver(data) {
  return { data: { current: data } };
}

function createSeatElement(attrs) {
  return {
    getAttribute(name) {
      return Object.hasOwn(attrs, name) ? attrs[name] : null;
    },
  };
}

function captureMove({ guestId = 'g1', target, tables, moveResult = { success: true } }) {
  const calls = [];
  const toastMessages = [];

  const result = moveGuestByDropTarget({
    guestId,
    dropTarget: target,
    tables,
    moveGuest: (...args) => {
      calls.push(['move', ...args]);
      return moveResult;
    },
    swapGuests: (...args) => {
      calls.push(['swap', ...args]);
      return { success: true };
    },
    toast: {
      warn: message => toastMessages.push(message),
    },
  });

  return { result, calls, toastMessages };
}

const emptySeats = Array.from({ length: 10 }, () => null);

assert.deepEqual(findGuestSeat([
  { id: 't1', guestIds: ['g1', null] },
], 'g1'), { tableId: 't1', seatIndex: 0 });

const unassignedToTableTarget = resolveDropTarget({
  over: createOver({ tableId: 't1', seatIndex: 0, isEmpty: true }),
});
assert.deepEqual(unassignedToTableTarget, { tableId: 't1', seatIndex: 0, isEmpty: true });

const unassignedToTable = captureMove({
  target: unassignedToTableTarget,
  tables: [{ id: 't1', guestIds: [...emptySeats] }],
});
assert.deepEqual(unassignedToTable.calls, [['move', 'g1', 't1', 0]]);
assert.equal(unassignedToTable.result.action, 'move');

const sameTableSwap = captureMove({
  target: { tableId: 't1', seatIndex: 1, isEmpty: false },
  tables: [{ id: 't1', guestIds: ['g1', 'g2', ...emptySeats.slice(2)] }],
});
assert.deepEqual(sameTableSwap.calls, [['swap', 't1', 0, 't1', 1]]);
assert.equal(sameTableSwap.result.action, 'swap');

const crossTableMove = captureMove({
  target: { tableId: 't2', seatIndex: 0, isEmpty: true },
  tables: [
    { id: 't1', guestIds: ['g1', ...emptySeats.slice(1)] },
    { id: 't2', guestIds: [...emptySeats] },
  ],
});
assert.deepEqual(crossTableMove.calls, [['move', 'g1', 't2', 0]]);

const tableToUnassigned = captureMove({
  target: resolveDropTarget({ over: createOver({ tableId: null }) }),
  tables: [{ id: 't1', guestIds: ['g1', ...emptySeats.slice(1)] }],
});
assert.deepEqual(tableToUnassigned.calls, [['move', 'g1', null, null]]);

const pointerFallbackTarget = resolveDropTarget({
  pointer: { x: 50, y: 80 },
  elementsFromPoint: () => [
    createSeatElement({
      'data-table-id': 't3',
      'data-seat-index': '4',
      'data-seat-empty': 'true',
    }),
  ],
});
assert.deepEqual(pointerFallbackTarget, { tableId: 't3', seatIndex: 4, isEmpty: true });

const rejectedMove = captureMove({
  target: { tableId: 't1', seatIndex: 9, isEmpty: true },
  tables: [{ id: 't1', guestIds: [...emptySeats] }],
  moveResult: { success: false, reason: '1桌 已滿 (10 人)' },
});
assert.deepEqual(rejectedMove.toastMessages, ['1桌 已滿 (10 人)']);

console.log('Phase 5 DnD refactor smoke passed');
