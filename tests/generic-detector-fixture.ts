import { genericWebDetector, GENERIC_WEB_LIMITS } from '../src/content/detection/generic-web';

interface TestResult { name: string; passed: boolean; error?: string }

declare global {
  interface Window { __bidifixGenericDetectorTestResults: TestResult[] }
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing fixture element ${selector}`);
  return element;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

const fixtures = requireElement<HTMLElement>('#fixtures');
const results: TestResult[] = [];

function test(name: string, run: () => void): void {
  fixtures.replaceChildren();
  try {
    run();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function ids(root: ParentNode): string[] {
  return genericWebDetector.findRegions(root).map((region) => region.root.id);
}

function watchStyles(root: HTMLElement, run: (seen: Set<Element>) => void): void {
  const original = window.getComputedStyle;
  const seen = new Set<Element>();
  window.getComputedStyle = (element, pseudo) => {
    if (root.contains(element)) seen.add(element);
    return original.call(window, element, pseudo);
  };
  try { run(seen); } finally { window.getComputedStyle = original; }
}

test('discovers Persian, Arabic, English-first, Latin-only, and neutral semantic prose in document order', () => {
  fixtures.innerHTML = `<article><h1 id="heading">A mixed article</h1>
    <p id="persian">فایل README را برای BidiFix AI بررسی کن.</p>
    <p id="arabic">هذا شرح عربي مع API و DOM.</p>
    <p id="english-first">Build the extension first. سپس دستور npm run build را اجرا کن.</p>
    <h2 id="subheading">Next steps</h2><p id="english">Ordinary English prose is safe too.</p>
    <p id="numbers">123 ؟!</p><p id="blank"> \n\t </p></article>
    <article id="bare-article"><div>مقاله با <strong>formatting</strong> و بدون پاراگراف.</div></article>`;
  const expected = ['heading', 'persian', 'arabic', 'english-first', 'subheading', 'english', 'numbers', 'bare-article'];
  equal(ids(fixtures), expected, 'readable regions');
  equal(ids(fixtures), expected, 'deterministic repeated discovery');
  genericWebDetector.findRegions(fixtures).forEach((region, index) => {
    equal(region.source, 'generic', 'source contract');
    equal(region.priority, index, 'document-order priority');
    const blocks = genericWebDetector.findBlocks(region);
    equal(blocks.map((block) => block.element.id), [expected[index]], 'one noncompeting block per discovered region');
    assert(blocks.every((block) => block.structurallySafe && !block.editable && block.region === region), 'safe candidate metadata');
  });
});

test('nested formatting, lists, quotes, and table cells never compete with their ancestors', () => {
  fixtures.innerHTML = `<article id="outer-article">
    <p id="formatted">متن <strong><span>backend</span></strong> و <em>English</em> <a href="https://example.com">reference</a></p>
    <ul><li id="list-direct">متن list</li><li id="list-parent">مقدمه<ul><li id="list-child">جزئیات</li></ul></li>
      <li id="list-wrapper"><p id="list-paragraph">متن API</p></li></ul>
    <blockquote id="quote-parent"><p id="quote-child">متن quote</p></blockquote>
    <blockquote id="quote-direct">نقل قول مستقیم</blockquote>
    <table><thead><tr><th id="table-heading">Title</th></tr></thead>
      <tbody><tr><td id="table-direct">متن cell</td><td id="cell-parent"><p id="cell-child">شرح</p></td></tr></tbody></table>
    <dl><dt id="term">API</dt><dd id="definition">شرح API</dd></dl>
  </article>`;
  const regions = genericWebDetector.findRegions(fixtures);
  equal(regions.map((region) => region.root.id), ['formatted', 'list-direct', 'list-child', 'list-paragraph', 'quote-child', 'quote-direct', 'table-heading', 'table-direct', 'cell-child', 'term', 'definition'], 'smallest semantic owners');
  regions.forEach((left) => regions.forEach((right) => {
    if (left !== right) assert(!left.root.contains(right.root), 'no ancestor/descendant candidates share text');
  }));
});

test('prunes navigation, controls, dialogs, forms, editors, code, and hidden descendants', () => {
  const wrappers = [
    '<nav>', '<aside>', '<div role="navigation">', '<div role="toolbar">',
    '<div role="dialog">', '<dialog open>', '<button>', '<div role="button">',
    '<form>', '<label>', '<select>', '<div role="textbox">',
    '<div contenteditable="true">', '<div contenteditable="">', '<div contenteditable="plaintext-only">',
    '<div class="ProseMirror">', '<div class="monaco-editor">', '<div class="CodeMirror">', '<div class="cm-editor">',
    '<pre>', '<code>', '<kbd>', '<samp>', '<var>',
    '<div hidden>', '<div aria-hidden="true">', '<div inert>',
    '<div class="css-hidden">', '<div class="css-invisible">',
    '<div style="opacity:0">', '<div style="content-visibility:hidden">',
  ];
  wrappers.forEach((opening, index) => {
    const container = document.createElement('div');
    container.innerHTML = `${opening}<p id="excluded-${index}">متن hidden English</p>`;
    fixtures.append(container);
  });
  const safe = document.createElement('p');
  safe.id = 'safe';
  safe.textContent = 'Visible متن';
  fixtures.append(safe);
  equal(ids(fixtures), ['safe'], 'only visible noninteractive prose survives');
});

test('rejects mixed safe/unsafe parent blocks without suppressing separate safe children', () => {
  fixtures.innerHTML = `<article>
    <p id="button-parent">شرح <button>Send</button></p>
    <p id="inline-code-parent">شرح <code>const value = 1;</code></p>
    <p id="hidden-parent">Visible <span hidden>Hidden</span></p>
    <div contenteditable="true"><div contenteditable="false"><p id="editor-child">Not an escape</p></div></div>
    <p id="safe-after">شرح مستقل DOM</p>
    <pre><code>const message = "سلام";\nconsole.log(message);</code></pre>
  </article>`;
  equal(ids(fixtures), ['safe-after'], 'unsafe descendants poison only their candidate ancestors');
  equal(genericWebDetector.findContainingRegion(requireElement('#editor-child')), null, 'editable ancestor wins');
});

test('excludes interactive ARIA widgets even without native controls or editable attributes', () => {
  for (const role of ['tab', 'searchbox', 'treeitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'scrollbar', 'grid', 'treegrid', 'tree', 'radiogroup']) {
    const widget = document.createElement('div');
    widget.setAttribute('role', role);
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Widget متن';
    widget.append(paragraph); fixtures.append(widget);
  }
  equal(ids(fixtures), [], 'widget descendants are never readable article candidates');
});

test('excludes document-level designMode editors without contenteditable attributes', () => {
  fixtures.innerHTML = '<p id="design-editor">Editable متن</p>';
  const mode = document.designMode;
  try {
    document.designMode = 'on';
    equal(ids(fixtures), [], 'design-mode document is excluded');
    equal(genericWebDetector.findContainingRegion(requireElement('#design-editor')), null, 'design-mode containing lookup excluded');
  } finally { document.designMode = mode; }
});

test('handles Document, matching roots, subtrees, fragments, and containing lookups without widening scope', () => {
  fixtures.innerHTML = '<article><p id="first">متن <span id="inline">English</span></p><p id="second">Other prose</p></article>';
  const first = requireElement<HTMLElement>('#first');
  equal(ids(document), ['first', 'second'], 'document starts at its body; fixture UI is excluded');
  equal(ids(first), ['first'], 'matching supplied root included');
  equal(ids(requireElement('#inline')), [], 'inline mutation root does not discover outside its subtree');
  equal(genericWebDetector.findContainingRegion(requireElement('#inline'))?.root.id, 'first', 'containing lookup supplies semantic owner');
  const fragment = document.createDocumentFragment();
  const detached = document.createElement('p');
  detached.id = 'fragment-prose';
  detached.textContent = 'Detached متن';
  fragment.append(detached);
  equal(ids(fragment), ['fragment-prose'], 'fragment root is supported');
  equal(ids(detached), ['fragment-prose'], 'detached matching root is supported');
  const unsafe = document.createElement('div');
  unsafe.hidden = true;
  unsafe.append(detached);
  fixtures.append(unsafe);
  equal(ids(detached), [], 'hidden ancestors outside supplied root are checked');
  equal(genericWebDetector.findContainingRegion(detached), null, 'containing lookup honors hidden ancestors');
});

test('preserves original DOM, text, attributes, and node identity across all detector methods', () => {
  fixtures.innerHTML = '<article dir="auto"><p id="unchanged">متن <strong id="native">API</strong> با English.</p><p>شرح دوم</p><pre>npm run build</pre></article>';
  const before = fixtures.innerHTML;
  const text = fixtures.textContent;
  const native = requireElement('#native');
  const textNode = native.firstChild;
  const observer = new MutationObserver(() => {});
  observer.observe(fixtures, { childList: true, characterData: true, attributes: true, subtree: true });
  try {
    const regions = genericWebDetector.findRegions(fixtures);
    assert(regions.length > 0, 'nonempty readable fixture');
    regions.forEach((region) => genericWebDetector.findBlocks(region));
    genericWebDetector.findContainingRegion(native);
    equal(observer.takeRecords().length, 0, 'no DOM mutations');
  } finally { observer.disconnect(); }
  equal(fixtures.innerHTML, before, 'exact DOM markup preserved');
  equal(fixtures.textContent, text, 'exact source text preserved');
  assert(requireElement('#native') === native && native.firstChild === textNode, 'native node identities preserved');
});

test('node budget terminates traversal before a readable tail in a large DOM', () => {
  const root = document.createElement('section');
  for (let index = 0; index < GENERIC_WEB_LIMITS.maxNodes + 100; index += 1) root.append(document.createElement('div'));
  const tail = document.createElement('p');
  tail.id = 'too-far'; tail.textContent = 'متن بعد از سقف'; root.append(tail); fixtures.append(root);
  // A bulk selector scan is not a bounded substitute for visiting a prefix.
  root.querySelectorAll = () => { throw new Error('unbounded bulk discovery'); };
  watchStyles(root, (seen) => {
    equal(ids(root), [], 'candidate beyond node budget is not discovered');
    assert(!seen.has(tail), 'tail is never inspected');
    assert(seen.size <= GENERIC_WEB_LIMITS.maxNodes, 'bounded element inspections');
  });
});

test('candidate budget stops discovery rather than collecting the whole large page and slicing', () => {
  const root = document.createElement('section');
  for (let index = 0; index < GENERIC_WEB_LIMITS.maxCandidates + 50; index += 1) {
    const paragraph = document.createElement('p');
    paragraph.id = `candidate-${index}`; paragraph.textContent = 'Readable متن'; root.append(paragraph);
  }
  fixtures.append(root);
  root.querySelectorAll = () => { throw new Error('unbounded bulk discovery'); };
  watchStyles(root, (seen) => {
    const found = ids(root);
    equal(found.length, GENERIC_WEB_LIMITS.maxCandidates, 'finite candidate cap');
    equal(found[0], 'candidate-0', 'document prefix starts correctly');
    equal(found.at(-1), `candidate-${GENERIC_WEB_LIMITS.maxCandidates - 1}`, 'document prefix ends at cap');
    assert(seen.size <= GENERIC_WEB_LIMITS.maxCandidates + 1, 'no later paragraph inspected');
    assert(!seen.has(root.lastElementChild as Element), 'far tail is not visited');
  });
});

test('depth limit prunes deeply nested branches but still discovers shallow siblings', () => {
  const root = document.createElement('section');
  let parent: HTMLElement = root;
  for (let index = 0; index < GENERIC_WEB_LIMITS.maxDepth + 20; index += 1) {
    const next = document.createElement('div'); parent.append(next); parent = next;
  }
  const deep = document.createElement('p'); deep.textContent = 'Too deep متن'; parent.append(deep);
  const shallow = document.createElement('h2'); shallow.id = 'shallow'; shallow.textContent = 'Safe متن';
  root.append(shallow); fixtures.append(root);
  watchStyles(root, (seen) => {
    equal(ids(root), ['shallow'], 'deep branch skipped, sibling retained');
    assert(!seen.has(deep), 'deep prose never inspected');
    assert(seen.size <= GENERIC_WEB_LIMITS.maxDepth + 2, 'depth-bound inspections');
  });
  equal(ids(deep), [], 'overlong ancestor chain fails closed on a supplied deep root');
  equal(genericWebDetector.findContainingRegion(deep), null, 'containing lookup also bounds ancestor checks');
});

test('oversized blocks are skipped and global text budget stops before later candidates', () => {
  const root = document.createElement('section');
  const long = document.createElement('p'); long.textContent = 'a'.repeat(GENERIC_WEB_LIMITS.maxBlockCharacters + 1);
  const short = document.createElement('p'); short.id = 'short'; short.textContent = 'متن safe';
  root.append(long, short); fixtures.append(root);
  equal(ids(root), ['short'], 'oversized candidate does not swallow a safe sibling');
  const huge = document.createElement('p'); huge.textContent = 'a'.repeat(GENERIC_WEB_LIMITS.maxTextCharacters + 1);
  const tail = document.createElement('p'); tail.id = 'past-text-budget'; tail.textContent = 'Later متن';
  root.replaceChildren(short, huge, tail);
  watchStyles(root, (seen) => {
    equal(ids(root), ['short'], 'only fully checked prefix is returned');
    assert(!seen.has(tail), 'global character limit stops traversal before tail');
  });
});

test('depth-boundary discoveries remain valid for block and containing-region lookups', () => {
  const root = document.createElement('section');
  for (let depth = 54; depth <= 65; depth += 1) {
    let parent: HTMLElement = root;
    for (let index = 0; index < depth; index += 1) {
      const child = document.createElement('div'); parent.append(child); parent = child;
    }
    const paragraph = document.createElement('p');
    paragraph.id = `boundary-${depth}`; paragraph.textContent = 'Boundary متن'; parent.append(paragraph);
  }
  fixtures.append(root);
  const regions = genericWebDetector.findRegions(root);
  assert(regions.length > 0, 'safe depth-boundary prefix is still readable');
  for (const region of regions) {
    equal(genericWebDetector.findBlocks(region).map((block) => block.element.id), [region.root.id], 'discovered root remains a safe block');
    equal(genericWebDetector.findContainingRegion(region.root)?.root.id, region.root.id, 'discovered root remains its own containing region');
    equal(ids(region.root), [region.root.id], 'matching root handling agrees with broad discovery');
  }
});

window.__bidifixGenericDetectorTestResults = results;
const list = requireElement('#results');
results.forEach((result) => {
  const item = document.createElement('li');
  item.className = result.passed ? 'pass' : 'fail';
  item.textContent = result.passed ? `PASS: ${result.name}` : `FAIL: ${result.name} — ${result.error}`;
  list.append(item);
});
const passed = results.filter((result) => result.passed).length;
const summary = requireElement('#summary');
summary.className = passed === results.length ? 'pass' : 'fail';
summary.textContent = `${passed}/${results.length} generic detector tests passed.`;
