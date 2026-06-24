import { TEXT_BLOCK_SELECTOR } from './detector';

const RTL_CHARACTER = /[\u0590-\u05ff\u0600-\u06ff\u0700-\u074f\u0750-\u077f\u0780-\u07bf\u08a0-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/gu;
const LTR_CHARACTER = /[A-Za-z\u00c0-\u02af]/g;
const INLINE_LTR_RUN = /(?:https?:\/\/|www\.)[^\s\u0590-\u08ff]+|[A-Za-z][A-Za-z0-9_@#.+:/\\-]*(?:[ \t]+[A-Za-z0-9][A-Za-z0-9_@#.+:/\\-]*)*/g;
const TECHNICAL_SELECTOR = [
  'pre',
  'code',
  'kbd',
  'samp',
  'var',
  'a[href]',
  '[data-bidifix-technical="true"]',
  '[class*="font-mono"]',
].join(',');
const INLINE_LTR_SKIP_SELECTOR = [
  'pre',
  'code',
  'kbd',
  'samp',
  'var',
  'a[href]',
  'textarea',
  'input',
  '[contenteditable="true"]',
  '[data-bidifix-inline-ltr="true"]',
].join(',');

export type TextDirection = 'rtl' | 'ltr' | 'auto';

function setManagedDirection(element: HTMLElement, direction: TextDirection): void {
  if (element.dataset.aiBidiOriginalDir === undefined) {
    element.dataset.aiBidiOriginalDir = element.getAttribute('dir') ?? '';
  }
  element.dir = direction;
}

function restoreDirection(element: HTMLElement): void {
  const original = element.dataset.aiBidiOriginalDir;
  if (original === undefined) return;
  if (original) element.setAttribute('dir', original);
  else element.removeAttribute('dir');
  delete element.dataset.aiBidiOriginalDir;
}

function directReadableText(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(TECHNICAL_SELECTOR).forEach((node) => node.remove());
  return clone.textContent?.trim() ?? '';
}

export function detectDirection(text: string, strongRtl: boolean): TextDirection {
  const rtlCount = text.match(RTL_CHARACTER)?.length ?? 0;
  const ltrCount = text.match(LTR_CHARACTER)?.length ?? 0;

  if (rtlCount > 0) return 'rtl';
  if (ltrCount > 0) return 'ltr';
  return strongRtl && text.length > 0 ? 'rtl' : 'auto';
}

function markTechnicalContent(root: ParentNode): void {
  root
    .querySelectorAll<HTMLElement>('pre, code, kbd, samp, var, a[href], [class*="font-mono"]')
    .forEach((element) => {
    element.dataset.bidifixTechnical = 'true';
    element.dataset.bidifixProcessed = 'true';
    setManagedDirection(element, 'ltr');
  });
}

function isolateInlineLtrRuns(block: HTMLElement): void {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest(INLINE_LTR_SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
      INLINE_LTR_RUN.lastIndex = 0;
      return INLINE_LTR_RUN.test((node as Text).data)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  textNodes.forEach((textNode) => {
    const text = textNode.data;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    INLINE_LTR_RUN.lastIndex = 0;

    for (const match of text.matchAll(INLINE_LTR_RUN)) {
      const start = match.index;
      const value = match[0];
      if (start > cursor) fragment.append(text.slice(cursor, start));

      const isolate = document.createElement('bdi');
      isolate.dir = 'ltr';
      isolate.dataset.bidifixInlineLtr = 'true';
      isolate.dataset.bidifixProcessed = 'true';
      isolate.textContent = value;
      fragment.append(isolate);
      cursor = start + value.length;
    }

    if (cursor < text.length) fragment.append(text.slice(cursor));
    textNode.replaceWith(fragment);
  });
}

function unwrapInlineLtr(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-bidifix-inline-ltr="true"]').forEach((element) => {
    element.replaceWith(document.createTextNode(element.textContent ?? ''));
  });
}

export function applyBidiFix(message: HTMLElement, strongRtl: boolean): void {
  message.dataset.bidifixMessage = 'true';
  message.dataset.bidifixProcessed = 'true';
  markTechnicalContent(message);

  const blocks = new Set<HTMLElement>();
  if (message.matches(TEXT_BLOCK_SELECTOR)) blocks.add(message);
  message.querySelectorAll<HTMLElement>(TEXT_BLOCK_SELECTOR).forEach((block) => blocks.add(block));

  // Claude occasionally streams prose as bare spans instead of paragraph tags.
  // Process those leaf spans and their nearest layout container without adding
  // wrappers or changing the text DOM.
  message.querySelectorAll<HTMLElement>('span').forEach((span) => {
    if (!span.textContent?.trim() || span.closest(TECHNICAL_SELECTOR)) return;
    if (span.closest(TEXT_BLOCK_SELECTOR)) return;
    if (span.querySelector(TEXT_BLOCK_SELECTOR)) return;
    blocks.add(span);

    const layoutContainer = span.closest<HTMLElement>('div');
    if (layoutContainer && message.contains(layoutContainer) && layoutContainer !== message) {
      blocks.add(layoutContainer);
    }
  });

  blocks.forEach((block) => {
    if (block.closest(TECHNICAL_SELECTOR)) return;
    const direction = detectDirection(directReadableText(block), strongRtl);
    block.dataset.bidifixDirection = direction;
    block.dataset.bidifixProcessed = 'true';
    setManagedDirection(block, direction);
    if (direction === 'rtl') isolateInlineLtrRuns(block);
    else unwrapInlineLtr(block);
  });
}

function composerText(composer: HTMLElement): string {
  if (composer instanceof HTMLInputElement || composer instanceof HTMLTextAreaElement) {
    return composer.value;
  }
  return composer.textContent ?? '';
}

export function applyComposerFix(composer: HTMLElement): void {
  const direction = RTL_CHARACTER.test(composerText(composer)) ? 'rtl' : 'auto';
  RTL_CHARACTER.lastIndex = 0;
  composer.dataset.bidifixComposer = 'true';
  composer.dataset.bidifixComposerDirection = direction;
  composer.dataset.bidifixProcessed = 'true';
  setManagedDirection(composer, direction);
}

export function clearBidiFix(root: ParentNode = document): void {
  unwrapInlineLtr(root);
  root.querySelectorAll<HTMLElement>('[data-bidifix-composer]').forEach((element) => {
    delete element.dataset.bidifixComposer;
    delete element.dataset.bidifixComposerDirection;
    delete element.dataset.bidifixProcessed;
    restoreDirection(element);
  });
  root.querySelectorAll<HTMLElement>('[data-bidifix-direction]').forEach((element) => {
    delete element.dataset.bidifixDirection;
    delete element.dataset.bidifixProcessed;
    restoreDirection(element);
  });
  root.querySelectorAll<HTMLElement>('[data-bidifix-technical]').forEach((element) => {
    delete element.dataset.bidifixTechnical;
    delete element.dataset.bidifixProcessed;
    restoreDirection(element);
  });
  root.querySelectorAll<HTMLElement>('[data-bidifix-message]').forEach((element) => {
    delete element.dataset.bidifixMessage;
    delete element.dataset.bidifixProcessed;
  });
}
