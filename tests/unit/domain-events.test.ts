import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const projectRoot = path.resolve(__dirname, '..', '..');
const read = (relativePath: string) => readFileSync(path.join(projectRoot, relativePath), 'utf8');

function findFilesRecursively(
  dir: string,
  matcher: (name: string) => boolean,
  results: string[] = [],
) {
  for (const entry of readdirSync(path.join(projectRoot, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) findFilesRecursively(relative, matcher, results);
    else if (matcher(entry.name)) results.push(relative);
  }
  return results;
}

test('every emitted domain event type has a registered handler', () => {
  const routeFiles = findFilesRecursively('src/app/api', (name) => name === 'route.ts');
  const emittedTypes = new Set<string>();
  const typePattern = /type:\s*"([a-z0-9_.]+)"/g;

  for (const file of routeFiles) {
    const content = read(file);
    if (!content.includes('emitDomainEvent(')) continue;
    for (const match of content.matchAll(typePattern)) emittedTypes.add(match[1]);
  }

  assert.ok(emittedTypes.size > 0, 'expected at least one emitDomainEvent call in the API routes');

  const registry = read('src/lib/domain-events.ts');
  for (const type of emittedTypes) {
    assert.ok(
      registry.includes(`"${type}": handle`),
      `event type "${type}" is emitted but has no entry in the domainEventHandlers registry`,
    );
  }
});

test('DomainEventStatus enum matches the states the dispatcher relies on', () => {
  const schema = read('prisma/schema.prisma');
  const match = schema.match(/enum DomainEventStatus \{([^}]+)\}/);
  assert.ok(match, 'DomainEventStatus enum not found in schema.prisma');
  const values = match![1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  assert.deepEqual(values, ['PENDING', 'PROCESSED', 'FAILED']);
});

test('the feedback follow-up task is created through the domain event pipe, not inline', () => {
  const route = read('src/app/api/public/feedback/[token]/route.ts');
  assert.ok(
    route.includes('emitDomainEvent(tx,'),
    'expected the feedback route to emit a domain event on ACTION_REQUIRED',
  );
  assert.ok(
    route.includes('dispatchDomainEventNow(result.pendingEventId)'),
    'expected the feedback route to dispatch the event synchronously after commit',
  );
  assert.ok(
    !/if \(status === "ACTION_REQUIRED"\) \{\s*const task = await tx\.task\.create/.test(route),
    'the follow-up task should no longer be created inline inside the feedback transaction',
  );
});
