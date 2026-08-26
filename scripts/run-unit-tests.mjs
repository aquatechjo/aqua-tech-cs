import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const testsDirectory = path.join(projectDirectory, 'tests', 'unit');

const testFiles = readdirSync(testsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.ts'))
  .map((entry) => path.join('tests', 'unit', entry.name))
  .sort();

if (testFiles.length === 0) {
  console.error(`No unit test files found in ${testsDirectory}`);
  process.exit(1);
}

console.log(`Running ${testFiles.length} unit test file(s) in a stable sequence.`);

const child = spawn(
  process.execPath,
  ['--import', 'tsx', '--test', '--test-concurrency=1', ...testFiles],
  {
    cwd: projectDirectory,
    stdio: 'inherit',
  },
);

child.once('error', (error) => {
  console.error('Unable to start the unit test runner.', error);
  process.exit(1);
});

child.once('exit', (code, signal) => {
  if (signal) {
    console.error(`Unit test runner stopped by signal ${signal}.`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
