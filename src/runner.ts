import { PromptLockConfig, RunResult, DatasetRunResult, AssertionConfig } from './types';
import { getProvider } from './providers';
import { runAssertions } from './assertions';
import { renderTemplate, hashString } from './utils';
import { validateConfig } from './config-validation';

export interface RunOptions {
  dryRun?: boolean;
  verbose?: boolean;
  parallel?: boolean;
  concurrency?: number;
  onResult?: (result: RunResult) => void;
  onProgress?: (id: string, status: string) => void;
}

export async function runPrompt(config: PromptLockConfig, opts?: RunOptions): Promise<RunResult> {
  const startTime = Date.now();

  // Validate config before running
  const validation = validateConfig(config);
  if (!validation.valid) {
    return {
      id: config.id ?? 'unknown',
      version: config.version,
      provider: providerName(config),
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

  let output: string;
  const duration = Date.now() - startTime;

  if (opts?.dryRun) {
    // Dry run: skip LLM call, run assertions against empty string
    output = '[DRY RUN — no LLM call made]';
    const assertionResults = await runAssertionsWithLatency(output, config.assertions, 0);
    return {
      id: config.id,
      version: config.version,
      provider: providerName(config),
      model: config.model,
      prompt: renderedPrompt,
      promptHash: `sha256:${hashString(renderedPrompt)}`,
      output,
      defaultVars: config.defaultVars,
      assertions: assertionResults,
      passed: assertionResults.every(r => r.passed),
      duration: 0,
      timestamp: new Date().toISOString(),
    };
  }

  // Get provider and call LLM
  opts?.onProgress?.(config.id, 'calling LLM...');
  const provider = getProvider(config.provider, config.model);
  const callStart = Date.now();
  output = await provider.call(renderedPrompt, config.options);
  const callDuration = Date.now() - callStart;

  if (opts?.verbose) {
    process.stderr.write(`  [verbose] ${config.id}: LLM responded in ${callDuration}ms (${output.length} chars)\n`);
  }

  // Run assertions (inject latency for max-latency)
  const assertionResults = await runAssertionsWithLatency(output, config.assertions, callDuration);
  const allPassed = assertionResults.every(r => r.passed);

  const totalDuration = Date.now() - startTime;

  // Dataset runs
  let datasetResults: DatasetRunResult[] | undefined;
  if (config.dataset && config.dataset.length > 0) {
    opts?.onProgress?.(config.id, `running dataset (${config.dataset.length} inputs)...`);
    datasetResults = [];
    for (const vars of config.dataset) {
      const dsPrompt = renderTemplate(config.prompt, vars);
      const dsStart = Date.now();
      const dsOutput = await provider.call(dsPrompt, config.options);
      const dsDuration = Date.now() - dsStart;
      const dsAssertions = await runAssertionsWithLatency(dsOutput, config.assertions, dsDuration);
      datasetResults.push({
        vars,
        output: dsOutput,
        assertions: dsAssertions,
        passed: dsAssertions.every(r => r.passed),
        duration: dsDuration,
      });
    }
  }

  const datasetAllPassed = datasetResults
    ? datasetResults.every(d => d.passed)
    : true;

  return {
    id: config.id,
    version: config.version,
    provider: providerName(config),
    model: config.model,
    prompt: renderedPrompt,
    promptHash: `sha256:${hashString(renderedPrompt)}`,
    output,
    defaultVars: config.defaultVars,
    assertions: assertionResults,
    passed: allPassed && datasetAllPassed,
    duration: totalDuration,
    timestamp: new Date().toISOString(),
    datasetResults,
  };
}

export async function runAll(
  configs: PromptLockConfig[],
  opts?: RunOptions,
): Promise<RunResult[]> {
  const parallel = opts?.parallel ?? configs[0]?.options?.parallel ?? false;
  const concurrency = opts?.concurrency ?? configs[0]?.options?.concurrency ?? 5;

  if (parallel && configs.length > 1) {
    return runParallel(configs, concurrency, opts);
  }

  const results: RunResult[] = [];
  for (const config of configs) {
    const result = await runSafe(config, opts);
    results.push(result);
    opts?.onResult?.(result);
  }
  return results;
}

async function runParallel(
  configs: PromptLockConfig[],
  concurrency: number,
  opts?: RunOptions,
): Promise<RunResult[]> {
  const results: RunResult[] = new Array(configs.length);
  let index = 0;

  async function worker() {
    while (index < configs.length) {
      const i = index++;
      results[i] = await runSafe(configs[i], opts);
      opts?.onResult?.(results[i]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, configs.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function runSafe(config: PromptLockConfig, opts?: RunOptions): Promise<RunResult> {
  try {
    return await runPrompt(config, opts);
  } catch (error) {
    return {
      id: config.id,
      version: config.version,
      provider: providerName(config),
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
  }
}

async function runAssertionsWithLatency(
  output: string,
  assertions: AssertionConfig[],
  durationMs: number,
): Promise<import('./types').AssertionResult[]> {
  // Inject __duration into max-latency assertion configs
  const enriched = assertions.map(a =>
    a.type === 'max-latency'
      ? { ...a, __duration: durationMs }
      : a,
  );
  return runAssertions(output, enriched as AssertionConfig[]);
}

function providerName(config: PromptLockConfig): string {
  if (typeof config.provider === 'string') return config.provider;
  return `custom:${config.provider.url}`;
}
