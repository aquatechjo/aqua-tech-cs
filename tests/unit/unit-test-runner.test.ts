import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
};
const runner = readFileSync('scripts/run-unit-tests.mjs', 'utf8');

test('unit test quality gate discovers every unit test in a stable sequence', () => {
  assert.equal(packageJson.scripts['test:unit'], 'node scripts/run-unit-tests.mjs');
  assert.match(packageJson.scripts.check, /npm run test:unit/u);
  assert.match(runner, /readdirSync\(testsDirectory, \{ withFileTypes: true \}\)/u);
  assert.match(runner, /entry\.name\.endsWith\('\.test\.ts'\)/u);
  assert.match(runner, /\.sort\(\)/u);
  assert.match(runner, /'--test-concurrency=1'/u);
});
