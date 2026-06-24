import './styles.css';
import { applyBidiFix, clearBidiFix } from './bidi';
import { findAssistantMessages, isInsideAssistantMessage } from './detector';
import { createBidiObserver } from './observer';
import type { Settings } from '../shared/settings';
import { getCurrentSite } from '../shared/sites';

// Kept local so Rollup emits a self-contained classic content script. Chrome's
// manifest content_scripts do not support ESM imports.
const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  chatgptEnabled: true,
  claudeEnabled: true,
  strongRtl: false,
};

async function getContentSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored } as Settings;
}

function isSettingsKey(key: string): key is keyof Settings {
  return key in DEFAULT_SETTINGS;
}

const site = getCurrentSite();
let settings: Settings = DEFAULT_SETTINGS;

function siteIsEnabled(): boolean {
  if (!site || !settings.enabled) return false;
  return site === 'chatgpt' ? settings.chatgptEnabled : settings.claudeEnabled;
}

function processRoot(root: ParentNode): void {
  if (!site || !siteIsEnabled()) return;

  const messages = findAssistantMessages(root, site);
  if (root instanceof Element && isInsideAssistantMessage(root, site)) {
    const containingMessage = findAssistantMessages(document, site).find((message) => message.contains(root));
    if (containingMessage) messages.push(containingMessage);
  }

  new Set(messages).forEach((message) => applyBidiFix(message, settings.strongRtl));
}

if (site) {
  const observer = createBidiObserver(processRoot);

  void getContentSettings().then((loaded) => {
    settings = loaded;
    if (siteIsEnabled()) observer.refresh();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    let relevantChange = false;
    for (const [key, change] of Object.entries(changes)) {
      if (!isSettingsKey(key)) continue;
      settings = { ...settings, [key]: change.newValue ?? DEFAULT_SETTINGS[key] };
      relevantChange = true;
    }
    if (!relevantChange) return;
    clearBidiFix();
    if (siteIsEnabled()) observer.refresh();
  });
}
