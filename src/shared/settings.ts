export interface Settings {
  enabled: boolean;
  chatgptEnabled: boolean;
  claudeEnabled: boolean;
  strongRtl: boolean;
  debug: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  chatgptEnabled: true,
  claudeEnabled: true,
  strongRtl: false,
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
