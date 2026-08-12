import '../src/content/styles.css';
import { applyBidiFix, clearBidiFix } from '../src/content/bidi';

interface DomTestResult {
  name: string;
  passed: boolean;
  error?: string;
}

declare global {
  interface Window {
    __bidifixDomTestResults: DomTestResult[];
  }
}

const options = { strongRtl: false, experimentalMixedPromptFix: false };

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`DOM fixture is missing ${selector}.`);
  return element;
}

const fixtureRoot = requireElement<HTMLElement>('#fixtures');
const resultList = requireElement<HTMLOListElement>('#results');
const summary = requireElement<HTMLElement>('#summary');

document.documentElement.dataset.bidifixSite = 'chatgpt';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
}

function createMessage(): HTMLElement {
  const message = document.createElement('div');
  message.dataset.messageAuthorRole = 'assistant';
  fixtureRoot.append(message);
  return message;
}

function createNestedCodeBlock(message: HTMLElement, text: string): { pre: HTMLPreElement; code: HTMLElement } {
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  const first = document.createElement('span');
  const second = document.createElement('span');
  const midpoint = Math.max(1, Math.floor(text.length / 2));
  first.textContent = text.slice(0, midpoint);
  second.textContent = text.slice(midpoint);
  code.append(first, second);
  pre.append(code);
  message.append(pre);
  return { pre, code };
}

function createCodeMirrorBlock(message: HTMLElement, text: string): HTMLPreElement {
  const viewer = document.createElement('div');
  viewer.id = 'code-block-viewer';
  viewer.className = 'cm-editor';
  viewer.dir = 'ltr';
  const scroller = document.createElement('div');
  scroller.className = 'cm-scroller';
  const pre = document.createElement('pre');
  pre.className = 'cm-content q9tKkq_readonly m-0';
  const line = document.createElement('span');
  line.textContent = text;
  pre.append(line);
  scroller.append(pre);
  viewer.append(scroller);
  message.append(viewer);
  return pre;
}

function expectRtlProse(element: HTMLElement, originalText: string, expectedIslands: string[]): void {
  const style = getComputedStyle(element);
  assertEqual(element.dataset.bidifixDirection, 'rtl', 'direction marker');
  assertEqual(element.dataset.bidifixCodeProse, 'true', 'code-prose marker');
  assertEqual(element.dataset.bidifixTechnical, undefined, 'technical marker removed');
  assertEqual(element.dir, 'rtl', 'dir attribute');
  assertEqual(style.direction, 'rtl', 'computed direction');
  assertEqual(style.textAlign, 'right', 'computed text alignment');
  assertEqual(style.unicodeBidi, 'plaintext', 'computed unicode-bidi');
  assertEqual(element.textContent, originalText, 'text content is unchanged');

  const islands = [...element.querySelectorAll<HTMLElement>('[data-bidifix-inline-ltr="true"]')];
  const islandText = islands.map((island) => island.textContent);
  expectedIslands.forEach((expected) => {
    assert(islandText.includes(expected), `missing LTR island: ${expected}`);
  });
  islands.forEach((island) => {
    assertEqual(island.dir, 'ltr', 'LTR island dir');
    assertEqual(getComputedStyle(island).direction, 'ltr', 'LTR island computed direction');
    assertEqual(getComputedStyle(island).unicodeBidi, 'isolate', 'LTR island computed unicode-bidi');
  });
}

function expectRealCode(pre: HTMLElement, originalText: string): void {
  const style = getComputedStyle(pre);
  assertEqual(pre.dataset.bidifixTechnical, 'true', 'real-code technical marker');
  assertEqual(pre.dataset.bidifixCodeProse, undefined, 'real code has no prose marker');
  assertEqual(pre.dir, 'ltr', 'real-code dir');
  assertEqual(style.direction, 'ltr', 'real-code computed direction');
  assertEqual(style.textAlign, 'left', 'real-code computed alignment');
  assertEqual(style.unicodeBidi, 'isolate', 'real-code computed unicode-bidi');
  assertEqual(pre.textContent, originalText, 'real-code text is unchanged');
  assertEqual(pre.querySelectorAll('[data-bidifix-inline-ltr="true"]').length, 0, 'real code has no islands');
}

const results: DomTestResult[] = [];

function test(name: string, run: () => void): void {
  try {
    run();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) });
  } finally {
    fixtureRoot.replaceChildren();
  }
}

test('prioritizes a nested pre/code Persian prose block after the normal block budget', () => {
  const text = 'فایل docs/ICON_PIPELINE.md را بررسی کن و سپس project.godot و presets.cfg را باز کن.';
  const message = createMessage();
  for (let index = 0; index < 100; index += 1) {
    const paragraph = document.createElement('p');
    paragraph.textContent = `Ordinary paragraph ${index}`;
    message.append(paragraph);
  }
  const { pre, code } = createNestedCodeBlock(message, text);

  applyBidiFix(message, options, 'chatgpt');

  expectRtlProse(pre, text, ['docs/ICON_PIPELINE.md', 'project.godot', 'presets.cfg']);
  expectRtlProse(code, text, ['docs/ICON_PIPELINE.md', 'project.godot', 'presets.cfg']);
  assertEqual(getComputedStyle(code.querySelector('span') as HTMLElement).direction, 'rtl', 'nested span inherits RTL');
  assertEqual(message.querySelectorAll('[data-bidifix-line="true"]').length, 0, 'default mode creates no line wrappers');
});

test('overrides a current ChatGPT CodeMirror viewer LTR ancestor for Persian command prose', () => {
  const text = 'برای ساخت پروژه ابتدا npm run build را اجرا کن و بعد فایل README.md را بررسی کن.';
  const message = createMessage();
  const pre = createCodeMirrorBlock(message, text);

  applyBidiFix(message, options, 'chatgpt');

  expectRtlProse(pre, text, ['npm run build', 'README.md']);
  assertEqual(getComputedStyle(pre.firstElementChild as HTMLElement).direction, 'rtl', 'CodeMirror line inherits RTL');
});

const realCodeCases = [
  {
    name: 'TypeScript',
    text: 'const value = 1;\nfunction test() {\n  return value;\n}',
  },
  {
    name: 'shell',
    text: 'npm ci\nnpm run lint\nnpm run build',
  },
  {
    name: 'JSON',
    text: '{\n  "name": "bidifix-ai",\n  "version": "0.1.3"\n}',
  },
  {
    name: 'TypeScript with Persian string and comment',
    text: 'const message = "سلام دنیا";\n// توضیح فارسی\nconsole.log(message);',
  },
];

realCodeCases.forEach(({ name, text }) => {
  test(`keeps genuine ${name} LTR`, () => {
    const message = createMessage();
    const { pre, code } = createNestedCodeBlock(message, text);
    applyBidiFix(message, options, 'chatgpt');
    expectRealCode(pre, text);
    expectRealCode(code, text);
  });
});

test('reclassifies prose to code and back without stale state', () => {
  const prose = 'فایل docs/ICON_PIPELINE.md را بررسی کن و سپس npm run build را اجرا کن.';
  const codeText = 'const value = 1;\nfunction test() {\n  return value;\n}';
  const message = createMessage();
  const { pre, code } = createNestedCodeBlock(message, prose);

  applyBidiFix(message, options, 'chatgpt');
  expectRtlProse(pre, prose, ['docs/ICON_PIPELINE.md', 'npm run build']);

  code.textContent = codeText;
  applyBidiFix(message, options, 'chatgpt');
  expectRealCode(pre, codeText);
  expectRealCode(code, codeText);

  code.textContent = prose;
  applyBidiFix(message, options, 'chatgpt');
  expectRtlProse(pre, prose, ['docs/ICON_PIPELINE.md', 'npm run build']);
  assertEqual(pre.querySelectorAll('[data-bidifix-inline-ltr="true"]').length, 2, 'no nested duplicate islands');

  applyBidiFix(message, options, 'chatgpt');
  assertEqual(pre.querySelectorAll('[data-bidifix-inline-ltr="true"]').length, 2, 'idempotent reprocessing');
});

test('restores inline islands removed by a renderer while keeping text unchanged', () => {
  const text = 'فایل docs/ICON_PIPELINE.md و project.godot را بررسی کن.';
  const message = createMessage();
  const { pre } = createNestedCodeBlock(message, text);

  applyBidiFix(message, options, 'chatgpt');
  const originalWrapperCount = pre.querySelectorAll('[data-bidifix-inline-ltr="true"]').length;
  pre.querySelectorAll<HTMLElement>('[data-bidifix-inline-ltr="true"]').forEach((island) => {
    island.replaceWith(document.createTextNode(island.textContent ?? ''));
  });
  assertEqual(pre.textContent, text, 'renderer reconciliation preserves logical text');
  assertEqual(pre.querySelectorAll('[data-bidifix-inline-ltr="true"]').length, 0, 'renderer removed islands');

  applyBidiFix(message, options, 'chatgpt');
  assertEqual(
    pre.querySelectorAll('[data-bidifix-inline-ltr="true"]').length,
    originalWrapperCount,
    'unchanged processed block restores missing islands',
  );
  assertEqual(pre.textContent, text, 'restored islands preserve logical text');
});

test('cleanup unwraps generated islands and restores managed attributes', () => {
  const text = 'برای ساخت پروژه npm run build را اجرا کن.';
  const message = createMessage();
  const { pre } = createNestedCodeBlock(message, text);
  applyBidiFix(message, options, 'chatgpt');
  assert(pre.querySelector('[data-bidifix-inline-ltr="true"]'), 'precondition: island exists');

  clearBidiFix(fixtureRoot);

  assertEqual(pre.textContent, text, 'cleanup preserves text');
  assertEqual(pre.querySelectorAll('[data-bidifix-inline-ltr="true"]').length, 0, 'cleanup removes islands');
  assertEqual(pre.hasAttribute('data-bidifix-direction'), false, 'cleanup removes direction marker');
  assertEqual(pre.hasAttribute('data-bidifix-technical'), false, 'cleanup removes technical marker');
  assertEqual(pre.hasAttribute('dir'), false, 'cleanup restores original dir');
});

window.__bidifixDomTestResults = results;
results.forEach((result) => {
  const item = document.createElement('li');
  item.className = result.passed ? 'pass' : 'fail';
  item.textContent = result.passed ? `PASS: ${result.name}` : `FAIL: ${result.name} — ${result.error}`;
  resultList.append(item);
});

const passed = results.filter((result) => result.passed).length;
summary.textContent = `${passed}/${results.length} DOM regression tests passed.`;
summary.className = passed === results.length ? 'pass' : 'fail';
