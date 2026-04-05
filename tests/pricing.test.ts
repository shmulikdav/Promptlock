import { estimateCost, getPricingTable } from '../src/pricing';
import { TokenUsage } from '../src/types';

describe('estimateCost', () => {
  const usage: TokenUsage = { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 };

  it('calculates cost for exact model match', () => {
    const cost = estimateCost('gpt-4o-mini', usage);
    // 1000/1000 * 0.00015 + 500/1000 * 0.0006 = 0.00015 + 0.0003 = 0.00045
    expect(cost).toBeCloseTo(0.00045, 5);
  });

  it('calculates cost for prefix model match', () => {
    const cost = estimateCost('gpt-4o-2024-08-06', usage);
    // Should match 'gpt-4o' pricing
    expect(cost).toBeGreaterThan(0);
  });

  it('returns 0 for unknown model', () => {
    const cost = estimateCost('unknown-model-xyz', usage);
    expect(cost).toBe(0);
  });

  it('handles zero tokens', () => {
    const cost = estimateCost('gpt-4o', { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
    expect(cost).toBe(0);
  });

  it('calculates anthropic model costs', () => {
    const cost = estimateCost('claude-sonnet-4-20250514', usage);
    // Should match 'claude-sonnet-4' via prefix
    expect(cost).toBeGreaterThan(0);
  });
});

describe('getPricingTable', () => {
  it('returns a copy of the pricing table', () => {
    const table = getPricingTable();
    expect(table['gpt-4o']).toBeDefined();
    expect(table['gpt-4o'].inputPer1k).toBeGreaterThan(0);
    // Verify it's a copy
    table['gpt-4o'].inputPer1k = 999;
    const table2 = getPricingTable();
    expect(table2['gpt-4o'].inputPer1k).not.toBe(999);
  });
});
