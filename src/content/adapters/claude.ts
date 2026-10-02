import { isClaudeHostname } from '../../shared/sites';
import type {
  BlockCandidate,
  CandidateHint,
  DetectedRegion,
  RegionRole,
  SiteAdapter,
} from '../detection/types';
import { TEXT_BLOCK_SELECTOR } from '../detection/types';
import { INLINE_LTR_SKIP_SELECTOR } from '../rendering/dom-state';

// Prefer semantic/data attributes. Class-based selectors are retained only as
// fallbacks because Claude changes generated class names frequently.
const MESSAGE_SELECTORS = [
  '[data-testid="assistant-message"]',
  '[data-testid*="assistant"]',
  '[data-testid*="message"]',
  '[data-is-streaming]',
  '.font-claude-message',
  '[class~="font-claude-message"]',
  '[class*="font-claude-message"]',
] as const;

const PROSE_SELECTORS = [
  '[data-testid*="markdown"]',
  '[data-testid*="response"]',
  '.prose',
  '[class~="prose"]',
  '[class*="prose"]',
] as const;

const TEXT_CANDIDATE_SELECTORS = [
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
  ...MESSAGE_SELECTORS,
  ...PROSE_SELECTORS,
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
  'pre',
  'code',
].join(',');

const COMPOSER_SELECTOR = [
  '#prompt-textarea',
  'textarea',
  'input[type="text"]',
  'input:not([type])',
  '[contenteditable="true"]',
  '[role="textbox"]',
].join(',');

const RTL_CHARACTER = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/u;
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

function hasDirectRtlText(element: HTMLElement): boolean {
  return [...element.childNodes].some(
    (node) => node.nodeType === Node.TEXT_NODE && RTL_CHARACTER.test(node.textContent ?? ''),
  );
}

function isAllowedTextContainer(element: HTMLElement): boolean {
  const pageMain = document.querySelector('main, [role="main"]');
  if (pageMain ? !element.closest('main, [role="main"]') : !document.body?.contains(element)) {
    return false;
  }
  if (element.closest(EXCLUDED_SELECTOR)) return false;
  return RTL_CHARACTER.test(element.textContent ?? '');
}

function regionRole(element: HTMLElement): RegionRole {
  if (
    element.closest(
      '[data-testid="assistant-message"], [data-testid*="assistant"], .font-claude-message, [class~="font-claude-message"], [class*="font-claude-message"]',
    )
  ) {
    return 'assistant';
  }
  if (element.matches('article, [role="article"]')) return 'article';
  return 'unknown';
}

function sourceId(element: HTMLElement, role: RegionRole): string {
  if (role === 'assistant') return 'claude:assistant-message';
  if (element.closest('[data-is-streaming]')) return 'claude:streaming-message';
  if (role === 'article') return 'claude:article';
  return 'claude:rtl-text';
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

  // Claude sometimes emits prose as nested divs without p/li semantics.
  message.querySelectorAll<HTMLElement>('div').forEach((div) => {
    if (hasDirectTextNode(div)) blocks.add(div);
  });

  // Claude occasionally streams prose as bare spans instead of paragraph tags.
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
  return (
    element.closest('form') !== null ||
    element.classList.contains('ProseMirror') ||
    element.hasAttribute('data-placeholder')
  );
}

export const claudeAdapter: SiteAdapter = {
  id: 'claude',

  matches(location): boolean {
    return isClaudeHostname(location.hostname);
  },

  describeRegion(root, priority = 0): DetectedRegion {
    const role = regionRole(root);
    return {
      root,
      role,
      source: 'adapter',
      sourceId: sourceId(root, role),
      priority,
      compatibility: {
        inlineIsolation: 'default',
        messageSiteMarker: 'claude',
      },
    };
  },

  findRegions(root): readonly DetectedRegion[] {
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
    addSelectorMatches(searchRoot, TEXT_CANDIDATE_SELECTORS, candidates);

    const allowed = [...candidates].filter(isAllowedTextContainer);
    const directTextContainers = allowed.filter(hasDirectRtlText);
    let usefulContainers: HTMLElement[];
    if (directTextContainers.length > 0) {
      const useful = new Set(directTextContainers);
      directTextContainers.forEach((element) => {
        const parent = element.parentElement;
        if (
          parent &&
          parent !== pageMain &&
          parent.matches(TEXT_CANDIDATE_SELECTORS.join(',')) &&
          isAllowedTextContainer(parent)
        ) {
          useful.add(parent);
        }
      });
      usefulContainers = [...useful];
    } else {
      // Last resort for unusual Claude markup: use the smallest RTL candidate.
      usefulContainers = allowed.filter(
        (element) =>
          ![...element.children].some(
            (child) =>
              child instanceof HTMLElement &&
              child.matches(TEXT_CANDIDATE_SELECTORS.join(',')) &&
              isAllowedTextContainer(child),
          ),
      );
    }

    return usefulContainers.map((element, priority) => this.describeRegion(element, priority));
  },

  findContainingRegion(element): DetectedRegion | null {
    const candidate = element.closest<HTMLElement>(TEXT_CANDIDATE_SELECTORS.join(','));
    return candidate && isAllowedTextContainer(candidate) ? this.describeRegion(candidate) : null;
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
