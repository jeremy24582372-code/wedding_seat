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

for (const child of ['guests', 'tables', 'unassignedGuestIds', 'tablePositions', 'lastSaved']) {
  if (!seatingRules[child]) fail(`missing validation block for ${child}`);
}

const serializedRules = JSON.stringify(rulesFile);
if (serializedRules.includes('now <')) {
  fail('rules must not use expiring test-mode now < conditions');
}

console.log('RTDB rules check passed. Current rules are path-scoped and schema-validated, but public read/write remains for the existing no-Firebase-Auth app flow.');
