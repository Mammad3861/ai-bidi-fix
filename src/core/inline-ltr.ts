// Released v0.1.5 rule: keep compact MiB quantities together, not bare RTL digits.
const INLINE_LTR_RUN = /(?:https?:\/\/|www\.)[^\s\u0590-\u08ff]+|(?:[0-9\u0660-\u0669\u06f0-\u06f9]+(?=MiB(?![A-Za-z0-9_])))?[A-Za-z][A-Za-z0-9_@#.+:/\\-]*(?:[ \t]+[A-Za-z0-9][A-Za-z0-9_@#.+:/\\-]*)*/g;

export interface InlineLtrRange {
  start: number;
  end: number;
  value: string;
}

export function findInlineLtrRanges(text: string): InlineLtrRange[] {
  INLINE_LTR_RUN.lastIndex = 0;

  return Array.from(text.matchAll(INLINE_LTR_RUN), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
    value: match[0],
  }));
}
