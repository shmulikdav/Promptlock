# Contributing to prompt-lock

Thanks for contributing! This guide gets you from clone to PR in under 5 minutes.

## Quick Setup

```bash
git clone https://github.com/shmulikdav/Promptlock.git
cd Promptlock
npm install
npm run build
npm test        # all tests use mocks — no API keys needed
```

## Project Structure

```
src/
├── types.ts              # All TypeScript interfaces
├── utils.ts              # Template rendering, hashing, file helpers
├── cache.ts              # Response caching layer
├── config-validation.ts  # Config schema validation
├── github.ts             # GitHub PR comment integration
├── retry.ts              # Retry with exponential backoff
├── assertions/
│   ├── builtin.ts        # 14 built-in assertion handlers
│   ├── json-schema.ts    # JSON Schema validation (ajv)
│   ├── custom.ts         # User-provided assertion wrapper
│   └── index.ts          # runAssertions() orchestrator
├── providers/
│   ├── openai.ts         # OpenAI adapter
│   ├── anthropic.ts      # Anthropic adapter
│   ├── custom.ts         # Custom HTTP endpoint adapter (Ollama, LM Studio, Azure)
│   └── index.ts          # Provider factory
├── snapshot.ts           # Snapshot save/load/diff
├── runner.ts             # Core: template → LLM → assertions
├── reporter.ts           # Console, JSON, HTML reports
├── cli.ts                # CLI entry point (commander.js)
└── index.ts              # PromptLock class + re-exports
```

## High-Priority Contribution Areas

- **New assertion types** — e.g. `semantic-similarity`, `cost-under`, `token-count-max`. See `src/assertions/builtin.ts`.
- **New provider adapters** — e.g. Google Vertex, AWS Bedrock. See `src/providers/`.
- **CLI improvements** — interactive init wizard, `--watch` mode. See `src/cli.ts`.
- **Reporting** — Markdown report format, CI summary improvements. See `src/reporter.ts`.
- **Documentation** — README examples, assertion reference, provider setup guides.

## Adding a New Assertion Type

1. Add the handler to `src/assertions/builtin.ts` (or a new file for complex ones)
2. Add the config type to the `AssertionConfig` union in `src/types.ts`
3. Update the README assertion reference table
4. Add test cases in `tests/assertions.test.ts`

## Adding a New Provider

1. Create `src/providers/your-provider.ts` implementing the `LLMProvider` interface from `src/types.ts`
   - Your adapter must implement: `call(prompt: string, options?) => Promise<string>`
2. Add a case to the switch in `src/providers/index.ts`
3. Add the provider name to the `PromptLockConfig.provider` union in `src/types.ts`
4. Add tests in `tests/providers.test.ts`

## Code Style

- TypeScript strict mode
- No unnecessary abstractions — keep it simple
- CJS-compatible (no ESM-only dependencies)

## Testing

- Run `npm test` before submitting — all tests use mocks, no API keys required
- Tests live in `tests/` and mirror source file names (`src/cache.ts` → `tests/cache.test.ts`)
- Use `jest.fn()` to mock provider calls — see existing tests for patterns
- Run `node demo.js` to smoke-test the full pipeline

## Submitting a PR

1. Branch from `main`
2. Keep PRs focused — one feature or fix per PR
3. Include tests for new assertions and providers
4. CI must pass (build + test on Node 18, 20, 22)
5. Link related issues with `Closes #N`

## Reporting Issues

Use our [issue templates](https://github.com/shmulikdav/Promptlock/issues/new/choose) — they help us triage faster.
