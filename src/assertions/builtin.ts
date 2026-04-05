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
    const regex = new RegExp(pattern);
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
