# BidiFix AI manual QA checklist

Complete this checklist against the production build before publishing a release.

## Setup

- [ ] Run `npm install`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Load the generated `dist/` directory from `chrome://extensions`.
- [ ] Reload the extension and hard-refresh open ChatGPT and Claude tabs.
- [ ] Confirm the popup enables and disables the extension and each supported site.
- [ ] Confirm the popup identifies ChatGPT, Claude, and an unsupported tab correctly.
- [ ] Confirm Debug Mode defaults to off and produces logs only after being enabled.
- [ ] Change settings, click **Reset settings**, and confirm all defaults are restored.

## Test prompt

Use this prompt on both ChatGPT and Claude:

```text
یک پاسخ فارسی بنویس که شامل BidiFix AI، Manifest V3، MutationObserver،
Chrome Extension، API، DOM و README باشد. توضیح بده چگونه فایل
src/content/detector.ts را باز کنم، دستور npm run build را اجرا کنم و به
https://claude.ai مراجعه کنم. یک نمونه inline code و یک code block هم اضافه کن.
```

## ChatGPT

- [ ] The input composer becomes RTL and right-aligned while Persian text is present.
- [ ] English phrases remain readable in the composer.
- [ ] The assistant response is RTL and right-aligned where appropriate.
- [ ] `BidiFix AI`, `Manifest V3`, and `MutationObserver` remain visually LTR.
- [ ] `src/content/detector.ts` remains visually LTR.
- [ ] `npm run build` remains visually LTR.
- [ ] `https://claude.ai` remains visually LTR.
- [ ] Real inline code and real code blocks remain LTR and left-aligned.
- [ ] Persian/Arabic prose inside code-like blocks becomes RTL and readable.
- [ ] Direction fixes appear while the response is streaming.

## Claude

- [ ] The input composer becomes RTL and right-aligned while Persian text is present.
- [ ] English phrases remain readable in the composer.
- [ ] The assistant response is RTL and right-aligned where appropriate.
- [ ] `BidiFix AI`, `Manifest V3`, and `MutationObserver` remain visually LTR.
- [ ] `src/content/detector.ts` remains visually LTR.
- [ ] `npm run build` remains visually LTR.
- [ ] `https://claude.ai` remains visually LTR.
- [ ] Real inline code and real code blocks remain LTR and left-aligned.
- [ ] Persian/Arabic prose inside code-like blocks becomes RTL and readable.
- [ ] Direction fixes appear while the response is streaming.

## Code block and monospaced RTL prose regression

Ask ChatGPT and Claude to render both real code and Persian prose inside code blocks:

```text
Please output these as separate code blocks:

1. Real TypeScript code:
const extensionName = "BidiFix AI";
const supportedSites = ["chatgpt.com", "claude.ai"];

function buildRelease(version: string) {
  console.log(`Building BidiFix AI ${version}`);
  return `bidifix-ai-${version}.zip`;
}

buildRelease("v0.1.2");

2. Persian prose inside a code block:
الان چون آیکون خوب شده، اول commit آیکون را انجام بده.
ولی قبلش این فایل‌ها را هم بررسی کن:
docs/ICON_PIPELINE.md
project.godot
presets.cfg
public/icons/icon-128.png
src/content/bidi.ts
src/content/detector.ts

بعد این دستورها را اجرا کن:
npm run typecheck
npm run build

3. A normal Persian paragraph:
فایل src/content/bidi.ts و دستور npm run build باید درست نمایش داده شوند.
```

- [ ] The real TypeScript code block remains LTR and left-aligned.
- [ ] TypeScript syntax, indentation, quotes, and template literals remain visually LTR.
- [ ] The Persian prose code block becomes RTL and right-aligned.
- [ ] File paths such as `docs/ICON_PIPELINE.md`, `project.godot`, `presets.cfg`, `public/icons/icon-128.png`, `src/content/bidi.ts`, and `src/content/detector.ts` remain visually LTR inside the RTL prose code block.
- [ ] Commands such as `npm run typecheck` and `npm run build` remain visually LTR inside the RTL prose code block.
- [ ] The normal Persian paragraph remains RTL and right-aligned.
- [ ] Inline technical runs such as `src/content/bidi.ts` and `npm run build` remain visually LTR.
- [ ] Copy/paste from all three cases preserves the original text and does not add Unicode bidi control characters.

## English-before-Persian mixed block regression

Ask ChatGPT and Claude to output this as one markdown/code-like block, preserving the English lines before the Persian lines:

```text
Problem:
The extension currently treats pre/code/font-mono content as always LTR technical content.
This is correct for real code, but wrong when AI puts Persian/Arabic explanation text inside a code block.

الان چون آیکون خوب شده، اول commit آیکون را انجام بده.
ولی قبلش این فایل‌ها را هم بررسی کن:
docs/ICON_PIPELINE.md
project.godot
presets.cfg
```

- [ ] The English `Problem:` section remains readable LTR.
- [ ] The Persian sentence lines become readable RTL.
- [ ] `commit` appears in the correct visual position inside the Persian sentence.
- [ ] File paths such as `docs/ICON_PIPELINE.md`, `project.godot`, and `presets.cfg` remain readable LTR.
- [ ] The whole block does not get forced into one broad LTR direction.
- [ ] Pasting the same text into the ChatGPT and Claude composers keeps Persian lines readable while English lines remain readable.
- [ ] Copy/paste preserves the original text and does not add Unicode bidi control characters.

## ChatGPT displayed user prompt card regression

Send this prompt in ChatGPT, then inspect the displayed user message card with the **Edit** button:

```text
Problem:
The extension currently treats pre/code/font-mono content as always LTR technical content.
This is correct for real code, but wrong when AI puts Persian/Arabic explanation text inside a code block.

Then later in the same block it contains Persian lines like:

الان چون آیکون خوب شده، اول commit آیکون را انجام بده.
ولی قبلش docs/ICON_PIPELINE.md و project.godot و presets.cfg را بررسی کن.
```

- [ ] The displayed user prompt card is processed, not only the assistant response.
- [ ] The English section remains readable LTR.
- [ ] The Persian lines are readable RTL.
- [ ] Persian text remains readable even if ChatGPT renders it as standalone child text sections instead of one newline-containing text node.
- [ ] `commit` appears in the correct visual position inside the Persian sentence.
- [ ] `docs/ICON_PIPELINE.md`, `project.godot`, and `presets.cfg` remain readable LTR.
- [ ] The **Edit** button and other ChatGPT controls still work and are not restyled as message text.
- [ ] The active composer still behaves as expected after sending the prompt.

## Regression and privacy checks

- [ ] Copy each response into a plain-text editor and confirm the text is unchanged.
- [ ] Disable BidiFix AI and confirm extension-added direction styling is removed.
- [ ] Re-enable it and confirm both sites are processed again.
- [ ] Confirm ordinary English-only content remains LTR.
- [ ] Confirm unsupported websites are unaffected.
- [ ] Confirm the browser console is not receiving BidiFix debug noise.
- [ ] Confirm DevTools shows no BidiFix network requests.
- [ ] Confirm the manifest requests only the `storage` permission and supported site matches.
