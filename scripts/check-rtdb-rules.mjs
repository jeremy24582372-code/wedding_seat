import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const rulesPath = resolve(projectRoot, 'database.rules.json');
const firebaseConfigPath = resolve(projectRoot, 'firebase.json');

const fail = (message) => {
  console.error(`RTDB rules check failed: ${message}`);
  process.exit(1);
};

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${path} is not valid JSON: ${error.message}`);
  }
};

const rulesFile = readJson(rulesPath);
const firebaseConfig = readJson(firebaseConfigPath);

if (firebaseConfig.database?.rules !== 'database.rules.json') {
  fail('firebase.json must point database.rules to database.rules.json');
}

const rootRules = rulesFile.rules;
if (!rootRules) fail('missing top-level rules object');
if (rootRules['.read'] !== false) fail('root .read must be false');
if (rootRules['.write'] !== false) fail('root .write must be false');

const seatingRules = rootRules['wedding-seating'];
if (!seatingRules) fail('missing wedding-seating rules');
if (seatingRules['.read'] !== true) fail('wedding-seating .read must match the current unauthenticated app flow');
if (seatingRules['.write'] !== 'newData.exists()') fail('wedding-seating writes must reject deletes');
if (!String(seatingRules['.validate'] ?? '').includes("hasChild('tables')")) fail('missing tables validation');
if (!String(seatingRules['.validate'] ?? '').includes("hasChild('lastSaved')")) fail('missing lastSaved validation');
if (seatingRules.$other?.['.validate'] !== false) fail('unknown wedding-seating children must be rejected');

for (const child of ['guests', 'partyRows', 'guestGroups', 'tables', 'unassignedGuestIds', 'tablePositions', 'seatingRules', 'lockedAssignments', 'lastSaved']) {
  if (!seatingRules[child]) fail(`missing validation block for ${child}`);
}

const guestRules = seatingRules.guests?.$guestIndex;
if (!guestRules?.partyId) fail('guest validation must allow optional partyId');
if (!guestRules?.partyRole) fail('guest validation must allow partyRole');

const partyRules = seatingRules.partyRows?.$partyIndex;
if (!String(partyRules?.headcount?.['.validate'] ?? '').includes('<= 10')) {
  fail('partyRows headcount validation must enforce max 10');
}
if (partyRules?.$other?.['.validate'] !== false) {
  fail('unknown partyRows children must be rejected');
}

const groupRules = seatingRules.guestGroups?.$groupIndex;
if (!String(groupRules?.preference?.['.validate'] ?? '').includes('same-table')) {
  fail('guestGroups must validate known group preferences');
}
if (!String(groupRules?.locked?.['.validate'] ?? '').includes('isBoolean()')) {
  fail('guestGroups locked must validate boolean values');
}
if (groupRules?.$other?.['.validate'] !== false) {
  fail('unknown guestGroups children must be rejected');
}

const tableRules = seatingRules.tables?.$tableIndex;
if (!String(tableRules?.seats?.['.validate'] ?? '').includes('=== 10')) {
  fail('tables seats validation must enforce the fixed 10-seat contract');
}
const seatIndexRule = String(tableRules?.guestIds?.$seatIndex?.['.validate'] ?? '');
if (!seatIndexRule.includes("$seatIndex === '0'") || !seatIndexRule.includes("$seatIndex === '9'")) {
  fail('table guestIds validation must restrict seat indexes to 0..9');
}

const autoRules = seatingRules.seatingRules;
if (!String(autoRules?.fillStrategy?.['.validate'] ?? '').includes('category-first')) {
  fail('seatingRules must validate known fill strategies');
}
if (!String(autoRules?.maxPerCategoryPerTable?.$category?.['.validate'] ?? '').includes('<= 10')) {
  fail('seatingRules category max must enforce max 10');
}
if (autoRules?.$other?.['.validate'] !== false) {
  fail('unknown seatingRules children must be rejected');
}

const lockedRules = seatingRules.lockedAssignments?.$guestId;
if (!String(lockedRules?.['.validate'] ?? '').includes('isBoolean()')) {
  fail('lockedAssignments must validate boolean values');
}

const serializedRules = JSON.stringify(rulesFile);
if (serializedRules.includes('now <')) {
  fail('rules must not use expiring test-mode now < conditions');
}

console.log('RTDB rules check passed. Current rules are path-scoped and schema-validated, but public read/write remains for the existing no-Firebase-Auth app flow.');
