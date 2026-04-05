import { validateConfig } from '../src/config-validation';

function validConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-prompt',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    prompt: 'Hello {{name}}',
    assertions: [{ type: 'contains', value: 'hello' }],
    ...overrides,
  };
}

describe('validateConfig', () => {
  it('accepts a valid config', () => {
    const result = validateConfig(validConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects non-object config', () => {
    expect(validateConfig(null).valid).toBe(false);
    expect(validateConfig('string').valid).toBe(false);
    expect(validateConfig(42).valid).toBe(false);
  });

  it('rejects config missing id', () => {
    const result = validateConfig(validConfig({ id: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('id');
  });

  it('rejects config with unknown provider', () => {
    const result = validateConfig(validConfig({ provider: 'google' }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('provider');
  });

  it('rejects config missing model', () => {
    const result = validateConfig(validConfig({ model: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('model');
  });

  it('rejects config missing prompt', () => {
    const result = validateConfig(validConfig({ prompt: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('prompt');
  });

  it('rejects config where assertions is not an array', () => {
    const result = validateConfig(validConfig({ assertions: 'not-array' }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('assertions');
  });

  it('rejects assertion with unknown type', () => {
    const result = validateConfig(validConfig({
      assertions: [{ type: 'nonexistent' }],
    }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('unknown type');
  });

  it('rejects matches-regex with invalid pattern', () => {
    const result = validateConfig(validConfig({
      assertions: [{ type: 'matches-regex', pattern: '[invalid' }],
    }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('invalid regex');
  });

  it('rejects max-length with non-numeric chars', () => {
    const result = validateConfig(validConfig({
      assertions: [{ type: 'max-length', chars: 'abc' }],
    }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('chars');
  });

  it('rejects contains assertion missing value', () => {
    const result = validateConfig(validConfig({
      assertions: [{ type: 'contains', value: 123 }],
    }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('value');
  });

  it('rejects custom assertion without fn', () => {
    const result = validateConfig(validConfig({
      assertions: [{ type: 'custom', name: 'test' }],
    }));
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('fn'))).toBe(true);
  });

  it('accepts config with optional fields omitted', () => {
    const result = validateConfig({
      id: 'test',
      provider: 'openai',
      model: 'gpt-4o-mini',
      prompt: 'hello',
      assertions: [],
    });
    expect(result.valid).toBe(true);
  });

  it('collects multiple errors', () => {
    const result = validateConfig({ id: '', provider: 'invalid', assertions: 'bad' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(2);
  });

  it('accepts custom provider config', () => {
    const result = validateConfig(validConfig({
      provider: { type: 'custom', url: 'http://localhost:11434/api/generate' },
    }));
    expect(result.valid).toBe(true);
  });

  it('rejects custom provider without url', () => {
    const result = validateConfig(validConfig({
      provider: { type: 'custom' },
    }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('url');
  });

  it('rejects custom provider with non-http URL', () => {
    const result = validateConfig(validConfig({
      provider: { type: 'custom', url: 'ftp://evil.com/api' },
    }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('http');
  });

  it('rejects custom provider with invalid URL', () => {
    const result = validateConfig(validConfig({
      provider: { type: 'custom', url: 'not-a-url' },
    }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not a valid URL');
  });

  it('validates contains-all assertion', () => {
    const result = validateConfig(validConfig({
      assertions: [{ type: 'contains-all', values: 'not-array' }],
    }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('values');
  });

  it('validates max-latency assertion', () => {
    const result = validateConfig(validConfig({
      assertions: [{ type: 'max-latency', ms: -1 }],
    }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('ms');
  });

  it('validates dataset field rejects non-array non-path', () => {
    const result = validateConfig(validConfig({ dataset: 123 }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('dataset');
  });

  it('validates dataset file path must end with .csv or .json', () => {
    const result = validateConfig(validConfig({ dataset: 'not-a-valid-file.txt' }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('.csv or .json');
  });

  it('accepts dataset as file path string', () => {
    const result = validateConfig(validConfig({ dataset: 'data/inputs.csv' }));
    expect(result.valid).toBe(true);
  });

  it('accepts valid dataset', () => {
    const result = validateConfig(validConfig({
      dataset: [{ text: 'input 1' }, { text: 'input 2' }],
    }));
    expect(result.valid).toBe(true);
  });
});
