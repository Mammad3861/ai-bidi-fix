import { getSiteAdapter } from './adapters/registry';
import { TEXT_BLOCK_SELECTOR } from './detection/types';
import type { SupportedSite } from '../shared/sites';

export { TEXT_BLOCK_SELECTOR };

export function findAssistantMessages(root: ParentNode, site: SupportedSite): HTMLElement[] {
  return getSiteAdapter(site)?.findRegions(root).map((region) => region.root) ?? [];
}

export function findContainingAssistantMessage(
  element: Element,
  site: SupportedSite,
): HTMLElement | null {
  return getSiteAdapter(site)?.findContainingRegion(element)?.root ?? null;
}

export function findComposers(root: ParentNode, site: SupportedSite): HTMLElement[] {
  return [...(getSiteAdapter(site)?.findComposers(root) ?? [])];
}

export function findContainingComposer(
  element: Element,
  site: SupportedSite,
): HTMLElement | null {
  return getSiteAdapter(site)?.findContainingComposer(element) ?? null;
}
