# Changelog

All notable changes to BidiFix AI are documented in this file.

## [Unreleased]

### Fixed

- Resolved the remaining Issue #8 cases where short Persian/Arabic technical prose could be mistaken for LTR source code inside `pre`, `code`, nested code, or monospaced containers.
- Distinguished strong whole-block source, shell, JSON, markup, style, and config structure from incidental paths, commands, identifiers, and code keywords in natural RTL prose.
- Kept genuine code with Persian/Arabic strings or comments LTR while preserving the performance-safe default path and existing inline LTR isolation.
- Prioritized RTL code-like prose within the existing per-message processing budget so fenced blocks in long ChatGPT responses are not starved by earlier paragraph nodes.
- Restored missing inline LTR islands when ChatGPT reconciles a processed fenced block's children without changing its text.
- Added a browser DOM regression fixture for current ChatGPT-style nested `pre`/`code` and read-only CodeMirror markup, computed styles, state transitions, cleanup, and idempotency.

## [0.1.2] - 2026-06-26

### Fixed

- Restored performance-safe default behavior by moving aggressive line-level wrapping behind an off-by-default experimental setting.
- Moved composer/editor direction handling behind an off-by-default Composer direction fix setting.
- Reduced default DOM wrapping to improve ChatGPT responsiveness and copy/paste usability.
- Added processing caps and observer batching for the experimental mixed prompt fix.
- Fixed Persian/Arabic RTL prose inside code blocks, `pre` blocks, and monospaced containers.
- Fixed mixed English-first prompt/code-like blocks so later Persian/Arabic lines receive their own RTL direction.
- Fixed ChatGPT displayed user prompt cards so mixed English-first prompts receive the same line-level bidi handling as assistant messages.
- Kept real code blocks LTR with technical bidi isolation.
- Improved inline LTR handling for file paths, commands, URLs, and English technical phrases inside RTL prose code blocks.

## [0.1.1] - 2026-06-26

### Added

- Current-site status in the popup for ChatGPT, Claude, and unsupported pages.
- Debug Mode setting, disabled by default.
- Reset Settings action and a concise popup privacy notice.
- Chrome extension icons at 16, 48, and 128 pixels.
- GitHub bug report and feature request templates.
- Expanded tester installation and manual QA documentation.

### Changed

- Refined popup layout and status feedback for testers.
- Runtime diagnostics are silent unless Debug Mode is enabled.

## [0.1.0] - 2026-06-24

Initial public MVP release.

### Added

- ChatGPT support on `chatgpt.com` and `chat.openai.com`.
- Claude support on `claude.ai` and `www.claude.ai`.
- Block-level RTL/LTR direction fixes for mixed Persian/Arabic and English text.
- Inline LTR isolation for English phrases, URLs, commands, file paths, and technical identifiers.
- LTR preservation for code blocks, inline code, links, and monospace content.
- Live processing of streamed assistant responses with `MutationObserver`.
- Direction handling for ChatGPT and Claude prompt composers.
- Popup settings for global enablement, per-site support, and Strong RTL mode.
- Synchronized extension preferences using `chrome.storage.sync`.
