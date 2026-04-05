# prompt-lock

**Version control and behavioral regression testing for LLM prompts.**

prompt-lock wraps your prompts with behavioral assertions and snapshot baselines. On every change, it runs the assertion suite and flags regressions — like Jest for LLM behavior.

## Installation

```bash
npm install prompt-lock
```

You'll also need at least one LLM provider SDK:

```bash
# For Anthropic
npm install @anthropic-ai/sdk

# For OpenAI
npm install openai
```

## Quick Start

```bash
# 1. Initialize prompt-lock in your project
npx prompt-lock init

# 2. Edit the example prompt in prompts/example.js

# 3. Set your API key
export ANTHROPIC_API_KEY=your-key-here

# 4. Run assertions
npx prompt-lock run
```

## Defining Prompts

Create `.js` files in your `prompts/` directory:

```javascript
// prompts/summarizer.js
module.exports = {
  id: 'article-summarizer',
  version: '1.0.0',
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',

  prompt: `You are a professional summarizer.
Summarize the following article in 3 bullet points.
Article: {{article}}`,

  defaultVars: {
    article: 'The quick brown fox jumped over the lazy dog.'
  },

  assertions: [
    { type: 'contains', value: '•' },
    { type: 'max-length', chars: 500 },
    { type: 'not-contains', value: 'I cannot' },
  ]
};
```

## Programmatic Usage

```typescript
import { PromptLock } from 'prompt-lock';

const lock = new PromptLock({
  id: 'my-prompt',
  version: '1.0.0',
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  prompt: 'Translate to French: {{text}}',
  defaultVars: { text: 'Hello world' },
  assertions: [
    { type: 'not-contains', value: 'Hello' },
    { type: 'min-length', chars: 5 },
  ],
});

const results = await lock.run();
console.log(results[0].passed); // true or false
```

## CLI Reference

### `prompt-lock init`

Scaffold a `.promptlock/` folder with config and an example prompt.

### `prompt-lock run`

Run all assertions against current prompts.

```bash
prompt-lock run                    # Run all prompts
prompt-lock run --id my-prompt     # Run a specific prompt
prompt-lock run --ci               # Exit code 1 on failure
prompt-lock run --report html      # Generate HTML report
prompt-lock run --report json      # Generate JSON report
prompt-lock run --report both      # Generate both reports
```

### `prompt-lock snapshot`

Capture and save the current output as a baseline.

```bash
prompt-lock snapshot               # Snapshot all prompts
prompt-lock snapshot --id my-prompt
```

### `prompt-lock diff`

Compare current LLM output against the last saved snapshot.

```bash
prompt-lock diff                   # Diff all prompts
prompt-lock diff --id my-prompt
```

## Assertion Reference

| Assertion | Config | What it checks |
|-----------|--------|---------------|
| `contains` | `value: string` | Output contains the string |
| `not-contains` | `value: string` | Output does NOT contain the string |
| `starts-with` | `value: string` | Output starts with the string |
| `ends-with` | `value: string` | Output ends with the string |
| `matches-regex` | `pattern: string` | Output matches regex pattern |
| `max-length` | `chars: number` | Output is under N characters |
| `min-length` | `chars: number` | Output is over N characters |
| `json-valid` | — | Output is valid JSON |
| `json-schema` | `schema: object` | Output JSON matches a JSON Schema |
| `no-hallucination-words` | `words?: string[]` | Output does NOT contain hallucination indicators |
| `custom` | `name: string, fn: (output) => boolean` | User-provided function returning boolean |

## Provider Setup

### Anthropic

```bash
export ANTHROPIC_API_KEY=your-key-here
```

### OpenAI

```bash
export OPENAI_API_KEY=your-key-here
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Prompt Regression Tests
on: [push, pull_request]
jobs:
  prompt-lock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npx prompt-lock run --ci
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

The `--ci` flag (or `failOnRegression: true` in config) ensures exit code 1 when any assertion fails.

## Configuration

`.promptlock/config.json` (created by `init`):

```json
{
  "promptsDir": "./prompts",
  "snapshotDir": "./.promptlock/snapshots",
  "reportDir": "./.promptlock/reports",
  "defaultProvider": "anthropic",
  "ci": {
    "failOnRegression": true,
    "reportFormat": ["json", "html"]
  }
}
```

## License

MIT
