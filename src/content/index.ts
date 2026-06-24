import './styles.css';
import { applyBidiFix, applyComposerFix, clearBidiFix } from './bidi';
import {
  findAssistantMessages,
  findComposers,
  findContainingAssistantMessage,
  findContainingComposer,
} from './detector';
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
  if (root instanceof Element) {
    const containingMessage = findContainingAssistantMessage(root, site);
    if (containingMessage) messages.push(containingMessage);
  }

  new Set(messages).forEach((message) => applyBidiFix(message, settings.strongRtl));

  const composers = findComposers(root, site);
  if (root instanceof Element) {
    const containingComposer = findContainingComposer(root, site);
    if (containingComposer) composers.push(containingComposer);
  }
  new Set(composers).forEach(applyComposerFix);
}

if (site) {
  const observer = createBidiObserver(processRoot);

  document.addEventListener(
    'input',
    (event) => {
      if (!siteIsEnabled() || !(event.target instanceof Element)) return;
      const composer = findContainingComposer(event.target, site);
      if (composer) applyComposerFix(composer);
    },
    true,
  );

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
