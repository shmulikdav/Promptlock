import * as fs from 'fs';
import * as path from 'path';
import { runAll, RunOptions } from '../src/runner';
import { runAssertions } from '../src/assertions';
import { OutputCache } from '../src/cache';
import { PromptLockConfig } from '../src/types';

const TEST_CACHE_DIR = path.join(__dirname, '.test-integration-cache');

beforeEach(async () => {
  await fs.promises.rm(TEST_CACHE_DIR, { recursive: true, force: true });
});

afterAll(async () => {
  await fs.promises.rm(TEST_CACHE_DIR, { recursive: true, force: true });
});

// Mock config that will fail at provider level (no SDK installed)
// but exercises the full pipeline
function mockConfig(overrides: Partial<PromptLockConfig> = {}): PromptLockConfig {
  return {
    id: 'integration-test',
    version: '1.0.0',
    provider: 'openai',
    model: 'gpt-4o-mini',
    prompt: 'Hello {{name}}',
    defaultVars: { name: 'World' },
    assertions: [
      { type: 'contains', value: 'hello' },
      { type: 'max-length', chars: 500 },
    ],
    ...overrides,
  };
}

describe('integration: runAll with options', () => {
  it('dry-run skips LLM calls', async () => {
    const results = await runAll([mockConfig()], { dryRun: true });
    expect(results).toHaveLength(1);
    expect(results[0].output).toBe('[DRY RUN — no LLM call made]');
    expect(results[0].duration).toBe(0);
  });

  it('dry-run still runs assertions against placeholder', async () => {
    const results = await runAll([mockConfig({
      assertions: [{ type: 'contains', value: 'DRY RUN' }],
    })], { dryRun: true });
    expect(results[0].passed).toBe(true);
    expect(results[0].assertions[0].passed).toBe(true);
  });

  it('handles multiple configs in dry-run', async () => {
    const configs = [
      mockConfig({ id: 'a' }),
      mockConfig({ id: 'b' }),
      mockConfig({ id: 'c' }),
    ];
    const results = await runAll(configs, { dryRun: true });
    expect(results).toHaveLength(3);
    expect(results.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('parallel dry-run produces same results as sequential', async () => {
    const configs = [
      mockConfig({ id: 'x' }),
      mockConfig({ id: 'y' }),
    ];
    const sequential = await runAll(configs, { dryRun: true });
    const parallel = await runAll(configs, { dryRun: true, parallel: true, concurrency: 2 });
    expect(parallel.map(r => r.id).sort()).toEqual(sequential.map(r => r.id).sort());
  });

  it('parallel execution handles many configs correctly (no races)', async () => {
    // Create 20 configs to stress-test the parallel queue
    const configs = Array.from({ length: 20 }, (_, i) => mockConfig({ id: `prompt-${i}` }));
    const results = await runAll(configs, { dryRun: true, parallel: true, concurrency: 5 });

    // All 20 must be present with unique IDs
    expect(results).toHaveLength(20);
    const ids = results.map(r => r.id).sort();
    const expected = Array.from({ length: 20 }, (_, i) => `prompt-${i}`).sort();
    expect(ids).toEqual(expected);

    // No duplicates
    const unique = new Set(ids);
    expect(unique.size).toBe(20);
  });

  it('onResult callback fires for each config', async () => {
    const received: string[] = [];
    const configs = [mockConfig({ id: 'p1' }), mockConfig({ id: 'p2' })];
    await runAll(configs, {
      dryRun: true,
      onResult: (r) => received.push(r.id),
    });
    expect(received).toEqual(['p1', 'p2']);
  });

  it('handles invalid config gracefully', async () => {
    const badConfig = { id: '', provider: 'invalid', assertions: [] } as any;
    const results = await runAll([badConfig], { dryRun: true });
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
    expect(results[0].assertions[0].type).toBe('error');
  });

  it('provider error produces error result, not crash', async () => {
    // No SDK installed, so this will fail at provider level
    const results = await runAll([mockConfig()]);
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
    expect(results[0].assertions[0].message).toContain('Error');
  });
});

describe('integration: assertions pipeline', () => {
  it('all assertion types work together', async () => {
    const output = '{"items": ["apple", "banana"]}\nResult is ready.';
    const results = await runAssertions(output, [
      { type: 'contains', value: 'apple' },
      { type: 'not-contains', value: 'cherry' },
      { type: 'contains-all', values: ['apple', 'banana'] },
      { type: 'starts-with', value: '{"items"' },
      { type: 'matches-regex', pattern: '"items":\\s*\\[' },
      { type: 'max-length', chars: 1000 },
      { type: 'min-length', chars: 10 },
      { type: 'no-hallucination-words' },
      { type: 'no-duplicates', separator: '\n' },
    ]);

    expect(results).toHaveLength(9);
    expect(results.every(r => r.passed)).toBe(true);
  });

  it('mixed pass/fail assertions all report correctly', async () => {
    const output = 'short';
    const results = await runAssertions(output, [
      { type: 'contains', value: 'short' },     // pass
      { type: 'min-length', chars: 100 },        // fail
      { type: 'json-valid' },                    // fail
      { type: 'max-length', chars: 10 },         // pass
    ]);

    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(false);
    expect(results[2].passed).toBe(false);
    expect(results[3].passed).toBe(true);
  });
});

describe('integration: cache + runner', () => {
  it('cache stores and returns output on second call', async () => {
    const cache = new OutputCache(TEST_CACHE_DIR);
    await cache.set('Hello World', 'gpt-4o-mini', 'cached hello response');

    // Verify the cache works standalone
    const cached = await cache.get('Hello World', 'gpt-4o-mini');
    expect(cached).toBe('cached hello response');
  });

  it('cache key differs by model', async () => {
    const cache = new OutputCache(TEST_CACHE_DIR);
    await cache.set('same prompt', 'gpt-4o', 'gpt response');
    await cache.set('same prompt', 'claude-sonnet', 'claude response');

    expect(await cache.get('same prompt', 'gpt-4o')).toBe('gpt response');
    expect(await cache.get('same prompt', 'claude-sonnet')).toBe('claude response');
  });
});

describe('integration: dataset with dry-run', () => {
  it('does NOT run dataset in dry-run mode', async () => {
    const results = await runAll([mockConfig({
      dataset: [
        { name: 'Alice' },
        { name: 'Bob' },
      ],
    })], { dryRun: true });

    // dry-run skips everything after initial output
    expect(results[0].output).toBe('[DRY RUN — no LLM call made]');
    // dataset is not populated in dry-run
    expect(results[0].datasetResults).toBeUndefined();
  });
});
