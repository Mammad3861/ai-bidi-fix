# BidiFix AI Roadmap

This document describes the intended product direction for BidiFix AI. It is a plan, not a description of features that are already available. The current stable release, v0.1.3, supports ChatGPT and Claude on Chrome and Chromium-based browsers.

## Vision

BidiFix AI should become a general-purpose, privacy-first bidirectional text readability engine for the web. Its single purpose is:

> Improve the readability and usability of mixed RTL/LTR text across the web without changing the underlying content.

The extension should continue to handle Persian and Arabic text mixed with English, technical terms, URLs, file paths, commands, identifiers, and code. Dedicated site support should improve reliability on complex applications, while ordinary websites should eventually benefit without requiring a custom adapter.

## Product principles

- **Auto first. Safe by default.** Most users should not need to understand bidi implementation details or choose technical processing modes.
- **When in doubt, preserve the page.** Low-confidence cases should remain unchanged.
- **Minimal and reversible changes.** Prefer direction and rendering metadata over DOM restructuring, and always support reliable cleanup.
- **Preserve content and interaction.** Selection, copy/paste, editors, controls, streaming interfaces, and page performance must remain usable.
- **Local and private.** Page text analysis stays inside the browser and exists only to provide the bidi readability feature.
- **Explicit access.** Broader website access must be initiated and understood by the user.
- **One focused purpose.** New capabilities must directly improve mixed RTL/LTR readability.

## Auto-first experience

The intended default experience is approximately:

> BidiFix AI: ON

Normal controls should focus on clear choices such as **Enable on this site**, **Enable on all websites**, and **Advanced settings**. Existing options—including Strong RTL, Composer direction fix, Experimental mixed prompt fix, and Debug Mode—may remain useful as advanced or fallback controls, but should not define the everyday workflow.

The automatic engine should evaluate whether:

- a text block needs bidi correction;
- its dominant direction is RTL or LTR;
- it mixes Persian/Arabic and English;
- its content is prose, code, a URL, a path, a command, or a technical identifier;
- an editable element is safe to modify;
- a node should be left untouched; and
- a reversible fix must be restored after streaming or DOM reconciliation.

## Confidence model

| Confidence | Intended behavior |
| --- | --- |
| High | Apply the complete safe bidi correction automatically. |
| Medium | Apply only a minimal, reversible block-level correction. |
| Low | Leave the page unchanged. |

Confidence must reflect both text classification and DOM safety. A confident text decision does not justify modifying an unsafe editor, control, hidden element, or unstable page region.

## Architecture direction

The planned architecture separates bidi decisions from website structure:

1. **Bidi Core**
   - Detect text direction and mixed RTL/LTR content.
   - Classify prose, technical content, and real code.
   - Identify LTR islands and produce confidence-based decisions.
   - Remain browser-agnostic where practical.

2. **Rendering Engine**
   - Apply the smallest safe fix.
   - Handle cleanup, idempotency, reconciliation, and streamed or dynamic DOM updates.
   - Preserve source text, selection, copy/paste, and performance.

3. **Generic Web Detector**
   - Find readable text blocks on ordinary websites.
   - Exclude navigation, controls, hidden UI, unsafe editable elements, and ambiguous regions.

4. **Site Adapters**
   - Describe structure and exclusions for complex sites such as ChatGPT and Claude.
   - Optimize detection without owning the bidi decision logic.
   - Allow future adapters where generic detection is insufficient.

5. **Browser Layer**
   - Integrate permissions, settings, content scripts, and browser-specific APIs.
   - Continue with Chrome and Chromium first, with Firefox considered after the new architecture is stable.

## Generic web support and permissions

Generic web support should not require a dedicated adapter for every site. Adapters are optimizations for complex applications, not a prerequisite for the engine to work.

The current release remains limited to declared ChatGPT and Claude origins. Any future expansion of host access should use clear, opt-in choices such as:

- Enable on this site
- Enable on selected sites
- Enable on all websites

BidiFix AI must not silently request or enable unrestricted all-site access. Permission prompts and settings should clearly explain why access is needed and how to revoke it.

## Permanent privacy constraints

- All text analysis happens locally in the browser.
- No backend, analytics, telemetry, tracking, or advertising.
- No transmission of page text.
- No storage of prompts, responses, or page content.
- Only extension preferences may be stored through browser settings storage.
- No changes to underlying user-visible text characters.
- Selection and copy/paste must remain usable.

## Version roadmap

### v0.1.x — Stable Chrome baseline

- Keep v0.1.3 as the current stable baseline.
- Limit maintenance releases to reproducible real-world bugs and essential compatibility fixes.
- Avoid introducing the new architecture or major features into the maintenance branch.

### v0.2.0 — Auto Engine foundation

Primary goal: move from site-specific bidi fixing toward an automatic, site-agnostic engine.

Planned work includes:

- separating Bidi Core from site detection;
- introducing the Generic Web Detector;
- adding confidence-based automatic decisions;
- preserving ChatGPT and Claude as optimized adapters;
- simplifying the normal popup experience;
- moving technical controls toward Advanced settings;
- designing a safe optional host-permission flow;
- strengthening rendering, regression, and performance tests; and
- preserving the proven behavior of the stable baseline.

These items are planned and are not implemented in v0.1.3.

### v0.2.x — Gradual coverage expansion

After the architecture is proven, expand real-world site coverage based on testing and user feedback. Potential research targets include Gemini, Perplexity, and other websites, but no specific site or delivery date is promised.

### Cross-browser direction

After the automatic architecture is stable:

- evaluate Firefox Desktop support;
- consider Firefox Android only after real-device testing; and
- support other Chromium browsers where practical.

### Long term

BidiFix AI should become a lightweight, automatic bidi readability layer across the web while retaining its narrow single purpose, privacy guarantees, and safe-by-default behavior.

## Non-goals

BidiFix AI is not intended to become:

- a translator;
- a grammar or spelling checker;
- an AI writing assistant;
- a general website restyling extension; or
- a content rewriting service.

Features outside the single-purpose bidi readability mission should remain out of scope.
