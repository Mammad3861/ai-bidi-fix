# Chrome Web Store submission content

This document contains copy-paste-ready content for the BidiFix AI v0.1.2 Chrome Web Store Developer Dashboard. Recheck the live dashboard labels before submission because Google may update its fields.

## Store listing

### Extension name

```text
BidiFix AI
```

### Short description

```text
Improves mixed Persian/Arabic RTL and English LTR text readability in ChatGPT and Claude.
```

### Detailed description

```text
BidiFix AI improves the readability of Persian and Arabic right-to-left text when it is mixed with English left-to-right content in the ChatGPT and Claude web interfaces.

The extension detects visible conversation text locally in your browser, applies an appropriate text direction, and isolates common English and technical phrases such as URLs, file paths, commands, and identifiers. It supports streamed AI responses and provides separate controls for ChatGPT and Claude.

Features:
• RTL/LTR direction handling for supported ChatGPT and Claude conversations
• Inline isolation for common English and technical text inside RTL prose
• LTR preservation for real code and technical content
• Performance-safe defaults for long conversations
• Optional composer direction handling and experimental mixed-prompt processing
• Per-site enable/disable controls and a Strong RTL option

Privacy:
All text detection and rendering happen locally in the browser. BidiFix AI has no backend, analytics, telemetry, advertising, or tracking. It does not upload, log, store, sell, or share prompts or AI responses, and it makes no requests to developer-operated or third-party services. Chrome sync storage is used only for extension preferences.

BidiFix AI supports the Chrome browser versions of ChatGPT and Claude. Site layout changes and unusually formatted multilingual or technical containers may occasionally require future compatibility updates.
```

### Recommended category

```text
Accessibility
```

This best matches the extension's readability function. If the current dashboard does not offer that category, use `Tools` as the fallback.

### Homepage URL

```text
https://github.com/Mammad3861/ai-bidi-fix
```

### Support URL

```text
https://github.com/Mammad3861/ai-bidi-fix/issues
```

### Privacy policy URL

Replace the placeholder with a publicly accessible URL before submission:

```text
<PUBLIC_PRIVACY_POLICY_URL>
```

After `PRIVACY.md` reaches the public default branch, this repository URL is a suitable candidate:

```text
https://github.com/Mammad3861/ai-bidi-fix/blob/main/PRIVACY.md
```

## Privacy practices

### Single-purpose statement

```text
Improving bidirectional RTL/LTR text readability in supported AI chat interfaces.
```

### `storage` permission justification

```text
The storage permission is used only to save user-selected extension preferences in chrome.storage.sync, including the global enable state, per-site support, Strong RTL mode, optional composer handling, experimental mixed-prompt handling, and Debug Mode. Prompts and AI responses are not stored.
```

### ChatGPT site-access justification

Applies to `https://chatgpt.com/*` and the legacy `https://chat.openai.com/*` origin.

```text
Access is required so the content script can inspect visible ChatGPT conversation text in the page DOM and locally apply bidirectional direction and alignment styles. This enables the extension's single purpose on ChatGPT. Prompt and response text is not transmitted or stored by BidiFix AI.
```

### Claude site-access justification

Applies to `https://claude.ai/*` and `https://www.claude.ai/*`.

```text
Access is required so the content script can inspect visible Claude conversation text in the page DOM and locally apply bidirectional direction and alignment styles. This enables the extension's single purpose on Claude. Prompt and response text is not transmitted or stored by BidiFix AI.
```

### Remote code declaration

Select:

```text
No, I am not using remote code.
```

All executable JavaScript is bundled in the extension package. The extension does not download or execute remote JavaScript or WebAssembly.

### User-data disclosure guidance

Chrome's policy treats data processed only on the user's device as handled user data. Use the definitions displayed in the live dashboard and disclose the local processing prominently.

Recommended conservative disclosure:

- Disclose **Website content** because the extension reads visible text from supported pages.
- If the dashboard offers them as separate applicable types, also disclose **User-generated content** and **Personal communications** because prompts and AI responses may fall within those definitions.
- Do not select unrelated categories such as financial information, health information, authentication information, precise location, or personally identifiable information; the extension does not request or intentionally process those categories.
- State that processing is local and solely provides the advertised bidi-rendering feature.
- State that user text is not stored, transmitted, sold, shared, logged, used for advertising, or made available for human review by BidiFix AI.
- Disclose that `chrome.storage.sync` stores preferences only. Chrome may sync those settings through the user's Chrome profile.

Review and certify each Limited Use statement only after confirming it matches the submitted package and the published privacy policy. The current source supports statements that data is not sold, is not used for unrelated purposes or creditworthiness, and is not transferred to third parties by BidiFix AI.

### Privacy-practices consistency check

The Store listing, Privacy tab, site-access justifications, and published privacy policy must consistently say:

- Visible prompt and response text is processed locally for bidi rendering.
- No prompt or response text is transmitted or stored by BidiFix AI.
- Preferences are the only data saved through Chrome storage.
- There is no backend, analytics, telemetry, advertising, tracking, or remote executable code.

## Distribution

### Initial visibility

```text
Unlisted
```

Unlisted allows installation by anyone who has the listing URL without making the first release discoverable in Chrome Web Store search. Unlisted items still receive the normal policy review.

## Reviewer/test instructions

```text
BidiFix AI requires no extension account, license, backend, or API key. A reviewer can test it with a reviewer-controlled account on either https://chatgpt.com/ or https://claude.ai/.

1. Install the submitted extension package and keep the default popup settings.
2. Open ChatGPT or Claude and start a conversation.
3. Ask the service to display this Persian sample:
   این یک آزمایش برای BidiFix AI است. فایل src/content/bidi.ts را بررسی کن و دستور npm run build را اجرا کن.
4. Verify that the Persian prose is RTL/right-aligned while BidiFix AI, src/content/bidi.ts, and npm run build remain readable LTR.
5. Test this Arabic sample:
   هذا اختبار لإضافة BidiFix AI مع ملف src/content/bidi.ts وأمر npm run build.
6. Verify that English-only text and genuine code blocks remain LTR.
7. Open the BidiFix AI popup to test global enable/disable, per-site controls, Strong RTL mode, and Reset Settings.

Composer direction handling and the Experimental mixed prompt fix are disabled by default because they are optional. They can be enabled separately from the popup. Some unusual RTL prose inside code/pre-like or monospaced technical containers is a known edge-case limitation; normal conversation text, technical terms, and genuine code blocks should remain usable.

All text processing occurs locally. No credentials or user text are sent to BidiFix AI or a developer-operated service.
```

## Upload package and source maps

Use the exact tested GitHub Actions asset `bidifix-ai-v0.1.2.zip` for the initial submission. It contains two production source maps, `content.js.map` and `popup/popup.js.map`. The maps contain the extension's TypeScript sources but no audited secrets or remote code.

Recommendation for v0.1.2: keep the source maps in the upload. They are small, are not a Chrome Web Store policy blocker, and keeping them avoids making the submitted package differ from the release ZIP already tested. For a future version, source maps may be disabled or published separately if reducing package size or source exposure becomes a project goal; rebuild and retest that package before submission.

## Manual dashboard inputs still required

- Developer account and publisher/contact information
- Public privacy policy URL
- Store icon, screenshots, and promotional images
- Primary language and category selection
- User-data type selections and Limited Use certifications
- Distribution countries/regions and Unlisted visibility
- Mature-content declaration
- Reviewer instructions in the Test instructions tab
- Final package upload and submission-for-review confirmation
- Publishing choice after review, including whether to use deferred publishing

## Official references

- [Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing/)
- [Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Chrome Web Store user-data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Set up distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
- [Provide test instructions](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions)
- [Remote hosted code guidance](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)
