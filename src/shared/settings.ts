export interface Settings {
  enabled: boolean;
  chatgptEnabled: boolean;
  claudeEnabled: boolean;
  strongRtl: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  chatgptEnabled: true,
  claudeEnabled: true,
  strongRtl: false,
};

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored } as Settings;
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(patch);
}

export function isSettingsKey(key: string): key is keyof Settings {
  return key in DEFAULT_SETTINGS;
}
