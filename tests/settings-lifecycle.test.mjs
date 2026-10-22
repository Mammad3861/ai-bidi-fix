import assert from 'node:assert/strict';
import test from 'node:test';

import { createContentController } from '../src/content/controller.ts';
import { getSettings, resetSettings, updateSettings } from '../src/shared/settings.ts';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(t, site = 'chatgpt') {
  const originalChrome = globalThis.chrome;
  const read = deferred();
  const listeners = new Set();
  let stored = {};
  let reads = 0;
  const calls = [];
  function emit(changes, area = 'sync') {
    for (const listener of listeners) listener(changes, area);
  }
  globalThis.chrome = { storage: {
    sync: {
      get: () => { reads += 1; return reads === 1 ? read.promise : Promise.resolve({ ...stored }); },
      async set(patch) {
        const changes = {};
        for (const [key, newValue] of Object.entries(patch)) {
          if (stored[key] !== newValue) changes[key] = { oldValue: stored[key], newValue };
        }
        stored = { ...stored, ...patch };
        emit(changes);
      },
      async clear() {
        const changes = Object.fromEntries(Object.entries(stored).map(([key, oldValue]) => [key, { oldValue }]));
        stored = {};
        emit(changes);
      },
    },
    onChanged: {
      addListener: (listener) => listeners.add(listener),
      removeListener: (listener) => listeners.delete(listener),
    },
  } };
  t.after(() => {
    if (originalChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = originalChrome;
  });
  const controller = createContentController(site, {
    startProcessing: () => calls.push('start'),
    refresh: () => calls.push('refresh'),
    cleanup: () => calls.push('cleanup'),
  });
  return { controller, read, calls, emit, listeners, reads: () => reads, stored: () => stored };
}

test('stored-disabled startup never starts rendering with enabled defaults', async (t) => {
  const { controller, read, calls, listeners, reads } = setup(t);
  const first = controller.start();
  const second = controller.start();
  assert.equal(reads(), 1, 'repeated start shares the initial read');
  assert.equal(listeners.size, 1, 'one storage subscription while loading');
  assert.equal(controller.isEnabled(), false);
  assert.equal(controller.getSettings(), null);
  assert.deepEqual(calls, [], 'no observer/listener infrastructure before settings');
  read.resolve({ enabled: false });
  await Promise.all([first, second]);
  await controller.start();
  assert.deepEqual(calls, ['start'], 'infrastructure starts once, without a rendering refresh');
  assert.equal(controller.isEnabled(), false);
  assert.equal(controller.getSettings().composerDirectionFix, false);
  assert.equal(controller.getSettings().experimentalMixedPromptFix, false);
  assert.equal(controller.getSettings().debug, false);
});

test('newest changes and key removals win over a stale initial snapshot', async (t) => {
  const { controller, read, calls, emit } = setup(t);
  const started = controller.start();
  emit({ enabled: { newValue: false }, composerDirectionFix: { newValue: true } });
  emit({ enabled: { oldValue: false, newValue: true } });
  emit({ composerDirectionFix: { oldValue: true } });
  emit({ experimentalMixedPromptFix: { newValue: true } }, 'local');
  emit({ unknownPreference: { newValue: false } });
  assert.deepEqual(calls, [], 'loading updates never trigger processing');
  read.resolve({ enabled: false, composerDirectionFix: true });
  await started;
  assert.equal(controller.isEnabled(), true);
  assert.equal(controller.getSettings().composerDirectionFix, false, 'removed key resets to its default');
  assert.equal(controller.getSettings().experimentalMixedPromptFix, false, 'other storage areas are ignored');
  assert.deepEqual(calls, ['start', 'refresh']);
});

test('a disable arriving during loading prevents a stale enabled snapshot from rendering', async (t) => {
  const { controller, read, calls, emit } = setup(t);
  const started = controller.start();
  emit({ enabled: { newValue: false } });
  read.resolve({ enabled: true });
  await started;
  assert.equal(controller.isEnabled(), false);
  assert.deepEqual(calls, ['start']);
});

for (const [site, siteKey] of [['chatgpt', 'chatgptEnabled'], ['claude', 'claudeEnabled']]) {
  test(`${site} disable/re-enable cleans and reapplies without duplicate initialization or subscriptions`, async (t) => {
    const { controller, read, calls, emit, listeners, reads } = setup(t, site);
    const started = controller.start();
    read.resolve({});
    await started;
    assert.deepEqual(calls, ['start', 'refresh']);
    calls.length = 0;
    emit({ enabled: { newValue: false } });
    assert.equal(controller.isEnabled(), false);
    assert.deepEqual(calls, ['cleanup']);
    emit({ enabled: { newValue: true } });
    assert.equal(controller.isEnabled(), true);
    assert.deepEqual(calls, ['cleanup', 'cleanup', 'refresh']);
    calls.length = 0;
    emit({ [siteKey]: { newValue: false } });
    assert.equal(controller.isEnabled(), false);
    emit({ [siteKey]: { oldValue: false } });
    assert.equal(controller.isEnabled(), true);
    assert.deepEqual(calls, ['cleanup', 'cleanup', 'refresh']);
    await controller.start();
    assert.equal(listeners.size, 1);
    assert.equal(reads(), 1);
    assert.deepEqual(calls, ['cleanup', 'cleanup', 'refresh'], 'starting again adds no page listeners/observer');
    calls.length = 0;
    emit({ composerDirectionFix: { newValue: true }, experimentalMixedPromptFix: { newValue: true } });
    assert.equal(controller.getSettings().composerDirectionFix, true);
    assert.equal(controller.getSettings().experimentalMixedPromptFix, true);
    assert.deepEqual(calls, ['cleanup', 'refresh']);
  });
}

test('reset while loading keeps defaults instead of reviving stale opt-in settings', async (t) => {
  const { controller, read, calls, stored } = setup(t);
  const started = controller.start();
  await updateSettings({ enabled: false, strongRtl: true, composerDirectionFix: true, experimentalMixedPromptFix: true, debug: true });
  await resetSettings();
  read.resolve({ enabled: false, strongRtl: true, composerDirectionFix: true, experimentalMixedPromptFix: true, debug: true });
  await started;
  assert.equal(controller.isEnabled(), true);
  assert.deepEqual(controller.getSettings(), {
    enabled: true, chatgptEnabled: true, claudeEnabled: true,
    strongRtl: false, composerDirectionFix: false, experimentalMixedPromptFix: false, debug: false,
  });
  assert.deepEqual(stored(), controller.getSettings(), 'reset still clears then writes all defaults');
  assert.deepEqual(await getSettings(), {
    enabled: true, chatgptEnabled: true, claudeEnabled: true,
    strongRtl: false, composerDirectionFix: false, experimentalMixedPromptFix: false, debug: false,
  }, 'popup reads the same reset preferences');
  assert.deepEqual(calls, ['start', 'refresh']);
});

test('initial read failure is handled without processing or an unhandled rejection', async (t) => {
  const { controller, read, calls, emit, listeners } = setup(t);
  const started = controller.start();
  emit({ enabled: { newValue: true } });
  read.reject(new Error('Storage unavailable'));
  await assert.doesNotReject(started);
  assert.equal(controller.getSettings(), null);
  assert.equal(controller.isEnabled(), false);
  assert.deepEqual(calls, []);
  assert.equal(listeners.size, 0, 'failed startup releases its pending storage subscription');
  await controller.start();
  assert.deepEqual(calls, [], 'repeated startup does not silently fall back to enabled defaults');
});
