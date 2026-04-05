import { LLMProvider, LLMCallResult, PromptLockOptions } from '../types';

export function createAnthropicProvider(apiKey?: string): LLMProvider {
  async function callImpl(prompt: string, options?: PromptLockOptions & { model?: string }): Promise<LLMCallResult> {
    let Anthropic: any;
    try {
      Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
    } catch {
      throw new Error(
        'Anthropic SDK not found. Install it with: npm install @anthropic-ai/sdk',
      );
    }

    const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!resolvedKey) {
      throw new Error(
        'Anthropic API key not found. Set ANTHROPIC_API_KEY environment variable or pass apiKey to createAnthropicProvider().',
      );
    }

    const client = new Anthropic({ apiKey: resolvedKey });

    const controller = options?.timeout ? new AbortController() : undefined;
    const timer = controller
      ? setTimeout(() => controller.abort(), options!.timeout)
      : undefined;

    try {
      const response = await client.messages.create(
        {
          model: options?.model ?? 'claude-sonnet-4-20250514',
          max_tokens: options?.maxTokens ?? 1024,
          temperature: options?.temperature,
          messages: [{ role: 'user', content: prompt }],
        },
        controller ? { signal: controller.signal } : undefined,
      );

      const block = response.content[0];
      const text = block && block.type === 'text' ? block.text : '';
      const usage = response.usage ? {
        inputTokens: response.usage.input_tokens ?? 0,
        outputTokens: response.usage.output_tokens ?? 0,
        totalTokens: (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0),
      } : undefined;

      return { text, usage };
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        throw new Error(`Anthropic call timed out after ${options!.timeout}ms`);
      }
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    async call(prompt: string, options?: PromptLockOptions & { model?: string }): Promise<string> {
      const result = await callImpl(prompt, options);
      return result.text;
    },
    async callWithMeta(prompt: string, options?: PromptLockOptions & { model?: string }): Promise<LLMCallResult> {
      return callImpl(prompt, options);
    },
  };
}
