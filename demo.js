#!/usr/bin/env node

/**
 * prompt-lock Demo Script
 *
 * Runs without API keys — uses simulated LLM outputs to demonstrate
 * the assertion engine, console reporting, snapshot, diff, and HTML reports.
 *
 * Usage:
 *   node demo.js
 */

const { runAssertions } = require('./dist/assertions');
const { saveSnapshot, loadSnapshot, diffSnapshots } = require('./dist/snapshot');
const { printConsoleReport, printDiffReport, generateHtmlReport } = require('./dist/reporter');
const { hashString, ensureDir } = require('./dist/utils');
const path = require('path');

// ── Simulated LLM outputs ────────────────────────────────────────────────────

const GOOD_SUMMARY = `• A fox jumped over a lazy dog near a river
• The event took place on a sunny afternoon
• The dog remained undisturbed throughout`;

const BAD_SUMMARY = `As an AI language model, I cannot directly observe events, but based on the text provided, here is a lengthy summary that goes well beyond what was asked for. The quick brown fox jumped over the lazy dog. This happened near a river. The dog was lazy. The fox was brown. The fox was quick. The river was nearby. It was a sunny afternoon. The end. Let me also add some more unnecessary text to make this response way too long for the 500 character limit that was set in the assertion configuration.`;

const GOOD_JSON = JSON.stringify({
  category: "billing",
  priority: "high",
  confidence: 0.95
});

const BAD_JSON = `{ category: billing, priority: high }`;  // invalid JSON

// ── Prompt configs (simulated) ───────────────────────────────────────────────

const prompts = [
  {
    id: 'article-summarizer',
    version: '1.0.0',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    prompt: 'Summarize the following article in 3 bullet points...',
    output: GOOD_SUMMARY,
    assertions: [
      { type: 'contains', value: '•' },
      { type: 'max-length', chars: 500 },
      { type: 'not-contains', value: 'I cannot' },
      { type: 'no-hallucination-words' },
    ],
  },
  {
    id: 'article-summarizer-broken',
    version: '1.1.0',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    prompt: 'Summarize the following article...',
    output: BAD_SUMMARY,
    assertions: [
      { type: 'contains', value: '•' },
      { type: 'max-length', chars: 500 },
      { type: 'not-contains', value: 'I cannot' },
      { type: 'no-hallucination-words' },
    ],
  },
  {
    id: 'ticket-classifier',
    version: '1.0.0',
    provider: 'openai',
    model: 'gpt-4o-mini',
    prompt: 'Classify this support ticket as JSON...',
    output: GOOD_JSON,
    assertions: [
      { type: 'json-valid' },
      { type: 'contains', value: 'billing' },
      { type: 'max-length', chars: 200 },
    ],
  },
  {
    id: 'ticket-classifier-broken',
    version: '1.1.0',
    provider: 'openai',
    model: 'gpt-4o-mini',
    prompt: 'Classify this support ticket...',
    output: BAD_JSON,
    assertions: [
      { type: 'json-valid' },
      { type: 'contains', value: 'billing' },
      { type: 'max-length', chars: 200 },
    ],
  },
];

// ── Run demo ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           prompt-lock Demo (no API keys needed)        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // Step 1: Run assertions on all simulated outputs
  console.log('━━━ Step 1: Running assertions ━━━');

  const results = [];
  for (const p of prompts) {
    const startTime = Date.now();
    const assertionResults = await runAssertions(p.output, p.assertions);
    const allPassed = assertionResults.every(r => r.passed);
    results.push({
      id: p.id,
      version: p.version,
      provider: p.provider,
      model: p.model,
      prompt: p.prompt,
      promptHash: `sha256:${hashString(p.prompt)}`,
      output: p.output,
      assertions: assertionResults,
      passed: allPassed,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  }

  printConsoleReport(results);

  // Step 2: Save snapshots for the "good" versions
  console.log('');
  console.log('━━━ Step 2: Saving snapshots for known-good outputs ━━━');

  const snapshotDir = path.join(__dirname, '.promptlock-demo', 'snapshots');
  await ensureDir(snapshotDir);

  const goodResults = results.filter(r => r.passed);
  for (const result of goodResults) {
    const { saveSnapshot: save } = require('./dist/snapshot');
    const p = await save(result, snapshotDir);
    console.log(`  📸 Saved: ${result.id} → ${p}`);
  }

  // Step 3: Show diff between good snapshot and broken output
  console.log('');
  console.log('━━━ Step 3: Diffing broken output against snapshot ━━━');

  const summarizerSnap = await loadSnapshot('article-summarizer', snapshotDir);
  if (summarizerSnap) {
    const brokenResult = results.find(r => r.id === 'article-summarizer-broken');
    const diff = diffSnapshots(summarizerSnap, brokenResult.output);
    printDiffReport([{ ...diff, id: 'article-summarizer (v1.0.0 → v1.1.0)' }]);
  }

  // Step 4: Generate HTML report
  console.log('');
  console.log('━━━ Step 4: Generating HTML report ━━━');

  const reportDir = path.join(__dirname, '.promptlock-demo', 'reports');
  const htmlPath = await generateHtmlReport(results, reportDir);
  console.log(`  📄 HTML report: ${htmlPath}`);
  console.log('');

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  console.log('━━━ Demo Complete ━━━');
  console.log(`  ${passed} prompts passed, ${failed} failed`);
  console.log('');
  console.log('This is what happens in your CI pipeline when someone changes a prompt.');
  console.log('The broken prompts would fail the build before reaching production.');
  console.log('');
  console.log('Try it yourself:');
  console.log('  npx prompt-lock init');
  console.log('  npx prompt-lock run --ci');

  // Exit with failure if anything failed (like real CI)
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('Demo error:', err);
  process.exitCode = 1;
});
