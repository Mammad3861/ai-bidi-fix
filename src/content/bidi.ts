import { analyzeText } from '../core/analyze-text';
import { isLikelyRealCodeText } from '../core/code-classifier';
import { decideComposerDirection, decideRendering } from '../core/decide-rendering';
import { hasLtrText, hasRtlText } from '../core/text-direction';
import type { SupportedSite } from '../shared/sites';
import { getSiteAdapter } from './adapters/registry';
import type { DetectedRegion, SiteAdapter } from './detection/types';
import {
  createLineWrapBudget,
  MAX_BLOCKS_PER_MESSAGE,
  MAX_INLINE_ISOLATION_TEXT_LENGTH,
  MAX_LINE_WRAP_TEXT_LENGTH,
} from './rendering/budgets';
import { INLINE_LTR_SKIP_SELECTOR } from './rendering/dom-state';
import {
  applyBlockRendering,
  applyCodeTechnicalState,
  applyComposerState,
  applyMessageState,
  applyTechnicalState,
  clearRenderingState,
  releaseBlockDirection,
  removeTechnicalState,
  unwrapLineDirectionSpans,
} from './rendering/renderer';

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
const CODE_LIKE_SELECTOR = 'pre, code, [class*="font-mono"]';
const INLINE_CODE_SELECTOR = 'code:not(pre code)';

export interface BidiFixOptions {
  strongRtl: boolean;
  experimentalMixedPromptFix: boolean;
}

function directReadableText(element: HTMLElement, excludedSelector?: string): string {
  const clone = element.cloneNode(true) as HTMLElement;
  if (excludedSelector) {
    clone.querySelectorAll<HTMLElement>(excludedSelector).forEach((node) => node.remove());
  }
  clone.querySelectorAll<HTMLElement>(TECHNICAL_SELECTOR).forEach((node) => {
    if (node.dataset.bidifixDirection !== 'rtl') node.remove();
  });
  return clone.textContent?.trim() ?? '';
}

function lineStats(text: string): { lines: string[]; nonEmptyLines: string[]; indentedLines: number } {
  const lines = text.split(/\r?\n/);
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  const indentedLines = nonEmptyLines.filter((line) => /^\s{2,}|\t/.test(line)).length;
  return { lines, nonEmptyLines, indentedLines };
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

function markTechnicalContent(root: ParentNode, excludedSelector?: string): void {
  root.querySelectorAll<HTMLElement>('kbd, samp, var, a[href]').forEach((element) => {
    if (excludedSelector && element.closest(excludedSelector)) return;
    applyTechnicalState(element);
  });

  const codeLikeElements = new Set<HTMLElement>();
  if (root instanceof HTMLElement && root.matches(CODE_LIKE_SELECTOR)) codeLikeElements.add(root);
  root.querySelectorAll<HTMLElement>(CODE_LIKE_SELECTOR).forEach((element) => {
    codeLikeElements.add(element);
  });

  codeLikeElements.forEach((element) => {
    if (excludedSelector && element.closest(excludedSelector)) return;
    if (isCodeLikeRtlProse(element)) {
      removeTechnicalState(element);
      return;
    }

    applyCodeTechnicalState(element);
  });
}

function collectCodeLikeRtlProseBlocks(message: HTMLElement, blocks: Set<HTMLElement>): void {
  if (isCodeLikeRtlProse(message)) blocks.add(message);
  message.querySelectorAll<HTMLElement>(CODE_LIKE_SELECTOR).forEach((element) => {
    if (isCodeLikeRtlProse(element)) blocks.add(element);
  });
}

export function applyDetectedRegion(
  region: DetectedRegion,
  options: BidiFixOptions,
  adapter: SiteAdapter,
): void {
  const message = region.root;
  const excludedSelector = region.compatibility.excludedContentSelector;
  applyMessageState(message, region.compatibility.messageSiteMarker);
  if (!options.experimentalMixedPromptFix) unwrapLineDirectionSpans(message);
  markTechnicalContent(message, excludedSelector);
  const lineWrapBudget = createLineWrapBudget();

  const blocks = new Set<HTMLElement>();
  // Code-like RTL prose is the release-critical case and must not be starved by
  // the per-message budget in long responses with many ordinary prose nodes.
  collectCodeLikeRtlProseBlocks(message, blocks);
  adapter.findBlocks(region).forEach((candidate) => {
    if (candidate.directionOwner) releaseBlockDirection(candidate.element);
    else blocks.add(candidate.element);
  });

  [...blocks].slice(0, MAX_BLOCKS_PER_MESSAGE).forEach((block) => {
    if (excludedSelector && block.closest(excludedSelector)) return;
    const codeLikeRtlProse = isCodeLikeRtlProse(block);
    if (!codeLikeRtlProse && block.closest(TECHNICAL_SELECTOR)) return;

    const text = codeLikeRtlProse
      ? (block.textContent?.trim() ?? '')
      : directReadableText(block, excludedSelector);
    const lineLevel =
      options.experimentalMixedPromptFix &&
      lineWrapBudget.remaining > 0 &&
      text.length <= MAX_LINE_WRAP_TEXT_LENGTH &&
      shouldUseLineDirection(block, text, codeLikeRtlProse);
    const allowInlineIsolation =
      text.length <= MAX_INLINE_ISOLATION_TEXT_LENGTH &&
      (region.compatibility.inlineIsolation !== 'experimental-only' ||
        options.experimentalMixedPromptFix);
    const analysis = analyzeText(text, {
      strongRtl: options.strongRtl,
      classifyCode: false,
    });
    const decision = decideRendering(analysis, {
      lineLevel,
      allowInlineIsolation,
    });

    applyBlockRendering(block, {
      text,
      decision,
      codeLikeRtlProse,
      lineLevel,
      strongRtl: options.strongRtl,
      lineWrapBudget,
    });
  });
}

export function applyBidiFix(
  message: HTMLElement,
  options: BidiFixOptions,
  site: SupportedSite,
): void {
  const adapter = getSiteAdapter(site);
  if (!adapter) return;
  const region = adapter.describeRegion(message);
  applyDetectedRegion(region, options, adapter);
}

function composerText(composer: HTMLElement): string {
  if (composer instanceof HTMLInputElement || composer instanceof HTMLTextAreaElement) {
    return composer.value;
  }
  return composer.textContent ?? '';
}

export function applyComposerFix(composer: HTMLElement): void {
  const direction = decideComposerDirection(composerText(composer));
  applyComposerState(composer, direction);
}

export function clearBidiFix(root: ParentNode = document): void {
  clearRenderingState(root);
}
