# Phase 7 最終 QA Gate

日期：2026-06-05  
角色：`.agents/agents.md` 的 `@qa`  
來源：

- `.agents/agents.md`
- `.agents/context.md`
- `Plan/best-execution-plan-from-qa-reviews-20260604.md`
- `Plan/best-execution-plan-phase0-qa-baseline-20260604.md`
- Phase 2-6 completion artifacts under `Plan/`
- Phase 1-5 focused smoke scripts

## QA 結論

**Approve — Phase 7 local code/runtime gate passed.**

此結論代表 Phase 1-6 的本機 source review、純邏輯 smoke、rules/lint/build、桌機 local-mode runtime QA 沒有發現未處理 P0/P1。  
此結論不等於正式 Firebase / Google Sheets production integration sign-off；會改動正式資料的 live sync/concurrent-client 測試本次刻意不執行。

## Scope

已執行：

- 分批讀取高風險 source，不一次讀完整專案。
- 驗證座位資料完整性、匯入/headcount、Google Sheets sync response parsing、auto-seat 主桌/群組語意、DnD drop resolution、export builders。
- 跑 Phase 1-5 focused smoke scripts、RTDB rules check、lint、build、diff whitespace check。
- 使用隔離 env 啟動 desktop local-mode Vite server，確認不載入正式 Firebase。
- Browser runtime 驗證登入、AppShell 本機模式、座位圖桌機 layout、DnD unassigned-to-table、table-to-unassigned、auto-seat preview-first/apply、export menu、console logs。

未執行：

- 正式 Google Sheets `doPost()` live 寫回，避免覆寫同步目標表。
- 正式 Firebase concurrent two-client mutation，避免污染 production `wedding-seating` state。
- 手機 / tablet viewport。`.agents/context.md` 指定本工具為 desktop-only internal tool；除非使用者明確要求，mobile/tablet QA 不在預設範圍。
- Browser screenshot。`Page.captureScreenshot` 逾時，依既有 Browser limitation lesson，以 DOM/state/console evidence 代替。

## Source Review

| Batch | Files / Focus | Result |
| --- | --- | --- |
| State integrity | `src/hooks/useSeatingState.js`, `src/utils/seatingIntegrity.js`, `src/utils/seatingStateCore.js` | Pass. `removeTableFromState()` releases guests, clears released locks, removes `tablePositions[tableId]`, normalizes groups; `computeGuestMove()` rejects invalid seats and full tables. |
| Import / sync | `src/utils/importGuests.js`, `partyRows.js`, `googleSheetsRows.js`, `googleSheetsPayload.js`, `googleSheetsSyncResponse.js`, `src/hooks/useFirebase.js`, `apps-script-doPost.js` | Pass. Re-import updates existing party by source name, headcount shrink removes companions from table/unassigned/group/locks, sync payload excludes `人數`, response parser requires explicit `{ ok:true }` / `{ success:true }`. |
| Auto-seat / groups | `src/utils/autoSeatPlanner.js`, `src/utils/guestGroups.js` | Pass. Main table is excluded, existing main-table guests are blocked/protected even when `respectExistingAssignments=false`, group conflicts are skipped with blocked reasons, stale preview fingerprint is enforced. |
| DnD / export | `src/utils/dndDrop.js`, `src/hooks/useGuestDragAndDrop.js`, `src/components/TableZone.jsx`, `src/hooks/useExport.js`, export builders | Pass. Empty/occupied seat drop resolution is centralized, occupied seats are draggable/droppable, CSV/JSON/PDF builders are state-driven, print window has one-shot guard. |

## Verification Evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| Phase 1 data integrity smoke | Pass | `node scripts/check-phase1-data-integrity.mjs` |
| Phase 2 Google Sheets sync smoke | Pass | `node scripts/check-phase2-google-sheets-sync.mjs` |
| Phase 3 auto-seat/group smoke | Pass | `node scripts/check-phase3-auto-seat-groups.mjs` |
| Phase 4 export contract smoke | Pass | `node scripts/check-phase4-export-contract.mjs` |
| Phase 5 DnD smoke | Pass | `node scripts/check-phase5-dnd-refactor.mjs` |
| RTDB rules | Pass | `npm run rules:check`; rules remain path-scoped/schema-validated, public read/write is existing no-auth app tradeoff |
| Lint | Pass | `npm run lint` |
| Whitespace | Pass | `git diff --check` |
| Build | Pass with existing warning | sandbox `npm run build` hit known Vite/Rolldown `spawn EPERM`; escalated build passed with existing 804.50 kB chunk warning |
| Dev server cleanup | Pass | QA server on `127.0.0.1:5197` stopped; port verified closed |

## Browser Runtime Evidence

Environment:

- URL: `http://127.0.0.1:5197/wedding_seat/`
- Mode: isolated local Vite config with safe env; rendered status `本機模式`
- Viewport: desktop in-app browser default, 1280x720

Results:

| Matrix | Result | Evidence |
| --- | --- | --- |
| FB-01 | Pass | App rendered in `本機模式`, `db === null` did not block loading. |
| VIS-01 | Pass | `body.scrollWidth === documentElement.clientWidth`; no horizontal overflow in overview / seating map. |
| Firebase badge single source | Pass | `.app-shell__status-pill = 1`, legacy `.firebase-status = 0`. |
| DND-01 | Pass | Added `Phase7 甲`; drag unassigned-to-`1桌` seat changed unassigned `2 位 -> 1 位`, `1桌 0/10 -> 1/10`. |
| DND-05 | Pass | Drag table-to-unassigned with visible drop-zone coordinate changed `1桌 1/10 -> 0/10`, unassigned `1 位 -> 2 位`. |
| AUTO-01 | Pass | Before preview: no assigned seats. After generating preview: no assigned seats; state changed only after `套用預覽`. |
| AUTO-02 | Pass | Auto-seat applied two unassigned guests to `10桌`; `1桌` stayed `0/10`. |
| Export UI | Pass | Toolbar export dropdown opened and showed `匯出 JSON` / `匯出 Excel`; export contract itself covered by focused smoke. |
| Console | Pass | Only expected local-mode Firebase warning; no app error. |

## Matrix Summary

| Area | Status | Notes |
| --- | --- | --- |
| Import / headcount / party seat-unit | Pass | Covered by source review and Phase 1/3 smoke. |
| 10-seat hard limit | Pass | Covered by state helper, normalize, rules, Phase 1/5 smoke. |
| Guest count integrity | Pass | Browser add/DnD/autoseat preserved counts; export smoke verifies count consistency. |
| Remove table -> lock cleanup -> auto-seat | Pass | Source review and Phase 1/3 smoke. |
| Google Sheets success/failure truthfulness | Pass local smoke | Live write intentionally skipped. |
| CSV/PDF/JSON consistency | Pass local smoke | Browser only verified export UI; builders verified by script. |
| Firebase fallback/reload | Pass local fallback | Live concurrent mutation intentionally skipped. |
| Desktop visual | Pass | No horizontal overflow; primary controls visible. |

## Remaining Low-Risk / Operational Items

1. `npm run build` still emits the existing Vite chunk-size warning (`804.50 kB` JS). This is not a Phase 7 blocker.
2. The `賓客` tab label shows `0 筆` after adding manual-only guests because that label appears to use source-row count, while total seats show `0/2`. This is a wording/stat口徑 issue, not a data integrity bug.
3. `Plan/` contains Phase 2-6 completion artifacts but no Phase 1 completion artifact file. Phase 1 is still traceable through KB and `scripts/check-phase1-data-integrity.mjs`; this is documentation completeness, not runtime risk.
4. Production integration should still get a deliberate manual smoke in a safe maintenance window: one Google Sheets write-back and one Firebase multi-client edit/restore test against backed-up data or a dedicated QA namespace.

## Review

`@qa` 判定：Phase 7 local gate 通過。  
沒有發現資料遺失、重複 guest、超過 10 人桌、主桌被 auto-seat 補入、sync 假成功、export count mismatch、或桌機 layout overflow。

