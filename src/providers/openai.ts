import { LLMProvider, LLMCallResult, PromptLockOptions } from '../types';

export function createOpenAIProvider(apiKey?: string): LLMProvider {
  async function callImpl(prompt: string, options?: PromptLockOptions & { model?: string }): Promise<LLMCallResult> {
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
          model: options?.model ?? 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options?.maxTokens ?? 1024,
          temperature: options?.temperature,
        },
        controller ? { signal: controller.signal } : undefined,
      );

      const text = response.choices[0]?.message?.content ?? '';
      const usage = response.usage ? {
        inputTokens: response.usage.prompt_tokens ?? 0,
        outputTokens: response.usage.completion_tokens ?? 0,
        totalTokens: response.usage.total_tokens ?? 0,
      } : undefined;

      return { text, usage };
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        throw new Error(`OpenAI call timed out after ${options!.timeout}ms`);
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
