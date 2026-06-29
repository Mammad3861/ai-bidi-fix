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
- Shows whether the current tab is ChatGPT, Claude, or unsupported.
- Leaves ChatGPT/Claude editors untouched by default; composer direction fixes are optional.
- Keeps default processing performance-safe; the experimental mixed prompt fix is optional.
- Includes an optional Debug Mode for local troubleshooting; it is disabled by default.
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

## Install from a GitHub release

1. Open the project's **Releases** page on GitHub.
2. Download the extension ZIP attached to the desired release or pre-release.
3. Extract the ZIP to a permanent local directory. Chrome cannot load the extension directly from the ZIP file.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Click **Load unpacked** and select the extracted directory containing `manifest.json`.
7. Open or refresh ChatGPT or Claude.

Chrome does not automatically update manually loaded release ZIPs. To test a newer pre-release, download and extract it into a new directory, remove or reload the previous unpacked version, and select the new directory with **Load unpacked**. Confirm the version shown on `chrome://extensions` before testing.

## Load a local development build

1. Run `npm install` and `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode** in the upper-right corner.
4. Click **Load unpacked**.
5. Select the project's `dist` directory.
6. Open or refresh ChatGPT or Claude.
7. Optionally pin BidiFix AI and use its popup to configure site support or Strong RTL mode.

After rebuilding, return to `chrome://extensions`, click **Reload** on BidiFix AI, and refresh the chat tab.

## Tester notes

- The popup identifies the active tab as ChatGPT, Claude, or unsupported.
- Debug Mode is off by default. Enable it only when collecting troubleshooting output from DevTools, then turn it off again.
- **Composer direction fix** is off by default because it touches active editor/composer DOM and may affect editor behavior on some sites.
- **Experimental mixed prompt fix** is off by default. It can improve rare English-first prompt blocks, but may affect performance on long chats.
- **Reset settings** restores the global, per-site, Strong RTL, composer, experimental, and Debug Mode defaults.
- Before reporting a rendering issue, reproduce it with the smallest non-sensitive text sample possible.

## Manual testing

Try these prompts on both ChatGPT and Claude. Before publishing a release, complete the full [manual QA checklist](docs/manual-test.md).

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
- Active composer/editor direction changes are opt-in. Enable **Composer direction fix** only if you need it, and turn it off if typing, Shift+Enter, paste, or editor controls feel worse.
- Rare mixed prompt cards that start in English and later contain Persian/Arabic text use lightweight fixes by default. Enable **Experimental mixed prompt fix** only when needed, and turn it off if ChatGPT becomes slow or copy/paste feels worse.
- Inline isolation focuses on common English and technical patterns. Complex mathematical notation, generated interactive artifacts, canvas content, and text inside closed shadow DOM may not be processed.
- Changes to extension code require a rebuild, extension reload, and page refresh.

## Permissions

- `storage`: saves extension settings using Chrome sync storage.
- Declarative site access is limited to the supported ChatGPT and Claude URLs.

## Roadmap

- Keep pace with ChatGPT and Claude DOM changes.
- Expand test coverage for bidi direction detection and inline isolation.
- Improve handling of mathematical notation and complex rendered artifacts.
- Evaluate support for additional AI chat sites based on user feedback.
- Explore Firefox support after the Chromium MVP is stable.

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

This project is available under the [MIT License](LICENSE).
