import type { SupportedSite } from '../../shared/sites';
import type { SiteAdapter } from '../detection/types';
import { chatGptAdapter } from './chatgpt';
import { claudeAdapter } from './claude';

export const SITE_ADAPTERS: readonly SiteAdapter[] = [chatGptAdapter, claudeAdapter];

export function getSiteAdapter(site: SupportedSite): SiteAdapter | null {
  return SITE_ADAPTERS.find((adapter) => adapter.id === site) ?? null;
}

export function findSiteAdapter(
  location: Pick<Location, 'hostname' | 'pathname'>,
): SiteAdapter | null {
  return SITE_ADAPTERS.find((adapter) => adapter.matches(location)) ?? null;
}
