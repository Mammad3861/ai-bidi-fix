# Changelog

All notable changes to BidiFix AI are documented in this file.

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
