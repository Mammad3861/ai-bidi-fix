import {
  getSettings,
  isSettingsKey,
  resetSettings,
  updateSettings,
  type Settings,
} from '../shared/settings';

const form = document.querySelector<HTMLFormElement>('#settings-form');
const status = document.querySelector<HTMLElement>('#status');
const currentSite = document.querySelector<HTMLElement>('#current-site');
const resetButton = document.querySelector<HTMLButtonElement>('#reset-settings');

function getInput(key: keyof Settings): HTMLInputElement | null {
  return form?.elements.namedItem(key) as HTMLInputElement | null;
}

function render(settings: Settings): void {
  for (const [key, value] of Object.entries(settings)) {
    if (isSettingsKey(key)) {
      const input = getInput(key);
      if (input) input.checked = value;
    }
  }
  const enabled = settings.enabled;
  (
    [
      'chatgptEnabled',
      'claudeEnabled',
      'strongRtl',
      'composerDirectionFix',
      'experimentalMixedPromptFix',
      'debug',
    ] as const
  ).forEach((key) => {
    const input = getInput(key);
    if (input) input.disabled = !enabled;
  });
}

function showStatus(message: string): void {
  if (!status) return;
  status.textContent = message;
  window.setTimeout(() => {
    if (status.textContent === message) status.textContent = '';
  }, 1200);
}

form?.addEventListener('change', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !isSettingsKey(input.name)) return;
  void updateSettings({ [input.name]: input.checked }).then(async () => {
    render(await getSettings());
    showStatus('Saved');
  });
});

resetButton?.addEventListener('click', () => {
  void resetSettings().then(async () => {
    render(await getSettings());
    showStatus('Settings reset');
  });
});

async function renderCurrentSite(): Promise<void> {
  if (!currentSite) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    currentSite.textContent = 'Unsupported site';
    return;
  }

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: 'bidifix:get-site',
    })) as { site?: 'chatgpt' | 'claude' };
    if (response.site === 'chatgpt' || response.site === 'claude') {
      currentSite.textContent = response.site === 'chatgpt' ? 'ChatGPT' : 'Claude';
      currentSite.closest('.site-status')?.classList.add('supported');
    } else {
      currentSite.textContent = 'Unsupported site';
    }
  } catch {
    currentSite.textContent = 'Unsupported site';
  }
}

void getSettings().then(render);
void renderCurrentSite();
