# Wedding Seating DnD Table Lock Fix - 2026-06-09

## Role

Execute as `.agents/agents.md` `@engineer`.

## Scope

1. Fix unassigned-guest to seat drop accuracy so the seat under the pointer wins over dnd-kit rectangle collision when a concrete seat exists under the mouse.
2. Replace the large dragged guest card preview with a seat-sized circular token centered under the cursor, so the visible drag target matches the 52px seat footprint.
3. Add a `鎖` table-lock toggle on the seating canvas so table positions cannot be accidentally dragged while assigning guests.
4. When table lock is enabled, also prevent deleting tables.

## Non-goals

- Do not change Firebase schema or persistence payload.
- Do not change guest seat lock semantics (`lockedAssignments`).
- Do not change the 10-seat hard limit or auto-seat behavior.
- Do not add dependencies.

## Implementation Plan

1. Update `src/utils/dndDrop.js` to resolve seat targets from pointer coordinates first, with dnd-kit `over` as fallback.
2. Extend the DnD smoke script with a stale-`over` regression case and nested element target detection.
3. Replace `DragOverlay` content with a compact circular `DragGuestToken` and center that overlay on the activation cursor.
4. Add local `tablesLocked` UI state to `FloorPlan`, expose a lock/unlock control, and block table-drag pointer starts while locked.
5. Pass locked state into `TableZone` and disable `刪除此桌` while locked.
6. Add visual locked state to the table handle, mode chips, and disabled table removal control.

## Verification

- `node scripts/check-phase5-dnd-refactor.mjs`
- `npm run lint`
- `npm run build` with sandbox escalation if the known Vite/Rolldown `spawn EPERM` appears.
- Desktop browser smoke for loading the seating canvas, verifying the circular drag token, and verifying locked tables cannot move or be deleted.

## Review

- Implemented pointer-first seat resolution in `src/utils/dndDrop.js`; concrete seats under the mouse now win over stale dnd-kit `over` data.
- Added nested-seat target support so child elements inside a seat resolve to the parent seat target.
- Added `桌子鎖定` local UI state in `FloorPlan`; locked mode blocks only table-position pointer drag while keeping guest DnD, rename, delete, pan, zoom, and table controls available.
- Added locked handle visuals and mode-chip feedback.
- Added `DragGuestToken` so dragged guests render as a seat-sized circular token instead of a full-width card.
- Added a dnd-kit overlay modifier to center the circular token under the activation cursor.
- Locked table mode now disables the table removal button and clears any pending delete confirmation state.

## Verification Results

- Passed: `node scripts/check-phase5-dnd-refactor.mjs`
- Passed: `npm run lint`
- Passed: `git diff --check` with only existing Windows CRLF warnings.
- Sandbox build: `npm run build` reproduced the known Vite/Rolldown `spawn EPERM` environment issue.
- Passed with escalation: `npm run build`; only the existing chunk-size warning remained.
- Browser verification at `http://127.0.0.1:5184/wedding_seat/`:
  - Page loaded after password entry with no framework error overlay.
  - `座位圖` rendered 20 table wrappers.
  - Lock control changed from `鎖定桌子位置` / `桌子鎖定 關` to `解鎖桌子位置` / `桌子鎖定 開`.
  - Locked table wrapper received `floor-plan__table-wrapper--locked`, handle title changed to `桌子位置已鎖定`.
  - Locked drag attempt on visible `11桌` kept DOM position unchanged (`65.8824px`, `421.961px`).
  - Browser console had no warn/error entries.

## Second-Pass Verification Results

- Passed: `node scripts/check-phase5-dnd-refactor.mjs`
- Passed: `npm run lint`
- Passed: `git diff --check` with only existing Windows CRLF warnings.
- Sandbox build: `npm run build` reproduced the known Vite/Rolldown `spawn EPERM` environment issue.
- Passed with escalation: `npm run build`; only the existing chunk-size warning remained.
- Browser verification at `http://127.0.0.1:5185/wedding_seat/` in Firebase local-only mode:
  - Added a local test guest `測試拖曳`.
  - Dragged the unassigned guest from the pool to seat `0` of the first visible table; the target seat rendered `測試拖曳` and the unassigned pool became empty.
  - Confirmed `.drag-guest-token` CSS is loaded with `width: 52px`, `height: 52px`, and `border-radius: 50%`.
  - Enabled `桌子鎖定`; mode chip changed to `桌子鎖定 開` and legend included `不能移動或刪桌`.
  - Table removal buttons became disabled and rendered `桌子已鎖定`.
  - Locked drag attempt on the first table handle kept DOM position unchanged (`80px`, `80px`) and table count stayed `10`.
  - Browser console had only the expected local-only Firebase warning.
  - Dev server on port `5185` was stopped after verification.
