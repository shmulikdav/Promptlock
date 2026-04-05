# prompt-lock

[![CI](https://github.com/shmulikdav/Promptlock/actions/workflows/ci.yml/badge.svg)](https://github.com/shmulikdav/Promptlock/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/prompt-lock)](https://www.npmjs.com/package/prompt-lock)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Version control and behavioral regression testing for LLM prompts.**

prompt-lock wraps your prompts with behavioral assertions and snapshot baselines. On every change, it runs the assertion suite and flags regressions — like Jest for LLM behavior.
The lightweight, code-first alternative to promptfoo. TypeScript-native. Works with any LLM endpoint. Zero cloud dependencies.

## Demo

Run the demo without any API keys to see prompt-lock in action:

```bash
git clone https://github.com/shmulikdav/Promptlock.git
cd Promptlock
npm install && npm run build
node demo.js
```

This runs 4 simulated prompts (2 passing, 2 failing), saves snapshots, shows diffs, and generates an HTML report — all with mock LLM outputs.

## Installation

```bash
npm install prompt-lock
```

You'll also need at least one LLM provider SDK (or use a custom endpoint):

```bash
# For Anthropic
npm install @anthropic-ai/sdk

# For OpenAI
npm install openai

# For Ollama, LM Studio, Azure, etc. — no extra install needed!
# Use the custom provider: { type: 'custom', url: 'http://localhost:11434/api/generate' }
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

# 5. Save a snapshot baseline
npx prompt-lock snapshot
```

## Defining Prompts

Create config files as `.js`, `.yaml`, `.yml`, or `.json`. prompt-lock auto-discovers `promptlock.yaml` in your project root, or scans the `prompts/` directory.

### YAML Config (recommended)

```yaml
# promptlock.yaml
id: article-summarizer
version: '1.0.0'
provider: anthropic
model: claude-sonnet-4-20250514
prompt: |
  Summarize the following article in 3 bullet points.
  Article: {{article}}
defaultVars:
  article: The quick brown fox jumped over the lazy dog.
assertions:
  - type: contains
    value: '•'
  - type: max-length
    chars: 500
  - type: max-cost
    dollars: 0.05
```

### JavaScript Config

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
    { type: 'max-latency', ms: 10000 },
  ]
};
```

### Using Custom Providers (Ollama, LM Studio, Azure, etc.)

```javascript
module.exports = {
  id: 'local-test',
  provider: {
    type: 'custom',
    url: 'http://localhost:11434/api/generate',
    // Optional: custom headers for auth
    headers: { 'Authorization': 'Bearer ...' },
    // Optional: custom response path (auto-detects OpenAI, Anthropic, Ollama formats)
    responsePath: 'response',
  },
  model: 'llama3',
  prompt: 'Hello {{name}}',
  defaultVars: { name: 'world' },
  assertions: [
    { type: 'min-length', chars: 5 },
  ],
};
```

### Testing with Datasets

Test a prompt against multiple inputs — inline or from external CSV/JSON files:

```javascript
module.exports = {
  id: 'classifier',
  provider: 'openai',
  model: 'gpt-4o-mini',
  prompt: 'Classify this ticket: {{ticket}}',
  defaultVars: { ticket: 'My payment failed' },

  // Inline dataset
  dataset: [
    { ticket: 'My payment failed' },
    { ticket: 'How do I reset my password?' },
    { ticket: 'Your product is great!' },
  ],

  // Or load from a file:
  // dataset: './data/test-tickets.csv',
  // dataset: './data/test-tickets.json',

  assertions: [
    { type: 'json-valid' },
    { type: 'max-latency', ms: 5000 },
  ],
};
```

CSV files use the first row as headers (= template variable names):

```csv
ticket,expected_category
My payment failed,billing
How do I reset my password?,account
Your product is great!,feedback
```

### LLM-as-Judge

Use a separate LLM to evaluate output quality:

```javascript
module.exports = {
  id: 'creative-writer',
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  prompt: 'Write a haiku about {{topic}}',
  defaultVars: { topic: 'coding' },
  assertions: [
    { type: 'max-length', chars: 200 },
    {
      type: 'llm-judge',
      judge: { provider: 'openai', model: 'gpt-4o-mini' },
      criteria: 'Is this a valid haiku with 5-7-5 syllable structure?',
      threshold: 0.7,  // pass if score >= 0.7
    },
  ],
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
prompt-lock run --report markdown  # Generate Markdown report
prompt-lock run --report both      # Generate JSON + HTML reports
prompt-lock run --dry-run          # Show what would be tested without calling LLMs
prompt-lock run --verbose          # Show detailed output per prompt
prompt-lock run --parallel         # Run prompts in parallel
prompt-lock run --concurrency 10   # Max concurrent runs (default: 5)
prompt-lock run --cache            # Cache LLM outputs (skip unchanged prompts)
prompt-lock run --watch            # Watch for file changes and re-run
prompt-lock run --github-pr owner/repo#123  # Post results as PR comment
```

### `prompt-lock snapshot`

Capture and save the current output as a baseline. Snapshots are versioned — previous snapshots are kept as history.

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

### `prompt-lock history`

View snapshot history for a prompt.

```bash
prompt-lock history my-prompt
```

### `prompt-lock cache`

Manage the output cache (used with `--cache` flag).

```bash
prompt-lock cache stats            # Show cache size and entries
prompt-lock cache clear            # Clear all cached outputs
```

### Output Caching

Use `--cache` to skip LLM calls for prompts that haven't changed. Cached outputs are stored in `.promptlock/cache/` and keyed by prompt text + model name.

```bash
# First run: calls the LLM, saves to cache
prompt-lock run --cache

# Second run: uses cache, instant results
prompt-lock run --cache

# Clear cache when you want fresh results
prompt-lock cache clear
```

### Cost & Token Tracking

prompt-lock automatically tracks token usage and estimates cost for OpenAI and Anthropic calls. Costs are shown in console output and included in all report formats.

```bash
prompt-lock run --verbose   # Shows per-prompt token counts and cost
```

Use the `max-cost` assertion to enforce budget limits:

```yaml
assertions:
  - type: max-cost
    dollars: 0.05
```

Built-in pricing for GPT-4o, GPT-4o-mini, Claude Sonnet 4, Claude Haiku, and more. Unknown models show zero cost.

### Watch Mode

Auto-rerun on file changes during prompt development:

```bash
prompt-lock run --watch
```

Watches your config files and `prompts/` directory. Debounces rapid changes (500ms).

### Retry Logic

All LLM provider calls automatically retry on transient errors (rate limits, timeouts, network errors) with exponential backoff. Default: 3 retries. Use `--verbose` to see retry activity.

### GitHub PR Comments

Post test results directly to a GitHub pull request:

```bash
export GITHUB_TOKEN=your-token
prompt-lock run --ci --github-pr owner/repo#123
```

This posts a markdown table with pass/fail results and failure details. If a comment already exists, it updates in place.

## Assertion Reference

| Assertion | Config | What it checks |
|-----------|--------|---------------|
| `contains` | `value: string` | Output contains the string |
| `not-contains` | `value: string` | Output does NOT contain the string |
| `contains-all` | `values: string[]` | Output contains ALL listed strings |
| `starts-with` | `value: string` | Output starts with the string |
| `ends-with` | `value: string` | Output ends with the string |
| `matches-regex` | `pattern: string` | Output matches regex pattern |
| `max-length` | `chars: number` | Output is under N characters |
| `min-length` | `chars: number` | Output is over N characters |
| `json-valid` | — | Output is valid JSON |
| `json-schema` | `schema: object` | Output JSON matches a JSON Schema |
| `no-hallucination-words` | `words?: string[]` | Output does NOT contain hallucination indicators |
| `no-duplicates` | `separator?: string` | Output has no duplicate items (split by separator, default `\n`) |
| `max-latency` | `ms: number` | LLM response time is under N milliseconds |
| `max-cost` | `dollars: number` | LLM call cost is under N dollars |
| `llm-judge` | `judge: {provider, model}, criteria: string, threshold?: number` | Another LLM scores output quality (0-1) |
| `custom` | `name: string, fn: (output) => boolean` | User-provided function returning boolean (JS configs only) |

## Provider Setup

### Anthropic

```bash
export ANTHROPIC_API_KEY=your-key-here
```

### OpenAI

```bash
export OPENAI_API_KEY=your-key-here
```

### Custom Provider (Ollama, LM Studio, Azure, any HTTP endpoint)

No API key needed for local models. Just set the URL:

```javascript
provider: {
  type: 'custom',
  url: 'http://localhost:11434/api/generate',  // Ollama
  // url: 'http://localhost:1234/v1/chat/completions',  // LM Studio
  // url: 'https://your-resource.openai.azure.com/openai/deployments/gpt-4/chat/completions?api-version=2024-02-01',  // Azure
  headers: { 'api-key': process.env.AZURE_API_KEY },  // Optional auth
  responsePath: 'choices[0].message.content',  // Optional: path to extract response
}
```

Auto-detects response format for OpenAI, Anthropic, and Ollama APIs. Use `responsePath` for custom APIs.

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
      - run: npx prompt-lock run --ci --cache --github-pr ${{ github.repository }}#${{ github.event.pull_request.number }}
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- `--ci` ensures exit code 1 when any assertion fails
- `--cache` skips LLM calls for unchanged prompts (faster, cheaper)
- `--github-pr` posts results as a PR comment with pass/fail table
- Automatic retry on rate limits and transient errors (3 retries with exponential backoff)

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

## Template Variables

Use `{{variableName}}` in your prompts. Supports alphanumeric, dashes, dots, and underscores:

```
{{article}}        ✅
{{user-name}}      ✅
{{api.version}}    ✅
{{my_var}}         ✅
```

## License

MIT
