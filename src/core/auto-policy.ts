import { isLikelyRealCodeText } from './code-classifier.ts';
import { findInlineLtrRanges } from './inline-ltr.ts';
import { hasLtrText, hasRtlText } from './text-direction.ts';
import type { Confidence, RenderDecision, TextDirection } from './types.ts';

export interface AutoPolicyContext {
  structurallySafe: boolean;
  editable: boolean;
  allowInlineIsolation?: boolean;
}

export interface AutoRenderDecision extends RenderDecision {
  lineLevel: false;
}

function noOp(reason: string): AutoRenderDecision {
  return {
    mode: 'none', direction: 'auto', align: 'start', bidi: 'normal',
    isolateInlineLtr: false, technical: false, confidence: 'low',
    reason, lineLevel: false,
  };
}

function correction(
  direction: TextDirection,
  confidence: 'medium' | 'high',
  reason: string,
  technical = false,
  isolateInlineLtr = false,
): AutoRenderDecision {
  return {
    mode: confidence === 'high' ? 'full' : 'minimal',
    direction,
    align: direction === 'rtl' ? 'right' : direction === 'ltr' ? 'left' : 'start',
    bidi: technical ? 'isolate' : 'plaintext',
    isolateInlineLtr,
    technical,
    confidence,
    reason,
    lineLevel: false,
  };
}

function letterEvidence(text: string) {
  let rtl = 0;
  let ltr = 0;
  let rtlWords = 0;
  let ltrWords = 0;
  let unsupported = false;
  let first: 'rtl' | 'ltr' | null = null;
  // Marks and Persian joiners stay within a word, but are not letter votes.
  for (const word of text.match(/[\p{L}\p{M}\u200c\u200d]+/gu) ?? []) {
    let rtlLetters = 0;
    let ltrLetters = 0;
    for (const character of word) {
      if (!/\p{L}/u.test(character)) continue;
      if (hasRtlText(character)) {
        rtlLetters += 1;
        first ??= 'rtl';
      } else if (hasLtrText(character)) {
        ltrLetters += 1;
        first ??= 'ltr';
      } else unsupported = true;
    }
    rtl += rtlLetters;
    ltr += ltrLetters;
    if (rtlLetters >= 2 && ltrLetters === 0) rtlWords += 1;
    if (ltrLetters >= 2 && rtlLetters === 0) ltrWords += 1;
  }
  return { rtl, ltr, rtlWords, ltrWords, unsupported, first };
}

const TECHNICAL_TOKEN = /^(?:(?:https?:\/\/|www\.)\S+|\S*[\\/]\S+|[\p{L}\p{N}_-]+\.[A-Za-z0-9]+)$/iu;
const UNCLASSIFIED_SYNTAX = /[{};=<>|&[\]]/u;

/**
 * Isolated opt-in policy; decideRendering/analyzeText remain compatibility APIs.
 * Confidence is an evidence category, not a probability. See
 * docs/v0.2-auto-policy.md for the exact thresholds and known false negatives.
 */
export function decideAutoRendering(text: string, context: AutoPolicyContext): AutoRenderDecision {
  if (context.structurallySafe !== true || context.editable !== false) return noOp('auto-unsafe-context');
  const normalized = text.trim();
  if (!normalized) return noOp('auto-empty');
  // Preserve the existing classifier even for code with RTL strings/comments.
  if (isLikelyRealCodeText(normalized)) return correction('ltr', 'high', 'auto-real-code', true);

  const evidence = letterEvidence(normalized);
  if (evidence.unsupported) return noOp('auto-unsupported-script');
  if (normalized.split(/\s+/u).every((token) => TECHNICAL_TOKEN.test(token))) {
    return correction('ltr', 'medium', 'auto-technical-token', true);
  }
  if (evidence.rtl + evidence.ltr < 4) return noOp('auto-insufficient-letters');

  const mixed = evidence.rtl > 0 && evidence.ltr > 0;
  const direction = mixed ? 'auto' : evidence.rtl > 0 ? 'rtl' : 'ltr';
  if (UNCLASSIFIED_SYNTAX.test(normalized)) {
    return correction(direction, 'medium', 'auto-unclassified-syntax');
  }

  const strongRtl = evidence.first === 'rtl' && evidence.rtl >= 12 && evidence.rtlWords >= 3
    && evidence.rtl >= 2 * evidence.ltr;
  const strongLtr = !mixed && evidence.ltr >= 12 && evidence.ltrWords >= 3;
  const confidence: Confidence = strongRtl || strongLtr ? 'high' : 'medium';
  if (confidence === 'medium') {
    return correction(direction, confidence, mixed ? 'auto-mixed-ambiguous' : 'auto-limited-prose-evidence');
  }
  const highDirection = strongRtl ? 'rtl' : 'ltr';
  const inline = highDirection === 'rtl' && context.allowInlineIsolation === true
    && findInlineLtrRanges(normalized).length > 0;
  return correction(highDirection, confidence, strongRtl ? 'auto-rtl-evidence' : 'auto-ltr-evidence', false, inline);
}
