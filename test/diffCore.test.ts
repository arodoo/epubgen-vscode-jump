import { diffChars, diffLines } from 'diff';

import {
  computeChangeOffsets,
  offsetToLineColumn,
  offsetsToPositions,
  findNextOffset,
  findPrevOffset,
} from '../src/diffCore';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function deepEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

function assertEq<T>(actual: T, expected: T, msg: string): void {
  if (deepEq(actual, expected)) {
    passed++;
    console.log(`  \u2713 ${msg}`);
  } else {
    failed++;
    failures.push(msg);
    console.error(`  \u2717 ${msg}`);
    console.error(`      expected: ${JSON.stringify(expected)}`);
    console.error(`      actual:   ${JSON.stringify(actual)}`);
  }
}

console.log('=== diffCore.test.ts (line-aware navigation) ===\n');

console.log('[line-ending normalization (CRLF/LF)]');

{
  const oldText = 'line 1\nline 2\nline 3\n';
  const newText = 'line 1\r\nline 2\r\nline 3\r\n';
  const offsets = computeChangeOffsets(oldText, newText);
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets, [], 'pure line-ending change = no offsets');
}

{
  const oldText = 'a\nb\nc\n';
  const newText = 'a\r\nB\r\nc\r\n';
  const offsets = computeChangeOffsets(oldText, newText);
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets.length, 1, 'line 2 changed, line endings ignored');
  const positions = offsetsToPositions(
    newText.replace(/\r/g, ''),
    offsets
  );
  assertEq(positions[0].line, 1, 'change at line 1 (0-indexed) = UI line 2');
}

{
  // User's actual scenario: 2 content changes with CRLF/LF mismatch
  const oldText =
    'L1\nL2\nL3\nL4\nL5\nL6 d1e\nL7\nL8\nL9\nL10\nL11\nL12\nL13\nL14\nL15\nL16 cosas1\n';
  const newText = oldText
    .replace(/\n/g, '\r\n')
    .replace('d1e', 'de')
    .replace('cosas1', 'cosas');
  const offsets = computeChangeOffsets(oldText, newText);
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets.length, 2, '2 content changes detected despite CRLF');
  const positions = offsetsToPositions(newText.replace(/\r/g, ''), offsets);
  assertEq(positions[0].line, 5, 'first change at UI line 6');
  assertEq(positions[1].line, 15, 'second change at UI line 16');
}

console.log('\n[line-level: one offset per changed line]');

{
  // Two code lines modified → 2 offsets (one per modified line)
  const oldText = 'def func():\n    return x + y\n\ndef other():\n    return a + b\n';
  const newText = 'def func():\n    return x * y\n\ndef other():\n    return a * b\n';
  const offsets = computeChangeOffsets(oldText, newText);
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets.length, 2, 'two changed lines → 2 offsets');
  const positions = offsetsToPositions(newText, offsets);
  assertEq(
    positions[0],
    { offset: 25, line: 1, column: 13 },
    'first offset at line 1 col 13 (where * replaced +)'
  );
  assertEq(
    positions[1],
    { offset: 56, line: 4, column: 13 },
    'second offset at line 4 col 13'
  );
}

{
  // Multi-word substitutions in same line → 1 offset (first change col)
  const oldText = 'I went to the store and bought some milk and bread yesterday afternoon';
  const newText = 'I went to the SHOP and bought some MILK and BREAD yesterday afternoon';
  const offsets = computeChangeOffsets(oldText, newText);
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets.length, 1, 'many subs in same line = 1 offset');
  const positions = offsetsToPositions(newText, offsets);
  assertEq(
    positions[0].column,
    14,
    'first offset col 14 (where "SHOP" replaces "store")'
  );
}

{
  // Multi-line: each modified line gets its own offset
  const oldText =
    'I like cats and dogs\nShe drinks coffee and tea\nThe sky is blue today';
  const newText =
    'I LIKE CATS AND DOGS\nShe DRINKS COFFEE AND TEA\nThe sky is blue today';
  const offsets = computeChangeOffsets(oldText, newText);
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets.length, 2, 'two changed lines → 2 offsets');
  const positions = offsetsToPositions(newText, offsets);
  assertEq(positions[0].line, 0, 'first change at line 0');
  assertEq(positions[1].line, 1, 'second change at line 1');
}

{
  // Synthetic: 50 lines, 5 with multi-word changes each
  const oldLines: string[] = [];
  const newLines: string[] = [];
  for (let i = 1; i <= 50; i++) {
    oldLines.push('The quick brown fox jumps over the lazy dog and runs to the park');
    newLines.push('The quick brown fox jumps over the lazy dog and runs to the park');
  }
  for (const ln of [10, 20, 25, 35, 48]) {
    newLines[ln - 1] = 'The FAST brown CAT jumps over the lazy DOG and walks to the STORE';
  }
  const offsets = computeChangeOffsets(oldLines.join('\n'), newLines.join('\n'));
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets.length, 5, '5 modified lines → exactly 5 offsets');
}

{
  // Column-300 scenario from user's original request
  const beforeText = 'x'.repeat(305);
  const afterText = beforeText.slice(0, 300) + 'Y' + beforeText.slice(301);
  const offsets = computeChangeOffsets(beforeText, afterText);
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets.length, 1, 'single line change → 1 offset');
  assertEq(offsets[0], 300, 'offset at column 300 (user requirement)');
}

console.log('\n[additions / deletions / empty cases]');

{
  const oldText = 'hello world';
  const newText = 'hello there';
  const offsets = computeChangeOffsets(oldText, newText);
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets.length, 1, 'world→there → 1 offset');
  assertEq(offsets[0], 6, 'offset at col 6 (where "there" starts)');
}

{
  const oldText = 'a b c';
  const newText = 'a b new c';
  const offsets = computeChangeOffsets(oldText, newText);
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets.length, 1, '"new" inserted → 1 offset');
  assertEq(offsets[0], 4, 'offset at col 4');
}

{
  assertEq(
    computeChangeOffsets('same', 'same'),
    [],
    'identical texts = empty offsets'
  );
}

{
  const oldText = 'old text';
  const newText = 'completely new content';
  const offsets = computeChangeOffsets(oldText, newText);
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets.length, 1, 'single-line replacement → 1 offset');
  assertEq(offsets[0], 0, 'replacement starts at offset 0');
}

{
  const oldText = 'a\nb\nc';
  const newText = 'A\nB\nC';
  const offsets = computeChangeOffsets(oldText, newText);
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets.length, 3, 'three lines all changed → 3 offsets');
  const positions = offsetsToPositions(newText, offsets);
  assertEq(positions.map((p) => p.line), [0, 1, 2], 'one nav point per line');
}

{
  const oldText = 'line 1\n';
  const newText = 'line 1\nline 2\n';
  const offsets = computeChangeOffsets(oldText, newText);
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets.length, 1, 'one new line added → 1 offset');
  assertEq(offsets[0], 7, 'offset at start of new line');
}

{
  const oldText = '';
  const newText = 'line 1\nline 2\nline 3';
  const offsets = computeChangeOffsets(oldText, newText);
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets.length, 3, 'empty old → all new lines are changes');
}

{
  const oldText = 'line1\nline2\nline3';
  const newText = 'line1\nline3';
  const offsets = computeChangeOffsets(oldText, newText);
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets.length, 0, 'pure removal → no offset in newText (line does not exist)');
}

{
  const oldText = 'unchanged 1\nunchanged 2\nwas here';
  const newText = 'unchanged 1\nunchanged 2\nnow here';
  const offsets = computeChangeOffsets(oldText, newText);
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets.length, 1, 'only last line modified');
  const positions = offsetsToPositions(newText, offsets);
  assertEq(positions[0].line, 2, 'change at line 2');
  assertEq(positions[0].column, 0, 'col 0 (was at start)');
}

{
  const oldText = 'unchanged line';
  const newText = 'unchanged line\nadded line';
  const offsets = computeChangeOffsets(oldText, newText);
  console.log(`  offsets: [${offsets.join(', ')}]`);
  assertEq(offsets.length, 1, 'one new line added → 1 offset');
  assertEq(offsets[0], 15, 'offset where new line starts');
}

console.log('\n[offsetToLineColumn]');
{
  const text = 'line one\nline two\nline three';
  assertEq(offsetToLineColumn(text, 0), { line: 0, column: 0 }, 'offset 0 → line 0 col 0');
  assertEq(offsetToLineColumn(text, 9), { line: 1, column: 0 }, 'offset 9 → line 1 col 0');
  assertEq(offsetToLineColumn(text, 12), { line: 1, column: 3 }, 'offset 12 → line 1 col 3');
  assertEq(offsetToLineColumn(text, 100), { line: 2, column: 10 }, 'beyond text clamps to end');
  assertEq(offsetToLineColumn(text, -5), { line: 0, column: 0 }, 'negative clamps to 0');
}

console.log('\n[findNextOffset / findPrevOffset]');
{
  const offsets = [5, 10, 20, 30];
  assertEq(findNextOffset(offsets, 0), 5, 'next from 0 → 5');
  assertEq(findNextOffset(offsets, 30), null, 'next from 30 → null');
  assertEq(findNextOffset(offsets, 100), null, 'next past end → null');
  assertEq(findPrevOffset(offsets, 30), 20, 'prev from 30 → 20');
  assertEq(findPrevOffset(offsets, 5), null, 'prev from 5 → null');
  assertEq(findPrevOffset(offsets, 0), null, 'prev from 0 → null');
}

console.log('\n[diffChars / diffLines sanity]');
{
  console.log('  diffLines(...) for two-line replacement:');
  const parts = diffLines(
    'aaa\nbbb\nccc',
    'aaa\nBBB\nccc'
  );
  for (const p of parts) {
    const m = (p as any).added ? '+' : (p as any).removed ? '-' : ' ';
    console.log(`    ${m} ${JSON.stringify(p.value)}`);
  }
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  console.error('\nFailures:');
  for (const f of failures) {
    console.error(`  - ${f}`);
  }
  process.exit(1);
}
