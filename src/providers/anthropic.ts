import { LLMProvider, PromptLockOptions } from '../types';

export function createAnthropicProvider(apiKey?: string): LLMProvider {
  return {
    async call(prompt: string, options?: PromptLockOptions & { model?: string }): Promise<string> {
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
            model: (options as any)?.model ?? 'claude-sonnet-4-20250514',
            max_tokens: options?.maxTokens ?? 1024,
            temperature: options?.temperature,
            messages: [{ role: 'user', content: prompt }],
          },
          controller ? { signal: controller.signal } : undefined,
        );

        const block = response.content[0];
        return block && block.type === 'text' ? block.text : '';
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          throw new Error(`Anthropic call timed out after ${options!.timeout}ms`);
        }
        throw e;
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}
