import './styles.css';
import { applyComposerFix, applyDetectedRegion, clearBidiFix } from './bidi';
import { findSiteAdapter } from './adapters/registry';
import type { DetectedRegion } from './detection/types';
import { createBidiObserver } from './observer';
import type { Settings } from '../shared/settings';

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

const adapter = findSiteAdapter(window.location);
const site = adapter?.id ?? null;
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
  if (!adapter || !site || !siteIsEnabled()) return;

  const regions = [...adapter.findRegions(root)];
  if (root instanceof Element) {
    const containingRegion = adapter.findContainingRegion(root);
    if (containingRegion) regions.push(containingRegion);
  }

  const seenRoots = new Set<HTMLElement>();
  const uniqueRegions: DetectedRegion[] = [];
  regions.forEach((region) => {
    if (seenRoots.has(region.root)) return;
    seenRoots.add(region.root);
    uniqueRegions.push(region);
  });
  uniqueRegions.slice(0, MAX_MESSAGES_PER_REFRESH).forEach((region) =>
    applyDetectedRegion(
      region,
      {
        strongRtl: settings.strongRtl,
        experimentalMixedPromptFix: settings.experimentalMixedPromptFix,
      },
      adapter,
    ),
  );
  const processedRegionCount = Math.min(uniqueRegions.length, MAX_MESSAGES_PER_REFRESH);
  if (processedRegionCount > 0 && Date.now() - lastDebugAt > 2000) {
    debugLog(`processed ${site} messages`, processedRegionCount);
    lastDebugAt = Date.now();
  }

  if (settings.composerDirectionFix) {
    const composers = [...adapter.findComposers(root)];
    if (root instanceof Element) {
      const containingComposer = adapter.findContainingComposer(root);
      if (containingComposer) composers.push(containingComposer);
    }
    new Set(composers).forEach(applyComposerFix);
  }
}

if (site && adapter) {
  document.documentElement.dataset.bidifixLoaded = 'true';
  document.documentElement.dataset.bidifixSite = site;
  const observer = createBidiObserver(processRoot);

  document.addEventListener(
    'input',
    (event) => {
      if (!siteIsEnabled() || !settings.composerDirectionFix || !(event.target instanceof Element)) return;
      const composer = adapter.findContainingComposer(event.target);
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
