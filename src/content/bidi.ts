import { TEXT_BLOCK_SELECTOR } from './detector';
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
  '[data-bidifix-inline-ltr="true"]',
  '[data-bidifix-technical="true"]',
].join(',');
const CODE_LIKE_SELECTOR = 'pre, code, [class*="font-mono"]';
const INLINE_CODE_SELECTOR = 'code:not(pre code)';

const CODE_KEYWORD = /\b(?:import|export|function|class|const|let|var|return|if|else|for|while|switch|case|try|catch|interface|type|enum|async|await|def|from|public|private|protected|static|new|extends|implements)\b/;
const SHELL_COMMAND = /(?:^|\n)\s*(?:npm|pnpm|yarn|node|npx|git|cd|mkdir|rm|cp|mv|python|pip|curl|docker|deno|bun)\s+[\w./:@-]/;
const HTML_OR_XML_TAG = /<\/?[A-Za-z][^>\n]{0,120}>/;
const CSS_DECLARATION = /\b[a-z-]+\s*:\s*[^;\n{}]+;/i;
const JSON_OR_OBJECT_SYNTAX = /["'][\w-]+["']\s*:|^\s*[\[{][\s\S]*[\]}]\s*$/;
const YAML_OR_TOML_SYNTAX = /(?:^|\n)\s*[A-Za-z0-9_.-]+\s*[:=]\s*[^:\n]+/;
const PERSIAN_ARABIC_SENTENCE_WORDS = /(?:[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]{2,}[\s،؛,.!?]+){3,}/u;

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

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function lineStats(text: string): { lines: string[]; nonEmptyLines: string[]; indentedLines: number } {
  const lines = text.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  const indentedLines = nonEmptyLines.filter((line) => /^\s{2,}|\t/.test(line)).length;
  return { lines, nonEmptyLines, indentedLines };
}

function textDensityWithoutSpaces(text: string): number {
  return Math.max(text.replace(/\s/g, '').length, 1);
}

export function isLikelyRealCodeBlock(element: HTMLElement, text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;

  const { nonEmptyLines, indentedLines } = lineStats(normalized);
  const charCount = textDensityWithoutSpaces(normalized);
  const rtlWordCount = countMatches(normalized, /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]{2,}/gu);
  const codePunctuationCount = countMatches(normalized, /[{}[\]();=<>|&]/g);
  const punctuationDensity = codePunctuationCount / charCount;
  const hasRtl = hasRtlText(normalized);
  let codeScore = 0;
  let proseScore = 0;

  if (CODE_KEYWORD.test(normalized)) codeScore += 3;
  if (SHELL_COMMAND.test(normalized)) codeScore += 2;
  if (HTML_OR_XML_TAG.test(normalized)) codeScore += 3;
  if (CSS_DECLARATION.test(normalized)) codeScore += 2;
  if (JSON_OR_OBJECT_SYNTAX.test(normalized)) codeScore += 2;
  if (YAML_OR_TOML_SYNTAX.test(normalized) && !hasRtl) codeScore += 1;
  if (punctuationDensity > 0.08) codeScore += 2;
  if (punctuationDensity > 0.14) codeScore += 2;
  if (nonEmptyLines.length >= 3 && indentedLines >= 2) codeScore += 2;
  if (element.matches(INLINE_CODE_SELECTOR) && !hasRtl) codeScore += 3;

  if (hasRtl) proseScore += 2;
  if (PERSIAN_ARABIC_SENTENCE_WORDS.test(normalized)) proseScore += 4;
  if (rtlWordCount >= 4) proseScore += 3;
  if (rtlWordCount >= 8) proseScore += 2;
  if (/[،؛؟]/u.test(normalized)) proseScore += 2;
  if (punctuationDensity < 0.08) proseScore += 1;
  if (SHELL_COMMAND.test(normalized) && hasRtl && rtlWordCount >= 3) proseScore += 1;

  return codeScore >= proseScore + 2;
}

function isCodeLikeRtlProse(element: HTMLElement): boolean {
  if (!element.matches(CODE_LIKE_SELECTOR)) return false;
  const text = element.textContent?.trim() ?? '';
  return hasRtlText(text) && !isLikelyRealCodeBlock(element, text);
}

function markTechnicalContent(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('kbd, samp, var, a[href]').forEach((element) => {
    element.dataset.bidifixTechnical = 'true';
    element.dataset.bidifixProcessed = 'true';
    setManagedDirection(element, 'ltr');
  });

  root.querySelectorAll<HTMLElement>(CODE_LIKE_SELECTOR).forEach((element) => {
    if (isCodeLikeRtlProse(element)) {
      delete element.dataset.bidifixTechnical;
      return;
    }

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

function hasDirectReadableText(element: HTMLElement): boolean {
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

export function applyBidiFix(
  message: HTMLElement,
  strongRtl: boolean,
  site: SupportedSite,
): void {
  message.dataset.bidifixMessage = 'true';
  message.dataset.bidifixProcessed = 'true';
  if (site === 'claude') message.dataset.bidifixSite = 'claude';
  markTechnicalContent(message);

  const blocks = new Set<HTMLElement>();
  if (message.matches(TEXT_BLOCK_SELECTOR)) blocks.add(message);
  message.querySelectorAll<HTMLElement>(TEXT_BLOCK_SELECTOR).forEach((block) => blocks.add(block));
  collectCodeLikeRtlProseBlocks(message, blocks);

  if (site === 'claude') {
    // Claude sometimes emits prose as nested divs without p/li semantics.
    // Include the detected container itself and divs with direct text nodes;
    // the technical-content exclusions below still protect code and controls.
    blocks.add(message);
    message.querySelectorAll<HTMLElement>('div').forEach((div) => {
      if (hasDirectReadableText(div)) blocks.add(div);
    });
  }

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
    const codeLikeRtlProse = isCodeLikeRtlProse(block);
    if (!codeLikeRtlProse && block.closest(TECHNICAL_SELECTOR)) return;
    const direction = codeLikeRtlProse ? 'rtl' : detectDirection(directReadableText(block), strongRtl);
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
    delete element.dataset.bidifixSite;
    delete element.dataset.bidifixProcessed;
  });
}
