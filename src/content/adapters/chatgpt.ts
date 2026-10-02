import { isChatGptHostname } from '../../shared/sites';
import type {
  BlockCandidate,
  CandidateHint,
  DetectedRegion,
  RegionRole,
  SiteAdapter,
} from '../detection/types';
import { TEXT_BLOCK_SELECTOR } from '../detection/types';
import { INLINE_LTR_SKIP_SELECTOR } from '../rendering/dom-state';

const MESSAGE_SELECTORS = [
  '[data-message-author-role="assistant"]',
  '[data-message-author-role="user"]',
  'article[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]',
  'article[data-testid^="conversation-turn-"] [data-message-author-role="user"]',
  'article[data-testid^="conversation-turn-"] [class~="whitespace-pre-wrap"]',
  'article[data-testid^="conversation-turn-"] [class*="whitespace-pre-wrap"]',
  'main article [class~="whitespace-pre-wrap"]',
  'main article [class*="whitespace-pre-wrap"]',
  '[data-message-author-role="user"] [class~="whitespace-pre-wrap"]',
  '[data-message-author-role="user"] [class*="whitespace-pre-wrap"]',
] as const;

const EXCLUDED_SELECTOR = [
  '#prompt-textarea',
  'form',
  'textarea',
  'input',
  '[contenteditable="true"]',
  '[role="textbox"]',
  'button',
  'nav',
  'aside',
  '[role="dialog"]',
].join(',');

const COMPOSER_SELECTOR = [
  '#prompt-textarea',
  'textarea',
  'input[type="text"]',
  'input:not([type])',
  '[contenteditable="true"]',
  '[role="textbox"]',
].join(',');

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
const EDITABLE_SELECTOR = 'textarea, input, [contenteditable="true"], [role="textbox"]';

function addSelectorMatches(
  root: ParentNode,
  selectors: readonly string[],
  matches: Set<HTMLElement>,
): void {
  for (const selector of selectors) {
    if (root instanceof Element && root.matches(selector)) matches.add(root as HTMLElement);
    root.querySelectorAll<HTMLElement>(selector).forEach((element) => matches.add(element));
  }
}

function isAllowedMessage(element: HTMLElement): boolean {
  const pageMain = document.querySelector('main, [role="main"]');
  if (pageMain ? !element.closest('main, [role="main"]') : !document.body?.contains(element)) {
    return false;
  }
  if (element.closest(EXCLUDED_SELECTOR)) return false;
  if (!element.closest('article[data-testid^="conversation-turn-"], [data-message-author-role]')) {
    return false;
  }
  return Boolean(element.textContent?.trim());
}

function regionRole(element: HTMLElement): RegionRole {
  const role = element
    .closest<HTMLElement>('[data-message-author-role]')
    ?.getAttribute('data-message-author-role');
  if (role === 'assistant' || role === 'user') return role;
  return 'unknown';
}

function sourceId(role: RegionRole): string {
  if (role === 'assistant') return 'chatgpt:assistant-message';
  if (role === 'user') return 'chatgpt:user-message';
  return 'chatgpt:conversation-turn';
}

function hasDirectTextNode(element: HTMLElement): boolean {
  return [...element.childNodes].some(
    (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
  );
}

function candidateHint(element: HTMLElement): CandidateHint {
  if (element.matches(CODE_LIKE_SELECTOR)) return 'code-like';
  if (element.closest(TECHNICAL_SELECTOR)) return 'technical';
  if (element.matches(TEXT_BLOCK_SELECTOR)) return 'prose';
  return 'unknown';
}

function toBlockCandidates(region: DetectedRegion, elements: readonly HTMLElement[]): BlockCandidate[] {
  return elements.map((element, priority) => {
    const editable = Boolean(element.closest(EDITABLE_SELECTOR));
    return {
      element,
      region,
      hint: candidateHint(element),
      editable,
      structurallySafe: !editable && !element.closest('button, [role="button"]'),
      priority,
    };
  });
}

function findBlockElements(message: HTMLElement): HTMLElement[] {
  const blocks = new Set<HTMLElement>();
  if (message.matches(TEXT_BLOCK_SELECTOR)) blocks.add(message);
  message.querySelectorAll<HTMLElement>(TEXT_BLOCK_SELECTOR).forEach((block) => blocks.add(block));

  if (message.matches('div, span') && hasDirectTextNode(message)) blocks.add(message);
  message.querySelectorAll<HTMLElement>('div, span').forEach((element) => {
    if (!hasDirectTextNode(element)) return;
    if (element.closest(INLINE_LTR_SKIP_SELECTOR)) return;
    blocks.add(element);
  });

  message.querySelectorAll<HTMLElement>('span').forEach((span) => {
    if (!span.textContent?.trim() || span.closest(TECHNICAL_SELECTOR)) return;
    if (span.closest(TEXT_BLOCK_SELECTOR)) return;
    if (span.querySelector(TEXT_BLOCK_SELECTOR)) return;
    blocks.add(span);
  });

  return [...blocks];
}

function isLikelyComposer(element: HTMLElement): boolean {
  if (element instanceof HTMLTextAreaElement) return element.closest('form') !== null;
  if (element instanceof HTMLInputElement) {
    const hint = [
      element.id,
      element.name,
      element.placeholder,
      element.getAttribute('aria-label'),
      element.getAttribute('data-testid'),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return element.closest('form') !== null && /(prompt|message|chat|ask)/.test(hint);
  }

  const editable = element.matches('[contenteditable="true"], [role="textbox"]');
  if (!editable) return false;
  if (element.closest('[data-bidifix-message="true"]')) return false;
  return element.id === 'prompt-textarea' || element.closest('form') !== null;
}

export const chatGptAdapter: SiteAdapter = {
  id: 'chatgpt',

  matches(location): boolean {
    return isChatGptHostname(location.hostname);
  },

  describeRegion(root, priority = 0): DetectedRegion {
    const role = regionRole(root);
    return {
      root,
      role,
      source: 'adapter',
      sourceId: sourceId(role),
      priority,
      compatibility: {
        inlineIsolation: role === 'user' ? 'experimental-only' : 'default',
      },
    };
  },

  findRegions(root): readonly DetectedRegion[] {
    const matches = new Set<HTMLElement>();
    addSelectorMatches(root, MESSAGE_SELECTORS, matches);
    return [...matches]
      .filter(isAllowedMessage)
      .map((element, priority) => this.describeRegion(element, priority));
  },

  findContainingRegion(element): DetectedRegion | null {
    const candidate = element.closest<HTMLElement>(MESSAGE_SELECTORS.join(','));
    return candidate && isAllowedMessage(candidate) ? this.describeRegion(candidate) : null;
  },

  findBlocks(region): readonly BlockCandidate[] {
    return toBlockCandidates(region, findBlockElements(region.root));
  },

  findComposers(root): readonly HTMLElement[] {
    const matches = new Set<HTMLElement>();
    if (root instanceof Element && root.matches(COMPOSER_SELECTOR)) matches.add(root as HTMLElement);
    root.querySelectorAll<HTMLElement>(COMPOSER_SELECTOR).forEach((element) => matches.add(element));
    return [...matches].filter(isLikelyComposer);
  },

  findContainingComposer(element): HTMLElement | null {
    const candidate = element.closest<HTMLElement>(COMPOSER_SELECTOR);
    return candidate && isLikelyComposer(candidate) ? candidate : null;
  },
};
