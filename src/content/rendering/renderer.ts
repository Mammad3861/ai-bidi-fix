import { findInlineLtrRanges } from '../../core/inline-ltr';
import { detectDirection } from '../../core/text-direction';
import type { RenderDecision, TextDirection } from '../../core/types';
import {
  MAX_LINE_WRAP_TEXT_LENGTH,
  type LineWrapBudget,
} from './budgets';
import {
  COMPOSER_STATE_SELECTOR,
  DIRECTION_STATE_SELECTOR,
  elementsMatchingRootOrDescendants,
  INLINE_LTR_SKIP_SELECTOR,
  INLINE_LTR_WRAPPER_SELECTOR,
  LINE_DIRECTION_WRAPPER_SELECTOR,
  MESSAGE_STATE_SELECTOR,
  restoreManagedDirection,
  setManagedDirection,
  TECHNICAL_STATE_SELECTOR,
} from './dom-state';

export const PROCESSED_VERSION = '0.1.3-code-prose-rendering-v2';

export interface BlockRenderingOptions {
  text: string;
  decision: RenderDecision;
  codeLikeRtlProse: boolean;
  lineLevel: boolean;
  strongRtl: boolean;
  lineWrapBudget: LineWrapBudget;
}

export type BlockRenderingStatus = 'applied' | 'unchanged' | 'repaired';

function textSignature(text: string): string {
  const normalized = text.trim();
  return `${normalized.length}:${normalized.slice(0, 40)}:${normalized.slice(-40)}`;
}

function findInlineLtrTextNodes(block: HTMLElement): Text[] {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest(INLINE_LTR_SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
      return findInlineLtrRanges((node as Text).data).length > 0
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

    for (const { start, end, value } of findInlineLtrRanges(text)) {
      if (start > cursor) fragment.append(text.slice(cursor, start));

      const isolate = document.createElement('bdi');
      isolate.dir = 'ltr';
      isolate.dataset.bidifixInlineLtr = 'true';
      isolate.dataset.bidifixProcessed = 'true';
      isolate.textContent = value;
      fragment.append(isolate);
      cursor = end;
    }

    if (cursor < text.length) fragment.append(text.slice(cursor));
    textNode.replaceWith(fragment);
  });
}

function hasUnisolatedInlineLtrRun(block: HTMLElement): boolean {
  return findInlineLtrTextNodes(block).length > 0;
}

export function unwrapInlineLtr(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(INLINE_LTR_WRAPPER_SELECTOR).forEach((element) => {
    element.replaceWith(document.createTextNode(element.textContent ?? ''));
  });
}

export function unwrapLineDirectionSpans(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(LINE_DIRECTION_WRAPPER_SELECTOR).forEach((element) => {
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
  const existingLines = element.querySelectorAll<HTMLElement>(LINE_DIRECTION_WRAPPER_SELECTOR);
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
      if (parent.closest(LINE_DIRECTION_WRAPPER_SELECTOR)) return NodeFilter.FILTER_REJECT;
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
  budget: LineWrapBudget,
): void {
  if (budget.remaining <= 0) return;
  if ((element.textContent?.length ?? 0) > MAX_LINE_WRAP_TEXT_LENGTH) return;

  const existingCount = element.querySelectorAll(LINE_DIRECTION_WRAPPER_SELECTOR).length;
  processMixedTextLines(element, strongRtl);

  const currentCount = element.querySelectorAll(LINE_DIRECTION_WRAPPER_SELECTOR).length;
  budget.remaining -= Math.max(0, currentCount - existingCount);
  if (budget.remaining < 0) budget.remaining = 0;
}

export function applyMessageState(message: HTMLElement, siteMarker?: string): void {
  message.dataset.bidifixMessage = 'true';
  message.dataset.bidifixProcessed = 'true';
  if (siteMarker !== undefined) message.dataset.bidifixSite = siteMarker;
}

export function applyTechnicalState(element: HTMLElement): void {
  element.dataset.bidifixTechnical = 'true';
  element.dataset.bidifixProcessed = 'true';
  setManagedDirection(element, 'ltr');
}

export function removeTechnicalState(element: HTMLElement): void {
  const wasTechnical = element.dataset.bidifixTechnical === 'true';
  delete element.dataset.bidifixTechnical;
  if (wasTechnical) {
    delete element.dataset.bidifixProcessed;
    restoreManagedDirection(element);
  }
}

export function applyCodeTechnicalState(element: HTMLElement): void {
  if (element.dataset.bidifixCodeProse === 'true') unwrapInlineLtr(element);
  delete element.dataset.bidifixDirection;
  delete element.dataset.bidifixCodeProse;
  delete element.dataset.bidifixProcessedVersion;
  delete element.dataset.bidifixTextSignature;
  element.dataset.bidifixTechnical = 'true';
  element.dataset.bidifixProcessed = 'true';
  setManagedDirection(element, 'ltr');
}

export function applyBlockRendering(
  block: HTMLElement,
  options: BlockRenderingOptions,
): BlockRenderingStatus {
  const signature = textSignature(options.text);
  const processedAndUnchanged =
    block.dataset.bidifixProcessedVersion === PROCESSED_VERSION &&
    block.dataset.bidifixTextSignature === signature;
  const lostInlineIsolation =
    options.decision.isolateInlineLtr && hasUnisolatedInlineLtrRun(block);

  // A site renderer can reconcile a block's children after BidiFix runs. Its
  // text remains identical, but generated <bdi> islands can be removed while
  // our attributes remain on the stable container. Re-run only
  // when a genuinely wrappable LTR run is present; unchanged blocks otherwise
  // remain a no-op.
  if (processedAndUnchanged && !lostInlineIsolation) return 'unchanged';

  if (options.codeLikeRtlProse) block.dataset.bidifixCodeProse = 'true';
  block.dataset.bidifixDirection = options.decision.direction;
  block.dataset.bidifixProcessed = 'true';
  block.dataset.bidifixProcessedVersion = PROCESSED_VERSION;
  block.dataset.bidifixTextSignature = signature;
  setManagedDirection(block, options.decision.direction);

  if (options.lineLevel) {
    processMixedTextLinesWithBudget(block, options.strongRtl, options.lineWrapBudget);
  } else if (options.decision.isolateInlineLtr) {
    isolateInlineLtrRuns(block);
  } else {
    unwrapInlineLtr(block);
  }

  return processedAndUnchanged ? 'repaired' : 'applied';
}

export function applyComposerState(composer: HTMLElement, direction: TextDirection): void {
  composer.dataset.bidifixComposer = 'true';
  composer.dataset.bidifixComposerDirection = direction;
  composer.dataset.bidifixProcessed = 'true';
  setManagedDirection(composer, direction);
}

export function clearRenderingState(root: ParentNode = document): void {
  unwrapInlineLtr(root);
  unwrapLineDirectionSpans(root);
  elementsMatchingRootOrDescendants(root, COMPOSER_STATE_SELECTOR).forEach((element) => {
    delete element.dataset.bidifixComposer;
    delete element.dataset.bidifixComposerDirection;
    delete element.dataset.bidifixProcessed;
    restoreManagedDirection(element);
  });
  elementsMatchingRootOrDescendants(root, DIRECTION_STATE_SELECTOR).forEach((element) => {
    delete element.dataset.bidifixDirection;
    delete element.dataset.bidifixCodeProse;
    delete element.dataset.bidifixProcessedVersion;
    delete element.dataset.bidifixTextSignature;
    delete element.dataset.bidifixProcessed;
    restoreManagedDirection(element);
  });
  elementsMatchingRootOrDescendants(root, TECHNICAL_STATE_SELECTOR).forEach((element) => {
    delete element.dataset.bidifixTechnical;
    delete element.dataset.bidifixProcessed;
    restoreManagedDirection(element);
  });
  elementsMatchingRootOrDescendants(root, MESSAGE_STATE_SELECTOR).forEach((element) => {
    delete element.dataset.bidifixMessage;
    delete element.dataset.bidifixSite;
    delete element.dataset.bidifixProcessed;
  });
}
