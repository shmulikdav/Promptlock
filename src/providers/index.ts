import { LLMProvider, PromptLockOptions } from '../types';
import { createOpenAIProvider } from './openai';
import { createAnthropicProvider } from './anthropic';

export function getProvider(providerName: 'openai' | 'anthropic', model: string): LLMProvider {
  let baseProvider: LLMProvider;

  switch (providerName) {
    case 'openai':
      baseProvider = createOpenAIProvider();
      break;
    case 'anthropic':
      baseProvider = createAnthropicProvider();
      break;
    default:
      throw new Error(`Unknown provider: "${providerName}". Supported: openai, anthropic`);
  }

  // Wrap so that model is always passed through
  return {
    async call(prompt: string, options?: PromptLockOptions): Promise<string> {
      return baseProvider.call(prompt, { ...options, model } as any);
    },
  };
}
