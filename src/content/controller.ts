import { getSettings, subscribeSettings, type Settings } from '../shared/settings.ts';
import type { SupportedSite } from '../shared/sites.ts';

interface PageProcessing {
  startProcessing(): void;
  refresh(): void;
  cleanup(): void;
}

export interface ContentController {
  start(): Promise<void>;
  getSettings(): Settings | null;
  isEnabled(): boolean;
}

export function createContentController(
  site: SupportedSite,
  page: PageProcessing,
): ContentController {
  let settings: Settings | null = null;
  let startup: Promise<void> | null = null;

  function isEnabled(): boolean {
    if (!settings?.enabled) return false;
    return site === 'chatgpt' ? settings.chatgptEnabled : settings.claudeEnabled;
  }

  async function initialize(): Promise<void> {
    // Subscribe before reading. Keep removals as default-valued overrides too,
    // so an older snapshot cannot revive a removed/reset preference.
    let pending: Partial<Settings> = {};
    const unsubscribe = subscribeSettings((patch) => {
      if (!settings) {
        pending = { ...pending, ...patch };
        return;
      }
      settings = { ...settings, ...patch };
      page.cleanup();
      if (isEnabled()) page.refresh();
    });

    let loaded: Settings;
    try {
      loaded = await getSettings();
    } catch {
      // Fail closed, without an unhandled rejection or enabled-default fallback.
      unsubscribe();
      return;
    }
    settings = { ...loaded, ...pending };
    pending = {};
    page.startProcessing();
    if (isEnabled()) page.refresh();
  }

  return {
    start() {
      startup ??= initialize();
      return startup;
    },
    getSettings: () => settings,
    isEnabled,
  };
}
