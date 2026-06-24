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

const CLAUDE_TEXT_CANDIDATE_SELECTORS = [
  'p',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'span',
  'article',
  '[role="article"]',
  ...CLAUDE_MESSAGE_SELECTORS,
  ...CLAUDE_PROSE_SELECTORS,
] as const;

const CLAUDE_EXCLUDED_SELECTOR = [
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
  'pre',
  'code',
].join(',');

const CLAUDE_RTL_CHARACTER = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/u;

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

function hasDirectRtlText(element: HTMLElement): boolean {
  return [...element.childNodes].some(
    (node) => node.nodeType === Node.TEXT_NODE && CLAUDE_RTL_CHARACTER.test(node.textContent ?? ''),
  );
}

function isAllowedClaudeTextContainer(element: HTMLElement): boolean {
  const pageMain = document.querySelector('main, [role="main"]');
  if (pageMain ? !element.closest('main, [role="main"]') : !document.body?.contains(element)) {
    return false;
  }
  if (element.closest(CLAUDE_EXCLUDED_SELECTOR)) return false;
  return CLAUDE_RTL_CHARACTER.test(element.textContent ?? '');
}

function findClaudeMessages(root: ParentNode): HTMLElement[] {
  const candidates = new Set<HTMLElement>();
  const pageMain = document.querySelector<HTMLElement>('main, [role="main"]');
  const searchRoot =
    root instanceof Document
      ? pageMain ?? document.body
      : root instanceof Element && root.closest('main, [role="main"]')
        ? root
        : root instanceof Element && pageMain && root.contains(pageMain)
          ? pageMain
          : pageMain ?? document.body;

  if (!searchRoot) return [];
  addSelectorMatches(searchRoot, CLAUDE_TEXT_CANDIDATE_SELECTORS, candidates);

  const allowed = [...candidates].filter(isAllowedClaudeTextContainer);
  const directTextContainers = allowed.filter(hasDirectRtlText);
  if (directTextContainers.length > 0) {
    const usefulContainers = new Set(directTextContainers);
    directTextContainers.forEach((element) => {
      const parent = element.parentElement;
      if (
        parent &&
        parent !== pageMain &&
        parent.matches(CLAUDE_TEXT_CANDIDATE_SELECTORS.join(',')) &&
        isAllowedClaudeTextContainer(parent)
      ) {
        usefulContainers.add(parent);
      }
    });
    return [...usefulContainers];
  }

  // Last resort for unusual Claude markup: use the smallest RTL candidate.
  return allowed.filter(
    (element) =>
      ![...element.children].some(
        (child) =>
          child instanceof HTMLElement &&
          child.matches(CLAUDE_TEXT_CANDIDATE_SELECTORS.join(',')) &&
          isAllowedClaudeTextContainer(child),
      ),
  );
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

  const candidate = element.closest<HTMLElement>(CLAUDE_TEXT_CANDIDATE_SELECTORS.join(','));
  return candidate && isAllowedClaudeTextContainer(candidate) ? candidate : null;
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
