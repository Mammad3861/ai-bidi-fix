import { TEXT_BLOCK_SELECTOR } from './detector';
import { isLikelyRealCodeText } from './code-classifier';
import type { SupportedSite } from '../shared/sites';

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
  'kbd',
  'samp',
  'var',
  'a[href]',
  'textarea',
  'input',
  '[contenteditable="true"]',
  'button',
  '[role="button"]',
  '[data-bidifix-inline-ltr="true"]',
  '[data-bidifix-technical="true"]',
].join(',');
const CODE_LIKE_SELECTOR = 'pre, code, [class*="font-mono"]';
const INLINE_CODE_SELECTOR = 'code:not(pre code)';
const DIRECT_TEXT_CONTAINER_SELECTOR = 'div, span';
const PROCESSED_VERSION = '0.1.3-code-prose-rendering-v2';
const MAX_INLINE_ISOLATION_TEXT_LENGTH = 2000;
const MAX_LINE_WRAP_TEXT_LENGTH = 4000;
const MAX_LINE_WRAPPERS_PER_MESSAGE = 80;
const MAX_BLOCKS_PER_MESSAGE = 80;

export type TextDirection = 'rtl' | 'ltr' | 'auto';

export interface BidiFixOptions {
  strongRtl: boolean;
  experimentalMixedPromptFix: boolean;
}

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
  clone.querySelectorAll<HTMLElement>(TECHNICAL_SELECTOR).forEach((node) => {
    if (node.dataset.bidifixDirection !== 'rtl') node.remove();
  });
  return clone.textContent?.trim() ?? '';
}

export function detectDirection(text: string, strongRtl: boolean): TextDirection {
  const rtlCount = text.match(RTL_CHARACTER)?.length ?? 0;
  const ltrCount = text.match(LTR_CHARACTER)?.length ?? 0;

  if (rtlCount > 0) return 'rtl';
  if (ltrCount > 0) return 'ltr';
  return strongRtl && text.length > 0 ? 'rtl' : 'auto';
}

function hasRtlText(text: string): boolean {
  RTL_CHARACTER.lastIndex = 0;
  const result = RTL_CHARACTER.test(text);
  RTL_CHARACTER.lastIndex = 0;
  return result;
}

function hasLtrText(text: string): boolean {
  LTR_CHARACTER.lastIndex = 0;
  const result = LTR_CHARACTER.test(text);
  LTR_CHARACTER.lastIndex = 0;
  return result;
}

function lineStats(text: string): { lines: string[]; nonEmptyLines: string[]; indentedLines: number } {
  const lines = text.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  const indentedLines = nonEmptyLines.filter((line) => /^\s{2,}|\t/.test(line)).length;
  return { lines, nonEmptyLines, indentedLines };
}

function textSignature(text: string): string {
  const normalized = text.trim();
  return `${normalized.length}:${normalized.slice(0, 40)}:${normalized.slice(-40)}`;
}

function directTextSectionCount(element: HTMLElement): number {
  return [...element.childNodes].filter((node) => {
    if (node.nodeType === Node.TEXT_NODE) return Boolean(node.textContent?.trim());
    if (!(node instanceof HTMLElement)) return false;
    if (node.matches(INLINE_LTR_SKIP_SELECTOR)) return false;
    return Boolean(node.textContent?.trim());
  }).length;
}

export function isLikelyRealCodeBlock(element: HTMLElement, text: string): boolean {
  return isLikelyRealCodeText(text, { inlineCode: element.matches(INLINE_CODE_SELECTOR) });
}

function isCodeLikeRtlProse(element: HTMLElement): boolean {
  if (!element.matches(CODE_LIKE_SELECTOR)) return false;
  const text = element.textContent?.trim() ?? '';
  return hasRtlText(text) && !isLikelyRealCodeBlock(element, text);
}

function isMixedNaturalLanguageBlock(element: HTMLElement, text: string): boolean {
  if (!text.trim()) return false;
  if (!hasRtlText(text) || !hasLtrText(text)) return false;
  if (element.matches(CODE_LIKE_SELECTOR)) return !isLikelyRealCodeBlock(element, text);

  const { nonEmptyLines } = lineStats(text);
  const rtlLineCount = nonEmptyLines.filter(hasRtlText).length;
  const ltrLineCount = nonEmptyLines.filter((line) => hasLtrText(line) && !hasRtlText(line)).length;
  return (
    rtlLineCount > 0 &&
    ltrLineCount > 0 &&
    (nonEmptyLines.length >= 2 || directTextSectionCount(element) >= 2)
  );
}

function shouldUseLineDirection(element: HTMLElement, text: string, codeLikeRtlProse: boolean): boolean {
  const { nonEmptyLines } = lineStats(text);
  if (nonEmptyLines.length < 2 && directTextSectionCount(element) < 2) return false;
  if (codeLikeRtlProse) return true;
  return isMixedNaturalLanguageBlock(element, text);
}

function markTechnicalContent(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('kbd, samp, var, a[href]').forEach((element) => {
    element.dataset.bidifixTechnical = 'true';
    element.dataset.bidifixProcessed = 'true';
    setManagedDirection(element, 'ltr');
  });

  const codeLikeElements = new Set<HTMLElement>();
  if (root instanceof HTMLElement && root.matches(CODE_LIKE_SELECTOR)) codeLikeElements.add(root);
  root.querySelectorAll<HTMLElement>(CODE_LIKE_SELECTOR).forEach((element) => {
    codeLikeElements.add(element);
  });

  codeLikeElements.forEach((element) => {
    if (isCodeLikeRtlProse(element)) {
      const wasTechnical = element.dataset.bidifixTechnical === 'true';
      delete element.dataset.bidifixTechnical;
      if (wasTechnical) {
        delete element.dataset.bidifixProcessed;
        restoreDirection(element);
      }
      return;
    }

    if (element.dataset.bidifixCodeProse === 'true') unwrapInlineLtr(element);
    delete element.dataset.bidifixDirection;
    delete element.dataset.bidifixCodeProse;
    delete element.dataset.bidifixProcessedVersion;
    delete element.dataset.bidifixTextSignature;
    element.dataset.bidifixTechnical = 'true';
    element.dataset.bidifixProcessed = 'true';
    setManagedDirection(element, 'ltr');
  });
}

function findInlineLtrTextNodes(block: HTMLElement): Text[] {
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
  return textNodes;
}

function isolateInlineLtrRuns(block: HTMLElement): void {
  findInlineLtrTextNodes(block).forEach((textNode) => {
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

function hasUnisolatedInlineLtrRun(block: HTMLElement): boolean {
  return findInlineLtrTextNodes(block).length > 0;
}

function unwrapInlineLtr(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-bidifix-inline-ltr="true"]').forEach((element) => {
    element.replaceWith(document.createTextNode(element.textContent ?? ''));
  });
}

function unwrapLineDirectionSpans(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-bidifix-line="true"]').forEach((element) => {
    element.replaceWith(document.createTextNode(element.textContent ?? ''));
  });
}

function makeLineSpan(text: string, strongRtl: boolean): HTMLElement {
  const span = document.createElement('span');
  const direction = detectDirection(text, strongRtl);
  span.dataset.bidifixLine = 'true';
  span.dataset.bidifixDirection = direction;
  span.dataset.bidifixProcessed = 'true';
  setManagedDirection(span, direction);
  span.textContent = text;
  if (direction === 'rtl') isolateInlineLtrRuns(span);
  return span;
}

function appendDirectionalTextPart(
  fragment: DocumentFragment,
  text: string,
  strongRtl: boolean,
): void {
  if (!text) return;
  if (!text.trim()) {
    fragment.append(document.createTextNode(text));
    return;
  }
  fragment.append(makeLineSpan(text, strongRtl));
}

function processMixedTextLines(element: HTMLElement, strongRtl: boolean): void {
  const existingLines = element.querySelectorAll<HTMLElement>('[data-bidifix-line="true"]');
  if (existingLines.length > 0) {
    existingLines.forEach((line) => {
      const direction = detectDirection(line.textContent ?? '', strongRtl);
      line.dataset.bidifixDirection = direction;
      setManagedDirection(line, direction);
      if (direction === 'rtl') isolateInlineLtrRuns(line);
      else unwrapInlineLtr(line);
    });
  }

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest(INLINE_LTR_SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
      if (parent.closest('[data-bidifix-line="true"]')) return NodeFilter.FILTER_REJECT;
      return (node as Text).data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  textNodes.forEach((textNode) => {
    const parts = textNode.data.split(/(\r?\n)/);
    const fragment = document.createDocumentFragment();
    parts.forEach((part) => {
      if (!part) return;
      if (/^\r?\n$/.test(part)) {
        fragment.append(document.createTextNode(part));
        return;
      }
      appendDirectionalTextPart(fragment, part, strongRtl);
    });
    textNode.replaceWith(fragment);
  });
}

function processMixedTextLinesWithBudget(
  element: HTMLElement,
  strongRtl: boolean,
  budget: { remaining: number },
): void {
  if (budget.remaining <= 0) return;
  if ((element.textContent?.length ?? 0) > MAX_LINE_WRAP_TEXT_LENGTH) return;

  const existingCount = element.querySelectorAll('[data-bidifix-line="true"]').length;
  processMixedTextLines(element, strongRtl);

  const currentCount = element.querySelectorAll('[data-bidifix-line="true"]').length;
  budget.remaining -= Math.max(0, currentCount - existingCount);
  if (budget.remaining < 0) budget.remaining = 0;
}

function isChatGptDisplayedUserPrompt(message: HTMLElement): boolean {
  return Boolean(message.closest('[data-message-author-role="user"]'));
}

function hasDirectTextNode(element: HTMLElement): boolean {
  return [...element.childNodes].some(
    (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
  );
}

function collectCodeLikeRtlProseBlocks(message: HTMLElement, blocks: Set<HTMLElement>): void {
  if (isCodeLikeRtlProse(message)) blocks.add(message);
  message.querySelectorAll<HTMLElement>(CODE_LIKE_SELECTOR).forEach((element) => {
    if (isCodeLikeRtlProse(element)) blocks.add(element);
  });
}

function collectDirectTextBlocks(message: HTMLElement, blocks: Set<HTMLElement>): void {
  if (message.matches(DIRECT_TEXT_CONTAINER_SELECTOR) && hasDirectTextNode(message)) {
    blocks.add(message);
  }

  message.querySelectorAll<HTMLElement>(DIRECT_TEXT_CONTAINER_SELECTOR).forEach((element) => {
    if (!hasDirectTextNode(element)) return;
    if (element.closest(INLINE_LTR_SKIP_SELECTOR)) return;
    blocks.add(element);
  });
}

export function applyBidiFix(
  message: HTMLElement,
  options: BidiFixOptions,
  site: SupportedSite,
): void {
  message.dataset.bidifixMessage = 'true';
  message.dataset.bidifixProcessed = 'true';
  if (site === 'claude') message.dataset.bidifixSite = 'claude';
  if (!options.experimentalMixedPromptFix) unwrapLineDirectionSpans(message);
  markTechnicalContent(message);
  const lineWrapBudget = { remaining: MAX_LINE_WRAPPERS_PER_MESSAGE };

  const blocks = new Set<HTMLElement>();
  // Code-like RTL prose is the release-critical case and must not be starved by
  // the per-message budget in long responses with many ordinary prose nodes.
  collectCodeLikeRtlProseBlocks(message, blocks);
  if (message.matches(TEXT_BLOCK_SELECTOR)) blocks.add(message);
  message.querySelectorAll<HTMLElement>(TEXT_BLOCK_SELECTOR).forEach((block) => blocks.add(block));
  collectDirectTextBlocks(message, blocks);

  if (site === 'claude') {
    // Claude sometimes emits prose as nested divs without p/li semantics.
    // Include direct-text divs; the technical-content exclusions below still
    // protect code and controls.
    message.querySelectorAll<HTMLElement>('div').forEach((div) => {
      if (hasDirectTextNode(div)) blocks.add(div);
    });
  }

  // Claude occasionally streams prose as bare spans instead of paragraph tags.
  // Process those leaf spans without forcing a direction onto broad parents.
  message.querySelectorAll<HTMLElement>('span').forEach((span) => {
    if (!span.textContent?.trim() || span.closest(TECHNICAL_SELECTOR)) return;
    if (span.closest(TEXT_BLOCK_SELECTOR)) return;
    if (span.querySelector(TEXT_BLOCK_SELECTOR)) return;
    blocks.add(span);
  });

  [...blocks].slice(0, MAX_BLOCKS_PER_MESSAGE).forEach((block) => {
    const codeLikeRtlProse = isCodeLikeRtlProse(block);
    if (!codeLikeRtlProse && block.closest(TECHNICAL_SELECTOR)) return;

    const text = codeLikeRtlProse ? (block.textContent?.trim() ?? '') : directReadableText(block);
    const signature = textSignature(text);
    const lineLevel =
      options.experimentalMixedPromptFix &&
      lineWrapBudget.remaining > 0 &&
      text.length <= MAX_LINE_WRAP_TEXT_LENGTH &&
      shouldUseLineDirection(block, text, codeLikeRtlProse);
    const direction = lineLevel ? 'auto' : codeLikeRtlProse ? 'rtl' : detectDirection(text, options.strongRtl);

    const allowInlineIsolation =
      text.length <= MAX_INLINE_ISOLATION_TEXT_LENGTH &&
      (site !== 'chatgpt' || !isChatGptDisplayedUserPrompt(message) || options.experimentalMixedPromptFix);
    const processedAndUnchanged =
      block.dataset.bidifixProcessedVersion === PROCESSED_VERSION &&
      block.dataset.bidifixTextSignature === signature;
    const lostInlineIsolation =
      !lineLevel &&
      direction === 'rtl' &&
      allowInlineIsolation &&
      hasUnisolatedInlineLtrRun(block);

    // ChatGPT can reconcile a fenced block's children after BidiFix runs. Its
    // text remains identical, but React/CodeMirror removes the <bdi> islands
    // while leaving our attributes on the stable pre/code element. Re-run only
    // when a genuinely wrappable LTR run is present; unchanged blocks otherwise
    // remain a no-op.
    if (processedAndUnchanged && !lostInlineIsolation) return;

    if (codeLikeRtlProse) block.dataset.bidifixCodeProse = 'true';
    block.dataset.bidifixDirection = direction;
    block.dataset.bidifixProcessed = 'true';
    block.dataset.bidifixProcessedVersion = PROCESSED_VERSION;
    block.dataset.bidifixTextSignature = signature;
    setManagedDirection(block, direction);

    if (lineLevel) processMixedTextLinesWithBudget(block, options.strongRtl, lineWrapBudget);
    else if (direction === 'rtl' && allowInlineIsolation) {
      isolateInlineLtrRuns(block);
    }
    else unwrapInlineLtr(block);
  });
}

function composerText(composer: HTMLElement): string {
  if (composer instanceof HTMLInputElement || composer instanceof HTMLTextAreaElement) {
    return composer.value;
  }
  return composer.textContent ?? '';
}

function detectComposerDirection(text: string): TextDirection {
  if (!hasRtlText(text)) return 'auto';
  const { nonEmptyLines } = lineStats(text);
  const hasMixedMultilineText =
    nonEmptyLines.length >= 2 &&
    nonEmptyLines.some(hasRtlText) &&
    nonEmptyLines.some((line) => hasLtrText(line) && !hasRtlText(line));

  return hasMixedMultilineText ? 'auto' : 'rtl';
}

export function applyComposerFix(composer: HTMLElement): void {
  const direction = detectComposerDirection(composerText(composer));
  composer.dataset.bidifixComposer = 'true';
  composer.dataset.bidifixComposerDirection = direction;
  composer.dataset.bidifixProcessed = 'true';
  setManagedDirection(composer, direction);
}

export function clearBidiFix(root: ParentNode = document): void {
  unwrapInlineLtr(root);
  unwrapLineDirectionSpans(root);
  root.querySelectorAll<HTMLElement>('[data-bidifix-composer]').forEach((element) => {
    delete element.dataset.bidifixComposer;
    delete element.dataset.bidifixComposerDirection;
    delete element.dataset.bidifixProcessed;
    restoreDirection(element);
  });
  root.querySelectorAll<HTMLElement>('[data-bidifix-direction]').forEach((element) => {
    delete element.dataset.bidifixDirection;
    delete element.dataset.bidifixCodeProse;
    delete element.dataset.bidifixProcessedVersion;
    delete element.dataset.bidifixTextSignature;
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
    delete element.dataset.bidifixSite;
    delete element.dataset.bidifixProcessed;
  });
}
