import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  AQUA_TECH_CS_TECHNICAL_ID,
  LEGACY_AQUAFLOW_TECHNICAL_ID,
  LEGACY_WEBSITE_INTAKE_HEADER_NAME,
  WEBSITE_INTAKE_HEADER_NAME,
  readWebsiteIntakeSecret,
} from '../../src/lib/technical-identity';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  name: string;
};
const rootLayout = readFileSync('src/app/layout.tsx', 'utf8');
const tokensCss = readFileSync('src/styles/aqua-tokens.css', 'utf8');
const roadmap = readFileSync('docs/DESIGN_SYSTEM_ADOPTION_ROADMAP.md', 'utf8');

test('Aqua Tech CS is the canonical technical identity', () => {
  assert.equal(AQUA_TECH_CS_TECHNICAL_ID, 'aqua-tech-cs');
  assert.equal(LEGACY_AQUAFLOW_TECHNICAL_ID, 'aquaflow');
  assert.equal(packageJson.name, 'aqua-tech-cs');
  assert.match(rootLayout, /data-aqua-product="aqua-tech-cs"/u);
  assert.match(tokensCss, /\[data-aqua-product="aqua-tech-cs"\]/u);
  assert.match(tokensCss, /\[data-aqua-product="aquaflow"\]/u);
});

test('website intake prefers the canonical header and retains a bounded legacy fallback', () => {
  assert.equal(WEBSITE_INTAKE_HEADER_NAME, 'x-aqua-tech-cs-intake-secret');
  assert.equal(LEGACY_WEBSITE_INTAKE_HEADER_NAME, 'x-aquaflow-intake-secret');

  const canonicalHeaders = new Headers({
    [WEBSITE_INTAKE_HEADER_NAME]: ' current-secret ',
    [LEGACY_WEBSITE_INTAKE_HEADER_NAME]: 'legacy-secret',
  });
  assert.equal(readWebsiteIntakeSecret(canonicalHeaders), 'current-secret');

  const legacyHeaders = new Headers({
    [LEGACY_WEBSITE_INTAKE_HEADER_NAME]: ' legacy-secret ',
  });
  assert.equal(readWebsiteIntakeSecret(legacyHeaders), 'legacy-secret');

  const bearerHeaders = new Headers({
    authorization: 'Bearer bearer-secret',
    [WEBSITE_INTAKE_HEADER_NAME]: 'current-secret',
  });
  assert.equal(readWebsiteIntakeSecret(bearerHeaders), 'bearer-secret');
});

test('ID-01 is documented in the adoption roadmap', () => {
  assert.match(roadmap, /## ID-01 — Technical Identity Migration/u);
});
