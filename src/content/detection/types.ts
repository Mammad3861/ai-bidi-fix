import type { SupportedSite } from '../../shared/sites';

export type RegionRole = 'assistant' | 'user' | 'article' | 'unknown';
export type CandidateHint = 'prose' | 'code-like' | 'technical' | 'unknown';
export type InlineIsolationPolicy = 'default' | 'experimental-only';

export interface RegionCompatibility {
  inlineIsolation: InlineIsolationPolicy;
  messageSiteMarker?: SupportedSite;
  excludedContentSelector?: string;
}

export interface DetectedRegion {
  root: HTMLElement;
  role: RegionRole;
  source: 'adapter';
  sourceId: string;
  priority: number;
  compatibility: RegionCompatibility;
}

export interface BlockCandidate {
  element: HTMLElement;
  // Formatting spans inherit their semantic owner's block direction.
  directionOwner?: HTMLElement;
  region: DetectedRegion;
  hint: CandidateHint;
  editable: boolean;
  structurallySafe: boolean;
  priority: number;
}

export interface ContentDetector {
  findRegions(root: ParentNode): readonly DetectedRegion[];
  findContainingRegion(element: Element): DetectedRegion | null;
  findBlocks(region: DetectedRegion): readonly BlockCandidate[];
}

export interface SiteAdapter extends ContentDetector {
  readonly id: SupportedSite;
  matches(location: Pick<Location, 'hostname' | 'pathname'>): boolean;
  describeRegion(root: HTMLElement, priority?: number): DetectedRegion;
  findComposers(root: ParentNode): readonly HTMLElement[];
  findContainingComposer(element: Element): HTMLElement | null;
}

export const TEXT_BLOCK_SELECTOR = [
  'p',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'th',
  'td',
  'dt',
  'dd',
  '[data-testid*="markdown"]',
  '[class~="whitespace-pre-wrap"]',
  '[class*="whitespace-pre-wrap"]',
].join(',');
