import Ajv from 'ajv';
import { AssertionResult } from '../types';

export function assertJsonSchema(output: string, schema: Record<string, unknown>): AssertionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch (e) {
    return {
      type: 'json-schema',
      name: 'json-schema',
      passed: false,
      expected: 'valid JSON matching schema',
      actual: `invalid JSON: ${(e as Error).message}`,
    };
  }

  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);
  const valid = validate(parsed);

  return {
    type: 'json-schema',
    name: 'json-schema',
    passed: !!valid,
    expected: 'JSON matching provided schema',
    actual: valid
      ? 'matches schema'
      : `schema errors: ${(validate.errors ?? []).map(e => `${e.instancePath} ${e.message}`).join('; ')}`,
  };
}
