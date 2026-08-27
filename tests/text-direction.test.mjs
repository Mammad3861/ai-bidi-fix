import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectDirection,
  hasLtrText,
  hasRtlText,
} from '../src/core/text-direction.ts';

const DIRECTION_CASES = [
  {
    name: 'empty text',
    text: '',
    hasRtl: false,
    hasLtr: false,
    normal: 'auto',
    strong: 'auto',
  },
  {
    name: 'whitespace-only text',
    text: ' \t\n',
    hasRtl: false,
    hasLtr: false,
    normal: 'auto',
    strong: 'rtl',
  },
  {
    name: 'Persian-only text',
    text: 'این یک متن فارسی است',
    hasRtl: true,
    hasLtr: false,
    normal: 'rtl',
    strong: 'rtl',
  },
  {
    name: 'Arabic-only text',
    text: 'هذا نص عربي',
    hasRtl: true,
    hasLtr: false,
    normal: 'rtl',
    strong: 'rtl',
  },
  {
    name: 'English-only text',
    text: 'This is English text',
    hasRtl: false,
    hasLtr: true,
    normal: 'ltr',
    strong: 'ltr',
  },
  {
    name: 'mixed RTL/LTR text',
    text: 'این متن includes English',
    hasRtl: true,
    hasLtr: true,
    normal: 'rtl',
    strong: 'rtl',
  },
  {
    name: 'numbers and punctuation only',
    text: '1234 - / . !?',
    hasRtl: false,
    hasLtr: false,
    normal: 'auto',
    strong: 'rtl',
  },
  {
    name: 'Persian text with English technical terms',
    text: 'فایل src/content/bidi.ts را بررسی کن و npm run build را اجرا کن.',
    hasRtl: true,
    hasLtr: true,
    normal: 'rtl',
    strong: 'rtl',
  },
];

test('preserves v0.1.3 text-direction behavior', () => {
  for (const sample of DIRECTION_CASES) {
    assert.equal(hasRtlText(sample.text), sample.hasRtl, `${sample.name}: hasRtlText`);
    assert.equal(hasLtrText(sample.text), sample.hasLtr, `${sample.name}: hasLtrText`);
    assert.equal(detectDirection(sample.text, false), sample.normal, `${sample.name}: normal`);
    assert.equal(detectDirection(sample.text, true), sample.strong, `${sample.name}: strong`);
  }
});

test('keeps RTL precedence for mixed text', () => {
  const text = 'BidiFix AI برای متن فارسی';
  assert.equal(hasRtlText(text), true);
  assert.equal(hasLtrText(text), true);
  assert.equal(detectDirection(text, false), 'rtl');
});
