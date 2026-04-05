import { PromptLockConfig, RunResult } from './types';
import { getProvider } from './providers';
import { runAssertions } from './assertions';
import { renderTemplate, hashString } from './utils';
import { validateConfig } from './config-validation';

export async function runPrompt(config: PromptLockConfig): Promise<RunResult> {
  const startTime = Date.now();

  // Validate config before running
  const validation = validateConfig(config);
  if (!validation.valid) {
    return {
      id: config.id ?? 'unknown',
      version: config.version,
      provider: config.provider ?? 'unknown',
      model: config.model ?? 'unknown',
      prompt: config.prompt ?? '',
      promptHash: '',
      output: '',
      assertions: [{
        type: 'error',
        name: 'config-validation',
        passed: false,
        message: `Invalid config: ${validation.errors.join('; ')}`,
      }],
      passed: false,
      duration: 0,
      timestamp: new Date().toISOString(),
    };
  }

  // Render template with variables
  const renderedPrompt = config.defaultVars
    ? renderTemplate(config.prompt, config.defaultVars)
    : config.prompt;

  // Get provider and call LLM
  const provider = getProvider(config.provider, config.model);
  const output = await provider.call(renderedPrompt, config.options);

  // Run assertions
  const assertionResults = await runAssertions(output, config.assertions);
  const allPassed = assertionResults.every(r => r.passed);

  const duration = Date.now() - startTime;

  return {
    id: config.id,
    version: config.version,
    provider: config.provider,
    model: config.model,
    prompt: renderedPrompt,
    promptHash: `sha256:${hashString(renderedPrompt)}`,
    output,
    defaultVars: config.defaultVars,
    assertions: assertionResults,
    passed: allPassed,
    duration,
    timestamp: new Date().toISOString(),
  };
}

export async function runAll(
  configs: PromptLockConfig[],
  onResult?: (result: RunResult) => void,
): Promise<RunResult[]> {
  const results: RunResult[] = [];

  for (const config of configs) {
    try {
      const result = await runPrompt(config);
      results.push(result);
      onResult?.(result);
    } catch (error) {
      const errorResult: RunResult = {
        id: config.id,
        version: config.version,
        provider: config.provider,
        model: config.model,
        prompt: config.prompt,
        promptHash: `sha256:${hashString(config.prompt)}`,
        output: '',
        assertions: [{
          type: 'error',
          name: 'execution-error',
          passed: false,
          message: `Error running prompt: ${(error as Error).message}`,
        }],
        passed: false,
        duration: 0,
        timestamp: new Date().toISOString(),
      };
      results.push(errorResult);
      onResult?.(errorResult);
    }
  }

  return results;
}
