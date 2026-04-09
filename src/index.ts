import { PromptLockConfig, RunResult, DiffResult, SnapshotData } from './types';
import { runPrompt, runAll, RunOptions } from './runner';
import { RetryOptions } from './retry';
import { saveSnapshot, loadSnapshot, loadSnapshotHistory, diffSnapshots } from './snapshot';
import { printConsoleReport, generateJsonReport, generateHtmlReport, generateMarkdownReport } from './reporter';

export interface PromptLockInstanceOptions {
  snapshotDir?: string;
  reportDir?: string;
  verbose?: boolean;
  parallel?: boolean;
  concurrency?: number;
  cache?: boolean;
  cacheDir?: string;
  retry?: Partial<RetryOptions>;
}

export class PromptLock {
  private configs: PromptLockConfig[];
  private snapshotDir: string;
  private reportDir: string;
  private runOpts: RunOptions;

  constructor(config: PromptLockConfig | PromptLockConfig[], options?: PromptLockInstanceOptions) {
    this.configs = Array.isArray(config) ? config : [config];
    this.snapshotDir = options?.snapshotDir ?? '.promptlock/snapshots';
    this.reportDir = options?.reportDir ?? '.promptlock/reports';
    this.runOpts = {
      verbose: options?.verbose,
      parallel: options?.parallel,
      concurrency: options?.concurrency,
      cache: options?.cache,
      cacheDir: options?.cacheDir,
      retry: options?.retry,
    };
  }

  async run(opts?: RunOptions): Promise<RunResult[]> {
    return runAll(this.configs, { ...this.runOpts, ...opts });
  }

  async snapshot(snapshotDir?: string, opts?: RunOptions): Promise<string[]> {
    const dir = snapshotDir ?? this.snapshotDir;
    const results = await this.run(opts);
    const paths: string[] = [];
    for (const result of results) {
      const p = await saveSnapshot(result, dir);
      paths.push(p);
    }
    return paths;
  }

  async diff(snapshotDir?: string, opts?: RunOptions): Promise<DiffResult[]> {
    const dir = snapshotDir ?? this.snapshotDir;
    const results = await this.run(opts);
    const diffs: DiffResult[] = [];

    for (const result of results) {
      const snap = await loadSnapshot(result.id, dir);
      if (snap) {
        diffs.push(diffSnapshots(snap, result.output));
      }
    }

    return diffs;
  }

  async history(id: string, snapshotDir?: string): Promise<SnapshotData[]> {
    const dir = snapshotDir ?? this.snapshotDir;
    return loadSnapshotHistory(id, dir);
  }

  async report(format: 'json' | 'html' | 'markdown' | 'console' = 'console', reportDir?: string): Promise<void> {
    const dir = reportDir ?? this.reportDir;
    const results = await this.run();

    switch (format) {
      case 'console':
        printConsoleReport(results);
        break;
      case 'json': {
        const p = await generateJsonReport(results, dir);
        console.log(`Report saved: ${p}`);
        break;
      }
      case 'html': {
        const p = await generateHtmlReport(results, dir);
        console.log(`Report saved: ${p}`);
        break;
      }
      case 'markdown': {
        const p = await generateMarkdownReport(results, dir);
        console.log(`Report saved: ${p}`);
        break;
      }
    }
  }
}

// Re-export everything
export { runPrompt, runAll, runAB } from './runner';
export type { RunOptions } from './runner';
export { saveSnapshot, loadSnapshot, loadSnapshotHistory, listSnapshots, diffSnapshots } from './snapshot';
export { runAssertions } from './assertions';
export { getProvider } from './providers';
export { createCustomProvider } from './providers/custom';
export {
  printConsoleReport,
  printDiffReport,
  generateJsonReport,
  generateHtmlReport,
  generateMarkdownReport,
  printABReport,
  generateABMarkdownReport,
  generateABHtmlReport,
} from './reporter';
export { estimateCost, getPricingTable } from './pricing';
export { loadDataset } from './dataset-loader';
export { loadConfigFile, discoverConfigFile } from './config-loader';
export { validateConfig } from './config-validation';
export { OutputCache } from './cache';
export { withRetry } from './retry';
export type { RetryOptions } from './retry';
export { postPRComment } from './github';
export type { GitHubCommentOptions } from './github';
export * from './types';
