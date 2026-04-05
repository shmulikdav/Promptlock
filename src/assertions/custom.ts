import { AssertionResult } from '../types';

export async function assertCustom(
  output: string,
  name: string,
  fn: (output: string) => boolean | Promise<boolean>,
): Promise<AssertionResult> {
  try {
    const result = await fn(output);
    return {
      type: 'custom',
      name: `custom: ${name}`,
      passed: !!result,
      expected: `custom assertion "${name}" to pass`,
      actual: result ? 'passed' : 'failed',
    };
  } catch (e) {
    return {
      type: 'custom',
      name: `custom: ${name}`,
      passed: false,
      expected: `custom assertion "${name}" to pass`,
      actual: `threw error: ${(e as Error).message}`,
      message: (e as Error).message,
    };
  }
}
