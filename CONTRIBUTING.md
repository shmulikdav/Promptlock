# Contributing to prompt-lock

Thanks for your interest in contributing!

## Getting Started

```bash
git clone https://github.com/shmulikdav/Promptlock.git
cd Promptlock
npm install
npm run build
```

## Development Workflow

1. Create a branch from `main`
2. Make your changes in `src/`
3. Run `npm run build` to verify TypeScript compiles
4. Run `node demo.js` to smoke-test the assertion engine
5. Submit a pull request

## Project Structure

```
src/
├── types.ts              # All TypeScript interfaces
├── utils.ts              # Template rendering, hashing, file helpers
├── assertions/
│   ├── builtin.ts        # Built-in assertion handlers
│   ├── json-schema.ts    # JSON Schema validation (ajv)
│   ├── custom.ts         # User-provided assertion wrapper
│   └── index.ts          # runAssertions() orchestrator
├── providers/
│   ├── openai.ts         # OpenAI adapter
│   ├── anthropic.ts      # Anthropic adapter
│   └── index.ts          # Provider factory
├── snapshot.ts           # Snapshot save/load/diff
├── runner.ts             # Core: template → LLM → assertions
├── reporter.ts           # Console, JSON, HTML reports
├── index.ts              # PromptLock class + re-exports
└── cli.ts                # CLI entry point (commander.js)
```

## Adding a New Assertion Type

1. Add the handler to `src/assertions/builtin.ts` (or a new file for complex ones)
2. Add the config type to the `AssertionConfig` union in `src/types.ts`
3. Update the README assertion reference table

## Adding a New Provider

1. Create `src/providers/your-provider.ts` implementing the `LLMProvider` interface
2. Add a case to the switch in `src/providers/index.ts`
3. Add the provider name to the `PromptLockConfig.provider` union in `src/types.ts`

## Code Style

- TypeScript strict mode
- No unnecessary abstractions — keep it simple
- CJS-compatible (no ESM-only dependencies)

## Reporting Issues

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Node.js version and OS
