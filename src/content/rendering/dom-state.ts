import type { TextDirection } from '../../core/types';

export const INLINE_LTR_WRAPPER_SELECTOR = '[data-bidifix-inline-ltr="true"]';
export const LINE_DIRECTION_WRAPPER_SELECTOR = '[data-bidifix-line="true"]';
export const COMPOSER_STATE_SELECTOR = '[data-bidifix-composer]';
export const DIRECTION_STATE_SELECTOR = '[data-bidifix-direction]';
export const TECHNICAL_STATE_SELECTOR = '[data-bidifix-technical]';
export const MESSAGE_STATE_SELECTOR = '[data-bidifix-message]';
export const RENDERER_GENERATED_WRAPPER_SELECTOR = [
  LINE_DIRECTION_WRAPPER_SELECTOR,
  INLINE_LTR_WRAPPER_SELECTOR,
].join(',');

export const INLINE_LTR_SKIP_SELECTOR = [
  'kbd',
  'samp',
  'var',
  'a[href]',
  'textarea',
  'input',
  '[contenteditable="true"]',
  'button',
  '[role="button"]',
  INLINE_LTR_WRAPPER_SELECTOR,
  '[data-bidifix-technical="true"]',
].join(',');

export function setManagedDirection(element: HTMLElement, direction: TextDirection): void {
  if (element.dataset.aiBidiOriginalDir === undefined) {
    element.dataset.aiBidiOriginalDir = element.getAttribute('dir') ?? '';
  }
  element.dir = direction;
}

export function restoreManagedDirection(element: HTMLElement): void {
  const original = element.dataset.aiBidiOriginalDir;
  if (original === undefined) return;
  if (original) element.setAttribute('dir', original);
  else element.removeAttribute('dir');
  delete element.dataset.aiBidiOriginalDir;
}

export function elementsMatchingRootOrDescendants(
  root: ParentNode,
  selector: string,
): HTMLElement[] {
  const elements: HTMLElement[] = [];
  if (root instanceof HTMLElement && root.matches(selector)) elements.push(root);
  root.querySelectorAll<HTMLElement>(selector).forEach((element) => elements.push(element));
  return elements;
}

export function isRendererOwnedNode(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element?.closest(RENDERER_GENERATED_WRAPPER_SELECTOR));
}
