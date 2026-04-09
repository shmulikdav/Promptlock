#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { PromptLockConfig, PromptLockProjectConfig } from './types';
import { validateConfig } from './config-validation';
import { runAll, runAB, RunOptions } from './runner';
import { postPRComment } from './github';
import { OutputCache } from './cache';
import { saveSnapshot, loadSnapshot, loadSnapshotHistory, diffSnapshots } from './snapshot';
import {
  printConsoleReport,
  printDiffReport,
  generateJsonReport,
  generateHtmlReport,
  generateMarkdownReport,
  printABReport,
  generateABMarkdownReport,
  generateABHtmlReport,
} from './reporter';
import { loadConfigFile, discoverConfigFile } from './config-loader';
import { ensureDir, writeJsonFile, spinner, openInBrowser } from './utils';

const program = new Command();

program
  .name('prompt-lock')
  .description('Version control and behavioral regression testing for LLM prompts')
  .version('0.5.0');

// ── init ──────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize prompt-lock in the current project')
  .action(async () => {
    const baseDir = process.cwd();
    const promptlockDir = path.join(baseDir, '.promptlock');
    const promptsDir = path.join(baseDir, 'prompts');

    // Create directories
    await ensureDir(path.join(promptlockDir, 'snapshots'));
    await ensureDir(path.join(promptlockDir, 'reports'));
    await ensureDir(promptsDir);

    // Create config
    const configPath = path.join(promptlockDir, 'config.json');
    if (!fs.existsSync(configPath)) {
      const config: PromptLockProjectConfig = {
        promptsDir: './prompts',
        snapshotDir: './.promptlock/snapshots',
        reportDir: './.promptlock/reports',
        defaultProvider: 'anthropic',
        ci: {
          failOnRegression: true,
          reportFormat: ['json', 'html'],
        },
      };
      await writeJsonFile(configPath, config);
      console.log(chalk.green('✅ Created .promptlock/config.json'));
    }

    // Create example prompt file
    const examplePath = path.join(promptsDir, 'example.js');
    if (!fs.existsSync(examplePath)) {
      const exampleContent = `// Example prompt-lock definition
// Modify this file or create new ones in this directory
// You can export a single config or an array of configs

/** @type {import('prompt-lock').PromptLockConfig} */
module.exports = {
  id: 'example-summarizer',
  version: '1.0.0',
  provider: 'anthropic',   // 'openai', 'anthropic', or { type: 'custom', url: 'http://localhost:11434/api/generate' }
  model: 'claude-sonnet-4-20250514',

  prompt: \`You are a professional summarizer.
Summarize the following text in 2-3 bullet points.
Text: {{text}}\`,

  defaultVars: {
    text: 'The quick brown fox jumped over the lazy dog. This happened near a river on a sunny afternoon.',
  },

  // Optional: test with multiple inputs
  // dataset: [
  //   { text: 'Input one...' },
  //   { text: 'Input two...' },
  // ],

  assertions: [
    { type: 'max-length', chars: 500 },
    { type: 'not-contains', value: 'I cannot' },
    { type: 'min-length', chars: 10 },
    { type: 'max-latency', ms: 10000 },
  ],
};
`;
      await fs.promises.writeFile(examplePath, exampleContent, 'utf-8');
      console.log(chalk.green('✅ Created prompts/example.js'));
    }

    // Update .gitignore
    const gitignorePath = path.join(baseDir, '.gitignore');
    const entriesToAdd = ['.promptlock/snapshots/', '.promptlock/reports/'];
    try {
      let gitignore = '';
      if (fs.existsSync(gitignorePath)) {
        gitignore = fs.readFileSync(gitignorePath, 'utf-8');
      }
      const missing = entriesToAdd.filter(e => !gitignore.includes(e));
      if (missing.length > 0) {
        const addition = '\n# prompt-lock\n' + missing.join('\n') + '\n';
        fs.appendFileSync(gitignorePath, addition);
        console.log(chalk.green('✅ Updated .gitignore'));
      }
    } catch {
      // .gitignore update is best-effort
    }

    console.log('');
    console.log(chalk.bold('prompt-lock initialized!'));
    console.log('');
    console.log('  Created:');
    console.log(`    ${chalk.dim('.promptlock/')}        — config, snapshots, reports`);
    console.log(`    ${chalk.dim('prompts/example.js')} — example prompt definition`);
    console.log('');
    console.log('  Next steps:');
    console.log(`    1. Edit ${chalk.bold('prompts/example.js')} with your prompt and assertions`);
    console.log(`    2. Set your API key: ${chalk.bold('export ANTHROPIC_API_KEY=...')}`);
    console.log(`    3. Run: ${chalk.bold('prompt-lock run')}`);
    console.log(`    4. Save baseline: ${chalk.bold('prompt-lock snapshot')}`);
  });

// ── run ───────────────────────────────────────────────────────────────────────

program
  .command('run')
  .description('Run assertions against all registered prompts')
  .option('--id <id>', 'Run only a specific prompt by ID')
  .option('--ci', 'CI mode: exit 1 on any failure')
  .option('--report <format>', 'Generate report: json, html, or both')
  .option('--config <path>', 'Path to config file')
  .option('--dry-run', 'Validate configs and show what would be tested without calling LLMs')
  .option('--verbose', 'Show detailed output for each prompt run')
  .option('--parallel', 'Run prompts in parallel')
  .option('--concurrency <n>', 'Max concurrent runs (default: 5)', parseInt)
  .option('--cache', 'Cache LLM outputs (skip calls when prompt+model unchanged)')
  .option('--no-cache', 'Disable output caching')
  .option('--github-pr <pr>', 'Post results as a GitHub PR comment (e.g. owner/repo#123)')
  .option('--watch', 'Watch for file changes and re-run automatically')
  .option('--ab <pair>', 'Compare two prompt IDs side-by-side (e.g. "v1:v2")')
  .option('--no-open', 'Skip auto-opening HTML reports in the browser')
  .action(async (opts) => {
    const configs = await loadPromptConfigs(opts.config, opts.id);

    if (configs.length === 0) {
      console.log(chalk.yellow('No prompt configurations found.'));
      console.log(chalk.dim('Run "prompt-lock init" to get started, or create files in ./prompts/'));
      process.exitCode = 1;
      return;
    }

    // A/B testing mode
    if (opts.ab) {
      const [idA, idB] = String(opts.ab).split(':');
      if (!idA || !idB) {
        console.log(chalk.red('Invalid --ab format. Use: --ab <variant-a-id>:<variant-b-id>'));
        process.exitCode = 1;
        return;
      }

      const variantA = configs.find(c => c.id === idA);
      const variantB = configs.find(c => c.id === idB);

      if (!variantA) {
        console.log(chalk.red(`Variant A not found: "${idA}"`));
        process.exitCode = 1;
        return;
      }
      if (!variantB) {
        console.log(chalk.red(`Variant B not found: "${idB}"`));
        process.exitCode = 1;
        return;
      }

      const projectConfigAB = loadProjectConfig(opts.config);
      const cacheDirAB = projectConfigAB?.snapshotDir
        ? path.join(path.dirname(projectConfigAB.snapshotDir), 'cache')
        : '.promptlock/cache';

      const abRunOpts: RunOptions = {
        verbose: opts.verbose,
        cache: opts.cache ?? false,
        cacheDir: cacheDirAB,
        retry: { maxRetries: 3 },
      };

      const spinAB = spinner(`Running A/B: ${idA} vs ${idB}...`);
      const abResult = await runAB(variantA, variantB, abRunOpts);
      spinAB.stop(`Completed A/B comparison.`);

      printABReport(abResult);

      const abReportDir = projectConfigAB?.reportDir ?? '.promptlock/reports';
      const abFormats = parseReportFormats(opts.report, projectConfigAB);

      // Markdown report if explicitly requested
      if (abFormats.includes('markdown')) {
        const p = await generateABMarkdownReport(abResult, abReportDir);
        console.log(chalk.dim(`Report saved: ${p}`));
      }

      // HTML report: generated by default for A/B mode (it's the hero feature)
      // Skip in CI or when --no-open is set
      const shouldOpenAB = !opts.ci && opts.open !== false;
      if (shouldOpenAB || abFormats.includes('html')) {
        const p = await generateABHtmlReport(abResult, abReportDir);
        console.log(chalk.dim(`Report saved: ${p}`));
        if (shouldOpenAB) {
          const absPath = path.resolve(p);
          if (openInBrowser(absPath)) {
            console.log(chalk.dim(`Opening in browser: file://${absPath}`));
          }
        }
      }

      // Exit code for CI
      const abFailed = !abResult.variantA.passed || !abResult.variantB.passed;
      if (abFailed && (opts.ci || projectConfigAB?.ci?.failOnRegression)) {
        process.exitCode = 1;
      }
      return;
    }

    if (opts.dryRun) {
      console.log(chalk.dim(`[dry-run] Would test ${configs.length} prompt${configs.length !== 1 ? 's' : ''}:`));
      for (const c of configs) {
        const dsCount = c.dataset?.length ?? 0;
        const prov = typeof c.provider === 'string' ? c.provider : `custom:${c.provider.url}`;
        console.log(`  ${chalk.bold(c.id)} — ${prov}/${c.model} — ${c.assertions.length} assertions${dsCount > 0 ? ` — ${dsCount} dataset inputs` : ''}`);
      }
      console.log('');
      console.log(chalk.dim('No LLM calls were made. Remove --dry-run to execute.'));
      return;
    }

    const projectConfig = loadProjectConfig(opts.config);
    const cacheDir = projectConfig?.snapshotDir
      ? path.join(path.dirname(projectConfig.snapshotDir), 'cache')
      : '.promptlock/cache';

    const runOpts: RunOptions = {
      verbose: opts.verbose,
      parallel: opts.parallel,
      concurrency: opts.concurrency,
      cache: opts.cache ?? false,
      cacheDir,
      retry: { maxRetries: 3 },
    };

    const spin = spinner(`Running ${configs.length} prompt${configs.length !== 1 ? 's' : ''}...`);
    const results = await runAll(configs, runOpts);
    spin.stop(`Ran ${configs.length} prompt${configs.length !== 1 ? 's' : ''}.`);

    printConsoleReport(results);

    // Show cache stats if caching was enabled
    if (runOpts.cache) {
      const cache = new OutputCache(cacheDir);
      const stats = await cache.stats();
      if (stats.entries > 0) {
        console.log(chalk.dim(`Cache: ${stats.entries} entries (${(stats.sizeBytes / 1024).toFixed(1)}KB)`));
      }
    }

    // Generate reports
    const reportFormats = parseReportFormats(opts.report, projectConfig);
    const reportDir = projectConfig?.reportDir ?? '.promptlock/reports';

    for (const format of reportFormats) {
      if (format === 'json') {
        const p = await generateJsonReport(results, reportDir);
        console.log(chalk.dim(`Report saved: ${p}`));
      }
      if (format === 'html') {
        const p = await generateHtmlReport(results, reportDir);
        console.log(chalk.dim(`Report saved: ${p}`));
        if (!opts.ci && opts.open !== false) {
          const absPath = path.resolve(p);
          if (openInBrowser(absPath)) {
            console.log(chalk.dim(`Opening in browser: file://${absPath}`));
          }
        }
      }
      if (format === 'markdown') {
        const p = await generateMarkdownReport(results, reportDir);
        console.log(chalk.dim(`Report saved: ${p}`));
      }
    }

    // Post GitHub PR comment
    if (opts.githubPr) {
      const ghToken = process.env.GITHUB_TOKEN;
      if (!ghToken) {
        console.log(chalk.yellow('⚠️  --github-pr requires GITHUB_TOKEN environment variable'));
      } else {
        const parsed = parseGitHubPR(opts.githubPr);
        if (parsed) {
          try {
            await postPRComment({
              token: ghToken,
              owner: parsed.owner,
              repo: parsed.repo,
              prNumber: parsed.pr,
              results,
              updateExisting: true,
            });
            console.log(chalk.green(`✅ Posted results to ${opts.githubPr}`));
          } catch (e) {
            console.log(chalk.red(`❌ Failed to post PR comment: ${(e as Error).message}`));
          }
        } else {
          console.log(chalk.yellow('⚠️  Invalid --github-pr format. Use: owner/repo#123'));
        }
      }
    }

    // Exit code
    const anyFailed = results.some(r => !r.passed);
    if (anyFailed && (opts.ci || projectConfig?.ci?.failOnRegression)) {
      process.exitCode = 1;
    }

    // Watch mode
    if (opts.watch) {
      console.log('');
      console.log(chalk.dim('Watching for changes... (press Ctrl+C to stop)'));

      const promptsDir = path.join(process.cwd(), 'prompts');
      const watchTargets = [promptsDir];
      const discovered = await discoverConfigFile(process.cwd());
      if (discovered) watchTargets.push(discovered);

      let debounceTimer: ReturnType<typeof setTimeout> | null = null;

      for (const target of watchTargets) {
        try {
          fs.watch(target, { recursive: true }, () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
              console.clear();
              console.log(chalk.dim('Re-running...'));
              try {
                const reConfigs = await loadPromptConfigs(opts.config, opts.id);
                const reResults = await runAll(reConfigs, runOpts);
                printConsoleReport(reResults);
              } catch (e) {
                console.error(chalk.red(`Error: ${(e as Error).message}`));
              }
              console.log('');
              console.log(chalk.dim('Watching for changes... (press Ctrl+C to stop)'));
            }, 500);
          });
        } catch {
          // Target doesn't exist, skip
        }
      }

      // Keep process alive
      await new Promise(() => {});
    }
  });

// ── snapshot ──────────────────────────────────────────────────────────────────

program
  .command('snapshot')
  .description('Capture and save output baseline for prompts')
  .option('--id <id>', 'Snapshot only a specific prompt by ID')
  .option('--config <path>', 'Path to config file')
  .option('--verbose', 'Show detailed output')
  .action(async (opts) => {
    const configs = await loadPromptConfigs(opts.config, opts.id);

    if (configs.length === 0) {
      console.log(chalk.yellow('No prompt configurations found.'));
      process.exitCode = 1;
      return;
    }

    const projectConfig = loadProjectConfig(opts.config);
    const snapshotDir = projectConfig?.snapshotDir ?? '.promptlock/snapshots';

    const spin = spinner(`Running ${configs.length} prompt${configs.length !== 1 ? 's' : ''} for snapshot...`);
    const results = await runAll(configs, { verbose: opts.verbose });
    spin.stop('Done.');

    for (const result of results) {
      const p = await saveSnapshot(result, snapshotDir);
      const icon = result.passed ? chalk.green('✅') : chalk.yellow('⚠️');
      console.log(`${icon} Snapshot saved: ${chalk.bold(result.id)} → ${chalk.dim(p)}`);
    }

    console.log('');
    console.log(chalk.green(`${results.length} snapshot${results.length !== 1 ? 's' : ''} saved.`));
  });

// ── diff ──────────────────────────────────────────────────────────────────────

program
  .command('diff')
  .description('Compare current output against saved snapshots')
  .option('--id <id>', 'Diff only a specific prompt by ID')
  .option('--config <path>', 'Path to config file')
  .option('--verbose', 'Show detailed output')
  .action(async (opts) => {
    const configs = await loadPromptConfigs(opts.config, opts.id);

    if (configs.length === 0) {
      console.log(chalk.yellow('No prompt configurations found.'));
      process.exitCode = 1;
      return;
    }

    const projectConfig = loadProjectConfig(opts.config);
    const snapshotDir = projectConfig?.snapshotDir ?? '.promptlock/snapshots';

    const spin = spinner(`Running ${configs.length} prompt${configs.length !== 1 ? 's' : ''} for diff...`);
    const results = await runAll(configs, { verbose: opts.verbose });
    spin.stop('Done.');

    const diffs = [];

    for (const result of results) {
      const snap = await loadSnapshot(result.id, snapshotDir);
      if (!snap) {
        console.log(chalk.yellow(`⚠️  No snapshot found for "${result.id}". Run "prompt-lock snapshot" first.`));
        continue;
      }
      diffs.push(diffSnapshots(snap, result.output));
    }

    if (diffs.length > 0) {
      printDiffReport(diffs);
    } else {
      console.log(chalk.yellow('No diffs to show. Run "prompt-lock snapshot" to create baselines.'));
    }
  });

// ── history ───────────────────────────────────────────────────────────────────

program
  .command('history')
  .description('Show snapshot history for a prompt')
  .argument('<id>', 'Prompt ID')
  .option('--config <path>', 'Path to config file')
  .action(async (id, opts) => {
    const projectConfig = loadProjectConfig(opts.config);
    const snapshotDir = projectConfig?.snapshotDir ?? '.promptlock/snapshots';

    const history = await loadSnapshotHistory(id, snapshotDir);
    if (history.length === 0) {
      console.log(chalk.yellow(`No snapshot history for "${id}".`));
      return;
    }

    console.log(chalk.bold(`Snapshot history for "${id}" (${history.length} entries):`));
    console.log('');
    for (const snap of history) {
      const passCount = snap.assertionResults.filter(a => a.passed).length;
      const total = snap.assertionResults.length;
      const icon = passCount === total ? '✅' : '❌';
      console.log(
        `  ${icon} ${chalk.dim(snap.capturedAt)}  v${snap.version ?? '?'}  ${snap.model}  ${passCount}/${total} passed`,
      );
    }
  });

// ── cache ─────────────────────────────────────────────────────────────────────

program
  .command('cache')
  .description('Manage the output cache')
  .argument('<action>', '"clear" or "stats"')
  .option('--config <path>', 'Path to config file')
  .action(async (action, opts) => {
    const projectConfig = loadProjectConfig(opts.config);
    const cacheDir = projectConfig?.snapshotDir
      ? path.join(path.dirname(projectConfig.snapshotDir), 'cache')
      : '.promptlock/cache';
    const cache = new OutputCache(cacheDir);

    if (action === 'clear') {
      await cache.clear();
      console.log(chalk.green('✅ Cache cleared.'));
    } else if (action === 'stats') {
      const stats = await cache.stats();
      console.log(`Cache: ${stats.entries} entries, ${(stats.sizeBytes / 1024).toFixed(1)}KB`);
      console.log(chalk.dim(`Location: ${cacheDir}`));
    } else {
      console.log(chalk.yellow(`Unknown action "${action}". Use "clear" or "stats".`));
    }
  });

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadProjectConfig(configPath?: string): PromptLockProjectConfig | null {
  const p = configPath ?? path.join(process.cwd(), '.promptlock', 'config.json');
  try {
    const content = fs.readFileSync(p, 'utf-8');
    return JSON.parse(content) as PromptLockProjectConfig;
  } catch {
    return null;
  }
}

async function loadPromptConfigs(configPath?: string, filterId?: string): Promise<PromptLockConfig[]> {
  const configs: PromptLockConfig[] = [];

  // Try YAML/JSON config file first (auto-discovery)
  const discovered = await discoverConfigFile(process.cwd());
  if (discovered) {
    try {
      const loaded = await loadConfigFile(discovered);
      const items = Array.isArray(loaded) ? loaded : [loaded];
      configs.push(...items);
    } catch (e) {
      console.error(chalk.red(`Error loading ${discovered}: ${(e as Error).message}`));
    }
  }

  // Also scan prompts/ directory for JS/JSON/YAML files
  const projectConfig = loadProjectConfig(configPath);
  const promptsDir = projectConfig?.promptsDir
    ? path.resolve(process.cwd(), projectConfig.promptsDir)
    : path.join(process.cwd(), 'prompts');

  try {
    const files = fs.readdirSync(promptsDir);
    for (const file of files) {
      if (!['.js', '.json', '.yaml', '.yml'].some(ext => file.endsWith(ext))) continue;

      const filePath = path.join(promptsDir, file);
      try {
        const loaded = await loadConfigFile(filePath);
        const items = Array.isArray(loaded) ? loaded : [loaded];
        for (const item of items) {
          // Avoid duplicates from auto-discovery
          if (!configs.some(c => c.id === item.id)) {
            configs.push(item);
          }
        }
      } catch (e) {
        console.error(chalk.red(`Error loading ${file}: ${(e as Error).message}`));
      }
    }
  } catch {
    // prompts directory doesn't exist
  }

  if (filterId) {
    return configs.filter(c => c.id === filterId);
  }

  return configs;
}

function parseReportFormats(
  cliFormat: string | undefined,
  projectConfig: PromptLockProjectConfig | null,
): string[] {
  if (cliFormat) {
    if (cliFormat === 'both') return ['json', 'html'];
    return [cliFormat];
  }
  return projectConfig?.ci?.reportFormat ?? [];
}

function parseGitHubPR(value: string): { owner: string; repo: string; pr: number } | null {
  // Format: owner/repo#123
  const match = value.match(/^([^/]+)\/([^#]+)#(\d+)$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], pr: parseInt(match[3]) };
}

program.parse();
