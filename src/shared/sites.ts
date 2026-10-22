export type SupportedSite = 'chatgpt' | 'claude';

export function isChatGptHostname(hostname: string): boolean {
  return hostname === 'chatgpt.com' || hostname === 'chat.openai.com';
}

export function isClaudeHostname(hostname: string): boolean {
  return hostname === 'claude.ai' || hostname === 'www.claude.ai';
}

export function getCurrentSite(hostname = window.location.hostname): SupportedSite | null {
  if (isChatGptHostname(hostname)) return 'chatgpt';
  if (isClaudeHostname(hostname)) return 'claude';
  return null;
}
