import { TokenUsage } from './types';

interface ModelPricing {
  inputPer1k: number;
  outputPer1k: number;
}

const PRICING_TABLE: Record<string, ModelPricing> = {
  // OpenAI
  'gpt-4o': { inputPer1k: 0.0025, outputPer1k: 0.01 },
  'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  'gpt-4-turbo': { inputPer1k: 0.01, outputPer1k: 0.03 },
  'gpt-4': { inputPer1k: 0.03, outputPer1k: 0.06 },
  'gpt-3.5-turbo': { inputPer1k: 0.0005, outputPer1k: 0.0015 },
  'o1': { inputPer1k: 0.015, outputPer1k: 0.06 },
  'o1-mini': { inputPer1k: 0.003, outputPer1k: 0.012 },
  'o3-mini': { inputPer1k: 0.0011, outputPer1k: 0.0044 },
  // Anthropic
  'claude-opus-4': { inputPer1k: 0.015, outputPer1k: 0.075 },
  'claude-sonnet-4': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'claude-3-5-sonnet': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'claude-3-5-haiku': { inputPer1k: 0.0008, outputPer1k: 0.004 },
  'claude-3-haiku': { inputPer1k: 0.00025, outputPer1k: 0.00125 },
  'claude-3-opus': { inputPer1k: 0.015, outputPer1k: 0.075 },
};

export function estimateCost(model: string, usage: TokenUsage): number {
  const pricing = findPricing(model);
  if (!pricing) return 0;
  return (usage.inputTokens / 1000) * pricing.inputPer1k +
         (usage.outputTokens / 1000) * pricing.outputPer1k;
}

function findPricing(model: string): ModelPricing | null {
  // Exact match first
  if (PRICING_TABLE[model]) return PRICING_TABLE[model];

  // Prefix match (e.g. 'gpt-4o-2024-08-06' matches 'gpt-4o')
  const keys = Object.keys(PRICING_TABLE).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (model.startsWith(key)) return PRICING_TABLE[key];
  }

  return null;
}

export function getPricingTable(): Record<string, ModelPricing> {
  const copy: Record<string, ModelPricing> = {};
  for (const [key, val] of Object.entries(PRICING_TABLE)) {
    copy[key] = { ...val };
  }
  return copy;
}
