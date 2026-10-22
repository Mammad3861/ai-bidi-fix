import { chatGptAdapter } from '../src/content/adapters/chatgpt';
import { claudeAdapter } from '../src/content/adapters/claude';
import {
  findSiteAdapter,
  getSiteAdapter,
  SITE_ADAPTERS,
} from '../src/content/adapters/registry';
import {
  findAssistantMessages,
  findComposers,
  findContainingAssistantMessage,
  findContainingComposer,
} from '../src/content/detector';
import type { BlockCandidate, DetectedRegion } from '../src/content/detection/types';
import { getCurrentSite } from '../src/shared/sites';

interface DetectorTestResult {
  name: string;
  passed: boolean;
  error?: string;
}

declare global {
  interface Window {
    __bidifixDetectorTestResults: DetectorTestResult[];
  }
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Detector fixture is missing ${selector}.`);
  return element;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertIds(elements: readonly HTMLElement[], expected: readonly string[], message: string): void {
  const actual = elements.map((element) => element.id);
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), message);
}

function assertRegionIds(
  regions: readonly DetectedRegion[],
  expected: readonly string[],
  message: string,
): void {
  assertIds(
    regions.map((region) => region.root),
    expected,
    message,
  );
}

function assertBlockIds(
  candidates: readonly BlockCandidate[],
  expected: readonly string[],
  message: string,
): void {
  assertIds(
    candidates.map((candidate) => candidate.element),
    expected,
    message,
  );
}

const fixtureRoot = requireElement<HTMLElement>('#fixtures');
const resultList = requireElement<HTMLOListElement>('#results');
const summary = requireElement<HTMLElement>('#summary');
const results: DetectorTestResult[] = [];

function resetFixture(html: string): string {
  fixtureRoot.innerHTML = html;
  return fixtureRoot.innerHTML;
}

function assertDetectionOnly(before: string): void {
  assertEqual(fixtureRoot.innerHTML, before, 'detection leaves fixture DOM unchanged');
  assertEqual(
    fixtureRoot.querySelectorAll(
      '[data-bidifix-direction], [data-bidifix-inline-ltr], [data-bidifix-line], [data-bidifix-processed], [data-bidifix-site]',
    ).length,
    0,
    'detection creates no rendering markers',
  );
}

function test(name: string, run: () => void): void {
  try {
    run();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) });
  }
}

test('ChatGPT regions preserve selector order, roles, exclusions, containment, and facade parity', () => {
  const before = resetFixture(`
    <main id="cg-main">
      <article data-testid="conversation-turn-1">
        <div id="cg-assistant" data-message-author-role="assistant">Assistant response</div>
      </article>
      <article data-testid="conversation-turn-2">
        <div id="cg-user" data-message-author-role="user">
          <div id="cg-user-fallback" class="whitespace-pre-wrap">Displayed user prompt<span id="cg-nested"></span></div>
        </div>
      </article>
      <article data-testid="conversation-turn-3">
        <div id="cg-turn-fallback" class="whitespace-pre-wrap">Conversation fallback</div>
      </article>
      <form><div id="prompt-textarea" data-message-author-role="assistant" contenteditable="true">Prompt editor content</div></form>
      <nav><div id="cg-nav-content" data-message-author-role="assistant">Navigation content</div></nav>
      <div role="dialog"><div id="cg-dialog-content" data-message-author-role="assistant">Dialog content</div></div>
      <button><span id="cg-button-content" data-message-author-role="assistant">Button content</span></button>
    </main>
    <div id="cg-outside" data-message-author-role="assistant">Outside main</div>
  `);

  const expected = ['cg-assistant', 'cg-user', 'cg-user-fallback', 'cg-turn-fallback'];
  const regions = chatGptAdapter.findRegions(document);
  assertRegionIds(regions, expected, 'ChatGPT ordered regions');
  assertIds(findAssistantMessages(document, 'chatgpt'), expected, 'ChatGPT facade ordered roots');
  assertEqual(new Set(regions.map((region) => region.root)).size, expected.length, 'duplicates deduplicated');
  assertEqual(regions[0]?.role, 'assistant', 'assistant role metadata');
  assertEqual(regions[1]?.role, 'user', 'displayed user role metadata');
  assertEqual(regions[2]?.role, 'user', 'user fallback role metadata');
  assertEqual(regions[3]?.role, 'unknown', 'conversation fallback role metadata');
  assertEqual(regions[0]?.source, 'adapter', 'adapter source metadata');

  const nested = requireElement('#cg-nested');
  assertRegionIds(chatGptAdapter.findRegions(nested), [], 'nested ChatGPT mutation root has no duplicate region');
  assertEqual(
    chatGptAdapter.findContainingRegion(nested)?.root.id,
    'cg-user-fallback',
    'nested containing-region lookup',
  );
  assertEqual(
    findContainingAssistantMessage(nested, 'chatgpt')?.id,
    'cg-user-fallback',
    'facade containing-region lookup',
  );
  assertDetectionOnly(before);
});

test('released ChatGPT semantic roots retain roles, exclusions, ownership, and facade parity', () => {
  const before = resetFixture(`
    <main>
      <div id="modern-assistant" data-markdown-text-style="assistant-message">
        <p id="modern-owner">متن <span id="modern-format">backend</span></p>
        <div role="toolbar"><span id="modern-action">Copy</span></div>
      </div>
      <div data-user-message-bubble="true">
        <div class="whitespace-pre-wrap"><div id="modern-user" data-markdown-text-tone="user-message"><p>متن کاربر</p></div></div>
      </div>
      <div role="toolbar"><div data-markdown-text-style="assistant-message">Control</div></div>
      <form><div contenteditable="true" data-markdown-text-style="assistant-message">Editor</div></form>
    </main>
  `);
  const regions = chatGptAdapter.findRegions(document);
  assertRegionIds(regions, ['modern-assistant', 'modern-user'], 'narrow modern roots in release order');
  assertIds(findAssistantMessages(document, 'chatgpt'), ['modern-assistant', 'modern-user'], 'modern facade parity');
  assertEqual(regions[0]?.role, 'assistant', 'semantic assistant role');
  assertEqual(regions[1]?.role, 'user', 'bubble user role');
  assertEqual(regions[1]?.compatibility.inlineIsolation, 'experimental-only', 'modern user stays opt-in');
  const span = requireElement<HTMLElement>('#modern-format');
  assertEqual(chatGptAdapter.findContainingRegion(span)?.root.id, 'modern-assistant', 'modern streaming containment');
  const blocks = chatGptAdapter.findBlocks(regions[0] as DetectedRegion);
  assertEqual(blocks.find((candidate) => candidate.element === span)?.directionOwner?.id, 'modern-owner', 'formatting owner is metadata, not a mutation');
  const excluded = regions[0]?.compatibility.excludedContentSelector;
  assert(excluded, 'adapter supplies release exclusion policy');
  assert(requireElement('#modern-action').closest(excluded), 'toolbar text is excluded');
  assertDetectionOnly(before);
});

test('ChatGPT blocks and composers preserve ordering and compatibility metadata', () => {
  const before = resetFixture(`
    <main>
      <article data-testid="conversation-turn-1">
        <div id="cg-block-region" data-message-author-role="assistant">
          <p id="cg-block-p">پاسخ با README</p>
          <div id="cg-block-direct">متن مستقیم</div>
          <span id="cg-block-leaf"><em>متن برگ</em></span>
        </div>
      </article>
      <form id="cg-composer-form">
        <div id="prompt-textarea" contenteditable="true"><span id="cg-composer-child"></span></div>
        <textarea id="cg-textarea"></textarea>
        <input id="cg-prompt-input" type="text" placeholder="Ask anything" />
        <input id="cg-false-input" type="text" />
      </form>
      <div id="cg-false-editor" contenteditable="true"></div>
    </main>
  `);

  const assistantRegion = chatGptAdapter.describeRegion(requireElement('#cg-block-region'));
  const blocks = chatGptAdapter.findBlocks(assistantRegion);
  assertBlockIds(
    blocks,
    ['cg-block-p', 'cg-block-direct', 'cg-block-leaf'],
    'ChatGPT ordered block candidates',
  );
  assertEqual(blocks[0]?.hint, 'prose', 'paragraph structural hint');
  assertEqual(blocks[1]?.hint, 'unknown', 'direct div structural hint');
  assertEqual(blocks[2]?.priority, 2, 'block priority preserves order');
  assert(blocks.every((candidate) => !candidate.editable && candidate.structurallySafe), 'safe block metadata');

  const user = document.createElement('div');
  user.dataset.messageAuthorRole = 'user';
  const userRegion = chatGptAdapter.describeRegion(user);
  assertEqual(
    userRegion.compatibility.inlineIsolation,
    'experimental-only',
    'displayed-user inline-isolation restriction metadata',
  );
  assertEqual(
    assistantRegion.compatibility.inlineIsolation,
    'default',
    'assistant inline-isolation metadata',
  );

  const expectedComposers = ['prompt-textarea', 'cg-textarea', 'cg-prompt-input'];
  assertIds(chatGptAdapter.findComposers(document), expectedComposers, 'ChatGPT ordered composers');
  assertIds(findComposers(document, 'chatgpt'), expectedComposers, 'ChatGPT composer facade parity');
  const child = requireElement('#cg-composer-child');
  assertEqual(
    chatGptAdapter.findContainingComposer(child)?.id,
    'prompt-textarea',
    'ChatGPT containing composer',
  );
  assertEqual(
    findContainingComposer(child, 'chatgpt')?.id,
    'prompt-textarea',
    'ChatGPT containing composer facade parity',
  );
  assertDetectionOnly(before);
});

test('Claude regions preserve direct RTL preference, parent inclusion, exclusions, and facade parity', () => {
  const before = resetFixture(`
    <main id="cl-main">
      <p id="cl-direct">متن مستقیم فارسی</p>
      <div id="cl-semantic" data-testid="assistant-message">پاسخ معنایی<em id="cl-semantic-child"></em></div>
      <div id="cl-streaming" data-is-streaming="true">پاسخ در حال پخش</div>
      <div id="cl-parent"><span id="cl-child">متن فرزند فارسی</span></div>
      <p id="cl-non-rtl">English only</p>
      <form><div id="cl-form-content">متن فرم</div></form>
      <div contenteditable="true"><span id="cl-editor-content">متن ویرایشگر</span></div>
      <div role="dialog"><p id="cl-dialog-content">متن گفتگو</p></div>
      <nav><p id="cl-nav-content">متن ناوبری</p></nav>
      <pre><span id="cl-pre-content">متن پیش‌قالب</span></pre>
      <code><span id="cl-code-content">متن کد</span></code>
    </main>
    <p id="cl-outside">متن بیرون</p>
  `);

  const expected = ['cl-direct', 'cl-semantic', 'cl-streaming', 'cl-child', 'cl-parent'];
  const regions = claudeAdapter.findRegions(document);
  assertRegionIds(regions, expected, 'Claude ordered regions');
  assertIds(findAssistantMessages(document, 'claude'), expected, 'Claude facade ordered roots');
  assertEqual(new Set(regions.map((region) => region.root)).size, expected.length, 'Claude duplicates deduplicated');
  assertEqual(regions[1]?.role, 'assistant', 'Claude semantic assistant role');
  assertEqual(regions[2]?.sourceId, 'claude:streaming-message', 'Claude streaming source metadata');
  assertEqual(
    regions[1]?.compatibility.messageSiteMarker,
    'claude',
    'Claude CSS-scope marker metadata',
  );

  const nested = requireElement('#cl-semantic-child');
  assertRegionIds(claudeAdapter.findRegions(nested), [], 'nested Claude mutation root has no duplicate region');
  assertEqual(
    claudeAdapter.findContainingRegion(nested)?.root.id,
    'cl-semantic',
    'Claude nested containing-region lookup',
  );
  assertEqual(
    findContainingAssistantMessage(nested, 'claude')?.id,
    'cl-semantic',
    'Claude containing-region facade parity',
  );
  assertDetectionOnly(before);
});

test('Claude smallest-candidate fallback remains unchanged', () => {
  const before = resetFixture(`
    <main>
      <article id="cl-large"><div id="cl-small"><em id="cl-small-child">متن فارسی</em></div></article>
    </main>
  `);

  assertRegionIds(claudeAdapter.findRegions(document), ['cl-small'], 'Claude smallest RTL fallback');
  const child = requireElement('#cl-small-child');
  assertEqual(
    claudeAdapter.findContainingRegion(child)?.root.id,
    'cl-small',
    'Claude fallback containing region',
  );
  assertDetectionOnly(before);
});

test('Claude blocks and composers preserve compatibility collection and validation', () => {
  const before = resetFixture(`
    <main>
      <div id="cl-block-region" data-testid="assistant-message">
        <p id="cl-block-p">پاسخ با API</p>
        <div id="cl-block-direct">متن مستقیم</div>
        <span id="cl-block-leaf"><em>متن برگ</em></span>
      </div>
      <form>
        <textarea id="cl-textarea"></textarea>
        <div id="cl-form-editor" contenteditable="true"></div>
        <input id="cl-ask-input" type="text" aria-label="Ask Claude" />
      </form>
      <div id="cl-prosemirror" class="ProseMirror" contenteditable="true"><span id="cl-composer-child"></span></div>
      <div id="cl-placeholder" role="textbox" data-placeholder="Reply"></div>
      <div id="cl-false-editor" contenteditable="true"></div>
    </main>
  `);

  const region = claudeAdapter.describeRegion(requireElement('#cl-block-region'));
  const blocks = claudeAdapter.findBlocks(region);
  assertBlockIds(
    blocks,
    ['cl-block-p', 'cl-block-direct', 'cl-block-leaf'],
    'Claude direct-div and leaf-span block order',
  );
  assertEqual(region.role, 'assistant', 'Claude block region role');
  assertEqual(region.compatibility.messageSiteMarker, 'claude', 'Claude message marker metadata');

  const expectedComposers = [
    'cl-textarea',
    'cl-form-editor',
    'cl-ask-input',
    'cl-prosemirror',
    'cl-placeholder',
  ];
  assertIds(claudeAdapter.findComposers(document), expectedComposers, 'Claude ordered composers');
  assertIds(findComposers(document, 'claude'), expectedComposers, 'Claude composer facade parity');
  const child = requireElement('#cl-composer-child');
  assertEqual(
    claudeAdapter.findContainingComposer(child)?.id,
    'cl-prosemirror',
    'Claude ProseMirror containing composer',
  );
  assertEqual(
    findContainingComposer(child, 'claude')?.id,
    'cl-prosemirror',
    'Claude containing composer facade parity',
  );
  assertDetectionOnly(before);
});

test('registry supports only the four existing hostnames with no generic fallback', () => {
  resetFixture('');
  const locationFor = (hostname: string): Pick<Location, 'hostname' | 'pathname'> => ({
    hostname,
    pathname: '/',
  });

  const expectedSites = new Map([
    ['chatgpt.com', 'chatgpt'],
    ['chat.openai.com', 'chatgpt'],
    ['claude.ai', 'claude'],
    ['www.claude.ai', 'claude'],
  ]);
  expectedSites.forEach((site, hostname) => {
    assertEqual(findSiteAdapter(locationFor(hostname))?.id, site, `${hostname} adapter`);
    assertEqual(getCurrentSite(hostname), site, `${hostname} shared site mapping`);
  });

  assertEqual(findSiteAdapter(locationFor('example.com')), null, 'unsupported host has no adapter');
  assertEqual(getCurrentSite('example.com'), null, 'unsupported host has no shared site');
  assertEqual(getSiteAdapter('chatgpt')?.id, 'chatgpt', 'ChatGPT ID lookup');
  assertEqual(getSiteAdapter('claude')?.id, 'claude', 'Claude ID lookup');
  assertEqual(
    JSON.stringify(SITE_ADAPTERS.map((adapter) => adapter.id)),
    JSON.stringify(['chatgpt', 'claude']),
    'registry contains optimized adapters only',
  );
  assertEqual(fixtureRoot.querySelectorAll('[data-bidifix-processed]').length, 0, 'registry does not render');
});

window.__bidifixDetectorTestResults = results;
results.forEach((result) => {
  const item = document.createElement('li');
  item.className = result.passed ? 'pass' : 'fail';
  item.textContent = result.passed ? `PASS: ${result.name}` : `FAIL: ${result.name} — ${result.error}`;
  resultList.append(item);
});

const passed = results.filter((result) => result.passed).length;
summary.textContent = `${passed}/${results.length} detector adapter tests passed.`;
summary.className = passed === results.length ? 'pass' : 'fail';
