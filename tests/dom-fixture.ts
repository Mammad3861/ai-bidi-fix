import '../src/content/styles.css';
import { applyBidiFix, clearBidiFix } from '../src/content/bidi';
import { findAssistantMessages, findContainingAssistantMessage } from '../src/content/detector';

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

function createOctoberConversation(): HTMLElement {
  const main = document.createElement('main');
  // Synthetic text; semantic structure observed on live ChatGPT in October 2026.
  main.innerHTML = `
    <div data-chatgpt-search-unit-key="fallback-turn-0:0:user">
      <div data-user-message-bubble="true">
        <div class="whitespace-pre-wrap">
          <div id="oct-user" data-markdown-text-tone="user-message" dir="auto">
            <p dir="auto">این یک تست برای BidiFix AI است.</p>
          </div>
        </div>
        <button id="oct-edit">Edit message</button>
      </div>
    </div>
    <div data-chatgpt-search-unit-key="fallback-turn-0:2:assistant">
      <h4 data-conversation-role="assistant">ChatGPT said:</h4>
      <div data-chatgpt-selection-message-id="synthetic-assistant">
        <div id="oct-assistant" data-markdown-text-style="assistant-message" dir="auto">
          <p id="oct-prose" dir="auto">این یک تست برای BidiFix AI است و فایل src/content/detector.ts را بررسی می‌کنیم.</p>
          <p id="oct-command" dir="auto">برای build دستور npm run build را اجرا کن و به https://github.com مراجعه کن.</p>
          <p>فایل <code id="oct-inline" dir="ltr"><span>README.md</span></code> را بررسی کن.</p>
          <p>یک متن فارسی <span id="oct-citation-wrapper"><a id="oct-citation" data-testid="chatgpt-citation" href="https://example.com">Source</a></span></p>
          <div data-markdown-copy="code-block">
            <div id="oct-code-actions" data-markdown-copy="exclude"><span>TypeScript</span><button>Copy</button></div>
            <pre id="oct-source"><code>const message = "سلام دنیا";\n// توضیح فارسی\nconsole.log(message);</code></pre>
          </div>
          <div class="chatgpt-code-scrollport" dir="ltr"><code id="oct-technical-prose" class="whitespace-pre-wrap! block">فایل docs/ICON_PIPELINE.md را بررسی کن و سپس npm run build را اجرا کن.</code></div>
        </div>
        <div id="oct-actions" role="toolbar"><button>Copy response</button><span>Rate response</span></div>
      </div>
    </div>
    <form><div id="oct-composer" contenteditable="true" role="textbox">متن ویرایشگر BidiFix AI</div></form>
    <div class="whitespace-pre-wrap" id="oct-unrelated">متن رابط unrelated</div>
  `;
  fixtureRoot.append(main);
  return main;
}

test('detects October ChatGPT content roots without legacy author or article attributes', () => {
  const main = createOctoberConversation();
  const roots = findAssistantMessages(main, 'chatgpt');
  assertEqual(JSON.stringify(roots.map((root) => root.id)), JSON.stringify(['oct-assistant', 'oct-user']), 'ordered narrow message roots');
  const paragraph = requireElement('#oct-prose');
  assertEqual(findContainingAssistantMessage(paragraph, 'chatgpt')?.id, 'oct-assistant', 'streaming paragraph finds containing message');
  assertEqual(findContainingAssistantMessage(requireElement('#oct-actions'), 'chatgpt'), null, 'toolbar has no containing message');
});

test('renders October ChatGPT prose while preserving code, controls, editor, and text', () => {
  const main = createOctoberConversation();
  const originalText = main.textContent;
  findAssistantMessages(main, 'chatgpt').forEach((message) => applyBidiFix(message, options, 'chatgpt'));
  const prose = requireElement<HTMLElement>('#oct-prose');
  assertEqual(prose.dataset.bidifixDirection, 'rtl', 'new assistant prose is processed');
  assertEqual(getComputedStyle(prose).textAlign, 'right', 'Persian prose right alignment');
  assertEqual(getComputedStyle(prose).unicodeBidi, 'plaintext', 'Persian prose plaintext bidi');
  assert(prose.querySelector('[data-bidifix-inline-ltr="true"]'), 'technical English is isolated');
  expectRealCode(requireElement('#oct-source'), 'const message = "سلام دنیا";\n// توضیح فارسی\nconsole.log(message);');
  expectRtlProse(requireElement('#oct-technical-prose'), 'فایل docs/ICON_PIPELINE.md را بررسی کن و سپس npm run build را اجرا کن.', ['docs/ICON_PIPELINE.md', 'npm run build']);
  assertEqual(requireElement<HTMLElement>('#oct-inline').dir, 'ltr', 'inline token stays LTR');
  for (const id of ['oct-edit', 'oct-actions', 'oct-code-actions', 'oct-citation', 'oct-citation-wrapper', 'oct-composer', 'oct-unrelated']) {
    const control = requireElement<HTMLElement>(`#${id}`);
    assert(![control, ...control.querySelectorAll('*')].some((node) => [...node.attributes].some((attr) => attr.name.startsWith('data-bidifix'))), `${id} is untouched`);
  }
  assertEqual(main.querySelectorAll('[data-bidifix-line], [data-bidifix-composer]').length, 0, 'safe default markers');
  assertEqual(main.textContent, originalText, 'all logical characters preserved');
});

test('keeps October displayed user prompts free of inline wrappers in default mode', () => {
  const main = createOctoberConversation();
  const user = requireElement<HTMLElement>('#oct-user');
  const text = user.textContent;
  applyBidiFix(user, options, 'chatgpt');
  assertEqual(user.querySelector('p')?.dataset.bidifixDirection, 'rtl', 'displayed prompt direction');
  assertEqual(user.querySelectorAll('[data-bidifix-inline-ltr], [data-bidifix-line]').length, 0, 'no user prompt wrapping');
  assertEqual(user.textContent, text, 'prompt characters preserved');
  clearBidiFix(main);
});

test('repairs reconciled October assistant prose and restores native state on cleanup', () => {
  const main = createOctoberConversation();
  const message = requireElement<HTMLElement>('#oct-assistant');
  const paragraph = requireElement<HTMLElement>('#oct-prose');
  const text = paragraph.textContent;
  applyBidiFix(message, options, 'chatgpt');
  const count = paragraph.querySelectorAll('[data-bidifix-inline-ltr]').length;
  paragraph.textContent = text;
  const containing = findContainingAssistantMessage(paragraph, 'chatgpt');
  assertEqual(containing, message, 'reconciliation locates stable markdown root');
  applyBidiFix(containing as HTMLElement, options, 'chatgpt');
  assertEqual(paragraph.querySelectorAll('[data-bidifix-inline-ltr]').length, count, 'missing inline islands restored');
  applyBidiFix(message, options, 'chatgpt');
  assertEqual(paragraph.querySelectorAll('[data-bidifix-inline-ltr]').length, count, 'idempotent wrapping');
  clearBidiFix(main);
  assertEqual(paragraph.dir, 'auto', 'native direction restored');
  assertEqual(paragraph.textContent, text, 'cleanup preserves text');
  assertEqual(main.querySelectorAll('[data-bidifix-message], [data-bidifix-direction], [data-bidifix-inline-ltr]').length, 0, 'cleanup removes all rendering state');
});

test('preserves legacy ChatGPT roots and the current plain user-text fallback', () => {
  const main = document.createElement('main');
  main.innerHTML = `
    <article data-testid="conversation-turn-legacy">
      <div id="legacy-assistant" data-message-author-role="assistant"><p>متن BidiFix AI</p></div>
      <div id="legacy-user" data-message-author-role="user"><div class="whitespace-pre-wrap">متن کاربر</div></div>
    </article>
    <div data-user-message-bubble="true"><div id="plain-user" class="whitespace-pre-wrap">متن ساده کاربر</div></div>
    <aside><div data-markdown-text-style="assistant-message">متن خارج از گفتگو</div></aside>
  `;
  fixtureRoot.append(main);
  const roots = findAssistantMessages(main, 'chatgpt');
  assert(roots.some((root) => root.id === 'legacy-assistant'), 'legacy assistant detected');
  assert(roots.some((root) => root.id === 'legacy-user'), 'legacy user detected');
  assert(roots.some((root) => root.id === 'plain-user'), 'plain user fallback detected');
  assert(!roots.some((root) => root.closest('aside')), 'non-conversation content excluded');
  roots.forEach((root) => applyBidiFix(root, options, 'chatgpt'));
  assertEqual(requireElement<HTMLElement>('#plain-user').dataset.bidifixDirection, 'rtl', 'plain prompt RTL');
  assertEqual(requireElement('#legacy-user').querySelectorAll('[data-bidifix-inline-ltr], [data-bidifix-line]').length, 0, 'legacy user remains unwrapped');
});

test('keeps Claude detection and rendering unchanged with the ChatGPT compatibility fix', () => {
  const main = document.createElement('main');
  main.innerHTML = `<div data-testid="assistant-message" class="font-claude-message"><div class="prose"><p id="claude-prose">فایل src/content/detector.ts را برای BidiFix AI بررسی کن.</p><pre id="claude-source"><code>const message = "سلام";\nconsole.log(message);</code></pre></div></div>`;
  fixtureRoot.append(main);
  const originalText = main.textContent;
  const roots = findAssistantMessages(main, 'claude');
  assert(roots.length > 0, 'Claude prose detected');
  roots.forEach((root) => applyBidiFix(root, options, 'claude'));
  const prose = requireElement<HTMLElement>('#claude-prose');
  assertEqual(prose.dataset.bidifixDirection, 'rtl', 'Claude paragraph RTL');
  assert(prose.querySelector('[data-bidifix-inline-ltr="true"]'), 'Claude English isolated');
  expectRealCode(requireElement('#claude-source'), 'const message = "سلام";\nconsole.log(message);');
  assertEqual(main.textContent, originalText, 'Claude characters preserved');
  assertEqual(main.querySelectorAll('[data-bidifix-line], [data-bidifix-composer]').length, 0, 'Claude safe defaults');
});

function createReportedInlineProse(): { main: HTMLElement; message: HTMLElement; paragraph: HTMLElement } {
  const main = document.createElement('main');
  // Sanitized native inline structure supplied by manual live DevTools inspection.
  // The Worked-for control precedes the response; it is not the prose owner.
  main.innerHTML = `<button id="worked-for">Worked for 3m 46s</button>
    <div id="reported-message" data-markdown-text-style="assistant-message" dir="auto">
      <p id="reported-paragraph" dir="auto"><strong><span>swap</span><bdi>این سرور هنوز بررسی نشده است.</bdi></strong><span> محدودیت فعلی backend برابر </span><strong><span>۰٫۳ هسته و </span><bdi>۳۸۴MiB RAM</bdi></strong><span> است؛ مصرفش حدود ۷۳MiB بود. فعلاً دلیلی برای افزایش منابع یا افزودن swap نداریم.</span></p>
      <p>مصرف <span>RAM</span> حدود <bdi>338MiB</bdi> است و محدودیت فعلی backend هنوز بررسی نشده است.</p>
      <p>swap حدود 32MiB بود و فعلاً دلیلی برای افزایش منابع نداریم.</p>
      <p>healthcheck در Docker باید موفق شود و Supervisor فقط backend را جایگزین می‌کند. فایل src/content/bidi.ts و دستور npm run build و https://claude.ai را بررسی کن.<span id="reported-citation"><a data-testid="chatgpt-citation" href="https://example.com">Source</a></span></p>
      <pre id="reported-source"><code>const message = "سلام";\n// توضیح فارسی\nconsole.log(message);</code></pre>
      <div dir="ltr"><code id="reported-plain" class="whitespace-pre-wrap! block">فایل docs/ICON_PIPELINE.md را بررسی کن و سپس npm run build را اجرا کن.</code></div>
    </div>
    <form><div contenteditable="true" role="textbox">متن ویرایشگر backend</div></form>`;
  fixtureRoot.append(main);
  return { main, message: requireElement('#reported-message'), paragraph: requireElement('#reported-paragraph') };
}

test('ChatGPT semantic prose owns direction instead of its nested formatting spans', () => {
  const { main, message, paragraph } = createReportedInlineProse();
  const text = main.textContent;
  const nativeBdis = [...paragraph.querySelectorAll('bdi')];
  assertEqual(findContainingAssistantMessage(paragraph, 'chatgpt'), message, 'prose belongs to normal assistant markdown');
  applyBidiFix(message, options, 'chatgpt');
  assertEqual(paragraph.dir, 'rtl', 'paragraph owns RTL direction');
  assertEqual(getComputedStyle(paragraph).direction, 'rtl', 'computed paragraph direction');
  assertEqual(getComputedStyle(paragraph).unicodeBidi, 'plaintext', 'computed paragraph bidi');
  assertEqual(getComputedStyle(paragraph).textAlign, 'right', 'computed paragraph alignment');
  paragraph.querySelectorAll<HTMLElement>('span').forEach((span) => {
    assertEqual(span.hasAttribute('data-bidifix-direction'), false, 'formatting span has no independent direction');
    assertEqual(span.hasAttribute('dir'), false, 'formatting span inherits paragraph direction');
    assertEqual(getComputedStyle(span).direction, 'rtl', 'formatting span inherits RTL');
  });
  const islands = [...message.querySelectorAll<HTMLElement>('[data-bidifix-inline-ltr]')];
  for (const word of ['swap', 'backend', 'RAM', 'healthcheck', 'Docker', 'Supervisor', 'src/content/bidi.ts', 'npm run build', 'https://claude.ai']) {
    assert(islands.some((island) => island.textContent === word), `English technical island: ${word}`);
  }
  islands.forEach((island) => {
    assertEqual(getComputedStyle(island).direction, 'ltr', 'English island LTR');
    assertEqual(getComputedStyle(island).unicodeBidi, 'isolate', 'English island isolated');
  });
  expectRealCode(requireElement('#reported-source'), 'const message = "سلام";\n// توضیح فارسی\nconsole.log(message);');
  expectRtlProse(requireElement('#reported-plain'), 'فایل docs/ICON_PIPELINE.md را بررسی کن و سپس npm run build را اجرا کن.', ['docs/ICON_PIPELINE.md', 'npm run build']);
  assertEqual(main.querySelectorAll('[data-bidifix-line], [data-bidifix-composer]').length, 0, 'safe default markers');
  assertEqual(requireElement('#reported-citation').querySelectorAll('[data-bidifix-direction], [data-bidifix-inline-ltr]').length, 0, 'citation stays untouched');
  assertEqual(requireElement('#worked-for').hasAttribute('data-bidifix-direction'), false, 'Worked-for control is untouched');
  assertEqual(main.textContent, text, 'text characters unchanged');
  const selection = document.createRange();
  selection.selectNodeContents(paragraph);
  assertEqual(selection.toString(), paragraph.textContent, 'selection/copy text unchanged');
  const html = message.innerHTML;
  applyBidiFix(message, options, 'chatgpt');
  assertEqual(message.innerHTML, html, 'unchanged rendering is idempotent');
  message.querySelectorAll<HTMLElement>('[data-bidifix-inline-ltr]').forEach((island) => island.replaceWith(document.createTextNode(island.textContent ?? '')));
  applyBidiFix(message, options, 'chatgpt');
  assertEqual(message.innerHTML, html, 'reconciliation restores islands without formatting-span directions');
  clearBidiFix(main);
  assertEqual(paragraph.dir, 'auto', 'cleanup restores native paragraph dir');
  assertEqual(main.textContent, text, 'cleanup preserves text');
  assert(nativeBdis.every((bdi) => paragraph.contains(bdi)), 'cleanup retains native bdi elements');
  assertEqual(main.querySelectorAll('[data-bidifix-direction], [data-bidifix-inline-ltr], [data-bidifix-technical], [data-bidifix-message], [data-ai-bidi-original-dir]').length, 0, 'cleanup removes extension state');
});

for (const [name, content, direction] of [
  ['direct text', 'متن backend', 'rtl'],
  ['native bdi child', '<bdi>swap</bdi>', 'ltr'],
  ['formatting child', '<strong>متن backend</strong>', 'rtl'],
] as const) test(`restores a managed ChatGPT span with ${name} reused inside a semantic paragraph`, () => {
  const message = createMessage();
  const span = document.createElement('span');
  span.dir = 'auto';
  span.innerHTML = content;
  message.append(span);
  applyBidiFix(message, options, 'chatgpt');
  assertEqual(span.dataset.bidifixDirection, direction, 'bare streaming span initially owns direction');
  const paragraph = document.createElement('p');
  paragraph.append('متن فارسی ', span);
  message.append(paragraph);
  const text = message.textContent;
  applyBidiFix(message, options, 'chatgpt');
  assertEqual(paragraph.dataset.bidifixDirection, 'rtl', 'new paragraph owns direction');
  assertEqual(span.hasAttribute('data-bidifix-direction'), false, 'reused span loses independent direction');
  assertEqual(span.dir, 'auto', 'reused span restores its native dir');
  assertEqual(span.hasAttribute('data-ai-bidi-original-dir'), false, 'managed original-dir state is removed');
  assertEqual(span.hasAttribute('data-bidifix-processed-version'), false, 'stale processing signature is removed');
  assertEqual(span.hasAttribute('data-bidifix-text-signature'), false, 'stale text signature is removed');
  assertEqual(span.hasAttribute('data-bidifix-processed'), false, 'stale processed marker is removed');
  assertEqual(span.querySelectorAll('[data-bidifix-inline-ltr]').length, 1, 'existing English island is retained without duplication');
  assertEqual(message.textContent, text, 'reparenting preserves text');
  const html = message.innerHTML;
  applyBidiFix(message, options, 'chatgpt');
  assertEqual(message.innerHTML, html, 'reparented rendering is idempotent');
  clearBidiFix(fixtureRoot);
  assertEqual(message.textContent, text, 'reparented cleanup preserves text');
  assertEqual(span.dir, 'auto', 'cleanup keeps native span direction');
});

test('ChatGPT semantic span ownership applies to lists, headings, quotes, and table cells', () => {
  const message = createMessage();
  message.innerHTML = '<ul><li><span>متن backend</span></li></ul><h2><span>متن Docker</span></h2><blockquote><span>متن swap</span></blockquote><table><tbody><tr><th><span>متن RAM</span></th><td><span class="whitespace-pre-wrap">متن Supervisor</span></td></tr></tbody></table><p>متن <span class="font-mono">فایل README.md را بررسی کن.</span></p>';
  const text = message.textContent;
  applyBidiFix(message, options, 'chatgpt');
  message.querySelectorAll<HTMLElement>('li, h2, blockquote, th, td').forEach((owner) => {
    assertEqual(owner.dataset.bidifixDirection, 'rtl', 'semantic owner RTL');
    const span = owner.querySelector('span');
    assert(span, 'formatting span exists');
    assertEqual(span.hasAttribute('data-bidifix-direction'), false, 'formatting span has no independent direction even when matching whitespace selector');
    assertEqual(span.hasAttribute('dir'), false, 'formatting span has no generated dir');
    assertEqual(getComputedStyle(span).direction, 'rtl', 'formatting span inherits owner direction');
  });
  expectRtlProse(message.querySelector<HTMLElement>('.font-mono') as HTMLElement, 'فایل README.md را بررسی کن.', ['README.md']);
  assertEqual(message.textContent, text, 'all semantic and code-like characters preserved');
});

test('isolates compact memory quantities including ASCII, Persian, and Arabic digits as whole tokens', () => {
  const message = createMessage();
  const paragraph = document.createElement('p');
  const text = 'مصرف 338MiB و 32MiB و 73MiB و 384MiB RAM و ۳۸۴MiB و ۷۳MiB و ٣٨٤MiB است؛ شماره ۳۸۴ و ۳۲، مقدار ۰٫۳ هسته است.';
  paragraph.textContent = text;
  message.append(paragraph);
  applyBidiFix(message, options, 'chatgpt');
  const expected = ['338MiB', '32MiB', '73MiB', '384MiB RAM', '۳۸۴MiB', '۷۳MiB', '٣٨٤MiB'];
  const islands = [...paragraph.querySelectorAll<HTMLElement>('[data-bidifix-inline-ltr]')];
  assertEqual(JSON.stringify(islands.map((island) => island.textContent)), JSON.stringify(expected), 'only complete technical quantities are isolated in order');
  islands.forEach((island) => {
    const node = island.firstChild;
    assert(node instanceof Text, 'quantity is a single text node inside its island');
    const unitStart = node.data.indexOf('MiB');
    const digits = document.createRange();
    digits.setStart(node, 0);
    digits.setEnd(node, unitStart);
    const unit = document.createRange();
    unit.setStart(node, unitStart);
    unit.setEnd(node, unitStart + 3);
    assert(digits.getBoundingClientRect().left < unit.getBoundingClientRect().left, 'digits visually precede unit inside LTR island');
  });
  assertEqual(paragraph.textContent, text, 'number characters and punctuation preserved');
  const html = paragraph.innerHTML;
  applyBidiFix(message, options, 'chatgpt');
  assertEqual(paragraph.innerHTML, html, 'quantity rendering is idempotent');
  clearBidiFix(fixtureRoot);
  assertEqual(paragraph.textContent, text, 'quantity cleanup preserves text');
});

test('preserves ChatGPT standalone spans and Claude nested/bare streaming span processing', () => {
  for (const site of ['chatgpt', 'claude'] as const) {
    const message = createMessage();
    message.innerHTML = '<span id="bare">متن backend</span><p><strong><span id="formatted">متن Docker</span></strong></p>';
    applyBidiFix(message, options, site);
    assertEqual(requireElement<HTMLElement>('#bare').dataset.bidifixDirection, 'rtl', `${site} bare span remains processed`);
    assertEqual(requireElement<HTMLElement>('#formatted').dataset.bidifixDirection, site === 'claude' ? 'rtl' : undefined, `${site} contextual formatting span behavior`);
    assertEqual(message.querySelectorAll('[data-bidifix-inline-ltr]').length, 2, `${site} English isolation remains available`);
    clearBidiFix(fixtureRoot);
    message.remove();
  }
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
