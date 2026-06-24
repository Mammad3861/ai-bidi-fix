import type { SupportedSite } from '../shared/sites';

const CHATGPT_MESSAGE_SELECTORS = [
  '[data-message-author-role="assistant"]',
  'article[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]',
] as const;

// Prefer semantic/data attributes. Class-based selectors are retained only as
// fallbacks because Claude changes generated class names frequently.
const CLAUDE_MESSAGE_SELECTORS = [
  '[data-testid="assistant-message"]',
  '[data-testid*="assistant-message"]',
  '[data-testid*="assistant-response"]',
  '[data-is-streaming]',
  '[class~="font-claude-message"]',
] as const;

const CLAUDE_PROSE_SELECTORS = [
  '[data-testid*="markdown"]',
  '[data-testid*="response"]',
  '.prose',
  '[class~="prose"]',
  '[class*="prose-"]',
] as const;

const CLAUDE_CONVERSATION_SELECTOR = 'main, [role="main"], [data-testid*="conversation"]';
const CLAUDE_EXCLUDED_SELECTOR = [
  '[data-testid="user-message"]',
  '[data-testid*="user-message"]',
  '[data-testid*="human-message"]',
  'form',
  'textarea',
  '[contenteditable="true"]',
  'nav',
  'aside',
  '[role="dialog"]',
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
  if (!element.textContent?.trim()) return false;

  return (
    element.matches([...CLAUDE_MESSAGE_SELECTORS, ...CLAUDE_PROSE_SELECTORS].join(',')) &&
    (element.matches(TEXT_BLOCK_SELECTOR) || element.querySelector(TEXT_BLOCK_SELECTOR) !== null)
  );
}

function findClaudeMessages(root: ParentNode): HTMLElement[] {
  const candidates = new Set<HTMLElement>();
  addSelectorMatches(root, CLAUDE_MESSAGE_SELECTORS, candidates);
  addSelectorMatches(root, CLAUDE_PROSE_SELECTORS, candidates);
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
    [...CLAUDE_MESSAGE_SELECTORS, ...CLAUDE_PROSE_SELECTORS].join(','),
  );
  return candidate && isLikelyClaudeAssistantContainer(candidate) ? candidate : null;
}
