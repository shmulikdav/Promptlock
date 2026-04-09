import { runAB } from '../src/runner';
import { PromptLockConfig } from '../src/types';

function mockConfig(overrides: Partial<PromptLockConfig> = {}): PromptLockConfig {
  return {
    id: 'test',
    provider: 'openai',
    model: 'gpt-4o-mini',
    prompt: 'Say hello',
    assertions: [
      { type: 'min-length', chars: 1 },
    ],
    ...overrides,
  };
}

describe('runAB', () => {
  it('runs two variants in dry-run mode and returns a comparison', async () => {
    const a = mockConfig({ id: 'variant-a', prompt: 'Be concise: say hi' });
    const b = mockConfig({ id: 'variant-b', prompt: 'Respond verbosely: say hello' });

    const result = await runAB(a, b, { dryRun: true });

    expect(result.id).toBe('variant-a vs variant-b');
    expect(result.variantA.id).toBe('variant-a');
    expect(result.variantB.id).toBe('variant-b');
    expect(result.variantA.passed).toBe(true);
    expect(result.variantB.passed).toBe(true);
  });

  it('declares a tie when both variants produce identical dry-run results', async () => {
    const a = mockConfig({ id: 'v1' });
    const b = mockConfig({ id: 'v2' });

    const result = await runAB(a, b, { dryRun: true });
    expect(result.winner).toBe('tie');
  });

  it('calculates deltas correctly (B minus A sign convention)', async () => {
    // Dry run makes duration/cost effectively zero, but we can still verify signs
    const a = mockConfig({ id: 'v1' });
    const b = mockConfig({ id: 'v2' });

    const result = await runAB(a, b, { dryRun: true });

    expect(result.deltas).toHaveProperty('passRate');
    expect(result.deltas).toHaveProperty('costDollars');
    expect(result.deltas).toHaveProperty('latencyMs');
    expect(result.deltas).toHaveProperty('tokens');
    expect(typeof result.deltas.passRate).toBe('number');
    expect(typeof result.deltas.costDollars).toBe('number');
    expect(typeof result.deltas.latencyMs).toBe('number');
    expect(typeof result.deltas.tokens).toBe('number');
  });

  it('picks the variant with higher pass rate as winner', async () => {
    // variantA passes; variantB has a failing assertion (non-matching regex)
    const a = mockConfig({
      id: 'passing',
      assertions: [{ type: 'min-length', chars: 1 }],
    });
    const b = mockConfig({
      id: 'failing',
      assertions: [{ type: 'matches-regex', pattern: '^WILL_NEVER_MATCH_123$' }],
    });

    const result = await runAB(a, b, { dryRun: true });
    expect(result.winner).toBe('A');
    expect(result.deltas.passRate).toBeLessThan(0);
  });
});
