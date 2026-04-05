import { PromptLock, PromptLockConfig } from 'prompt-lock';

const summarizer: PromptLockConfig = {
  id: 'article-summarizer',
  version: '1.0.0',
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',

  prompt: `You are a professional summarizer.
Summarize the following article in 3 bullet points.
Article: {{article}}`,

  defaultVars: {
    article:
      'The quick brown fox jumped over the lazy dog. This happened near a river on a sunny afternoon. The dog barely noticed.',
  },

  assertions: [
    { type: 'contains', value: '•' },
    { type: 'max-length', chars: 500 },
    { type: 'not-contains', value: 'I cannot' },
    { type: 'min-length', chars: 10 },
    {
      type: 'custom',
      name: 'has-three-bullets',
      fn: (output: string) => {
        const bullets = output.split('\n').filter((l) => l.trim().startsWith('•'));
        return bullets.length === 3;
      },
    },
  ],
};

async function main() {
  const lock = new PromptLock(summarizer);

  // Run assertions
  const results = await lock.run();
  console.log('Results:', JSON.stringify(results, null, 2));

  // Save snapshot
  const paths = await lock.snapshot();
  console.log('Snapshots saved:', paths);

  // Generate report
  await lock.report('console');
}

main().catch(console.error);
