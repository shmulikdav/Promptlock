import { PromptLockConfig, RunResult, DatasetRunResult, AssertionConfig, TokenUsage, ABComparisonResult } from './types';
import { getProvider } from './providers';
import { runAssertions } from './assertions';
import { renderTemplate, hashString } from './utils';
import { validateConfig } from './config-validation';
import { OutputCache } from './cache';
import { withRetry, RetryOptions } from './retry';
import { estimateCost } from './pricing';
import { loadDataset } from './dataset-loader';

export interface RunOptions {
  dryRun?: boolean;
  verbose?: boolean;
  parallel?: boolean;
  concurrency?: number;
  cache?: boolean;
  cacheDir?: string;
  retry?: Partial<RetryOptions>;
  onResult?: (result: RunResult) => void;
  onProgress?: (id: string, status: string) => void;
}

function getCache(opts?: RunOptions): OutputCache | null {
  if (!opts?.cache) return null;
  return new OutputCache(opts.cacheDir);
}

async function callWithCacheAndRetry(
  provider: import('./types').LLMProvider,
  prompt: string,
  model: string,
  opts?: RunOptions,
  providerOpts?: import('./types').PromptLockOptions,
): Promise<{ output: string; cached: boolean; usage?: TokenUsage }> {
  const cache = getCache(opts);

  // Check cache
  if (cache) {
    const cached = await cache.get(prompt, model);
    if (cached !== null) {
      if (opts?.verbose) {
        process.stderr.write(`  [cache] HIT for ${model}:${prompt.slice(0, 50)}...\n`);
      }
      return { output: cached, cached: true };
    }
  }

  // Call with retry — prefer callWithMeta if available
  let output: string;
  let usage: TokenUsage | undefined;

  if (provider.callWithMeta) {
    const result = await withRetry(
      () => provider.callWithMeta!(prompt, providerOpts),
      opts?.retry,
      opts?.verbose
        ? (attempt, error, delay) => {
            process.stderr.write(`  [retry] attempt ${attempt}: ${error.message} — retrying in ${delay}ms\n`);
          }
        : undefined,
    );
    output = result.text;
    usage = result.usage;
  } else {
    output = await withRetry(
      () => provider.call(prompt, providerOpts),
      opts?.retry,
      opts?.verbose
        ? (attempt, error, delay) => {
            process.stderr.write(`  [retry] attempt ${attempt}: ${error.message} — retrying in ${delay}ms\n`);
          }
        : undefined,
    );
  }

  // Save to cache
  if (cache) {
    await cache.set(prompt, model, output);
  }

  return { output, cached: false, usage };
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

  if (opts?.dryRun) {
    const output = '[DRY RUN — no LLM call made]';
    const assertionResults = await runAssertionsEnriched(output, config.assertions, 0, 0);
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

  // Get provider and call LLM (with cache + retry)
  opts?.onProgress?.(config.id, 'calling LLM...');
  const provider = getProvider(config.provider, config.model);
  const callStart = Date.now();
  const { output, cached, usage } = await callWithCacheAndRetry(provider, renderedPrompt, config.model, opts, config.options);
  const callDuration = Date.now() - callStart;
  const callCost = usage ? estimateCost(config.model, usage) : 0;

  if (opts?.verbose) {
    const src = cached ? 'cached' : 'live';
    process.stderr.write(`  [verbose] ${config.id}: ${src} response in ${callDuration}ms (${output.length} chars)\n`);
    if (usage) {
      process.stderr.write(`  [verbose] ${config.id}: ${usage.totalTokens} tokens, $${callCost.toFixed(6)}\n`);
    }
  }

  // Run assertions (inject latency + cost)
  const assertionResults = await runAssertionsEnriched(output, config.assertions, callDuration, callCost);
  const allPassed = assertionResults.every(r => r.passed);

  const totalDuration = Date.now() - startTime;

  // Accumulate total tokens/cost
  let totalTokens: TokenUsage | undefined = usage ? { ...usage } : undefined;
  let totalCost = callCost;

  // Resolve dataset (file path or inline)
  let dataset: Record<string, string>[] | undefined;
  if (config.dataset) {
    if (typeof config.dataset === 'string') {
      dataset = await loadDataset(config.dataset, process.cwd());
    } else {
      dataset = config.dataset;
    }
  }

  // Dataset runs
  let datasetResults: DatasetRunResult[] | undefined;
  if (dataset && dataset.length > 0) {
    opts?.onProgress?.(config.id, `running dataset (${dataset.length} inputs)...`);
    datasetResults = [];
    for (const vars of dataset) {
      const dsPrompt = renderTemplate(config.prompt, vars);
      const dsStart = Date.now();
      const dsResult = await callWithCacheAndRetry(provider, dsPrompt, config.model, opts, config.options);
      const dsDuration = Date.now() - dsStart;
      const dsCost = dsResult.usage ? estimateCost(config.model, dsResult.usage) : 0;
      const dsAssertions = await runAssertionsEnriched(dsResult.output, config.assertions, dsDuration, dsCost);

      // Accumulate tokens
      if (dsResult.usage) {
        if (!totalTokens) {
          totalTokens = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
        }
        totalTokens.inputTokens += dsResult.usage.inputTokens;
        totalTokens.outputTokens += dsResult.usage.outputTokens;
        totalTokens.totalTokens += dsResult.usage.totalTokens;
      }
      totalCost += dsCost;

      datasetResults.push({
        vars,
        output: dsResult.output,
        assertions: dsAssertions,
        passed: dsAssertions.every(r => r.passed),
        duration: dsDuration,
        tokens: dsResult.usage,
        cost: dsCost,
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
    tokens: totalTokens,
    cost: totalCost > 0 ? totalCost : undefined,
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
  const queue = [...configs.keys()];

  async function worker() {
    while (queue.length > 0) {
      const i = queue.shift()!;
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

async function runAssertionsEnriched(
  output: string,
  assertions: AssertionConfig[],
  durationMs: number,
  costDollars: number,
): Promise<import('./types').AssertionResult[]> {
  const enriched = assertions.map(a => {
    if (a.type === 'max-latency') return { ...a, __duration: durationMs };
    if (a.type === 'max-cost') return { ...a, __cost: costDollars };
    return a;
  });
  return runAssertions(output, enriched as AssertionConfig[]);
}

function providerName(config: PromptLockConfig): string {
  if (typeof config.provider === 'string') return config.provider;
  return `custom:${config.provider.url}`;
}

// ── A/B Testing ─────────────────────────────────────────────────────────────

export async function runAB(
  variantA: PromptLockConfig,
  variantB: PromptLockConfig,
  opts?: RunOptions,
): Promise<ABComparisonResult> {
  opts?.onProgress?.(variantA.id, 'running variant A...');
  const a = await runSafe(variantA, opts);
  opts?.onResult?.(a);

  opts?.onProgress?.(variantB.id, 'running variant B...');
  const b = await runSafe(variantB, opts);
  opts?.onResult?.(b);

  const passRateA = computePassRate(a);
  const passRateB = computePassRate(b);

  const costA = a.cost ?? 0;
  const costB = b.cost ?? 0;

  const tokensA = a.tokens?.totalTokens ?? 0;
  const tokensB = b.tokens?.totalTokens ?? 0;

  const deltas = {
    passRate: passRateB - passRateA,
    costDollars: costB - costA,
    latencyMs: b.duration - a.duration,
    tokens: tokensB - tokensA,
  };

  return {
    id: `${variantA.id} vs ${variantB.id}`,
    variantA: a,
    variantB: b,
    winner: pickWinner(a, b, passRateA, passRateB, costA, costB),
    deltas,
  };
}

function computePassRate(r: RunResult): number {
  // Combine main assertions + dataset assertions for an overall pass-rate (0-100)
  let total = r.assertions.length;
  let passed = r.assertions.filter(x => x.passed).length;
  if (r.datasetResults) {
    for (const d of r.datasetResults) {
      total += d.assertions.length;
      passed += d.assertions.filter(x => x.passed).length;
    }
  }
  if (total === 0) return 0;
  return (passed / total) * 100;
}

function pickWinner(
  a: RunResult,
  b: RunResult,
  passRateA: number,
  passRateB: number,
  costA: number,
  costB: number,
): 'A' | 'B' | 'tie' {
  // 1. Pass rate wins if difference > 0
  if (passRateA > passRateB) return 'A';
  if (passRateB > passRateA) return 'B';

  // 2. Cost: cheaper wins if difference > 5%
  if (costA > 0 || costB > 0) {
    const maxCost = Math.max(costA, costB);
    const delta = Math.abs(costB - costA) / maxCost;
    if (delta > 0.05) return costA < costB ? 'A' : 'B';
  }

  // 3. Latency: faster wins if difference > 10%
  const maxLatency = Math.max(a.duration, b.duration);
  if (maxLatency > 0) {
    const delta = Math.abs(b.duration - a.duration) / maxLatency;
    if (delta > 0.10) return a.duration < b.duration ? 'A' : 'B';
  }

  return 'tie';
}
