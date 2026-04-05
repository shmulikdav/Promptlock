import { AssertionResult } from '../types';

const DEFAULT_HALLUCINATION_WORDS = [
  'As an AI',
  'as an AI',
  'I cannot',
  'I can\'t',
  'I don\'t have access',
  'I\'m not able to',
  'I am not able to',
  'As a language model',
  'as a language model',
];

type AssertionHandler = (output: string, config: Record<string, unknown>) => AssertionResult;

export const builtinAssertions: Record<string, AssertionHandler> = {
  'contains': (output, config) => {
    const value = config.value as string;
    return {
      type: 'contains',
      name: `contains "${value}"`,
      passed: output.includes(value),
      expected: `output to contain "${value}"`,
      actual: output.includes(value) ? 'found' : 'not found',
    };
  },

  'not-contains': (output, config) => {
    const value = config.value as string;
    return {
      type: 'not-contains',
      name: `not-contains "${value}"`,
      passed: !output.includes(value),
      expected: `output to NOT contain "${value}"`,
      actual: output.includes(value) ? 'found' : 'not found',
    };
  },

  'starts-with': (output, config) => {
    const value = config.value as string;
    return {
      type: 'starts-with',
      name: `starts-with "${value}"`,
      passed: output.startsWith(value),
      expected: `output to start with "${value}"`,
      actual: `starts with "${output.slice(0, value.length)}"`,
    };
  },

  'ends-with': (output, config) => {
    const value = config.value as string;
    return {
      type: 'ends-with',
      name: `ends-with "${value}"`,
      passed: output.endsWith(value),
      expected: `output to end with "${value}"`,
      actual: `ends with "${output.slice(-value.length)}"`,
    };
  },

  'matches-regex': (output, config) => {
    const pattern = config.pattern as string;
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch (e) {
      return {
        type: 'matches-regex',
        name: `matches-regex /${pattern}/`,
        passed: false,
        expected: `output to match /${pattern}/`,
        actual: `invalid regex: ${(e as Error).message}`,
        message: `Invalid regex pattern: ${(e as Error).message}`,
      };
    }
    const matched = regex.test(output);
    return {
      type: 'matches-regex',
      name: `matches-regex /${pattern}/`,
      passed: matched,
      expected: `output to match /${pattern}/`,
      actual: matched ? 'matched' : 'no match',
    };
  },

  'max-length': (output, config) => {
    const chars = config.chars as number;
    return {
      type: 'max-length',
      name: `max-length ${chars}`,
      passed: output.length <= chars,
      expected: `<= ${chars} chars`,
      actual: `${output.length} chars`,
    };
  },

  'min-length': (output, config) => {
    const chars = config.chars as number;
    return {
      type: 'min-length',
      name: `min-length ${chars}`,
      passed: output.length >= chars,
      expected: `>= ${chars} chars`,
      actual: `${output.length} chars`,
    };
  },

  'json-valid': (output) => {
    let passed = false;
    let message: string | undefined;
    try {
      JSON.parse(output);
      passed = true;
    } catch (e) {
      message = (e as Error).message;
    }
    return {
      type: 'json-valid',
      name: 'json-valid',
      passed,
      expected: 'valid JSON',
      actual: passed ? 'valid JSON' : `invalid JSON: ${message}`,
    };
  },

  'contains-all': (output, config) => {
    const values = config.values as string[];
    const missing = values.filter(v => !output.includes(v));
    return {
      type: 'contains-all',
      name: `contains-all [${values.length} items]`,
      passed: missing.length === 0,
      expected: `output to contain all of: ${values.join(', ')}`,
      actual: missing.length > 0 ? `missing: ${missing.join(', ')}` : 'all found',
    };
  },

  'no-duplicates': (output, config) => {
    const separator = (config.separator as string | undefined) ?? '\n';
    const items = output.split(separator).map(s => s.trim()).filter(Boolean);
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const item of items) {
      if (seen.has(item)) duplicates.push(item);
      seen.add(item);
    }
    return {
      type: 'no-duplicates',
      name: 'no-duplicates',
      passed: duplicates.length === 0,
      expected: 'no duplicate items',
      actual: duplicates.length > 0 ? `duplicates: ${duplicates.join(', ')}` : 'no duplicates',
    };
  },

  'max-latency': (output, config) => {
    // This is evaluated by the runner which injects __duration into config
    const ms = config.ms as number;
    const actual = (config.__duration as number) ?? 0;
    return {
      type: 'max-latency',
      name: `max-latency ${ms}ms`,
      passed: actual <= ms,
      expected: `<= ${ms}ms`,
      actual: `${actual}ms`,
    };
  },

  'no-hallucination-words': (output, config) => {
    const words = (config.words as string[] | undefined) ?? DEFAULT_HALLUCINATION_WORDS;
    const found = words.filter(w => output.includes(w));
    return {
      type: 'no-hallucination-words',
      name: 'no-hallucination-words',
      passed: found.length === 0,
      expected: 'no hallucination words',
      actual: found.length > 0 ? `found: ${found.join(', ')}` : 'none found',
    };
  },
};
