#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { PromptLockConfig, PromptLockProjectConfig } from './types';
import { runAll } from './runner';
import { saveSnapshot, loadSnapshot, diffSnapshots } from './snapshot';
import {
  printConsoleReport,
  printDiffReport,
  generateJsonReport,
  generateHtmlReport,
} from './reporter';
import { ensureDir, writeJsonFile } from './utils';

const program = new Command();

program
  .name('prompt-lock')
  .description('Version control and behavioral regression testing for LLM prompts')
  .version('0.1.0');

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

/** @type {import('prompt-lock').PromptLockConfig} */
module.exports = {
  id: 'example-summarizer',
  version: '1.0.0',
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',

  prompt: \`You are a professional summarizer.
Summarize the following text in 2-3 bullet points.
Text: {{text}}\`,

  defaultVars: {
    text: 'The quick brown fox jumped over the lazy dog. This happened near a river on a sunny afternoon.',
  },

  assertions: [
    { type: 'max-length', chars: 500 },
    { type: 'not-contains', value: 'I cannot' },
    { type: 'min-length', chars: 10 },
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
    console.log(chalk.dim('Edit prompts/ files, then run: prompt-lock run'));
  });

// ── run ───────────────────────────────────────────────────────────────────────

program
  .command('run')
  .description('Run assertions against all registered prompts')
  .option('--id <id>', 'Run only a specific prompt by ID')
  .option('--ci', 'CI mode: exit 1 on any failure')
  .option('--report <format>', 'Generate report: json, html, or both', '')
  .option('--config <path>', 'Path to config file')
  .action(async (opts) => {
    const configs = await loadPromptConfigs(opts.config, opts.id);

    if (configs.length === 0) {
      console.log(chalk.yellow('No prompt configurations found.'));
      console.log(chalk.dim('Run "prompt-lock init" to get started, or create files in ./prompts/'));
      process.exitCode = 1;
      return;
    }

    console.log(chalk.dim(`Running ${configs.length} prompt${configs.length !== 1 ? 's' : ''}...`));
    console.log('');

    const results = await runAll(configs);
    printConsoleReport(results);

    const projectConfig = loadProjectConfig(opts.config);

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
      }
    }

    // Exit code
    const anyFailed = results.some(r => !r.passed);
    if (anyFailed && (opts.ci || projectConfig?.ci?.failOnRegression)) {
      process.exitCode = 1;
    }
  });

// ── snapshot ──────────────────────────────────────────────────────────────────

program
  .command('snapshot')
  .description('Capture and save output baseline for prompts')
  .option('--id <id>', 'Snapshot only a specific prompt by ID')
  .option('--config <path>', 'Path to config file')
  .action(async (opts) => {
    const configs = await loadPromptConfigs(opts.config, opts.id);

    if (configs.length === 0) {
      console.log(chalk.yellow('No prompt configurations found.'));
      process.exitCode = 1;
      return;
    }

    const projectConfig = loadProjectConfig(opts.config);
    const snapshotDir = projectConfig?.snapshotDir ?? '.promptlock/snapshots';

    console.log(chalk.dim(`Running ${configs.length} prompt${configs.length !== 1 ? 's' : ''} for snapshot...`));

    const results = await runAll(configs);

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
  .action(async (opts) => {
    const configs = await loadPromptConfigs(opts.config, opts.id);

    if (configs.length === 0) {
      console.log(chalk.yellow('No prompt configurations found.'));
      process.exitCode = 1;
      return;
    }

    const projectConfig = loadProjectConfig(opts.config);
    const snapshotDir = projectConfig?.snapshotDir ?? '.promptlock/snapshots';

    console.log(chalk.dim(`Running ${configs.length} prompt${configs.length !== 1 ? 's' : ''} for diff...`));

    const results = await runAll(configs);
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
  const projectConfig = loadProjectConfig(configPath);
  const promptsDir = projectConfig?.promptsDir
    ? path.resolve(process.cwd(), projectConfig.promptsDir)
    : path.join(process.cwd(), 'prompts');

  const configs: PromptLockConfig[] = [];

  try {
    const files = fs.readdirSync(promptsDir);
    for (const file of files) {
      if (!file.endsWith('.js') && !file.endsWith('.json')) continue;

      const filePath = path.join(promptsDir, file);
      try {
        const mod = require(filePath);
        const config = mod.default ?? mod;

        if (Array.isArray(config)) {
          configs.push(...config);
        } else if (config && config.id) {
          configs.push(config);
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
  cliFormat: string,
  projectConfig: PromptLockProjectConfig | null,
): string[] {
  if (cliFormat) {
    if (cliFormat === 'both') return ['json', 'html'];
    return [cliFormat];
  }
  return projectConfig?.ci?.reportFormat ?? [];
}

program.parse();
