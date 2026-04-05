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

      const resolvedKey = apiKey || process.env.OPENAI_API_KEY;
      if (!resolvedKey) {
        throw new Error(
          'OpenAI API key not found. Set OPENAI_API_KEY environment variable or pass apiKey to createOpenAIProvider().',
        );
      }

      const client = new OpenAI({ apiKey: resolvedKey });

      const controller = options?.timeout ? new AbortController() : undefined;
      const timer = controller
        ? setTimeout(() => controller.abort(), options!.timeout)
        : undefined;

      try {
        const response = await client.chat.completions.create(
          {
            model: (options as any)?.model ?? 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: options?.maxTokens ?? 1024,
            temperature: options?.temperature,
          },
          controller ? { signal: controller.signal } : undefined,
        );

        return response.choices[0]?.message?.content ?? '';
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          throw new Error(`OpenAI call timed out after ${options!.timeout}ms`);
        }
        throw e;
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}
