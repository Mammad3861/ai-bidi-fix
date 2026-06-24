# BidiFix AI

BidiFix AI is a lightweight Manifest V3 Chrome extension that improves bidirectional text rendering on AI chat websites. It makes Persian and Arabic text easier to read when sentences also contain English product names, commands, URLs, file paths, or technical identifiers.

## The problem

Browsers support right-to-left (RTL) and left-to-right (LTR) text, but heavily mixed content can still appear in the wrong visual order. A Persian paragraph containing phrases such as `Manifest V3`, `npm run build`, or `src/content/index.ts` may show misplaced punctuation, reordered words, or confusing alignment.

BidiFix AI detects chat text blocks, chooses an appropriate block direction, and isolates embedded LTR phrases. It changes presentation and DOM direction metadata without changing the underlying text characters, so normal selection and copy/paste continue to work.

## Supported sites

- ChatGPT: `https://chatgpt.com/*` and `https://chat.openai.com/*`
- Claude: `https://claude.ai/*` and `https://www.claude.ai/*`

The extension handles assistant responses, streamed content, and prompt composers on supported sites.

## Features

- Applies RTL or LTR direction per paragraph, heading, list item, quote, table cell, and detected prose block.
- Isolates inline English and technical phrases inside RTL text.
- Preserves code blocks, inline code, links, paths, commands, numbers, and technical identifiers as LTR.
- Uses `MutationObserver` to process newly streamed messages.
- Provides global, per-site, and Strong RTL settings in a simple popup.
- Stores preferences in `chrome.storage.sync`.

## Privacy

BidiFix AI operates entirely inside the browser:

- No backend or external service
- No analytics or telemetry
- No runtime network requests
- No advertising or tracking
- No collection or transmission of prompts, responses, or other user text

Only extension preferences are stored through Chrome sync storage. Site access is limited to the supported ChatGPT and Claude origins.

## Local development

Requirements:

- Node.js 20.19+ or 22.12+
- npm
- Google Chrome or another Chromium-based browser with Manifest V3 support

Install dependencies:

```sh
npm install
```

Run the development watcher:

```sh
npm run dev
```

The watcher rebuilds the extension into `dist/` after source changes. Reload the extension and refresh the open chat page to use the latest build.

## Build and validation

Run the project checks and create a production build:

```sh
npm run typecheck
npm run lint
npm run build
```

The unpacked extension is generated in `dist/`.

## Load the extension in Chrome

1. Run `npm install` and `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode** in the upper-right corner.
4. Click **Load unpacked**.
5. Select the project's `dist` directory.
6. Open or refresh ChatGPT or Claude.
7. Optionally pin BidiFix AI and use its popup to configure site support or Strong RTL mode.

After rebuilding, return to `chrome://extensions`, click **Reload** on BidiFix AI, and refresh the chat tab.

## Manual testing

Try these prompts on both ChatGPT and Claude.

### Mixed prose and technical terms

```text
یک پاراگراف فارسی بنویس که عبارت‌های BidiFix AI، Manifest V3،
MutationObserver، Chrome Extension، API، DOM و README را داشته باشد.
```

Verify that the paragraph is RTL and right-aligned while each English phrase remains readable from left to right.

### Commands, paths, and URLs

```text
به فارسی توضیح بده چگونه npm run build را اجرا کنم، فایل
src/content/detector.ts را باز کنم و به https://claude.ai مراجعه کنم.
یک code block هم در پاسخ قرار بده.
```

Verify that the Persian text remains RTL while the command, path, URL, inline code, and code block remain LTR. Copy the result into a plain-text editor and confirm that its characters are unchanged.

### Streaming and composer behavior

1. Type a prompt containing both Persian and English and confirm the composer becomes RTL when Persian/Arabic text is present.
2. Submit the prompt and watch the response while it streams.
3. Confirm direction and inline isolation are applied without waiting for the response to finish.
4. Toggle the extension or individual site support from the popup and confirm the page updates accordingly.

## Current MVP limitations

- ChatGPT and Claude can change their page structure without notice. Detection selectors may occasionally require updates.
- Support is limited to the listed sites and Chromium-based browsers; Firefox and Safari are not currently targeted.
- Direction is inferred heuristically from visible Persian, Arabic, and Latin characters. Unusual multilingual or heavily formatted content may still need manual adjustment.
- Inline isolation focuses on common English and technical patterns. Complex mathematical notation, generated interactive artifacts, canvas content, and text inside closed shadow DOM may not be processed.
- Changes to extension code require a rebuild, extension reload, and page refresh.

## Permissions

- `storage`: saves extension settings using Chrome sync storage.
- Declarative site access is limited to the supported ChatGPT and Claude URLs.

## License

This project is available under the [MIT License](LICENSE).
