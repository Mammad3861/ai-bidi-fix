import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeText } from '../src/core/analyze-text.ts';
import {
  decideComposerDirection,
  decideRendering,
} from '../src/core/decide-rendering.ts';

const PROSE_OPTIONS = { strongRtl: false, classifyCode: false };
const CODE_OPTIONS = { strongRtl: false, classifyCode: true };

function assertAnalysis(text, options, expected) {
  const analysis = analyzeText(text, options);
  for (const [key, value] of Object.entries(expected)) {
    assert.deepEqual(analysis[key], value, `${JSON.stringify(text)}: ${key}`);
  }
  assert.equal(
    analysis.reasons.every((reason) => /^[a-z0-9-]+$/.test(reason)),
    true,
    `${JSON.stringify(text)}: diagnostic reasons are enum-like labels`,
  );
  return analysis;
}

test('analyzes natural-language and neutral text in v0.1.3 compatibility mode', () => {
  assertAnalysis('', PROSE_OPTIONS, {
    direction: 'auto',
    contentKind: 'unknown',
    hasRtl: false,
    hasLtr: false,
    mixed: false,
    confidence: 'low',
    inlineRanges: [],
  });
  assertAnalysis(' \t\n', PROSE_OPTIONS, {
    direction: 'auto',
    contentKind: 'unknown',
    hasRtl: false,
    hasLtr: false,
    mixed: false,
    confidence: 'low',
  });
  assertAnalysis('1234 - / . !?', PROSE_OPTIONS, {
    direction: 'auto',
    contentKind: 'unknown',
    hasRtl: false,
    hasLtr: false,
    mixed: false,
    confidence: 'low',
  });
  assertAnalysis('1234 - / . !?', { ...PROSE_OPTIONS, strongRtl: true }, {
    direction: 'rtl',
    contentKind: 'unknown',
    hasRtl: false,
    hasLtr: false,
    mixed: false,
    confidence: 'low',
  });
  assertAnalysis('این یک متن فارسی است', PROSE_OPTIONS, {
    direction: 'rtl',
    contentKind: 'prose',
    hasRtl: true,
    hasLtr: false,
    mixed: false,
    confidence: 'high',
  });
  assertAnalysis('هذا نص عربي', PROSE_OPTIONS, {
    direction: 'rtl',
    contentKind: 'prose',
    hasRtl: true,
    hasLtr: false,
    mixed: false,
    confidence: 'high',
  });
  assertAnalysis('This is ordinary English prose.', PROSE_OPTIONS, {
    direction: 'ltr',
    contentKind: 'prose',
    hasRtl: false,
    hasLtr: true,
    mixed: false,
    confidence: 'high',
  });
  assertAnalysis('این متن includes English', PROSE_OPTIONS, {
    direction: 'rtl',
    contentKind: 'prose',
    hasRtl: true,
    hasLtr: true,
    mixed: true,
    confidence: 'medium',
  });
});

test('preserves the existing real-code and code-like prose classifier outcomes', () => {
  const realCodeCases = [
    'const value = 1;\nfunction test() {\n  return value;\n}',
    'npm ci\nnpm run lint\nnpm run build',
    '{\n  "name": "bidifix-ai",\n  "version": "0.1.3"\n}',
    'const message = "متن فارسی";\n// این توضیح فارسی است\nconsole.log(message);',
  ];

  for (const sample of realCodeCases) {
    assertAnalysis(sample, CODE_OPTIONS, {
      contentKind: 'code',
      confidence: 'high',
    });
  }

  assertAnalysis(
    'فایل docs/ICON_PIPELINE.md را بررسی کن و سپس npm run build را اجرا کن.',
    CODE_OPTIONS,
    {
      direction: 'rtl',
      contentKind: 'prose',
      hasRtl: true,
      hasLtr: true,
      mixed: true,
      confidence: 'medium',
    },
  );
  assertAnalysis('README.md', { ...CODE_OPTIONS, inlineCode: true }, {
    direction: 'ltr',
    contentKind: 'code',
    hasRtl: false,
    hasLtr: true,
    mixed: false,
    confidence: 'high',
  });
});

test('maps exact legacy inline ranges without adding token heuristics', () => {
  const analysis = analyzeText(
    'فایل README.md و دستور npm run build را اجرا کن.',
    PROSE_OPTIONS,
  );

  assert.deepEqual(analysis.inlineRanges, [
    { start: 5, end: 14, direction: 'ltr', kind: 'phrase' },
    { start: 23, end: 36, direction: 'ltr', kind: 'phrase' },
  ]);
});

test('maps compatibility analyses to current rendering outcomes', () => {
  const code = analyzeText('const value = 1;', CODE_OPTIONS);
  assert.deepEqual(
    decideRendering(code, { lineLevel: false, allowInlineIsolation: true }),
    {
      mode: 'minimal',
      direction: 'ltr',
      align: 'left',
      bidi: 'isolate',
      isolateInlineLtr: false,
      technical: true,
      confidence: 'high',
      reason: 'compat-technical',
    },
  );

  const rtl = analyzeText('فایل README.md را بررسی کن.', PROSE_OPTIONS);
  assert.deepEqual(
    decideRendering(rtl, { lineLevel: false, allowInlineIsolation: true }),
    {
      mode: 'full',
      direction: 'rtl',
      align: 'right',
      bidi: 'plaintext',
      isolateInlineLtr: true,
      technical: false,
      confidence: 'medium',
      reason: 'compat-rtl-inline',
    },
  );

  const ltr = analyzeText('Ordinary English prose.', PROSE_OPTIONS);
  assert.deepEqual(
    decideRendering(ltr, { lineLevel: false, allowInlineIsolation: true }),
    {
      mode: 'minimal',
      direction: 'ltr',
      align: 'left',
      bidi: 'plaintext',
      isolateInlineLtr: false,
      technical: false,
      confidence: 'high',
      reason: 'compat-ltr-block',
    },
  );

  const neutral = analyzeText('123 !?', PROSE_OPTIONS);
  assert.deepEqual(
    decideRendering(neutral, { lineLevel: false, allowInlineIsolation: true }),
    {
      mode: 'minimal',
      direction: 'auto',
      align: 'start',
      bidi: 'plaintext',
      isolateInlineLtr: false,
      technical: false,
      confidence: 'low',
      reason: 'compat-auto-block',
    },
  );
});

test('preserves line-level and inline-isolation compatibility controls', () => {
  const analysis = analyzeText('English line\nخط فارسی', PROSE_OPTIONS);
  assert.deepEqual(
    decideRendering(analysis, { lineLevel: true, allowInlineIsolation: true }),
    {
      mode: 'full',
      direction: 'auto',
      align: 'start',
      bidi: 'plaintext',
      isolateInlineLtr: false,
      technical: false,
      confidence: 'medium',
      reason: 'compat-line-level',
    },
  );

  const denied = decideRendering(analysis, {
    lineLevel: false,
    allowInlineIsolation: false,
  });
  assert.equal(denied.direction, 'rtl');
  assert.equal(denied.mode, 'minimal');
  assert.equal(denied.isolateInlineLtr, false);
  assert.equal(denied.reason, 'compat-rtl-block');
});

test('keeps confidence metadata non-operative in compatibility decisions', () => {
  const base = analyzeText('فایل README.md را بررسی کن.', PROSE_OPTIONS);
  const decisions = ['low', 'medium', 'high'].map((confidence) =>
    decideRendering(
      { ...base, confidence },
      { lineLevel: false, allowInlineIsolation: true },
    ),
  );
  const withoutConfidence = decisions.map((decision) => {
    const copy = { ...decision };
    delete copy.confidence;
    return copy;
  });

  assert.deepEqual(withoutConfidence[0], withoutConfidence[1]);
  assert.deepEqual(withoutConfidence[1], withoutConfidence[2]);
  assert.equal(decisions[0].mode, 'full');
  assert.equal(decisions[0].isolateInlineLtr, true);
});

test('preserves current composer direction behavior', () => {
  const cases = [
    ['', 'auto'],
    ['English only', 'auto'],
    ['متن فارسی', 'rtl'],
    ['متن فارسی with English', 'rtl'],
    ['متن فارسی\nEnglish-only line', 'auto'],
    ['123 !?', 'auto'],
  ];

  for (const [text, expected] of cases) {
    assert.equal(decideComposerDirection(text), expected, JSON.stringify(text));
  }
});
