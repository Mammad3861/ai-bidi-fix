export type TextDirection = 'rtl' | 'ltr' | 'auto';
export type Confidence = 'low' | 'medium' | 'high';
export type ContentKind = 'prose' | 'code' | 'technical' | 'unknown';

export interface InlineTextRange {
  start: number;
  end: number;
  direction: 'ltr';
  kind: 'url' | 'path' | 'command' | 'identifier' | 'phrase';
}

export interface TextAnalysis {
  direction: TextDirection;
  contentKind: ContentKind;
  hasRtl: boolean;
  hasLtr: boolean;
  mixed: boolean;
  confidence: Confidence;
  inlineRanges: readonly InlineTextRange[];
  reasons: readonly string[];
}

export type RenderMode = 'none' | 'minimal' | 'full';

export interface RenderDecision {
  mode: RenderMode;
  direction: TextDirection;
  align: 'left' | 'right' | 'start';
  bidi: 'plaintext' | 'isolate' | 'normal';
  isolateInlineLtr: boolean;
  technical: boolean;
  confidence: Confidence;
  reason: string;
}
