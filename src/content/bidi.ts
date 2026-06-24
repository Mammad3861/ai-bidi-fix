import { TEXT_BLOCK_SELECTOR } from './detector';

const RTL_CHARACTER = /[\u0590-\u05ff\u0600-\u06ff\u0700-\u074f\u0750-\u077f\u0780-\u07bf\u08a0-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/gu;
const LTR_CHARACTER = /[A-Za-z\u00c0-\u02af]/g;
const TECHNICAL_SELECTOR = 'pre, code, kbd, samp, a[href], [data-ai-bidi-technical]';

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
  clone.querySelectorAll(TECHNICAL_SELECTOR).forEach((node) => node.remove());
  return clone.textContent?.trim() ?? '';
}

export function detectDirection(text: string, strongRtl: boolean): TextDirection {
  const rtlCount = text.match(RTL_CHARACTER)?.length ?? 0;
  const ltrCount = text.match(LTR_CHARACTER)?.length ?? 0;

  if (rtlCount === 0 && ltrCount === 0) return 'auto';
  if (strongRtl && rtlCount > 0) return 'rtl';
  return rtlCount >= ltrCount ? 'rtl' : 'ltr';
}

function markTechnicalContent(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('pre, code, kbd, samp').forEach((element) => {
    element.dataset.aiBidiTechnical = 'true';
    setManagedDirection(element, 'ltr');
  });

  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((element) => {
    element.dataset.aiBidiTechnical = 'true';
    setManagedDirection(element, 'ltr');
  });
}

export function applyBidiFix(message: HTMLElement, strongRtl: boolean): void {
  message.dataset.aiBidiMessage = 'true';
  markTechnicalContent(message);

  const blocks = new Set<HTMLElement>();
  if (message.matches(TEXT_BLOCK_SELECTOR)) blocks.add(message);
  message.querySelectorAll<HTMLElement>(TEXT_BLOCK_SELECTOR).forEach((block) => blocks.add(block));

  blocks.forEach((block) => {
    if (block.closest(TECHNICAL_SELECTOR)) return;
    const direction = detectDirection(directReadableText(block), strongRtl);
    block.dataset.aiBidiBlock = direction;
    setManagedDirection(block, direction);
  });
}

export function clearBidiFix(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-ai-bidi-block]').forEach((element) => {
    delete element.dataset.aiBidiBlock;
    restoreDirection(element);
  });
  root.querySelectorAll<HTMLElement>('[data-ai-bidi-technical]').forEach((element) => {
    delete element.dataset.aiBidiTechnical;
    restoreDirection(element);
  });
  root.querySelectorAll<HTMLElement>('[data-ai-bidi-message]').forEach((element) => {
    delete element.dataset.aiBidiMessage;
  });
}
