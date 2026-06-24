import type { SupportedSite } from '../shared/sites';

const CHATGPT_MESSAGE_SELECTORS = [
  '[data-message-author-role="assistant"]',
  'article[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]',
] as const;

// Prefer semantic/data attributes. Class-based selectors are retained only as
// fallbacks because Claude changes generated class names frequently.
const CLAUDE_MESSAGE_SELECTORS = [
  '[data-testid="assistant-message"]',
  '[data-testid*="assistant"]',
  '[data-testid*="message"]',
  '[data-is-streaming]',
  '.font-claude-message',
  '[class~="font-claude-message"]',
  '[class*="font-claude-message"]',
] as const;

const CLAUDE_PROSE_SELECTORS = [
  '[data-testid*="markdown"]',
  '[data-testid*="response"]',
  '.prose',
  '[class~="prose"]',
  '[class*="prose"]',
] as const;

const CLAUDE_FALLBACK_SELECTORS = [
  'main article',
  'main [role="article"]',
  'main div[class*="grid"]',
] as const;

const CLAUDE_CONVERSATION_SELECTOR = 'main, [role="main"], [data-testid*="conversation"]';
const CLAUDE_EXCLUDED_SELECTOR = [
  '[data-testid="user-message"]',
  '[data-testid*="user-message"]',
  '[data-testid*="human-message"]',
  '[data-testid*="user"]',
  '[data-testid*="human"]',
  '[data-message-author-role="user"]',
  '#prompt-textarea',
  'form',
  'textarea',
  'input',
  '[contenteditable="true"]',
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

export const TEXT_BLOCK_SELECTOR = [
  'p',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'th',
  'td',
  'dt',
  'dd',
  '[data-testid*="markdown"]',
  '[class~="whitespace-pre-wrap"]',
].join(',');

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

function isLikelyClaudeAssistantContainer(element: HTMLElement): boolean {
  if (!element.closest(CLAUDE_CONVERSATION_SELECTOR)) return false;
  if (element.closest(CLAUDE_EXCLUDED_SELECTOR)) return false;
  const text = element.textContent?.trim() ?? '';
  if (!text) return false;

  const explicit = element.matches(
    [...CLAUDE_MESSAGE_SELECTORS, ...CLAUDE_PROSE_SELECTORS].join(','),
  );
  if (explicit) return true;

  // Broad layout fallbacks are accepted only for RTL content and only when
  // they do not contain a user message or composer region.
  if (!element.matches(CLAUDE_FALLBACK_SELECTORS.join(','))) return false;
  if (element.querySelector(CLAUDE_EXCLUDED_SELECTOR)) return false;
  const hasRtl = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/u.test(text);
  return hasRtl;
}

function findClaudeMessages(root: ParentNode): HTMLElement[] {
  const candidates = new Set<HTMLElement>();
  addSelectorMatches(root, CLAUDE_MESSAGE_SELECTORS, candidates);
  addSelectorMatches(root, CLAUDE_PROSE_SELECTORS, candidates);
  addSelectorMatches(root, CLAUDE_FALLBACK_SELECTORS, candidates);
  return [...candidates].filter(isLikelyClaudeAssistantContainer);
}

export function findAssistantMessages(root: ParentNode, site: SupportedSite): HTMLElement[] {
  if (site === 'claude') return findClaudeMessages(root);

  const matches = new Set<HTMLElement>();
  addSelectorMatches(root, CHATGPT_MESSAGE_SELECTORS, matches);
  return [...matches];
}

export function findContainingAssistantMessage(
  element: Element,
  site: SupportedSite,
): HTMLElement | null {
  if (site === 'chatgpt') {
    return element.closest<HTMLElement>(CHATGPT_MESSAGE_SELECTORS.join(','));
  }

  const candidate = element.closest<HTMLElement>(
    [
      ...CLAUDE_MESSAGE_SELECTORS,
      ...CLAUDE_PROSE_SELECTORS,
      ...CLAUDE_FALLBACK_SELECTORS,
    ].join(','),
  );
  return candidate && isLikelyClaudeAssistantContainer(candidate) ? candidate : null;
}

function isLikelyComposer(element: HTMLElement, site: SupportedSite): boolean {
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

  if (site === 'chatgpt') {
    return element.id === 'prompt-textarea' || element.closest('form') !== null;
  }

  return (
    element.closest('form') !== null ||
    element.classList.contains('ProseMirror') ||
    element.hasAttribute('data-placeholder')
  );
}

export function findComposers(root: ParentNode, site: SupportedSite): HTMLElement[] {
  const matches = new Set<HTMLElement>();
  if (root instanceof Element && root.matches(COMPOSER_SELECTOR)) matches.add(root as HTMLElement);
  root.querySelectorAll<HTMLElement>(COMPOSER_SELECTOR).forEach((element) => matches.add(element));
  return [...matches].filter((element) => isLikelyComposer(element, site));
}

export function findContainingComposer(
  element: Element,
  site: SupportedSite,
): HTMLElement | null {
  const candidate = element.closest<HTMLElement>(COMPOSER_SELECTOR);
  return candidate && isLikelyComposer(candidate, site) ? candidate : null;
}
