import { PromptLockConfig } from './types';

const VALID_PROVIDERS = ['openai', 'anthropic'];
const VALID_ASSERTION_TYPES = [
  'contains', 'not-contains', 'starts-with', 'ends-with',
  'matches-regex', 'max-length', 'min-length',
  'json-valid', 'json-schema', 'no-hallucination-words', 'custom',
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be an object'] };
  }

  const c = config as Record<string, unknown>;

  if (!c.id || typeof c.id !== 'string') {
    errors.push('Config "id" must be a non-empty string');
  }

  if (!c.provider || typeof c.provider !== 'string' || !VALID_PROVIDERS.includes(c.provider)) {
    errors.push(`Config "provider" must be one of: ${VALID_PROVIDERS.join(', ')}`);
  }

  if (!c.model || typeof c.model !== 'string') {
    errors.push('Config "model" must be a non-empty string');
  }

  if (!c.prompt || typeof c.prompt !== 'string') {
    errors.push('Config "prompt" must be a non-empty string');
  }

  if (!Array.isArray(c.assertions)) {
    errors.push('Config "assertions" must be an array');
  } else {
    for (let i = 0; i < c.assertions.length; i++) {
      const a = c.assertions[i] as Record<string, unknown>;
      if (!a || typeof a !== 'object') {
        errors.push(`Assertion [${i}] must be an object`);
        continue;
      }

      if (!a.type || typeof a.type !== 'string' || !VALID_ASSERTION_TYPES.includes(a.type as string)) {
        errors.push(`Assertion [${i}] has unknown type "${a.type}". Valid types: ${VALID_ASSERTION_TYPES.join(', ')}`);
        continue;
      }

      // Type-specific validation
      const type = a.type as string;

      if (['contains', 'not-contains', 'starts-with', 'ends-with'].includes(type)) {
        if (typeof a.value !== 'string') {
          errors.push(`Assertion [${i}] "${type}" requires "value" to be a string`);
        }
      }

      if (type === 'matches-regex') {
        if (typeof a.pattern !== 'string') {
          errors.push(`Assertion [${i}] "matches-regex" requires "pattern" to be a string`);
        } else {
          try {
            new RegExp(a.pattern as string);
          } catch {
            errors.push(`Assertion [${i}] "matches-regex" has invalid regex pattern: "${a.pattern}"`);
          }
        }
      }

      if (type === 'max-length' || type === 'min-length') {
        if (typeof a.chars !== 'number' || a.chars < 0) {
          errors.push(`Assertion [${i}] "${type}" requires "chars" to be a non-negative number`);
        }
      }

      if (type === 'json-schema') {
        if (!a.schema || typeof a.schema !== 'object') {
          errors.push(`Assertion [${i}] "json-schema" requires "schema" to be an object`);
        }
      }

      if (type === 'custom') {
        if (typeof a.fn !== 'function') {
          errors.push(`Assertion [${i}] "custom" requires "fn" to be a function`);
        }
        if (!a.name || typeof a.name !== 'string') {
          errors.push(`Assertion [${i}] "custom" requires "name" to be a non-empty string`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
