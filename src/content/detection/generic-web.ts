import type { ContentDetector, DetectedRegion } from './types';

export const GENERIC_WEB_LIMITS = {
  maxNodes: 2000,
  maxCandidates: 200,
  maxDepth: 64,
  maxAncestors: 64,
  maxBlockCharacters: 8192,
  maxTextCharacters: 65536,
} as const;

const READABLE_SELECTOR = 'article, [role~="article"], h1, h2, h3, h4, h5, h6, p, li, blockquote, th, td, dt, dd';
const EXCLUDED_SELECTOR = [
  'head', 'nav', 'aside', 'form', 'dialog', 'button', 'input', 'textarea',
  'select', 'option', 'optgroup', 'fieldset', 'label', 'summary', 'details',
  'script', 'style', 'template', 'noscript', 'iframe', 'object', 'embed',
  'canvas', 'video', 'audio', 'pre', 'code', 'kbd', 'samp', 'var',
  '[hidden]', '[inert]', '[aria-hidden="true" i]',
  '[contenteditable]:not([contenteditable="false" i])',
  '[role~="navigation"]', '[role~="toolbar"]', '[role~="dialog"]', '[role~="alertdialog"]',
  '[role~="banner"]', '[role~="contentinfo"]', '[role~="button"]', '[role~="textbox"]',
  '[role~="checkbox"]', '[role~="radio"]', '[role~="switch"]', '[role~="combobox"]',
  '[role~="listbox"]', '[role~="menu"]', '[role~="menuitem"]', '[role~="tablist"]',
  '[role~="slider"]', '[role~="spinbutton"]', '[role~="tooltip"]',
  '[role~="tab"]', '[role~="searchbox"]', '[role~="treeitem"]',
  '[role~="menuitemcheckbox"]', '[role~="menuitemradio"]', '[role~="option"]',
  '[role~="scrollbar"]', '[role~="grid"]', '[role~="treegrid"]', '[role~="tree"]', '[role~="radiogroup"]',
  '.ProseMirror', '.monaco-editor', '.CodeMirror', '.cm-editor', '.cm-content', '.ace_editor',
].join(',');

function isExcluded(element: Element): boolean {
  if (!(element instanceof HTMLElement) || element.matches(EXCLUDED_SELECTOR)) return true;
  const view = element.ownerDocument.defaultView;
  if (!view) return true;
  const style = view.getComputedStyle(element);
  return style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'
    || style.contentVisibility === 'hidden' || style.opacity === '0';
}

function safeAncestorCount(node: Node): number | null {
  let ancestor = node.parentNode;
  let checked = 0;
  while (ancestor) {
    if (checked >= GENERIC_WEB_LIMITS.maxAncestors || ancestor instanceof ShadowRoot) return null;
    checked += 1;
    if (ancestor instanceof Element && isExcluded(ancestor)) return null;
    ancestor = ancestor.parentNode;
  }
  return checked;
}

interface CandidateFrame {
  element: HTMLElement;
  nested: boolean;
  unsafe: boolean;
  readable: boolean;
  characters: number;
}

function discover(root: ParentNode): HTMLElement[] {
  const start = root instanceof Document ? root.body ?? root.documentElement : root;
  if (!(start instanceof Node) || start instanceof ShadowRoot || start.ownerDocument?.designMode.toLowerCase() === 'on') return [];
  const ancestors = safeAncestorCount(start);
  if (ancestors === null) return [];
  const depthLimit = Math.min(GENERIC_WEB_LIMITS.maxDepth, GENERIC_WEB_LIMITS.maxAncestors - ancestors);
  const found: HTMLElement[] = [];
  const active: CandidateFrame[] = [];
  let visited = 0;
  let characters = 0;

  function rejectAncestors(): void {
    active.forEach((frame) => { frame.unsafe = true; });
  }

  // Walk nodes directly, pruning excluded branches. No querySelectorAll,
  // textContent, or collect-then-slice pass can traverse beyond these budgets.
  function visit(node: Node, depth: number): boolean {
    if (visited >= GENERIC_WEB_LIMITS.maxNodes || found.length >= GENERIC_WEB_LIMITS.maxCandidates) return false;
    visited += 1;
    // Keep discovery inside the same ancestor bound used by subsequent scoped
    // and containing-region lookups, even when the supplied root is nested.
    if (depth > depthLimit || (node instanceof Element && isExcluded(node))) {
      rejectAncestors();
      return true;
    }
    if (node instanceof Text) {
      const length = node.length;
      if (characters + length > GENERIC_WEB_LIMITS.maxTextCharacters) return false;
      characters += length;
      active.forEach((frame) => {
        frame.characters += length;
        if (frame.characters > GENERIC_WEB_LIMITS.maxBlockCharacters) frame.unsafe = true;
      });
      if (length <= GENERIC_WEB_LIMITS.maxBlockCharacters && active.length > 0 && /\S/u.test(node.data)) {
        active.forEach((frame) => { frame.readable = true; });
      }
      return true;
    }

    let frame: CandidateFrame | undefined;
    if (node instanceof HTMLElement && node.matches(READABLE_SELECTOR)) {
      active.forEach((parent) => { parent.nested = true; });
      frame = { element: node, nested: false, unsafe: false, readable: false, characters: 0 };
      active.push(frame);
    }
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (!visit(child, depth + 1)) {
        if (frame) active.pop();
        return false;
      }
    }
    if (frame) {
      active.pop();
      // Emit only fully inspected leaf owners. A parent with mixed direct text
      // and semantic children is deliberately skipped rather than competing.
      if (!frame.nested && !frame.unsafe && frame.readable) found.push(frame.element);
    }
    return true;
  }

  visit(start, 0);
  return found;
}

function describeRegion(root: HTMLElement, priority = 0): DetectedRegion {
  return {
    root,
    role: root.matches('article, [role~="article"]') ? 'article' : 'unknown',
    source: 'generic',
    sourceId: 'generic-web',
    priority,
    compatibility: { inlineIsolation: 'default' },
  };
}

export const genericWebDetector: ContentDetector = {
  findRegions(root) {
    return discover(root).map((element, priority) => describeRegion(element, priority));
  },

  findContainingRegion(element) {
    let current: Element | null = element;
    for (let checked = 0; current && checked < GENERIC_WEB_LIMITS.maxAncestors; checked += 1) {
      if (current instanceof HTMLElement && current.matches(READABLE_SELECTOR)) {
        return discover(current).includes(current) ? describeRegion(current) : null;
      }
      current = current.parentElement;
    }
    return null;
  },

  findBlocks(region) {
    if (region.source !== 'generic') return [];
    return discover(region.root).map((element, priority) => ({
      element,
      region,
      hint: 'prose',
      editable: false,
      structurallySafe: true,
      priority,
    }));
  },
};
