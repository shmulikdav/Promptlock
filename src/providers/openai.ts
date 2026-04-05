import { LLMProvider, PromptLockOptions } from '../types';

export function createOpenAIProvider(apiKey?: string): LLMProvider {
  return {
    async call(prompt: string, options?: PromptLockOptions & { model?: string }): Promise<string> {
      let OpenAI: any;
      try {
        OpenAI = require('openai').default || require('openai');
      } catch {
        throw new Error(
          'OpenAI SDK not found. Install it with: npm install openai',
        );
      }

      const client = new OpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
      });

      const response = await client.chat.completions.create({
        model: (options as any)?.model ?? 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature,
      });

      return response.choices[0]?.message?.content ?? '';
    },
  };
}
