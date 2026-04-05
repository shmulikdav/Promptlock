import { AssertionResult, ProviderConfig } from '../types';
import { getProvider } from '../providers';

const JUDGE_PROMPT = `You are an evaluator. Score the following LLM output on a scale of 0.0 to 1.0 based on the given criteria.
Respond with ONLY a JSON object: {"score": <number>, "explanation": "<brief reason>"}

Criteria: {{criteria}}

Output to evaluate:
{{output}}`;

export async function assertLlmJudge(
  output: string,
  judgeConfig: { provider: ProviderConfig; model: string },
  criteria: string,
  threshold: number,
): Promise<AssertionResult> {
  try {
    const judge = getProvider(judgeConfig.provider, judgeConfig.model);
    const prompt = JUDGE_PROMPT
      .replace('{{criteria}}', criteria)
      .replace('{{output}}', output);

    const response = await judge.call(prompt);
    const { score, explanation } = parseJudgeResponse(response);

    return {
      type: 'llm-judge',
      name: `llm-judge: ${criteria.slice(0, 50)}`,
      passed: score >= threshold,
      expected: `>= ${threshold}`,
      actual: `${score.toFixed(2)} — ${explanation}`,
    };
  } catch (error) {
    return {
      type: 'llm-judge',
      name: `llm-judge: ${criteria.slice(0, 50)}`,
      passed: false,
      message: `Judge error: ${(error as Error).message}`,
    };
  }
}

function parseJudgeResponse(response: string): { score: number; explanation: string } {
  // Try JSON parse first
  try {
    const json = JSON.parse(response.trim());
    if (typeof json.score === 'number') {
      return {
        score: Math.max(0, Math.min(1, json.score)),
        explanation: json.explanation || '',
      };
    }
  } catch {
    // Fall through to regex
  }

  // Try to extract JSON from response (judge might wrap in markdown)
  const jsonMatch = response.match(/\{[^}]*"score"\s*:\s*([\d.]+)[^}]*\}/);
  if (jsonMatch) {
    try {
      const json = JSON.parse(jsonMatch[0]);
      return {
        score: Math.max(0, Math.min(1, json.score)),
        explanation: json.explanation || '',
      };
    } catch {
      // Fall through
    }
  }

  // Last resort: extract any number between 0 and 1
  const numMatch = response.match(/\b(0(?:\.\d+)?|1(?:\.0+)?)\b/);
  if (numMatch) {
    return {
      score: parseFloat(numMatch[1]),
      explanation: 'Score extracted from unstructured response',
    };
  }

  throw new Error(`Could not parse judge response: ${response.slice(0, 200)}`);
}
