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
  composerDirectionFix: false,
  experimentalMixedPromptFix: false,
  debug: false,
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
let lastDebugAt = 0;
const MAX_MESSAGES_PER_REFRESH = 30;

function debugLog(message: string, details?: unknown): void {
  if (!settings.debug) return;
  if (details === undefined) console.debug(`[BidiFix AI] ${message}`);
  else console.debug(`[BidiFix AI] ${message}`, details);
}

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

  const uniqueMessages = [...new Set(messages)].slice(0, MAX_MESSAGES_PER_REFRESH);
  uniqueMessages.forEach((message) =>
    applyBidiFix(
      message,
      {
        strongRtl: settings.strongRtl,
        experimentalMixedPromptFix: settings.experimentalMixedPromptFix,
      },
      site,
    ),
  );
  if (uniqueMessages.length > 0 && Date.now() - lastDebugAt > 2000) {
    debugLog(`processed ${site} messages`, uniqueMessages.length);
    lastDebugAt = Date.now();
  }

  if (settings.composerDirectionFix) {
    const composers = findComposers(root, site);
    if (root instanceof Element) {
      const containingComposer = findContainingComposer(root, site);
      if (containingComposer) composers.push(containingComposer);
    }
    new Set(composers).forEach(applyComposerFix);
  }
}

if (site) {
  document.documentElement.dataset.bidifixLoaded = 'true';
  document.documentElement.dataset.bidifixSite = site;
  const observer = createBidiObserver(processRoot);

  document.addEventListener(
    'input',
    (event) => {
      if (!siteIsEnabled() || !settings.composerDirectionFix || !(event.target instanceof Element)) return;
      const composer = findContainingComposer(event.target, site);
      if (composer) applyComposerFix(composer);
    },
    true,
  );

  void getContentSettings().then((loaded) => {
    settings = loaded;
    debugLog(`loaded on ${site}`);
    if (siteIsEnabled()) observer.refresh();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if ((message as { type?: string }).type !== 'bidifix:get-site') return;
    sendResponse({ site });
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
