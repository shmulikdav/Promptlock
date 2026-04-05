import { runAssertions } from '../src/assertions';
import { builtinAssertions } from '../src/assertions/builtin';
import { assertJsonSchema } from '../src/assertions/json-schema';
import { assertCustom } from '../src/assertions/custom';

describe('builtin assertions', () => {
  describe('contains', () => {
    it('passes when output contains the value', () => {
      const result = builtinAssertions['contains']('hello world', { value: 'world' });
      expect(result.passed).toBe(true);
    });

    it('fails when output does not contain the value', () => {
      const result = builtinAssertions['contains']('hello world', { value: 'xyz' });
      expect(result.passed).toBe(false);
    });
  });

  describe('not-contains', () => {
    it('passes when output does not contain the value', () => {
      const result = builtinAssertions['not-contains']('hello world', { value: 'xyz' });
      expect(result.passed).toBe(true);
    });

    it('fails when output contains the value', () => {
      const result = builtinAssertions['not-contains']('hello world', { value: 'world' });
      expect(result.passed).toBe(false);
    });
  });

  describe('starts-with', () => {
    it('passes when output starts with the value', () => {
      const result = builtinAssertions['starts-with']('hello world', { value: 'hello' });
      expect(result.passed).toBe(true);
    });

    it('fails when output does not start with the value', () => {
      const result = builtinAssertions['starts-with']('hello world', { value: 'world' });
      expect(result.passed).toBe(false);
    });
  });

  describe('ends-with', () => {
    it('passes when output ends with the value', () => {
      const result = builtinAssertions['ends-with']('hello world', { value: 'world' });
      expect(result.passed).toBe(true);
    });

    it('fails when output does not end with the value', () => {
      const result = builtinAssertions['ends-with']('hello world', { value: 'hello' });
      expect(result.passed).toBe(false);
    });
  });

  describe('matches-regex', () => {
    it('passes when output matches the pattern', () => {
      const result = builtinAssertions['matches-regex']('order #12345', { pattern: '#\\d+' });
      expect(result.passed).toBe(true);
    });

    it('fails when output does not match the pattern', () => {
      const result = builtinAssertions['matches-regex']('no numbers here', { pattern: '\\d+' });
      expect(result.passed).toBe(false);
    });

    it('handles invalid regex pattern gracefully', () => {
      const result = builtinAssertions['matches-regex']('some text', { pattern: '[invalid' });
      expect(result.passed).toBe(false);
      expect(result.message).toContain('Invalid regex');
    });
  });

  describe('max-length', () => {
    it('passes when output is under the limit', () => {
      const result = builtinAssertions['max-length']('short', { chars: 100 });
      expect(result.passed).toBe(true);
    });

    it('passes when output is exactly at the limit', () => {
      const result = builtinAssertions['max-length']('hi', { chars: 2 });
      expect(result.passed).toBe(true);
    });

    it('fails when output exceeds the limit', () => {
      const result = builtinAssertions['max-length']('this is too long', { chars: 5 });
      expect(result.passed).toBe(false);
      expect(result.actual).toBe('16 chars');
    });
  });

  describe('min-length', () => {
    it('passes when output meets the minimum', () => {
      const result = builtinAssertions['min-length']('long enough', { chars: 5 });
      expect(result.passed).toBe(true);
    });

    it('fails when output is too short', () => {
      const result = builtinAssertions['min-length']('hi', { chars: 10 });
      expect(result.passed).toBe(false);
    });
  });

  describe('json-valid', () => {
    it('passes for valid JSON', () => {
      const result = builtinAssertions['json-valid']('{"key": "value"}', {});
      expect(result.passed).toBe(true);
    });

    it('passes for JSON arrays', () => {
      const result = builtinAssertions['json-valid']('[1, 2, 3]', {});
      expect(result.passed).toBe(true);
    });

    it('fails for invalid JSON', () => {
      const result = builtinAssertions['json-valid']('{key: value}', {});
      expect(result.passed).toBe(false);
      expect(result.actual).toContain('invalid JSON');
    });
  });

  describe('no-hallucination-words', () => {
    it('passes when no hallucination words are present', () => {
      const result = builtinAssertions['no-hallucination-words']('The fox jumped over the dog.', {});
      expect(result.passed).toBe(true);
    });

    it('fails when default hallucination words are found', () => {
      const result = builtinAssertions['no-hallucination-words']('As an AI, I cannot do that.', {});
      expect(result.passed).toBe(false);
      expect(result.actual).toContain('As an AI');
    });

    it('uses custom word list when provided', () => {
      const result = builtinAssertions['no-hallucination-words']('maybe this works', {
        words: ['maybe', 'perhaps'],
      });
      expect(result.passed).toBe(false);
      expect(result.actual).toContain('maybe');
    });
  });

  describe('contains-all', () => {
    it('passes when all values are present', () => {
      const result = builtinAssertions['contains-all']('hello world foo', { values: ['hello', 'world'] });
      expect(result.passed).toBe(true);
    });

    it('fails when some values are missing', () => {
      const result = builtinAssertions['contains-all']('hello world', { values: ['hello', 'missing'] });
      expect(result.passed).toBe(false);
      expect(result.actual).toContain('missing');
    });
  });

  describe('no-duplicates', () => {
    it('passes when no duplicates', () => {
      const result = builtinAssertions['no-duplicates']('apple\nbanana\ncherry', {});
      expect(result.passed).toBe(true);
    });

    it('fails when duplicates found', () => {
      const result = builtinAssertions['no-duplicates']('apple\nbanana\napple', {});
      expect(result.passed).toBe(false);
      expect(result.actual).toContain('apple');
    });

    it('uses custom separator', () => {
      const result = builtinAssertions['no-duplicates']('a, b, a', { separator: ', ' });
      expect(result.passed).toBe(false);
    });
  });

  describe('max-latency', () => {
    it('passes when under the limit', () => {
      const result = builtinAssertions['max-latency']('output', { ms: 5000, __duration: 1000 });
      expect(result.passed).toBe(true);
    });

    it('fails when over the limit', () => {
      const result = builtinAssertions['max-latency']('output', { ms: 1000, __duration: 2000 });
      expect(result.passed).toBe(false);
      expect(result.actual).toBe('2000ms');
    });
  });
});

describe('json-schema assertion', () => {
  it('passes when output matches schema', () => {
    const output = JSON.stringify({ name: 'Alice', age: 30 });
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name', 'age'],
    };
    const result = assertJsonSchema(output, schema);
    expect(result.passed).toBe(true);
  });

  it('fails when output does not match schema', () => {
    const output = JSON.stringify({ name: 'Alice' });
    const schema = {
      type: 'object',
      required: ['name', 'age'],
    };
    const result = assertJsonSchema(output, schema);
    expect(result.passed).toBe(false);
    expect(result.actual).toContain('schema errors');
  });

  it('fails when output is not valid JSON', () => {
    const result = assertJsonSchema('not json', { type: 'object' });
    expect(result.passed).toBe(false);
    expect(result.actual).toContain('invalid JSON');
  });
});

describe('custom assertion', () => {
  it('passes when custom function returns true', async () => {
    const result = await assertCustom('hello', 'is-hello', (output) => output === 'hello');
    expect(result.passed).toBe(true);
  });

  it('fails when custom function returns false', async () => {
    const result = await assertCustom('hello', 'is-goodbye', (output) => output === 'goodbye');
    expect(result.passed).toBe(false);
  });

  it('handles async custom functions', async () => {
    const result = await assertCustom('hello', 'async-check', async (output) => {
      return output.length > 0;
    });
    expect(result.passed).toBe(true);
  });

  it('catches errors in custom functions', async () => {
    const result = await assertCustom('hello', 'throws', () => {
      throw new Error('something broke');
    });
    expect(result.passed).toBe(false);
    expect(result.message).toBe('something broke');
  });
});

describe('runAssertions', () => {
  it('runs multiple assertions and returns all results', async () => {
    const results = await runAssertions('hello world', [
      { type: 'contains', value: 'hello' },
      { type: 'max-length', chars: 100 },
      { type: 'not-contains', value: 'goodbye' },
    ]);
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it('handles mixed pass/fail results', async () => {
    const results = await runAssertions('hello', [
      { type: 'contains', value: 'hello' },
      { type: 'min-length', chars: 100 },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].passed).toBe(true);
    expect(results[1].passed).toBe(false);
  });

  it('handles unknown assertion types gracefully', async () => {
    const results = await runAssertions('hello', [
      { type: 'nonexistent' } as any,
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain('Unknown assertion type');
  });

  it('handles custom assertions in the pipeline', async () => {
    const results = await runAssertions('hello world', [
      { type: 'contains', value: 'hello' },
      {
        type: 'custom',
        name: 'word-count',
        fn: (output: string) => output.split(' ').length === 2,
      },
    ]);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.passed)).toBe(true);
  });
});
