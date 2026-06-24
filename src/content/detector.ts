import type { SupportedSite } from '../shared/sites';

const MESSAGE_SELECTORS: Record<SupportedSite, readonly string[]> = {
  chatgpt: [
    '[data-message-author-role="assistant"]',
    'article[data-testid^="conversation-turn-"] [data-message-author-role="assistant"]',
  ],
  claude: [
    '[data-is-streaming="true"]',
    '[data-testid="assistant-message"]',
    '.font-claude-message',
    '[class*="font-claude-message"]',
  ],
};

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
].join(',');

export function findAssistantMessages(root: ParentNode, site: SupportedSite): HTMLElement[] {
  const matches = new Set<HTMLElement>();

  for (const selector of MESSAGE_SELECTORS[site]) {
    if (root instanceof Element && root.matches(selector)) matches.add(root as HTMLElement);
    root.querySelectorAll<HTMLElement>(selector).forEach((element) => matches.add(element));
  }

  return [...matches];
}

export function isInsideAssistantMessage(element: Element, site: SupportedSite): boolean {
  return MESSAGE_SELECTORS[site].some((selector) => element.closest(selector) !== null);
}
