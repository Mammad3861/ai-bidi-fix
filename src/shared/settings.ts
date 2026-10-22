export interface Settings {
  enabled: boolean;
  chatgptEnabled: boolean;
  claudeEnabled: boolean;
  strongRtl: boolean;
  composerDirectionFix: boolean;
  experimentalMixedPromptFix: boolean;
  debug: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  chatgptEnabled: true,
  claudeEnabled: true,
  strongRtl: false,
  composerDirectionFix: false,
  experimentalMixedPromptFix: false,
  debug: false,
};

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored } as Settings;
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(patch);
}

export async function resetSettings(): Promise<void> {
  await chrome.storage.sync.clear();
  await chrome.storage.sync.set(DEFAULT_SETTINGS);
}

export function isSettingsKey(key: string): key is keyof Settings {
  return key in DEFAULT_SETTINGS;
}

export function subscribeSettings(listener: (patch: Partial<Settings>) => void): () => void {
  const onChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'sync') return;
    const patch: Partial<Settings> = {};
    for (const [key, change] of Object.entries(changes)) {
      if (isSettingsKey(key)) patch[key] = change.newValue ?? DEFAULT_SETTINGS[key];
    }
    if (Object.keys(patch).length > 0) listener(patch);
  };
  chrome.storage.onChanged.addListener(onChanged);
  return () => chrome.storage.onChanged.removeListener(onChanged);
}
