# Changelog

All notable changes to BidiFix AI are documented in this file.

## [Unreleased]

## [0.1.2] - 2026-06-26

### Fixed

- Fixed Persian/Arabic RTL prose inside code blocks, `pre` blocks, and monospaced containers.
- Fixed mixed English-first prompt/code-like blocks so later Persian/Arabic lines receive their own RTL direction.
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
