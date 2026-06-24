import { getSettings, isSettingsKey, updateSettings, type Settings } from '../shared/settings';

const form = document.querySelector<HTMLFormElement>('#settings-form');
const status = document.querySelector<HTMLElement>('#status');

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
  (['chatgptEnabled', 'claudeEnabled', 'strongRtl'] as const).forEach((key) => {
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

void getSettings().then(render);
