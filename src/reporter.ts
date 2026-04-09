import * as path from 'path';
import chalk from 'chalk';
import { RunResult, DiffResult, ABComparisonResult } from './types';
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

  // Cost summary
  const totalCost = results.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  const totalTokens = results.reduce((sum, r) => sum + (r.tokens?.totalTokens ?? 0), 0);
  if (totalCost > 0 || totalTokens > 0) {
    console.log(chalk.dim(`  Cost: $${totalCost.toFixed(6)} · ${totalTokens} tokens`));
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
      tokens: r.tokens,
      cost: r.cost,
      outputPreview: r.output.slice(0, 500),
      datasetResults: r.datasetResults?.map(d => ({
        vars: d.vars,
        passed: d.passed,
        duration: d.duration,
        assertions: d.assertions,
        outputPreview: d.output.slice(0, 200),
      })),
    })),
  };

  await writeJsonFile(filePath, report);
  return filePath;
}

// ── Shared dark theme CSS for all HTML reports ──────────────────────────────

const DARK_THEME_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --bg: #0d1117;
    --card: #161b22;
    --card-2: #1c2128;
    --border: #30363d;
    --text: #e6edf3;
    --text-dim: #8b949e;
    --accent: #58a6ff;
    --pass: #3fb950;
    --fail: #f85149;
    --warn: #d29922;
    --highlight: #238636;
  }
  html { scroll-behavior: smooth; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.5;
    padding: 2rem 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  .mono { font-family: "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Courier New", monospace; }
  header { margin-bottom: 2rem; }
  header h1 {
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 0.25rem;
  }
  header .subtitle { color: var(--text-dim); font-size: 0.9rem; }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1rem;
    margin: 2rem 0;
  }
  .metric-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.25rem;
  }
  .metric-card .label {
    color: var(--text-dim);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }
  .metric-card .value {
    font-size: 1.75rem;
    font-weight: 700;
    font-family: "SF Mono", Monaco, monospace;
  }
  .metric-card.pass .value { color: var(--pass); }
  .metric-card.fail .value { color: var(--fail); }
  .metric-card.accent .value { color: var(--accent); }
  .prompt-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-left: 4px solid var(--pass);
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1rem;
  }
  .prompt-card.failed { border-left-color: var(--fail); }
  .prompt-card .title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .prompt-card h2 {
    font-size: 1.15rem;
    font-weight: 600;
  }
  .prompt-card .meta {
    color: var(--text-dim);
    font-size: 0.85rem;
    font-family: "SF Mono", Monaco, monospace;
  }
  .chip {
    display: inline-block;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    margin-right: 0.35rem;
    margin-bottom: 0.25rem;
  }
  .chip.pass { background: rgba(63, 185, 80, 0.15); color: var(--pass); border: 1px solid rgba(63, 185, 80, 0.4); }
  .chip.fail { background: rgba(248, 81, 73, 0.15); color: var(--fail); border: 1px solid rgba(248, 81, 73, 0.4); }
  .assertions { margin-top: 0.75rem; }
  details {
    margin-top: 1rem;
    border-top: 1px solid var(--border);
    padding-top: 0.75rem;
  }
  summary {
    cursor: pointer;
    color: var(--text-dim);
    font-size: 0.85rem;
    padding: 0.25rem 0;
    user-select: none;
  }
  summary:hover { color: var(--text); }
  pre {
    background: var(--card-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.9rem;
    margin-top: 0.5rem;
    overflow-x: auto;
    font-size: 0.82rem;
    font-family: "SF Mono", Monaco, monospace;
    white-space: pre-wrap;
    word-break: break-word;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0.75rem;
    font-size: 0.85rem;
  }
  th, td {
    padding: 0.6rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }
  th {
    background: var(--card-2);
    font-weight: 600;
    color: var(--text-dim);
    text-transform: uppercase;
    font-size: 0.7rem;
    letter-spacing: 0.05em;
  }
  tr.fail td { background: rgba(248, 81, 73, 0.06); }
  code {
    font-family: "SF Mono", Monaco, monospace;
    background: var(--card-2);
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    font-size: 0.85em;
  }
  footer {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border);
    color: var(--text-dim);
    font-size: 0.8rem;
    text-align: center;
  }
  footer a { color: var(--accent); text-decoration: none; }
  footer a:hover { text-decoration: underline; }

  /* ── A/B specific styles ── */
  .winner-banner {
    background: linear-gradient(135deg, rgba(35, 134, 54, 0.2), rgba(88, 166, 255, 0.1));
    border: 1px solid var(--highlight);
    border-radius: 12px;
    padding: 1.5rem 2rem;
    margin: 1.5rem 0 2rem;
    text-align: center;
  }
  .winner-banner .trophy { font-size: 2rem; margin-bottom: 0.5rem; }
  .winner-banner h2 {
    font-size: 1.5rem;
    color: var(--pass);
    margin-bottom: 0.25rem;
  }
  .winner-banner .subtext { color: var(--text-dim); font-size: 0.9rem; }
  .ab-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  @media (max-width: 720px) {
    .ab-grid { grid-template-columns: 1fr; }
  }
  .variant-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.5rem;
  }
  .variant-card.winner {
    border-color: var(--highlight);
    box-shadow: 0 0 0 2px rgba(35, 134, 54, 0.3);
  }
  .variant-card .variant-label {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--text-dim);
    text-transform: uppercase;
    margin-bottom: 0.25rem;
  }
  .variant-card.winner .variant-label { color: var(--pass); }
  .variant-card h3 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 1rem;
    word-break: break-word;
  }
  .variant-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .variant-metrics .m {
    background: var(--card-2);
    border-radius: 6px;
    padding: 0.75rem;
  }
  .variant-metrics .m .label {
    color: var(--text-dim);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.25rem;
  }
  .variant-metrics .m .value {
    font-family: "SF Mono", Monaco, monospace;
    font-size: 1.1rem;
    font-weight: 600;
  }
  .delta-bar {
    margin: 0.5rem 0 1rem;
  }
  .delta-bar .label {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--text-dim);
    margin-bottom: 0.35rem;
  }
  .delta-bar .track {
    background: var(--card-2);
    height: 10px;
    border-radius: 5px;
    position: relative;
    overflow: hidden;
  }
  .delta-bar .fill {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: 5px;
  }
  .delta-bar .fill.a { background: var(--accent); opacity: 0.6; }
  .delta-bar .fill.b { background: var(--pass); opacity: 0.8; }
`;

function renderHtmlShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>${DARK_THEME_CSS}</style>
</head>
<body>
${body}
<footer>
  Generated by <a href="https://www.npmjs.com/package/prompt-lock" target="_blank">prompt-lock</a> · ${new Date().toISOString()}
</footer>
</body>
</html>`;
}

function renderAssertionChips(assertions: { type: string; name: string; passed: boolean }[]): string {
  return assertions.map(a => `<span class="chip ${a.passed ? 'pass' : 'fail'}">${a.passed ? '✓' : '✗'} ${escapeHtml(a.name)}</span>`).join('');
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
  const totalCost = results.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  const totalTokens = results.reduce((sum, r) => sum + (r.tokens?.totalTokens ?? 0), 0);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  const summaryCards = `
    <div class="summary-grid">
      <div class="metric-card accent">
        <div class="label">Total prompts</div>
        <div class="value">${total}</div>
      </div>
      <div class="metric-card pass">
        <div class="label">Passed</div>
        <div class="value">${passed}</div>
      </div>
      <div class="metric-card ${failed > 0 ? 'fail' : ''}">
        <div class="label">Failed</div>
        <div class="value">${failed}</div>
      </div>
      <div class="metric-card">
        <div class="label">Duration</div>
        <div class="value mono">${totalDuration}ms</div>
      </div>
      ${totalCost > 0 ? `
      <div class="metric-card">
        <div class="label">Cost</div>
        <div class="value mono">$${totalCost.toFixed(6)}</div>
      </div>
      <div class="metric-card">
        <div class="label">Tokens</div>
        <div class="value mono">${totalTokens.toLocaleString()}</div>
      </div>` : ''}
    </div>
  `;

  const promptCards = results.map(r => {
    const statusClass = r.passed ? '' : 'failed';
    const assertionTable = r.assertions.length > 0 ? `
      <details open>
        <summary>Assertion details (${r.assertions.filter(a => a.passed).length}/${r.assertions.length})</summary>
        <table>
          <thead><tr><th>Type</th><th>Name</th><th>Result</th><th>Expected</th><th>Actual</th></tr></thead>
          <tbody>
            ${r.assertions.map(a => `
              <tr class="${a.passed ? '' : 'fail'}">
                <td>${escapeHtml(a.type)}</td>
                <td>${escapeHtml(a.name)}</td>
                <td>${a.passed ? '<span class="chip pass">Pass</span>' : '<span class="chip fail">Fail</span>'}</td>
                <td>${escapeHtml(a.expected ?? '—')}</td>
                <td>${escapeHtml(a.actual ?? '—')}${a.message ? ' · ' + escapeHtml(a.message) : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </details>` : '';

    const datasetSection = r.datasetResults && r.datasetResults.length > 0 ? `
      <details>
        <summary>Dataset (${r.datasetResults.filter(d => d.passed).length}/${r.datasetResults.length} inputs passed)</summary>
        <table>
          <thead><tr><th>#</th><th>Variables</th><th>Result</th><th>Duration</th><th>Failures</th></tr></thead>
          <tbody>
            ${r.datasetResults.map((d, i) => `
              <tr class="${d.passed ? '' : 'fail'}">
                <td>${i + 1}</td>
                <td><code>${escapeHtml(JSON.stringify(d.vars).slice(0, 80))}</code></td>
                <td>${d.passed ? '<span class="chip pass">Pass</span>' : '<span class="chip fail">Fail</span>'}</td>
                <td>${d.duration}ms</td>
                <td>${d.passed ? '—' : escapeHtml(d.assertions.filter(a => !a.passed).map(a => a.name).join(', '))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </details>` : '';

    return `
      <div class="prompt-card ${statusClass}">
        <div class="title-row">
          <h2>${r.passed ? '✓' : '✗'} ${escapeHtml(r.id)}</h2>
          <div class="meta">${escapeHtml(r.provider)}/${escapeHtml(r.model)} · ${r.duration}ms${r.cost ? ` · $${r.cost.toFixed(6)}` : ''}${r.tokens ? ` · ${r.tokens.totalTokens} tokens` : ''}</div>
        </div>
        <div class="assertions">
          ${renderAssertionChips(r.assertions)}
        </div>
        ${assertionTable}
        ${datasetSection}
        <details>
          <summary>Prompt</summary>
          <pre>${escapeHtml(r.prompt)}</pre>
        </details>
        <details>
          <summary>Output</summary>
          <pre>${escapeHtml(r.output.length > 2000 ? r.output.slice(0, 2000) + `\n... (truncated, ${r.output.length} chars total)` : r.output)}</pre>
        </details>
      </div>
    `;
  }).join('');

  const body = `
    <header>
      <h1>prompt-lock report</h1>
      <div class="subtitle">${new Date().toLocaleString()}</div>
    </header>
    ${summaryCards}
    ${promptCards}
  `;

  await ensureDir(outputDir);
  await fs.promises.writeFile(filePath, renderHtmlShell('prompt-lock report', body), 'utf-8');
  return filePath;
}

export async function generateMarkdownReport(
  results: RunResult[],
  outputDir: string = DEFAULT_REPORT_DIR,
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outputDir, `run-${timestamp}.md`);

  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  const totalCost = results.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  const totalTokens = results.reduce((sum, r) => sum + (r.tokens?.totalTokens ?? 0), 0);

  let md = `# prompt-lock Report\n\n`;
  md += `**${total}** prompts evaluated · **${passed}** passed · **${failed}** failed`;
  if (totalCost > 0) {
    md += ` · $${totalCost.toFixed(6)} · ${totalTokens} tokens`;
  }
  md += `\n\n`;

  // Summary table
  md += `| Prompt | Model | Status | Assertions | Duration |\n`;
  md += `|--------|-------|--------|------------|----------|\n`;
  for (const r of results) {
    const status = r.passed ? 'Pass' : 'FAIL';
    const assertPassed = r.assertions.filter(a => a.passed).length;
    md += `| ${r.id} | ${r.model} | ${status} | ${assertPassed}/${r.assertions.length} | ${r.duration}ms |\n`;
  }
  md += `\n`;

  // Per-prompt details
  for (const r of results) {
    const failedAssertions = r.assertions.filter(a => !a.passed);
    if (failedAssertions.length > 0) {
      md += `### ${r.id} — Failures\n\n`;
      for (const a of failedAssertions) {
        md += `- **${a.name}**`;
        if (a.expected) md += `: expected ${a.expected}, got ${a.actual}`;
        if (a.message) md += ` — ${a.message}`;
        md += `\n`;
      }
      md += `\n`;
    }

    if (r.datasetResults && r.datasetResults.length > 0) {
      const dsPassed = r.datasetResults.filter(d => d.passed).length;
      md += `### ${r.id} — Dataset (${dsPassed}/${r.datasetResults.length})\n\n`;
      md += `| # | Variables | Status | Duration |\n`;
      md += `|---|-----------|--------|----------|\n`;
      for (let i = 0; i < r.datasetResults.length; i++) {
        const d = r.datasetResults[i];
        const varsStr = Object.entries(d.vars).map(([k, v]) => `${k}="${v.slice(0, 30)}"`).join(', ');
        md += `| ${i + 1} | ${varsStr} | ${d.passed ? 'Pass' : 'FAIL'} | ${d.duration}ms |\n`;
      }
      md += `\n`;
    }
  }

  await ensureDir(outputDir);
  await fs.promises.writeFile(filePath, md, 'utf-8');
  return filePath;
}

export function printABReport(result: ABComparisonResult): void {
  const { variantA: a, variantB: b, winner, deltas } = result;

  console.log('');
  console.log(chalk.bold(`A/B Comparison: ${result.id}`));
  console.log('');

  const passA = `${a.assertions.filter(x => x.passed).length}/${a.assertions.length}`;
  const passB = `${b.assertions.filter(x => x.passed).length}/${b.assertions.length}`;

  const rows: [string, string, string, string][] = [
    ['Status', `${a.passed ? '✅' : '❌'} ${passA} passed`, `${b.passed ? '✅' : '❌'} ${passB} passed`, '—'],
    ['Latency', `${a.duration}ms`, `${b.duration}ms`, formatDelta(deltas.latencyMs, 'ms')],
  ];

  if ((a.cost ?? 0) > 0 || (b.cost ?? 0) > 0) {
    rows.push(['Cost', `$${(a.cost ?? 0).toFixed(6)}`, `$${(b.cost ?? 0).toFixed(6)}`, formatDelta(deltas.costDollars, '$', true)]);
  }

  if ((a.tokens?.totalTokens ?? 0) > 0 || (b.tokens?.totalTokens ?? 0) > 0) {
    rows.push(['Tokens', `${a.tokens?.totalTokens ?? 0}`, `${b.tokens?.totalTokens ?? 0}`, formatDelta(deltas.tokens, '')]);
  }

  // Print aligned table
  const colWidths = [12, 22, 22, 14];
  printTableRow(['Metric', 'Variant A', 'Variant B', 'Delta'], colWidths, true);
  printTableRow(colWidths.map(w => '─'.repeat(w)) as [string, string, string, string], colWidths, false);
  for (const row of rows) printTableRow(row, colWidths, false);

  console.log('');
  if (winner === 'tie') {
    console.log(chalk.yellow('Result: Tie — variants are equivalent'));
  } else {
    const name = winner === 'A' ? 'Variant A' : 'Variant B';
    console.log(chalk.green.bold(`Winner: ${name}`));
  }
  console.log('');
}

function formatDelta(value: number, unit: string, isDollar = false): string {
  if (value === 0) return '—';
  const sign = value > 0 ? '+' : '';
  if (isDollar) return `${sign}$${value.toFixed(6)}`;
  return `${sign}${value}${unit}`;
}

function printTableRow(cells: [string, string, string, string], widths: number[], bold: boolean): void {
  const padded = cells.map((c, i) => c.padEnd(widths[i]));
  const line = `| ${padded.join(' | ')} |`;
  console.log(bold ? chalk.bold(line) : line);
}

export async function generateABMarkdownReport(
  result: ABComparisonResult,
  outputDir: string = DEFAULT_REPORT_DIR,
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outputDir, `ab-${timestamp}.md`);

  const { variantA: a, variantB: b, winner, deltas } = result;
  const passA = `${a.assertions.filter(x => x.passed).length}/${a.assertions.length}`;
  const passB = `${b.assertions.filter(x => x.passed).length}/${b.assertions.length}`;

  let md = `# A/B Comparison: ${result.id}\n\n`;

  md += `| Metric | Variant A (${a.id}) | Variant B (${b.id}) | Delta |\n`;
  md += `|--------|---------------------|---------------------|-------|\n`;
  md += `| Status | ${a.passed ? 'Pass' : 'FAIL'} ${passA} | ${b.passed ? 'Pass' : 'FAIL'} ${passB} | — |\n`;
  md += `| Latency | ${a.duration}ms | ${b.duration}ms | ${formatDelta(deltas.latencyMs, 'ms')} |\n`;
  if ((a.cost ?? 0) > 0 || (b.cost ?? 0) > 0) {
    md += `| Cost | $${(a.cost ?? 0).toFixed(6)} | $${(b.cost ?? 0).toFixed(6)} | ${formatDelta(deltas.costDollars, '$', true)} |\n`;
  }
  if ((a.tokens?.totalTokens ?? 0) > 0 || (b.tokens?.totalTokens ?? 0) > 0) {
    md += `| Tokens | ${a.tokens?.totalTokens ?? 0} | ${b.tokens?.totalTokens ?? 0} | ${formatDelta(deltas.tokens, '')} |\n`;
  }
  md += `\n`;

  if (winner === 'tie') {
    md += `**Result:** Tie — variants are equivalent\n`;
  } else {
    const name = winner === 'A' ? `Variant A (${a.id})` : `Variant B (${b.id})`;
    md += `**Winner:** ${name}\n`;
  }

  await ensureDir(outputDir);
  await fs.promises.writeFile(filePath, md, 'utf-8');
  return filePath;
}

export async function generateABHtmlReport(
  result: ABComparisonResult,
  outputDir: string = DEFAULT_REPORT_DIR,
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outputDir, `ab-${timestamp}.html`);

  const { variantA: a, variantB: b, winner, deltas } = result;
  const winnerSide = winner === 'tie' ? 'none' : winner;

  // Compute winner subtext based on which metrics favor the winner
  const reasons: string[] = [];
  if (deltas.latencyMs !== 0) {
    const pct = Math.abs(deltas.latencyMs) / Math.max(a.duration, b.duration) * 100;
    if (pct >= 10) {
      const faster = deltas.latencyMs < 0 ? 'B' : 'A';
      if (faster === winner) reasons.push(`${pct.toFixed(0)}% faster`);
    }
  }
  if (deltas.costDollars !== 0 && Math.max(a.cost ?? 0, b.cost ?? 0) > 0) {
    const pct = Math.abs(deltas.costDollars) / Math.max(a.cost ?? 0, b.cost ?? 0) * 100;
    if (pct >= 5) {
      const cheaper = deltas.costDollars < 0 ? 'B' : 'A';
      if (cheaper === winner) reasons.push(`${pct.toFixed(0)}% cheaper`);
    }
  }

  // Render delta bars — normalize to fill width proportionally
  function deltaBar(label: string, aVal: number, bVal: number, unit: string, lowerIsBetter = true): string {
    const max = Math.max(aVal, bVal);
    if (max === 0) return '';
    const aPct = (aVal / max) * 100;
    const bPct = (bVal / max) * 100;
    return `
      <div class="delta-bar">
        <div class="label"><span>${label}</span><span class="mono">A: ${aVal}${unit} · B: ${bVal}${unit}</span></div>
        <div class="track"><div class="fill a" style="width:${aPct}%"></div></div>
        <div class="track" style="margin-top:4px"><div class="fill b" style="width:${bPct}%"></div></div>
      </div>
    `;
  }

  const showCost = (a.cost ?? 0) > 0 || (b.cost ?? 0) > 0;
  const showTokens = (a.tokens?.totalTokens ?? 0) > 0 || (b.tokens?.totalTokens ?? 0) > 0;

  function variantCard(label: 'A' | 'B', r: RunResult): string {
    const isWinner = winnerSide === label;
    const passCount = r.assertions.filter(x => x.passed).length;
    return `
      <div class="variant-card ${isWinner ? 'winner' : ''}">
        <div class="variant-label">${isWinner ? '★ WINNER · ' : ''}VARIANT ${label}</div>
        <h3>${escapeHtml(r.id)}</h3>
        <div class="meta" style="color: var(--text-dim); font-size: 0.85rem; margin-bottom: 1rem;">${escapeHtml(r.provider)}/${escapeHtml(r.model)}</div>
        <div class="variant-metrics">
          <div class="m"><div class="label">Status</div><div class="value" style="color: ${r.passed ? 'var(--pass)' : 'var(--fail)'}">${r.passed ? '✓' : '✗'} ${passCount}/${r.assertions.length}</div></div>
          <div class="m"><div class="label">Latency</div><div class="value">${r.duration}ms</div></div>
          ${showCost ? `<div class="m"><div class="label">Cost</div><div class="value">$${(r.cost ?? 0).toFixed(6)}</div></div>` : ''}
          ${showTokens ? `<div class="m"><div class="label">Tokens</div><div class="value">${r.tokens?.totalTokens ?? 0}</div></div>` : ''}
        </div>
        <div class="assertions" style="margin-top: 1rem;">
          ${renderAssertionChips(r.assertions)}
        </div>
        <details>
          <summary>Output preview</summary>
          <pre>${escapeHtml((r.output || '').slice(0, 1500))}</pre>
        </details>
      </div>
    `;
  }

  const winnerBanner = winner === 'tie' ? `
    <div class="winner-banner" style="border-color: var(--warn);">
      <div class="trophy">⚖️</div>
      <h2 style="color: var(--warn);">Tie</h2>
      <div class="subtext">Variants are equivalent on all measured metrics</div>
    </div>
  ` : `
    <div class="winner-banner">
      <div class="trophy">🏆</div>
      <h2>Variant ${winner} wins</h2>
      <div class="subtext">${reasons.length > 0 ? reasons.join(' · ') : 'Higher pass rate'}</div>
    </div>
  `;

  const body = `
    <header>
      <h1>A/B comparison</h1>
      <div class="subtitle">${escapeHtml(result.id)} · ${new Date().toLocaleString()}</div>
    </header>
    ${winnerBanner}
    <div class="ab-grid">
      ${variantCard('A', a)}
      ${variantCard('B', b)}
    </div>
    <div style="background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem;">
      <h3 style="margin-bottom: 1rem;">Metric comparison</h3>
      ${deltaBar('Latency', a.duration, b.duration, 'ms')}
      ${showCost ? deltaBar('Cost', a.cost ?? 0, b.cost ?? 0, '') : ''}
      ${showTokens ? deltaBar('Tokens', a.tokens?.totalTokens ?? 0, b.tokens?.totalTokens ?? 0, '') : ''}
    </div>
  `;

  await ensureDir(outputDir);
  await fs.promises.writeFile(filePath, renderHtmlShell(`A/B: ${result.id}`, body), 'utf-8');
  return filePath;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
