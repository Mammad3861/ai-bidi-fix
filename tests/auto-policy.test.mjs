import assert from 'node:assert/strict';
import test from 'node:test';

import { decideAutoRendering } from '../src/core/auto-policy.ts';
import { analyzeText } from '../src/core/analyze-text.ts';
import { decideRendering } from '../src/core/decide-rendering.ts';

const SAFE = Object.freeze({ structurallySafe: true, editable: false, allowInlineIsolation: true });
const RTL_PROSE = 'این یک متن فارسی طولانی و روشن است که با API و DOM کامل می‌شود.';

test('high-confidence RTL prose permits safe inline isolation without line wrapping', () => {
  assert.deepEqual(decideAutoRendering(RTL_PROSE, SAFE), {
    mode: 'full', direction: 'rtl', align: 'right', bidi: 'plaintext',
    isolateInlineLtr: true, technical: false, confidence: 'high',
    reason: 'auto-rtl-evidence', lineLevel: false,
  });
  const denied = decideAutoRendering(RTL_PROSE, { ...SAFE, allowInlineIsolation: false });
  assert.equal(denied.mode, 'full');
  assert.equal(denied.isolateInlineLtr, false, 'high text confidence does not grant inline permission');
  assert.equal(decideAutoRendering(RTL_PROSE, { structurallySafe: true, editable: false }).isolateInlineLtr, false);
});

test('confidence boundaries require substantive words, letter evidence, dominance, and first script', () => {
  const cases = [
    ['سلام دنیا کتاب', 'high', 'rtl'], // 12 RTL letters, three substantive words.
    ['سلام دنیا کار', 'medium', 'rtl'], // 11 letters.
    ['aaaaaa bbbbbb', 'medium', 'ltr'], // 12 letters, only two words.
    ['aaaa bbbb cccc', 'high', 'ltr'], // Three words and 12 letters.
    ['سلام دنیا کتاب API DOM', 'high', 'rtl'], // RTL:Latin = 12:6, inclusive boundary.
    ['سلام دنیا کتاب API DOM X', 'medium', 'auto'], // 12:7, insufficient dominance.
    ['API سلام دنیا کتاب', 'medium', 'auto'], // English first despite strong RTL evidence.
    ['شرح This is a much longer English explanation.', 'medium', 'auto'],
    ['سلام', 'medium', 'rtl'], // Four letters is enough only for a minimal block fix.
    ['API', 'low', 'auto'], // Three letters, not enough prose evidence.
  ];
  for (const [text, confidence, direction] of cases) {
    const result = decideAutoRendering(text, SAFE);
    assert.equal(result.confidence, confidence, text);
    assert.equal(result.direction, direction, text);
    assert.equal(result.mode, confidence === 'high' ? 'full' : confidence === 'medium' ? 'minimal' : 'none', text);
  }
});

test('English-first mixed text stays minimal/auto, while Latin-only prose can be high confidence', () => {
  const englishFirst = decideAutoRendering('Build the extension first. سپس متن فارسی را با جزئیات بیشتر ادامه بده.', SAFE);
  assert.equal(englishFirst.direction, 'auto');
  assert.equal(englishFirst.mode, 'minimal');
  assert.equal(englishFirst.confidence, 'medium');
  assert.equal(englishFirst.isolateInlineLtr, false);
  const latin = decideAutoRendering('This is ordinary English prose.', SAFE);
  assert.equal(latin.mode, 'full');
  assert.equal(latin.direction, 'ltr');
  assert.equal(latin.confidence, 'high');
  assert.equal(latin.isolateInlineLtr, false);
  assert.equal(decideAutoRendering('هذا شرح عربي واضح ومفصل', SAFE).confidence, 'high');
});

test('empty, whitespace, numbers and punctuation are no-ops, including RTL digits', () => {
  for (const text of ['', ' \t\n', '1234 - !?', '۳۸۴، ۰٫۳ ؟', '٣٨٤، ٧٣', '😀']) {
    assert.deepEqual(decideAutoRendering(text, { ...SAFE, strongRtl: true }), {
      mode: 'none', direction: 'auto', align: 'start', bidi: 'normal',
      isolateInlineLtr: false, technical: false, confidence: 'low',
      reason: text.trim() ? 'auto-insufficient-letters' : 'auto-empty', lineLevel: false,
    }, text);
  }
  const unsupported = decideAutoRendering('English and Ελληνικά', SAFE);
  assert.equal(unsupported.mode, 'none');
  assert.equal(unsupported.reason, 'auto-unsupported-script');
});

test('existing genuine-code classification wins over Persian strings/comments and never restructures code', () => {
  for (const text of [
    'const message = "متن فارسی";\n// توضیح فارسی\nconsole.log(message);',
    'const message = "نص عربي";\nconsole.log(message);',
    'npm run build',
    'npm ci\nnpm run lint\nnpm run build',
    '{"message":"سلام دنیا","count":1}',
  ]) {
    assert.deepEqual(decideAutoRendering(text, SAFE), {
      mode: 'full', direction: 'ltr', align: 'left', bidi: 'isolate',
      isolateInlineLtr: false, technical: true, confidence: 'high',
      reason: 'auto-real-code', lineLevel: false,
    }, text);
  }
});

test('standalone URLs, paths, and filenames get minimal technical LTR decisions, not prose confidence', () => {
  for (const text of ['https://claude.ai/path?q=1', '/usr/local/bin/tool.sh', 'C:\\Users\\Mammad\\file.txt', 'src/content/bidi.ts', 'README.md', 'docs/a.md project.godot', 'RTL/LTR']) {
    assert.deepEqual(decideAutoRendering(text, SAFE), {
      mode: 'minimal', direction: 'ltr', align: 'left', bidi: 'isolate',
      isolateInlineLtr: false, technical: true, confidence: 'medium',
      reason: 'auto-technical-token', lineLevel: false,
    }, text);
  }
});

test('technical runs in well-supported RTL prose stay eligible, without upgrading ambiguous syntax', () => {
  const prose = 'این توضیح فارسی برای بررسی دقیق فایل پروژه نوشته شده است و باید مراحل آن را با دقت کامل انجام بدهید؛ فایل src/content/bidi.ts را بررسی کنید و سپس دستور npm run build را اجرا کنید.';
  const supported = decideAutoRendering(prose, SAFE);
  assert.equal(supported.confidence, 'high');
  assert.equal(supported.direction, 'rtl');
  assert.equal(supported.technical, false);
  assert.equal(supported.isolateInlineLtr, true);
  const ambiguous = decideAutoRendering('فایل README.md و مقدار x = 1 را با دقت بررسی کن.', SAFE);
  assert.equal(ambiguous.confidence, 'medium');
  assert.equal(ambiguous.mode, 'minimal');
  assert.equal(ambiguous.direction, 'auto');
  assert.equal(ambiguous.reason, 'auto-unclassified-syntax');
});

test('unsafe or unknown structural metadata overrides high prose/code evidence', () => {
  for (const text of [RTL_PROSE, 'const message = "سلام";']) {
    assert.equal(decideAutoRendering(text, SAFE).confidence, 'high');
    for (const context of [
      { ...SAFE, structurallySafe: false }, { ...SAFE, editable: true },
      { editable: false }, { structurallySafe: true },
    ]) {
      const result = decideAutoRendering(text, context);
      assert.equal(result.mode, 'none');
      assert.equal(result.confidence, 'low');
      assert.equal(result.reason, 'auto-unsafe-context');
      assert.equal(result.isolateInlineLtr, false);
      assert.equal(result.lineLevel, false);
    }
  }
});

test('every medium outcome prohibits inline and line wrapping even if requested by a caller', () => {
  for (const text of ['سلام', 'Hello', 'API سلام دنیا کتاب', 'src/content/bidi.ts', 'فایل README.md و مقدار x = 1 را با دقت بررسی کن.']) {
    const result = decideAutoRendering(text, { ...SAFE, lineLevel: true });
    assert.equal(result.confidence, 'medium', text);
    assert.equal(result.mode, 'minimal', text);
    assert.equal(result.isolateInlineLtr, false, text);
    assert.equal(result.lineLevel, false, text);
  }
});

test('auto decisions do not change supported-site compatibility decisions or diagnostic confidence', () => {
  const cases = [
    ['API سلام دنیا کتاب', 'medium', 'rtl', 'full', true, 'compat-rtl-inline'],
    ['This is ordinary English prose.', 'high', 'ltr', 'minimal', false, 'compat-ltr-block'],
    ['123 !?', 'low', 'auto', 'minimal', false, 'compat-auto-block'],
  ];
  for (const [text, confidence, direction, mode, inline, reason] of cases) {
    const analysis = analyzeText(text, { strongRtl: false, classifyCode: false });
    const before = globalThis.structuredClone(analysis);
    decideAutoRendering(text, SAFE);
    assert.deepEqual(analysis, before, 'compatibility analysis is not mutated');
    for (const diagnostic of ['low', 'medium', 'high']) {
      const decision = decideRendering({ ...analysis, confidence: diagnostic }, { lineLevel: false, allowInlineIsolation: true });
      assert.equal(decision.direction, direction);
      assert.equal(decision.mode, mode);
      assert.equal(decision.isolateInlineLtr, inline);
      assert.equal(decision.reason, reason);
    }
    assert.equal(analysis.confidence, confidence);
  }
  const line = decideRendering(analyzeText('English line\nخط فارسی', { strongRtl: false, classifyCode: false }), { lineLevel: true, allowInlineIsolation: true });
  assert.equal(line.mode, 'full');
  assert.equal(line.reason, 'compat-line-level');
});
