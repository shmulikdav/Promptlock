# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-05

### Added

- **Custom HTTP provider** — connect to Ollama, LM Studio, Azure OpenAI, or any REST endpoint with `{ type: 'custom', url: '...' }`
- **Output caching** (`--cache`) — skip LLM calls for unchanged prompts, with `prompt-lock cache stats` and `cache clear` commands
- **Retry with exponential backoff** — automatic retry on rate limits (429), server errors (5xx), and network errors (3 retries by default)
- **GitHub PR comments** (`--github-pr owner/repo#123`) — post markdown results table to pull requests, updates existing comment in place
- **Dataset testing** — test prompts against multiple inputs via `dataset` config field
- **Parallel execution** (`--parallel`, `--concurrency`) — run prompts concurrently
- **Snapshot history** — timestamped snapshots with `prompt-lock history <id>` command
- **CLI flags** — `--dry-run`, `--verbose`, `--parallel`, `--concurrency`, `--cache`, `--github-pr`
- **Progress spinner** — visual feedback during LLM calls
- 3 new assertions: `contains-all`, `no-duplicates`, `max-latency`
- Config validation module with schema checks for all assertion types and provider configs
- Dataset results in JSON and HTML reports

### Changed

- Template variables now support dashes and dots: `{{user-name}}`, `{{api.version}}`
- Provider model passing is now type-safe (removed `as any` casts)
- Snapshots use `{id}/latest.json` format (backward compatible with old `{id}.json`)

### Fixed

- Invalid regex in `matches-regex` assertion no longer crashes the run
- Missing API keys now throw clear actionable error messages
- HTML report escapes all user-controlled fields (XSS fix)
- `PromptLock` class defaults `snapshotDir` and `reportDir` properly

### Security

- Snapshot and cache file paths sanitize prompt IDs to prevent path traversal
- Custom provider URLs validated to require `http://` or `https://` protocol
- Parallel runner uses queue-based dispatch to prevent race conditions

### Packaging

- Added `files` field — npm tarball now ships only `dist/`, `README.md`, `CHANGELOG.md`, `LICENSE`
- Added `exports` field for ESM/CJS resolution
- Added `declarationMap` for IDE go-to-definition
- Added `LICENSE` (MIT)
- `prepublishOnly` now runs both build and tests
- Added `repository`, `homepage`, `author`, `bugs` to package.json

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
