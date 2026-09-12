#!/usr/bin/env node
// Scans tests/**/*.test.ts for regex/string assertions that embed a literal
// double-quote character while matching against source files prettier
// formats with single quotes (.prettierrc: singleQuote true). Every CI
// failure fixed in a90721e and 90440df was this exact class of bug: a test
// hardcoded a quote style that lint-staged's prettier pass later changed in
// the source file being matched.
//
// This is a heuristic detector, not an AST-based one: it flags literals for
// human review rather than auto-fixing them (a naive rewrite risks corrupting
// regex escaping). Run it whenever tests fail on a fresh checkout for no
// obvious reason, or periodically as a repo-health check.
//
// Usage: node scripts/find-quote-fragile-tests.mjs [--dir tests/unit]

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const argDir = process.argv.includes('--dir')
  ? process.argv[process.argv.indexOf('--dir') + 1]
  : 'tests';

// Extensions Prettier reformats with singleQuote: true per .prettierrc.
// JSON is intentionally excluded: the JSON spec requires double quotes, so a
// test matching literal JSON content legitimately embeds them.
const PRETTIER_SINGLE_QUOTE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css']);

function listTestFiles(dir) {
  const out = [];
  const abs = join(repoRoot, dir);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs)) {
    const full = join(abs, entry);
    const rel = relative(repoRoot, full);
    if (statSync(full).isDirectory()) {
      out.push(...listTestFiles(rel));
    } else if (entry.endsWith('.test.ts')) {
      out.push(rel);
    }
  }
  return out;
}

// Finds every readFileSync('path', ...) call in the file text (variable-bound
// or inline) and returns the referenced paths, resolved relative to repo root.
function findReadFileSyncTargets(content) {
  const targets = [];
  const re = /readFileSync\(\s*(['"])((?:(?!\1).)+)\1/g;
  let match;
  while ((match = re.exec(content))) {
    targets.push(match[2]);
  }
  return targets;
}

function isPrettierGoverned(targetPath) {
  if (!PRETTIER_SINGLE_QUOTE_EXTS.has(extname(targetPath))) return false;
  return existsSync(join(repoRoot, targetPath));
}

// Extracts every string literal (both quote styles) and every regex literal
// in the file, with line numbers, skipping the file's own import statements
// (those are irrelevant and prettier-normalized already, not assertions).
function findLiterals(content) {
  const literals = [];
  const lines = content.split('\n');

  const patterns = [
    // "double quoted" strings (captures raw inner text, unescaped)
    { kind: 'string', re: /"((?:[^"\\]|\\.)*)"/g },
    // 'single quoted' strings
    { kind: 'string', re: /'((?:[^'\\]|\\.)*)'/g },
    // /regex/flags literals following `, ` `(` or `=` (reduces false
    // positives from division operators)
    { kind: 'regex', re: /[,(=]\s*\/((?:[^/\\\n]|\\.)+)\/[a-z]*/g },
  ];

  lines.forEach((line, idx) => {
    // Skip import/export lines and test/describe description labels — the
    // label is prose for humans, never matched against source content, so a
    // stray quote inside it (e.g. a word in "scare quotes") isn't a bug.
    if (/^\s*(import|export)\s/.test(line)) return;
    if (/^\s*(test|describe)\(\s*['"]/.test(line)) return;

    // Neutralize already quote-tolerant alternation idioms (e.g. `["']`,
    // `['"]`, `(?:"|')`) so they aren't misread as a string literal's
    // delimiters — these already handle both quote styles and are never
    // themselves the bug.
    const cleaned = line.replace(/\["']|\['"]|\(\?:"\|'\)|\(\?:'\|"\)/g, (match) =>
      '_'.repeat(match.length),
    );

    for (const { kind, re } of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(cleaned))) {
        literals.push({ kind, value: m[1], line: idx + 1, raw: m[0] });
      }
    }
  });

  return literals;
}

// Prettier's `singleQuote: true` governs plain JS/TS string literals and CSS
// attribute-selector quotes, but NOT JSX attribute values — `<Foo bar="x" />`
// stays double-quoted regardless (that's JSX convention, only overridden by
// the separate `jsxSingleQuote` option, which this repo doesn't set). So
// `mobileStrategy="stack"` as a JSX prop is stable; `[data-x="stack"]` as a
// CSS attribute selector is not, and `key: "value"` as a JS object/array
// entry is not either. Classify each embedded `"` inside the literal's own
// text (not the literal's position in the line — regex literals carry their
// matched source snippet *inside* their pattern text) by what immediately
// precedes the identifier the quote is attached to: a `[` means CSS
// attribute-selector syntax (fragile); a bare `identifier="` with no `[`
// means JSX-attribute shape (stable); `:`/`,`/`(`/`[` before the quote means
// a JS value position (fragile).
// Classify each `"..."` span by the context of its *opening* quote only —
// the closing quote is preceded by whatever the value's last character
// happens to be, which carries no positional meaning and would otherwise be
// misclassified as 'unknown'.
function classifyEmbeddedQuotes(value) {
  const contexts = [];
  const pairRe = /"[^"]*"/g;
  let m;
  while ((m = pairRe.exec(value))) {
    contexts.push(classifyOne(value, m.index));
  }
  return contexts;
}

function classifyOne(value, quoteIndex) {
  let i = quoteIndex - 1;
  if (value[i] === '=') {
    let j = i - 1;
    let sawIdentChar = false;
    while (j >= 0 && /[\w-]/.test(value[j])) {
      sawIdentChar = true;
      j--;
    }
    if (sawIdentChar) return value[j] === '[' ? 'css-attr-selector' : 'jsx-attr';
    return 'unknown';
  }
  while (i >= 0 && value[i] === ' ') i--;
  if (value[i] === ':' || value[i] === ',' || value[i] === '(' || value[i] === '[') {
    return 'js-value';
  }
  return 'unknown';
}

// Fragile unless every embedded double quote is in a JSX-attribute position
// (the one shape Prettier deliberately leaves double-quoted).
function isFragile(literal) {
  if (!literal.value.includes('"')) return false;
  const contexts = classifyEmbeddedQuotes(literal.value);
  return contexts.some((c) => c !== 'jsx-attr');
}

function main() {
  const testFiles = listTestFiles(argDir);
  const findings = [];

  for (const relPath of testFiles) {
    const absPath = join(repoRoot, relPath);
    const content = readFileSync(absPath, 'utf8');

    const targets = findReadFileSyncTargets(content);
    const governedTargets = targets.filter(isPrettierGoverned);
    if (governedTargets.length === 0) continue;

    const literals = findLiterals(content);
    const fragile = literals.filter(isFragile);
    if (fragile.length === 0) continue;

    findings.push({ file: relPath, governedTargets, fragile });
  }

  if (findings.length === 0) {
    console.log('No quote-fragile assertions found.');
    return;
  }

  console.log(
    `Found ${findings.length} test file(s) with assertions that may break the next time ` +
      `lint-staged reformats their source targets:\n`,
  );

  for (const { file, governedTargets, fragile } of findings) {
    console.log(`\n${file}`);
    console.log(`  reads: ${governedTargets.join(', ')}`);
    for (const lit of fragile) {
      console.log(`  L${lit.line} [${lit.kind}]  ${lit.raw}`);
    }
  }

  console.log(
    `\n${findings.reduce((sum, f) => sum + f.fragile.length, 0)} literal(s) flagged for manual review. ` +
      `This is a heuristic — verify each against the current source before changing it; ` +
      `not every hit is a real bug (e.g. legitimate double quotes in matched JSON content).`,
  );
}

main();
