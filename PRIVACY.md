# BidiFix AI Privacy Policy

**Effective date:** August 11, 2026

BidiFix AI is a Chrome extension that improves bidirectional right-to-left (RTL) and left-to-right (LTR) text presentation on supported ChatGPT and Claude websites.

## Local text processing

BidiFix AI processes visible text in supported pages locally inside the user's browser. To detect and correct text direction, it may inspect user prompts and AI responses that are present in the page's Document Object Model (DOM). This processing is used solely to improve bidirectional text detection and rendering.

BidiFix AI does not transmit prompt or response text. User text is not uploaded, sold, shared, logged, or stored by BidiFix AI.

## Data collection and network activity

BidiFix AI has:

- No backend or developer-operated server
- No analytics or telemetry
- No advertising or tracking
- No runtime network requests to BidiFix AI, the developer, or third-party services

The extension does not collect or retain browsing content outside the page. Text inspected for rendering remains on the page and is not added to extension storage.

## Extension preferences

BidiFix AI uses `chrome.storage.sync` only to save extension preferences, such as whether the extension, supported sites, or optional rendering modes are enabled. It does not store prompts or AI responses. Chrome may synchronize these preferences through the user's Chrome profile according to Chrome's own settings and policies.

Users can reset preferences from the extension popup or remove the extension through Chrome's extension management page.

## Site access

Site access is limited to the ChatGPT and Claude origins declared in `manifest.json`:

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://claude.ai/*`
- `https://www.claude.ai/*`

The extension does not run on unsupported websites.

## Support and contact

For privacy questions, support requests, or bug reports, open an issue in the [BidiFix AI GitHub repository](https://github.com/Mammad3861/ai-bidi-fix/issues). Do not include private or sensitive prompt content in a public issue.
