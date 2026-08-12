# Chrome Web Store release-package QA checklist

Complete this checklist against the exact GitHub Actions release assets intended for Chrome Web Store upload. Do not substitute a local `dist/` build or GitHub's automatically generated source archive.

## Test record

- [ ] Version/tag: `v0.1.3`
- [ ] GitHub Actions run URL recorded: ____________________
- [ ] Release ZIP filename: `bidifix-ai-v0.1.3.zip`
- [ ] Checksum filename: `bidifix-ai-v0.1.3.zip.sha256`
- [ ] SHA-256 verified and recorded: ____________________
- [ ] Chrome version: ____________________
- [ ] Operating system: ____________________
- [ ] Test date/tester: ____________________

On Windows, compare the published checksum with:

```powershell
Get-FileHash .\bidifix-ai-v0.1.3.zip -Algorithm SHA256
```

## Package and installation

- [ ] Download the ZIP and checksum from the GitHub Release **Assets** section, not the source-code archives.
- [ ] Extract the ZIP into a new empty directory.
- [ ] Confirm `manifest.json` is directly inside the extracted root.
- [ ] Confirm there is no enclosing `dist/` directory.
- [ ] Open `chrome://extensions` and enable Developer mode.
- [ ] Select **Load unpacked** and choose the extracted root.
- [ ] Confirm BidiFix AI loads as version `0.1.3` without manifest or runtime errors.
- [ ] Confirm the 16, 48, and 128 pixel icons render in the toolbar and extension details.
- [ ] Inspect the extension service/error view and supported-site DevTools consoles for unexpected errors.

## Default settings

- [ ] Use **Reset Settings** before testing.
- [ ] Extension, ChatGPT support, and Claude support are enabled.
- [ ] Strong RTL mode is disabled.
- [ ] Composer direction fix is disabled.
- [ ] Experimental mixed prompt fix is disabled.
- [ ] Debug Mode is disabled and normal use does not spam the console.

On a supported page, verify:

```js
document.querySelectorAll('[data-bidifix-line="true"]').length === 0
```

- [ ] Result is `true` in default mode.

```js
document.querySelectorAll('[data-bidifix-composer]').length === 0
```

- [ ] Result is `true` in default mode.

## Core text-direction matrix

Run every row on both ChatGPT and Claude assistant output unless noted otherwise.

- [ ] Persian-only prose is RTL, right-aligned, readable, and selectable.
- [ ] Arabic-only prose is RTL, right-aligned, readable, and selectable.
- [ ] English-only prose remains LTR and left-aligned.
- [ ] Mixed Persian/English prose is RTL while English phrases remain readable LTR.
- [ ] Mixed Arabic/English prose is RTL while English phrases remain readable LTR.
- [ ] A URL such as `https://claude.ai/` stays readable LTR inside RTL prose.
- [ ] A path such as `src/content/bidi.ts` stays readable LTR inside RTL prose.
- [ ] A shell command such as `npm run build` stays readable LTR inside RTL prose.
- [ ] Inline code remains readable and does not reorder surrounding prose.
- [ ] Copying each case into a plain-text editor preserves the original characters and order.

Suggested Persian sample:

```text
این یک آزمایش برای BidiFix AI است. فایل src/content/bidi.ts را بررسی کن، به https://claude.ai/ برو و دستور npm run build را اجرا کن.
```

Suggested Arabic sample:

```text
هذا اختبار لإضافة BidiFix AI مع ملف src/content/bidi.ts ورابط https://claude.ai/ وأمر npm run build.
```

## Code and technical-container regression

- [ ] A genuine TypeScript block remains LTR and left-aligned:

```ts
const extensionName = "BidiFix AI";
const supportedSites = ["chatgpt.com", "claude.ai"];

function buildRelease(version: string) {
  console.log(`Building ${extensionName} ${version}`);
  return `bidifix-ai-${version}.zip`;
}
```

- [ ] Short inline technical tokens remain LTR.
- [ ] Shell-command-only blocks remain readable LTR.
- [ ] Test Persian/Arabic prose placed inside `pre`, `code`, or monospaced scrollable containers.
- [ ] Confirm paths and commands inside that RTL prose remain readable LTR.

Run the complete Issue [#8](https://github.com/Mammad3861/ai-bidi-fix/issues/8) regression matrix inside `pre`, `code`, nested `pre > code`, and representative monospaced containers on ChatGPT and Claude.

### A. Persian technical prose

```text
فایل docs/ICON_PIPELINE.md را بررسی کن و سپس project.godot و presets.cfg را باز کن.
```

- [ ] The prose is RTL and the paths remain readable LTR.

### B. Persian prose plus command

```text
برای ساخت پروژه ابتدا npm run build را اجرا کن و بعد فایل README.md را بررسی کن.
```

- [ ] The prose is RTL and the command/path remain readable LTR.

### C. Genuine TypeScript

```ts
const value = 1;
function test() {
  return value;
}
```

- [ ] The block remains LTR and unchanged.

### D. Genuine shell

```sh
npm ci
npm run lint
npm run build
```

- [ ] The command-only block remains LTR and unchanged.

### E. JSON/config

```json
{
  "name": "bidifix-ai",
  "version": "0.1.3"
}
```

- [ ] The structured block remains LTR and unchanged.

### F. English technical prose

```text
Open README.md and run npm run build.
```

- [ ] The English-only technical block remains LTR.

### G. Persian prose with URL and paths

```text
برای اطلاعات بیشتر به https://claude.ai/ برو و فایل‌های docs/ICON_PIPELINE.md و src/content/bidi.ts را بررسی کن.
```

- [ ] The prose is RTL and the URL/paths remain readable LTR.
- [ ] Copy every corrected RTL case into a plain-text editor and confirm the characters and ordering are unchanged.
- [ ] Record the result for GitHub issue #8: Pass / Partial / Fail
- [ ] If any edge case still fails, record the affected site/container and keep #8 documented as a known limitation. Do not hold the result out as fixed without a verified test.

## ChatGPT interaction and performance

- [ ] Assistant responses are corrected while streaming.
- [ ] A normal Persian displayed user prompt remains selectable, RTL, and readable.
- [ ] A normal English displayed user prompt remains selectable, LTR, and readable.
- [ ] The **Edit** action on a displayed prompt still works.
- [ ] Enter sends a prompt normally.
- [ ] Shift+Enter inserts a line break normally.
- [ ] Copy and paste work normally.
- [ ] Scrolling and text selection stay smooth in a long conversation.
- [ ] Sending several messages does not create escalating console errors or obvious DOM growth.
- [ ] Default mode remains responsive with the two DOM-count assertions above still passing.

## Claude interaction and performance

- [ ] Assistant responses are corrected while streaming.
- [ ] English technical phrases remain readable inside RTL response prose.
- [ ] Enter and Shift+Enter retain their normal behavior.
- [ ] Copy, paste, selection, scrolling, and navigation remain responsive in a long conversation.
- [ ] No unrelated Claude UI, navigation, dialog, or user-control text is modified.

## Popup and settings

- [ ] Popup shows `BidiFix AI` and the correct current-site status.
- [ ] Global enable/disable applies and cleans up extension-added rendering state.
- [ ] ChatGPT support can be disabled without disabling Claude.
- [ ] Claude support can be disabled without disabling ChatGPT.
- [ ] Strong RTL mode toggles and persists after popup reopen.
- [ ] Reset Settings restores performance-safe defaults.
- [ ] Settings persist across supported-site reloads and Chrome restarts as expected.
- [ ] Unsupported sites report `Unsupported site` and are not modified.

## Navigation and multi-tab behavior

- [ ] Hard reload each supported site and retest an existing conversation.
- [ ] Navigate between conversations without reloading and verify new content is processed.
- [ ] Open ChatGPT and Claude in separate tabs and verify per-site behavior remains independent.
- [ ] Open multiple tabs of the same supported site and verify settings changes apply without errors.
- [ ] Disable the extension, reload, and confirm extension-added markers are absent.

## Optional Composer direction fix

Test this separately after the default-mode matrix passes.

- [ ] Enable **Composer direction fix** only.
- [ ] Persian and Arabic composer text receives the expected direction.
- [ ] English-only composer text remains usable.
- [ ] Paste, Enter, Shift+Enter, selection, undo/redo, and send remain functional on both sites.
- [ ] Disable the option and verify composer markers are cleaned up after reload.

## Optional Experimental mixed prompt fix

Test this separately after the default-mode matrix passes.

- [ ] Enable **Experimental mixed prompt fix** only when testing the known mixed-prompt edge cases.
- [ ] English-first displayed prompts containing later Persian/Arabic segments improve where expected.
- [ ] Generated line wrappers remain capped and do not freeze a long conversation.
- [ ] Selection and copy/paste remain acceptable.
- [ ] Disable the option after testing and confirm line wrappers return to zero after reload.

## Submission sign-off

- [ ] No release-package-specific regression was found.
- [ ] Privacy policy and Developer Dashboard disclosures match observed behavior.
- [ ] Store screenshots were captured from this exact tested release package using non-sensitive content.
- [ ] Any issue #8 failure is documented as a known limitation rather than represented as fixed.
- [ ] The exact tested ZIP—not a source archive and not a different local build—is selected for dashboard upload.
