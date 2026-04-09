import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';

const schemaPath = path.join(__dirname, '..', 'schemas', 'promptlock.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

describe('promptlock JSON schema', () => {
  it('schema file exists and is valid JSON Schema', () => {
    expect(schema).toBeDefined();
    expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(schema.title).toBe('prompt-lock config');
  });

  it('accepts a minimal valid config', () => {
    const config = {
      id: 'test',
      provider: 'openai',
      model: 'gpt-4o-mini',
      prompt: 'Hello',
      assertions: [{ type: 'contains', value: 'hi' }],
    };
    expect(validate(config)).toBe(true);
  });

  it('rejects config missing required fields', () => {
    const config = {
      id: 'test',
      provider: 'openai',
      // missing model, prompt, assertions
    };
    expect(validate(config)).toBe(false);
  });

  it('accepts all 16 assertion types', () => {
    const types = [
      { type: 'contains', value: 'x' },
      { type: 'not-contains', value: 'x' },
      { type: 'contains-all', values: ['a', 'b'] },
      { type: 'starts-with', value: 'x' },
      { type: 'ends-with', value: 'x' },
      { type: 'matches-regex', pattern: '.*' },
      { type: 'max-length', chars: 100 },
      { type: 'min-length', chars: 1 },
      { type: 'json-valid' },
      { type: 'json-schema', schema: { type: 'object' } },
      { type: 'no-hallucination-words' },
      { type: 'no-duplicates' },
      { type: 'max-latency', ms: 5000 },
      { type: 'max-cost', dollars: 0.05 },
      { type: 'llm-judge', judge: { provider: 'openai', model: 'gpt-4o-mini' }, criteria: 'is helpful' },
      { type: 'custom', name: 'test' },
    ];

    for (const assertion of types) {
      const config = {
        id: 'test',
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt: 'Hello',
        assertions: [assertion],
      };
      const valid = validate(config);
      if (!valid) {
        throw new Error(`Assertion type "${assertion.type}" failed schema validation: ${JSON.stringify(validate.errors)}`);
      }
      expect(valid).toBe(true);
    }
  });

  it('accepts custom provider config', () => {
    const config = {
      id: 'test',
      provider: { type: 'custom', url: 'https://example.com/api' },
      model: 'my-model',
      prompt: 'Hello',
      assertions: [{ type: 'contains', value: 'hi' }],
    };
    expect(validate(config)).toBe(true);
  });

  it('rejects non-http custom provider URL', () => {
    const config = {
      id: 'test',
      provider: { type: 'custom', url: 'ftp://example.com/api' },
      model: 'my-model',
      prompt: 'Hello',
      assertions: [{ type: 'contains', value: 'hi' }],
    };
    expect(validate(config)).toBe(false);
  });

  it('accepts dataset as inline array', () => {
    const config = {
      id: 'test',
      provider: 'openai',
      model: 'gpt-4o-mini',
      prompt: 'Say {{word}}',
      dataset: [{ word: 'hi' }, { word: 'bye' }],
      assertions: [{ type: 'min-length', chars: 1 }],
    };
    expect(validate(config)).toBe(true);
  });

  it('accepts dataset as .csv file path', () => {
    const config = {
      id: 'test',
      provider: 'openai',
      model: 'gpt-4o-mini',
      prompt: 'Say {{word}}',
      dataset: './data/inputs.csv',
      assertions: [{ type: 'min-length', chars: 1 }],
    };
    expect(validate(config)).toBe(true);
  });

  it('rejects dataset as .txt file path', () => {
    const config = {
      id: 'test',
      provider: 'openai',
      model: 'gpt-4o-mini',
      prompt: 'Say {{word}}',
      dataset: './data/inputs.txt',
      assertions: [{ type: 'min-length', chars: 1 }],
    };
    expect(validate(config)).toBe(false);
  });

  it('accepts an array of configs', () => {
    const configs = [
      {
        id: 'a',
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt: 'Hello',
        assertions: [{ type: 'contains', value: 'hi' }],
      },
      {
        id: 'b',
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        prompt: 'World',
        assertions: [{ type: 'min-length', chars: 1 }],
      },
    ];
    expect(validate(configs)).toBe(true);
  });
});
