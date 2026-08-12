import assert from 'node:assert/strict';
import test from 'node:test';

import { isLikelyRealCodeText } from '../src/content/code-classifier.ts';

const RTL_PROSE_CASES = [
  'فایل docs/ICON_PIPELINE.md را بررسی کن و سپس project.godot و presets.cfg را باز کن.',
  'برای ساخت پروژه ابتدا npm run build را اجرا کن و بعد فایل README.md را بررسی کن.',
  'برای اطلاعات بیشتر به https://claude.ai/ برو و فایل‌های docs/ICON_PIPELINE.md و src/content/bidi.ts را بررسی کن.',
  'function test() را اجرا کن',
  'const value = 1; را بررسی کن',
];

const REAL_CODE_CASES = [
  'const value = 1;\nfunction test() {\n  return value;\n}',
  'npm ci\nnpm run lint\nnpm run build',
  '{\n  "name": "bidifix-ai",\n  "version": "0.1.3"\n}',
  'const message = "متن فارسی";\n// این توضیح فارسی است\nconsole.log(message);',
  '{\n  "name": "پروژه",\n  "version": "0.1.3"\n}',
  'def test():\n  # این توضیح فارسی است\n  return 1',
  'git commit -m "پیام فارسی"\nnpm run build',
];

test('classifies Persian technical prose as prose', () => {
  for (const sample of RTL_PROSE_CASES) {
    assert.equal(isLikelyRealCodeText(sample), false, sample);
  }
});

test('keeps structured source, shell, and JSON blocks as real code', () => {
  for (const sample of REAL_CODE_CASES) {
    assert.equal(isLikelyRealCodeText(sample), true, sample);
  }
});

test('does not treat English technical prose as source code', () => {
  assert.equal(isLikelyRealCodeText('Open README.md and run npm run build.'), false);
});

test('does not infer config syntax from path-labelled RTL prose', () => {
  const sample = 'README.md: این فایل را بررسی کن\nproject.godot: این فایل را باز کن';
  assert.equal(isLikelyRealCodeText(sample), false);
});

test('keeps short English inline code technical', () => {
  assert.equal(isLikelyRealCodeText('README.md', { inlineCode: true }), true);
});
