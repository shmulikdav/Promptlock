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

      const client = new Anthropic({
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
      });

      const response = await client.messages.create({
        model: (options as any)?.model ?? 'claude-sonnet-4-20250514',
        max_tokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature,
        messages: [{ role: 'user', content: prompt }],
      });

      const block = response.content[0];
      return block && block.type === 'text' ? block.text : '';
    },
  };
}
