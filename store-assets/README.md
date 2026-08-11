# Chrome Web Store asset plan

This directory documents the listing assets needed for the first BidiFix AI Chrome Web Store submission. Store assets should be prepared from the exact tested release package and should accurately show the real extension. Do not use fabricated product screenshots.

## Required and recommended assets

| Asset | Size | Requirement | Proposed content |
| --- | ---: | --- | --- |
| Store icon | 128×128 PNG | Required | BidiFix AI green bidirectional-arrow mark, exported crisply with appropriate transparent padding. |
| Screenshots | 1280×800 PNG/JPEG | At least one required; up to five recommended | Real ChatGPT, Claude, and popup views demonstrating mixed RTL/LTR rendering. |
| Small promo tile | 440×280 PNG/JPEG | Required | Clean BidiFix AI branding with the icon and a short readability-focused message; this should be a designed promo image, not a screenshot. |
| Marquee tile | 1400×560 PNG/JPEG | Optional | Spacious BidiFix AI brand treatment with a subtle RTL/LTR visual motif and minimal text. |

The existing `public/icons/icon-128.png` is a valid 128×128 PNG and is included in the extension package. Its visible artwork reaches the canvas edges, while Chrome's image guidance recommends transparent padding around store-icon artwork. Review or re-export the store icon before dashboard upload; do not silently replace the extension icon in the v0.1.2 package.

## Recommended real screenshots

Capture up to five current, real screenshots at 1280×800:

1. **ChatGPT mixed Persian/English result** — Persian response text with `BidiFix AI`, `Manifest V3`, or `MutationObserver` visibly ordered and aligned.
2. **Claude mixed Persian/English result** — Persian response with a URL, file path, and shell command remaining readable LTR.
3. **Mixed Arabic/English result** — ChatGPT or Claude output, but only if the Arabic case has been manually verified from the exact release ZIP.
4. **Technical content inside RTL prose** — A normal prose paragraph containing `src/content/bidi.ts`, `npm run build`, and `https://claude.ai/`; avoid presenting the known issue #8 edge case as fully solved.
5. **BidiFix AI popup** — Current-site status, main controls, privacy note, and performance-safe optional settings.

## Capture rules

- Install and test the GitHub Actions release ZIP before capture.
- Use only non-sensitive demonstration prompts and conversations.
- Hide account names, email addresses, avatars, conversation titles, or other identifying information.
- Show the current extension behavior without mockups, compositing, or fake site content.
- Keep screenshots sharp, correctly oriented, full bleed, and free of excessive annotations.
- Do not imply support for native ChatGPT/Claude apps, Firefox, Firefox Android, or Safari.
- Avoid third-party endorsement claims, ratings, badges, or claims such as “official,” “best,” or “fastest.”
- Keep branding consistent across icon, screenshots, and promotional tiles.

## Suggested filenames

```text
store-assets/icon-128.png
store-assets/screenshot-01-chatgpt-persian-english.png
store-assets/screenshot-02-claude-persian-technical.png
store-assets/screenshot-03-arabic-english.png
store-assets/screenshot-04-rtl-technical-phrases.png
store-assets/screenshot-05-popup-settings.png
store-assets/promo-small-440x280.png
store-assets/promo-marquee-1400x560.png
```

## Final asset QA

- Confirm exact pixel dimensions and PNG/JPEG format.
- Confirm the icon remains recognizable at small sizes.
- Confirm screenshots match the submitted version and contain no private data.
- Confirm small text remains readable at the Store's displayed size.
- Confirm promo art is not simply a screenshot and is not visually crowded.
- Complete `docs/store-test-checklist.md` before using screenshots in the listing.

See Chrome's official [listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing/) and [listing image guidance](https://developer.chrome.com/docs/webstore/best-listing) before final export.

