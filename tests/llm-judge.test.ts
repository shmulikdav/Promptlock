import { assertLlmJudge } from '../src/assertions/llm-judge';

// Mock the providers module
jest.mock('../src/providers', () => ({
  getProvider: jest.fn(),
}));

import { getProvider } from '../src/providers';

const mockGetProvider = getProvider as jest.MockedFunction<typeof getProvider>;

describe('assertLlmJudge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes when score meets threshold', async () => {
    mockGetProvider.mockReturnValue({
      call: jest.fn().mockResolvedValue('{"score": 0.9, "explanation": "Great output"}'),
    });

    const result = await assertLlmJudge(
      'Hello world',
      { provider: 'openai', model: 'gpt-4o-mini' },
      'Is the output a greeting?',
      0.7,
    );

    expect(result.passed).toBe(true);
    expect(result.type).toBe('llm-judge');
    expect(result.actual).toContain('0.90');
  });

  it('fails when score is below threshold', async () => {
    mockGetProvider.mockReturnValue({
      call: jest.fn().mockResolvedValue('{"score": 0.3, "explanation": "Poor quality"}'),
    });

    const result = await assertLlmJudge(
      'bad output',
      { provider: 'openai', model: 'gpt-4o-mini' },
      'Is the output helpful?',
      0.7,
    );

    expect(result.passed).toBe(false);
    expect(result.actual).toContain('0.30');
  });

  it('handles JSON wrapped in markdown code blocks', async () => {
    mockGetProvider.mockReturnValue({
      call: jest.fn().mockResolvedValue('```json\n{"score": 0.85, "explanation": "Good"}\n```'),
    });

    const result = await assertLlmJudge(
      'test output',
      { provider: 'openai', model: 'gpt-4o-mini' },
      'Quality check',
      0.7,
    );

    expect(result.passed).toBe(true);
  });

  it('extracts score from unstructured response', async () => {
    mockGetProvider.mockReturnValue({
      call: jest.fn().mockResolvedValue('The score is 0.8 because the output is good.'),
    });

    const result = await assertLlmJudge(
      'test output',
      { provider: 'openai', model: 'gpt-4o-mini' },
      'Quality check',
      0.7,
    );

    expect(result.passed).toBe(true);
  });

  it('returns failure on provider error', async () => {
    mockGetProvider.mockReturnValue({
      call: jest.fn().mockRejectedValue(new Error('API key invalid')),
    });

    const result = await assertLlmJudge(
      'test output',
      { provider: 'openai', model: 'gpt-4o-mini' },
      'Quality check',
      0.7,
    );

    expect(result.passed).toBe(false);
    expect(result.message).toContain('API key invalid');
  });

  it('clamps score to 0-1 range', async () => {
    mockGetProvider.mockReturnValue({
      call: jest.fn().mockResolvedValue('{"score": 1.5, "explanation": "Over max"}'),
    });

    const result = await assertLlmJudge(
      'test',
      { provider: 'openai', model: 'gpt-4o-mini' },
      'test',
      0.7,
    );

    expect(result.passed).toBe(true);
    expect(result.actual).toContain('1.00');
  });
});
