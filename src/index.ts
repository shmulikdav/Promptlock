import { PromptLockConfig, RunResult, DiffResult } from './types';
import { runPrompt, runAll } from './runner';
import { saveSnapshot, loadSnapshot, diffSnapshots } from './snapshot';
import { printConsoleReport, generateJsonReport, generateHtmlReport } from './reporter';

export interface PromptLockOptions {
  snapshotDir?: string;
  reportDir?: string;
}

export class PromptLock {
  private configs: PromptLockConfig[];
  private snapshotDir: string;
  private reportDir: string;

  constructor(config: PromptLockConfig | PromptLockConfig[], options?: PromptLockOptions) {
    this.configs = Array.isArray(config) ? config : [config];
    this.snapshotDir = options?.snapshotDir ?? '.promptlock/snapshots';
    this.reportDir = options?.reportDir ?? '.promptlock/reports';
  }

  async run(): Promise<RunResult[]> {
    return runAll(this.configs);
  }

  async snapshot(snapshotDir?: string): Promise<string[]> {
    const dir = snapshotDir ?? this.snapshotDir;
    const results = await this.run();
    const paths: string[] = [];
    for (const result of results) {
      const p = await saveSnapshot(result, dir);
      paths.push(p);
    }
    return paths;
  }

  async diff(snapshotDir?: string): Promise<DiffResult[]> {
    const dir = snapshotDir ?? this.snapshotDir;
    const results = await this.run();
    const diffs: DiffResult[] = [];

    for (const result of results) {
      const snap = await loadSnapshot(result.id, dir);
      if (snap) {
        diffs.push(diffSnapshots(snap, result.output));
      }
    }

    return diffs;
  }

  async report(format: 'json' | 'html' | 'console' = 'console', reportDir?: string): Promise<void> {
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
    }
  }
}

// Re-export everything
export { runPrompt, runAll } from './runner';
export { saveSnapshot, loadSnapshot, listSnapshots, diffSnapshots } from './snapshot';
export { runAssertions } from './assertions';
export { getProvider } from './providers';
export {
  printConsoleReport,
  printDiffReport,
  generateJsonReport,
  generateHtmlReport,
} from './reporter';
export { validateConfig } from './config-validation';
export * from './types';
