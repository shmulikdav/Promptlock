import { AssertionConfig, AssertionResult } from '../types';
import { builtinAssertions } from './builtin';
import { assertJsonSchema } from './json-schema';
import { assertCustom } from './custom';
import { assertLlmJudge } from './llm-judge';

export async function runAssertions(
  output: string,
  assertions: AssertionConfig[],
): Promise<AssertionResult[]> {
  const results: AssertionResult[] = [];

  for (const assertion of assertions) {
    if (assertion.type === 'json-schema') {
      results.push(assertJsonSchema(output, assertion.schema));
      continue;
    }

    if (assertion.type === 'llm-judge') {
      results.push(await assertLlmJudge(
        output,
        assertion.judge,
        assertion.criteria,
        assertion.threshold ?? 0.7,
      ));
      continue;
    }

    if (assertion.type === 'custom') {
      results.push(await assertCustom(output, assertion.name, assertion.fn));
      continue;
    }

    const handler = builtinAssertions[assertion.type];
    if (!handler) {
      results.push({
        type: assertion.type,
        name: assertion.type,
        passed: false,
        message: `Unknown assertion type: "${assertion.type}"`,
      });
      continue;
    }

    results.push(handler(output, assertion as unknown as Record<string, unknown>));
  }

  return results;
}
