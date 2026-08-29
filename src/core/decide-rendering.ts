import { hasLtrText, hasRtlText } from './text-direction.ts';
import type { RenderDecision, TextAnalysis, TextDirection } from './types.ts';

export interface CompatibilityDecisionContext {
  lineLevel: boolean;
  allowInlineIsolation: boolean;
  forceTechnical?: boolean;
}

export function decideRendering(
  analysis: TextAnalysis,
  context: CompatibilityDecisionContext,
): RenderDecision {
  const technical =
    context.forceTechnical === true ||
    analysis.contentKind === 'code' ||
    analysis.contentKind === 'technical';

  if (technical) {
    return {
      mode: 'minimal',
      direction: 'ltr',
      align: 'left',
      bidi: 'isolate',
      isolateInlineLtr: false,
      technical: true,
      confidence: analysis.confidence,
      reason: 'compat-technical',
    };
  }

  const direction = context.lineLevel ? 'auto' : analysis.direction;
  const isolateInlineLtr =
    !context.lineLevel && direction === 'rtl' && context.allowInlineIsolation;
  const mode = context.lineLevel || isolateInlineLtr ? 'full' : 'minimal';

  return {
    mode,
    direction,
    align: direction === 'rtl' ? 'right' : direction === 'ltr' ? 'left' : 'start',
    bidi: 'plaintext',
    isolateInlineLtr,
    technical: false,
    confidence: analysis.confidence,
    reason: context.lineLevel
      ? 'compat-line-level'
      : isolateInlineLtr
        ? 'compat-rtl-inline'
        : direction === 'rtl'
          ? 'compat-rtl-block'
          : direction === 'ltr'
            ? 'compat-ltr-block'
            : 'compat-auto-block',
  };
}

export function decideComposerDirection(text: string): TextDirection {
  if (!hasRtlText(text)) return 'auto';

  const nonEmptyLines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const hasMixedMultilineText =
    nonEmptyLines.length >= 2 &&
    nonEmptyLines.some(hasRtlText) &&
    nonEmptyLines.some((line) => hasLtrText(line) && !hasRtlText(line));

  return hasMixedMultilineText ? 'auto' : 'rtl';
}
