import './styles.css';
import { applyComposerFix, applyDetectedRegion, clearBidiFix } from './bidi';
import { findSiteAdapter } from './adapters/registry';
import type { DetectedRegion } from './detection/types';
import { createBidiObserver, type BidiObserver } from './observer';
import { createContentController, type ContentController } from './controller';

const adapter = findSiteAdapter(window.location);
const site = adapter?.id ?? null;
let controller: ContentController | null = null;
let lastDebugAt = 0;
const MAX_MESSAGES_PER_REFRESH = 30;

function debugLog(message: string, details?: unknown): void {
  if (!controller?.getSettings()?.debug) return;
  if (details === undefined) console.debug(`[BidiFix AI] ${message}`);
  else console.debug(`[BidiFix AI] ${message}`, details);
}

function siteIsEnabled(): boolean {
  return controller?.isEnabled() ?? false;
}

function processRoot(root: ParentNode): void {
  const settings = controller?.getSettings();
  if (!adapter || !site || !settings || !siteIsEnabled()) return;

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
  let observer: BidiObserver | null = null;
  controller = createContentController(site, {
    startProcessing() {
      document.documentElement.dataset.bidifixLoaded = 'true';
      document.documentElement.dataset.bidifixSite = site;
      observer = createBidiObserver(processRoot);
      document.addEventListener(
        'input',
        (event) => {
          if (!siteIsEnabled() || !controller?.getSettings()?.composerDirectionFix || !(event.target instanceof Element)) return;
          const composer = adapter.findContainingComposer(event.target);
          if (composer) applyComposerFix(composer);
        },
        true,
      );
      debugLog(`loaded on ${site}`);
    },
    refresh: () => observer?.refresh(),
    cleanup: clearBidiFix,
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if ((message as { type?: string }).type !== 'bidifix:get-site') return;
    sendResponse({ site });
  });

  void controller.start();
}
