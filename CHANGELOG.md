# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-05

### Added

- `PromptLock` class for defining prompts with behavioral assertions and snapshot baselines
- CLI commands: `init`, `run`, `snapshot`, `diff`
- 11 built-in assertion types: `contains`, `not-contains`, `starts-with`, `ends-with`, `matches-regex`, `max-length`, `min-length`, `json-valid`, `json-schema`, `no-hallucination-words`, `custom`
- OpenAI and Anthropic provider adapters with lazy SDK loading
- Snapshot capture, storage, and diff (file-based in `.promptlock/snapshots/`)
- Report generation: console (colorized), JSON, and self-contained HTML
- CI mode with exit code 1 on assertion failure (`--ci` flag)
- Project scaffolding via `prompt-lock init`
- GitHub Actions example in README
