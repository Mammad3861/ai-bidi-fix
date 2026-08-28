const INLINE_LTR_RUN = /(?:https?:\/\/|www\.)[^\s\u0590-\u08ff]+|[A-Za-z][A-Za-z0-9_@#.+:/\\-]*(?:[ \t]+[A-Za-z0-9][A-Za-z0-9_@#.+:/\\-]*)*/g;

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
