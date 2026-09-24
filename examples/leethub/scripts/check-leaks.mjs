#!/usr/bin/env node
// Blocks a commit/CI run that would introduce a local absolute path or a secret-shaped
// string. Direct fix for the graphify-out/cache/ leak (see decisions.md) - this is the
// check that would have caught it before the first commit, not after the third.
//
// ponytail: regex-based, not a full entropy/provider-aware scanner (gitleaks-class tool).
// Covers the patterns this project's own history actually hit plus common token shapes.
// Upgrade path: swap for gitleaks if false negatives show up in practice.
import { execFileSync } from 'node:child_process';

const PATTERNS = [
  [/\/Users\/[A-Za-z0-9_.-]+/, 'absolute macOS user path (/Users/...)'],
  [/\/home\/[A-Za-z0-9_.-]+/, 'absolute Linux user path (/home/...)'],
  [/\bghp_[A-Za-z0-9]{36}\b/, 'GitHub personal access token (classic)'],
  [/\bgithub_pat_[A-Za-z0-9_]{22,}\b/, 'GitHub fine-grained personal access token'],
  [/\bgho_[A-Za-z0-9]{36}\b/, 'GitHub OAuth token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key ID'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 'Slack token'],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key block'],
];

// This file's own pattern literals necessarily contain the strings they detect - exclude it
// from its own scan rather than obfuscating the patterns to dodge that.
const EXCLUDED_PATHS = ['scripts/dev/check-leaks.mjs'];

function addedLines(diff) {
  const lines = [];
  let excluded = false;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) {
      excluded = EXCLUDED_PATHS.includes(line.slice('+++ b/'.length));
      continue;
    }
    if (!excluded && line.startsWith('+') && !line.startsWith('+++')) {
      lines.push(line.slice(1));
    }
  }
  return lines;
}

const full = process.argv.includes('--full');
const emptyTree = execFileSync('git', ['hash-object', '-t', 'tree', '/dev/null'], {
  encoding: 'utf8',
}).trim();
const diffArgs = full
  ? ['diff', '--unified=0', emptyTree, 'HEAD']
  : ['diff', '--cached', '-U0'];
const diff = execFileSync('git', diffArgs, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });

const hits = [];
for (const line of addedLines(diff)) {
  for (const [pattern, label] of PATTERNS) {
    if (pattern.test(line)) hits.push({ label, line: line.trim().slice(0, 120) });
  }
}

if (hits.length > 0) {
  console.error('check-leaks: blocked - found what looks like a leak:\n');
  for (const hit of hits) {
    console.error(`  [${hit.label}] ${hit.line}`);
  }
  console.error('\nIf this is a false positive, fix the pattern in scripts/dev/check-leaks.mjs.');
  process.exit(1);
}

console.log('check-leaks: clean');
