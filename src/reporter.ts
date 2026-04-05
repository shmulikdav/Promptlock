import * as path from 'path';
import chalk from 'chalk';
import { RunResult, DiffResult } from './types';
import { ensureDir, writeJsonFile } from './utils';
import * as fs from 'fs';

const DEFAULT_REPORT_DIR = '.promptlock/reports';

export function printConsoleReport(results: RunResult[]): void {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  console.log('');
  console.log(chalk.bold(`prompt-lock run — ${total} prompt${total !== 1 ? 's' : ''} evaluated`));
  console.log('');

  for (const result of results) {
    const icon = result.passed ? chalk.green('✅') : chalk.red('❌');
    const assertionCount = result.assertions.length;
    const assertionPassed = result.assertions.filter(a => a.passed).length;

    console.log(
      `${icon} ${chalk.bold(result.id)}` +
      `  ${assertionPassed}/${assertionCount} assertions passed` +
      `  ${chalk.dim(`(${result.duration}ms)`)}`,
    );

    // Show failed assertions
    const failedAssertions = result.assertions.filter(a => !a.passed);
    for (const assertion of failedAssertions) {
      console.log(
        chalk.red(`   └─ FAIL: ${assertion.name}`) +
        (assertion.expected ? chalk.dim(` (expected ${assertion.expected}, got ${assertion.actual})`) : '') +
        (assertion.message ? chalk.dim(` — ${assertion.message}`) : ''),
      );
    }

    // Show dataset results if present
    if (result.datasetResults && result.datasetResults.length > 0) {
      const dsPassed = result.datasetResults.filter(d => d.passed).length;
      const dsTotal = result.datasetResults.length;
      const dsIcon = dsPassed === dsTotal ? chalk.green('✅') : chalk.red('❌');
      console.log(
        `   ${dsIcon} dataset: ${dsPassed}/${dsTotal} inputs passed`,
      );
      for (let i = 0; i < result.datasetResults.length; i++) {
        const ds = result.datasetResults[i];
        if (!ds.passed) {
          const dsFailed = ds.assertions.filter(a => !a.passed);
          const varsStr = Object.entries(ds.vars).map(([k, v]) => `${k}="${v.slice(0, 30)}"`).join(', ');
          console.log(
            chalk.red(`      └─ input[${i}] (${varsStr}): `) +
            chalk.dim(dsFailed.map(a => a.name).join(', ')),
          );
        }
      }
    }
  }

  console.log('');
  if (failed > 0) {
    console.log(chalk.red(`Run complete. ${failed} failure${failed !== 1 ? 's' : ''}. Exit code: 1`));
  } else {
    console.log(chalk.green(`Run complete. All ${total} prompt${total !== 1 ? 's' : ''} passed.`));
  }
}

export function printDiffReport(diffs: DiffResult[]): void {
  for (const diff of diffs) {
    console.log('');
    console.log(chalk.bold(`Diff: ${diff.id}`) + chalk.dim(` (snapshot from ${diff.snapshotTimestamp})`));
    console.log('');

    for (const change of diff.changes) {
      if (change.added) {
        process.stdout.write(chalk.green(`+ ${change.value}`));
      } else if (change.removed) {
        process.stdout.write(chalk.red(`- ${change.value}`));
      } else {
        process.stdout.write(chalk.dim(`  ${change.value}`));
      }
    }
    console.log('');
  }
}

export async function generateJsonReport(
  results: RunResult[],
  outputDir: string = DEFAULT_REPORT_DIR,
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outputDir, `run-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results: results.map(r => ({
      id: r.id,
      version: r.version,
      provider: r.provider,
      model: r.model,
      passed: r.passed,
      duration: r.duration,
      assertions: r.assertions,
      outputPreview: r.output.slice(0, 500),
    })),
  };

  await writeJsonFile(filePath, report);
  return filePath;
}

export async function generateHtmlReport(
  results: RunResult[],
  outputDir: string = DEFAULT_REPORT_DIR,
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outputDir, `run-${timestamp}.html`);

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;

  const resultRows = results.map(r => {
    const statusClass = r.passed ? 'pass' : 'fail';
    const statusIcon = r.passed ? '✅' : '❌';
    const assertionRows = r.assertions.map(a => `
      <tr class="${a.passed ? 'pass' : 'fail'}">
        <td>${escapeHtml(a.type)}</td>
        <td>${escapeHtml(a.name)}</td>
        <td>${a.passed ? '✅ Pass' : '❌ Fail'}</td>
        <td>${escapeHtml(a.expected ?? '')}</td>
        <td>${escapeHtml(a.actual ?? '')}</td>
        <td>${escapeHtml(a.message ?? '')}</td>
      </tr>
    `).join('');

    return `
      <div class="prompt-result ${statusClass}">
        <h3>${statusIcon} ${escapeHtml(r.id)} <span class="meta">v${escapeHtml(r.version ?? '?')} · ${escapeHtml(r.provider)}/${escapeHtml(r.model)} · ${r.duration}ms</span></h3>
        <details>
          <summary>Prompt</summary>
          <pre class="prompt-text">${escapeHtml(r.prompt)}</pre>
        </details>
        <details>
          <summary>Output</summary>
          <pre class="output-text">${escapeHtml(r.output.length > 2000 ? r.output.slice(0, 2000) + `\n... (truncated, ${r.output.length} chars total)` : r.output)}</pre>
        </details>
        <table>
          <thead>
            <tr><th>Type</th><th>Name</th><th>Result</th><th>Expected</th><th>Actual</th><th>Message</th></tr>
          </thead>
          <tbody>${assertionRows}</tbody>
        </table>
      </div>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>prompt-lock Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2rem; background: #f8f9fa; color: #212529; }
    h1 { margin-bottom: 0.5rem; }
    .summary { margin-bottom: 2rem; padding: 1rem; background: white; border-radius: 8px; border: 1px solid #dee2e6; }
    .summary .stat { display: inline-block; margin-right: 2rem; font-size: 1.1rem; }
    .stat.fail-count { color: #dc3545; font-weight: bold; }
    .stat.pass-count { color: #28a745; font-weight: bold; }
    .prompt-result { margin-bottom: 1.5rem; padding: 1rem; background: white; border-radius: 8px; border-left: 4px solid #28a745; }
    .prompt-result.fail { border-left-color: #dc3545; }
    .prompt-result h3 { margin-bottom: 0.75rem; }
    .prompt-result .meta { font-weight: normal; color: #6c757d; font-size: 0.85rem; }
    details { margin-bottom: 0.75rem; }
    summary { cursor: pointer; font-weight: 500; padding: 0.25rem 0; }
    pre { background: #f1f3f5; padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.85rem; margin-top: 0.5rem; white-space: pre-wrap; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #dee2e6; }
    th { background: #f1f3f5; font-weight: 600; }
    tr.fail { background: #fff5f5; }
    tr.pass { background: #f0fff0; }
  </style>
</head>
<body>
  <h1>prompt-lock Report</h1>
  <p style="color: #6c757d; margin-bottom: 1.5rem;">${new Date().toISOString()}</p>
  <div class="summary">
    <span class="stat">Total: ${total}</span>
    <span class="stat pass-count">Passed: ${passed}</span>
    ${failed > 0 ? `<span class="stat fail-count">Failed: ${failed}</span>` : ''}
  </div>
  ${resultRows}
</body>
</html>`;

  await ensureDir(outputDir);
  await fs.promises.writeFile(filePath, html, 'utf-8');
  return filePath;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
