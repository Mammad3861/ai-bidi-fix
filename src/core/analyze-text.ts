import { isLikelyRealCodeText } from './code-classifier.ts';
import { findInlineLtrRanges } from './inline-ltr.ts';
import { detectDirection, hasLtrText, hasRtlText } from './text-direction.ts';
import type { Confidence, ContentKind, TextAnalysis } from './types.ts';

export interface AnalyzeTextOptions {
  strongRtl: boolean;
  classifyCode: boolean;
  inlineCode?: boolean;
}

function diagnosticConfidence(
  realCode: boolean,
  hasRtl: boolean,
  hasLtr: boolean,
): Confidence {
  if (realCode) return 'high';
  if (hasRtl && hasLtr) return 'medium';
  if (hasRtl || hasLtr) return 'high';
  return 'low';
}

function contentKind(
  classifyCode: boolean,
  realCode: boolean,
  hasRtl: boolean,
  hasLtr: boolean,
): ContentKind {
  if (realCode) return 'code';
  if (classifyCode && !hasRtl) return 'technical';
  if (hasRtl || hasLtr) return 'prose';
  return 'unknown';
}

export function analyzeText(text: string, options: AnalyzeTextOptions): TextAnalysis {
  const hasRtl = hasRtlText(text);
  const hasLtr = hasLtrText(text);
  const mixed = hasRtl && hasLtr;
  const realCode = options.classifyCode
    ? isLikelyRealCodeText(text, { inlineCode: options.inlineCode })
    : false;
  const kind = contentKind(options.classifyCode, realCode, hasRtl, hasLtr);
  const ranges = findInlineLtrRanges(text).map(({ start, end }) => ({
    start,
    end,
    direction: 'ltr' as const,
    kind: 'phrase' as const,
  }));
  const reasons: string[] = [];

  if (text.length === 0) reasons.push('empty-text');
  else if (!text.trim()) reasons.push('whitespace-only');
  else if (mixed) reasons.push('mixed-text');
  else if (hasRtl) reasons.push('rtl-text');
  else if (hasLtr) reasons.push('ltr-text');
  else reasons.push('neutral-text');

  if (realCode) reasons.push('real-code');
  else if (kind === 'technical') reasons.push('code-like-technical');
  if (ranges.length > 0) reasons.push('inline-ltr-ranges');
  if (options.strongRtl && !hasRtl && !hasLtr && text.length > 0) reasons.push('strong-rtl');

  return {
    direction: detectDirection(text, options.strongRtl),
    contentKind: kind,
    hasRtl,
    hasLtr,
    mixed,
    confidence: diagnosticConfidence(realCode, hasRtl, hasLtr),
    inlineRanges: ranges,
    reasons,
  };
}
