# BidiFix AI

BidiFix AI is a small Manifest V3 Chrome extension that improves mixed Persian/Arabic (RTL) and English (LTR) rendering in assistant responses on ChatGPT and Claude.

It changes only direction and presentation metadata. It never rewrites message text, makes network requests, or sends analytics.

## Features

- Detects ChatGPT and Claude assistant messages.
- Chooses RTL or LTR per paragraph, heading, list item, quote, definition, and table cell.
- Keeps code, links, and technical content isolated as LTR.
- Handles streaming and newly inserted messages with `MutationObserver`.
- Stores global, per-site, and Strong RTL preferences in `chrome.storage.sync`.

## Development

Requirements: Node.js 20.19+ (or 22.12+) and npm.

```sh
npm install
npm run typecheck
npm run lint
npm run build
```

`npm run dev` rebuilds the extension into `dist/` whenever a source file changes. After a rebuild, reload the extension and the open chat tab in Chrome.

## Load the unpacked extension

1. Run `npm install` and `npm run build`.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Select this project's `dist` directory.
6. Open or refresh ChatGPT or Claude. Use the toolbar popup to adjust settings.

When source files change, rebuild and click the extension's **Reload** button on `chrome://extensions`.

## Permissions

- `storage`: saves popup preferences using Chrome sync storage.
- Host access is limited to `chatgpt.com`, `chat.openai.com`, and `claude.ai`.

## License

MIT
