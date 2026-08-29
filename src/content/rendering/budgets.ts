export const MAX_BLOCKS_PER_MESSAGE = 80;
export const MAX_INLINE_ISOLATION_TEXT_LENGTH = 2000;
export const MAX_LINE_WRAP_TEXT_LENGTH = 4000;
export const MAX_LINE_WRAPPERS_PER_MESSAGE = 80;

export interface LineWrapBudget {
  remaining: number;
}

export function createLineWrapBudget(): LineWrapBudget {
  return { remaining: MAX_LINE_WRAPPERS_PER_MESSAGE };
}
