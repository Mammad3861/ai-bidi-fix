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
- [ ] Inline code and code blocks remain LTR and left-aligned.
- [ ] Direction fixes appear while the response is streaming.

## Claude

- [ ] The input composer becomes RTL and right-aligned while Persian text is present.
- [ ] English phrases remain readable in the composer.
- [ ] The assistant response is RTL and right-aligned where appropriate.
- [ ] `BidiFix AI`, `Manifest V3`, and `MutationObserver` remain visually LTR.
- [ ] `src/content/detector.ts` remains visually LTR.
- [ ] `npm run build` remains visually LTR.
- [ ] `https://claude.ai` remains visually LTR.
- [ ] Inline code and code blocks remain LTR and left-aligned.
- [ ] Direction fixes appear while the response is streaming.

## Regression and privacy checks

- [ ] Copy each response into a plain-text editor and confirm the text is unchanged.
- [ ] Disable BidiFix AI and confirm extension-added direction styling is removed.
- [ ] Re-enable it and confirm both sites are processed again.
- [ ] Confirm ordinary English-only content remains LTR.
- [ ] Confirm unsupported websites are unaffected.
- [ ] Confirm the browser console is not receiving BidiFix debug noise.
- [ ] Confirm DevTools shows no BidiFix network requests.
- [ ] Confirm the manifest requests only the `storage` permission and supported site matches.
