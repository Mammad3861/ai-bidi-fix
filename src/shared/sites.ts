export type SupportedSite = 'chatgpt' | 'claude';

export function getCurrentSite(hostname = window.location.hostname): SupportedSite | null {
  if (hostname === 'chatgpt.com' || hostname === 'chat.openai.com') return 'chatgpt';
  if (hostname === 'claude.ai') return 'claude';
  return null;
}
