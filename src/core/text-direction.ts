import type { TextDirection } from './types.ts';

const RTL_CHARACTER = /[\u0590-\u05ff\u0600-\u06ff\u0700-\u074f\u0750-\u077f\u0780-\u07bf\u08a0-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/gu;
const LTR_CHARACTER = /[A-Za-z\u00c0-\u02af]/g;

export type { TextDirection } from './types.ts';

export function detectDirection(text: string, strongRtl: boolean): TextDirection {
  const rtlCount = text.match(RTL_CHARACTER)?.length ?? 0;
  const ltrCount = text.match(LTR_CHARACTER)?.length ?? 0;

  if (rtlCount > 0) return 'rtl';
  if (ltrCount > 0) return 'ltr';
  return strongRtl && text.length > 0 ? 'rtl' : 'auto';
}

export function hasRtlText(text: string): boolean {
  RTL_CHARACTER.lastIndex = 0;
  const result = RTL_CHARACTER.test(text);
  RTL_CHARACTER.lastIndex = 0;
  return result;
}

export function hasLtrText(text: string): boolean {
  LTR_CHARACTER.lastIndex = 0;
  const result = LTR_CHARACTER.test(text);
  LTR_CHARACTER.lastIndex = 0;
  return result;
}
