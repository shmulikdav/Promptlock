import { LLMProvider, LLMCallResult, ProviderConfig, PromptLockOptions } from '../types';
import { createOpenAIProvider } from './openai';
import { createAnthropicProvider } from './anthropic';
import { createCustomProvider } from './custom';

export function getProvider(providerConfig: ProviderConfig, model: string): LLMProvider {
  let baseProvider: LLMProvider;

  if (typeof providerConfig === 'string') {
    switch (providerConfig) {
      case 'openai':
        baseProvider = createOpenAIProvider();
        break;
      case 'anthropic':
        baseProvider = createAnthropicProvider();
        break;
      default:
        throw new Error(
          `Unknown provider: "${providerConfig}". Supported: openai, anthropic, or use { type: 'custom', url: '...' } for custom endpoints.`,
        );
    }
  } else if (providerConfig.type === 'custom') {
    baseProvider = createCustomProvider(providerConfig);
  } else {
    throw new Error('Invalid provider configuration.');
  }

  // Wrap so that model is always passed through
  const wrapped: LLMProvider = {
    async call(prompt: string, options?: PromptLockOptions): Promise<string> {
      return baseProvider.call(prompt, { ...options, model });
    },
  };

  if (baseProvider.callWithMeta) {
    wrapped.callWithMeta = async (prompt: string, options?: PromptLockOptions): Promise<LLMCallResult> => {
      return baseProvider.callWithMeta!(prompt, { ...options, model });
    };
  }

  return wrapped;
}
