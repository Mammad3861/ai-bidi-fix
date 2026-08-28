import assert from 'node:assert/strict';
import test from 'node:test';

import { findInlineLtrRanges } from '../src/core/inline-ltr.ts';

test('returns no ranges when the existing matcher finds no LTR run', () => {
  assert.deepEqual(findInlineLtrRanges(''), []);
  assert.deepEqual(findInlineLtrRanges('فقط متن فارسی'), []);
  assert.deepEqual(findInlineLtrRanges('123 !؟'), []);
});

test('returns the exact existing URL range', () => {
  assert.deepEqual(findInlineLtrRanges('https://example.com/path?q=1,'), [
    { start: 0, end: 29, value: 'https://example.com/path?q=1,' },
  ]);
});

test('preserves the existing Unix-style path boundary', () => {
  assert.deepEqual(findInlineLtrRanges('/usr/local/bin/tool.sh'), [
    { start: 1, end: 22, value: 'usr/local/bin/tool.sh' },
  ]);
});

test('returns the exact existing Windows-style path range', () => {
  assert.deepEqual(findInlineLtrRanges('C:\\Users\\Mammad\\file.txt'), [
    { start: 0, end: 24, value: 'C:\\Users\\Mammad\\file.txt' },
  ]);
});

test('returns the exact existing command range', () => {
  assert.deepEqual(findInlineLtrRanges('npm run build'), [
    { start: 0, end: 13, value: 'npm run build' },
  ]);
});

test('returns the exact existing English technical phrase ranges', () => {
  assert.deepEqual(findInlineLtrRanges('Chrome Extension'), [
    { start: 0, end: 16, value: 'Chrome Extension' },
  ]);
  assert.deepEqual(findInlineLtrRanges('BidiFix AI Manifest V3'), [
    { start: 0, end: 22, value: 'BidiFix AI Manifest V3' },
  ]);
});

test('finds paths and commands adjacent to Persian text', () => {
  const text = 'فایل README.md و دستور npm run build را اجرا کن.';
  assert.deepEqual(findInlineLtrRanges(text), [
    { start: 5, end: 14, value: 'README.md' },
    { start: 23, end: 36, value: 'npm run build' },
  ]);
});

test('returns multiple matches in their original order with exact indices', () => {
  const text = 'فایل src/content/bidi.ts و README.md را بررسی کن';
  assert.deepEqual(findInlineLtrRanges(text), [
    { start: 5, end: 24, value: 'src/content/bidi.ts' },
    { start: 27, end: 36, value: 'README.md' },
  ]);
});

test('preserves current punctuation boundaries without reinterpretation', () => {
  const text = 'README.md, https://claude.ai/path). npm run build.';
  assert.deepEqual(findInlineLtrRanges(text), [
    { start: 0, end: 9, value: 'README.md' },
    { start: 11, end: 35, value: 'https://claude.ai/path).' },
    { start: 36, end: 50, value: 'npm run build.' },
  ]);
});
