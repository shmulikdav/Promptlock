import { createOpenAIProvider } from '../src/providers/openai';
import { createAnthropicProvider } from '../src/providers/anthropic';
import { getProvider } from '../src/providers';

// Save original env
const originalEnv = { ...process.env };

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('createOpenAIProvider', () => {
  it('returns a provider with a call method', () => {
    const provider = createOpenAIProvider('test-key');
    expect(typeof provider.call).toBe('function');
  });

  it('throws SDK not found when openai is not installed', async () => {
    // openai is not in our dependencies (it's a peer dep), so require will fail
    const provider = createOpenAIProvider('test-key');
    await expect(provider.call('test')).rejects.toThrow('OpenAI SDK not found');
  });

  it('error message suggests how to install', async () => {
    const provider = createOpenAIProvider('test-key');
    await expect(provider.call('test')).rejects.toThrow('npm install openai');
  });
});

describe('createAnthropicProvider', () => {
  it('returns a provider with a call method', () => {
    const provider = createAnthropicProvider('test-key');
    expect(typeof provider.call).toBe('function');
  });

  it('throws SDK not found when @anthropic-ai/sdk is not installed', async () => {
    const provider = createAnthropicProvider('test-key');
    await expect(provider.call('test')).rejects.toThrow('Anthropic SDK not found');
  });

  it('error message suggests how to install', async () => {
    const provider = createAnthropicProvider('test-key');
    await expect(provider.call('test')).rejects.toThrow('npm install @anthropic-ai/sdk');
  });
});

describe('getProvider', () => {
  it('throws for unknown provider name', () => {
    expect(() => getProvider('google' as any, 'model')).toThrow('Unknown provider');
  });

  it('returns a provider with call method for openai', () => {
    const provider = getProvider('openai', 'gpt-4o-mini');
    expect(typeof provider.call).toBe('function');
  });

  it('returns a provider with call method for anthropic', () => {
    const provider = getProvider('anthropic', 'claude-sonnet-4-20250514');
    expect(typeof provider.call).toBe('function');
  });

  it('openai provider fails with SDK not found (peer dep not installed)', async () => {
    const provider = getProvider('openai', 'gpt-4o-mini');
    await expect(provider.call('test')).rejects.toThrow('OpenAI SDK not found');
  });

  it('anthropic provider fails with SDK not found (peer dep not installed)', async () => {
    const provider = getProvider('anthropic', 'claude-sonnet-4-20250514');
    await expect(provider.call('test')).rejects.toThrow('Anthropic SDK not found');
  });

  it('creates a custom provider', () => {
    const provider = getProvider(
      { type: 'custom', url: 'http://localhost:11434/api/generate' },
      'llama3',
    );
    expect(typeof provider.call).toBe('function');
  });

  it('throws for invalid provider config', () => {
    expect(() => getProvider({} as any, 'model')).toThrow('Invalid provider');
  });
});
