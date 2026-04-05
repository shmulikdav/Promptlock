import * as https from 'https';
import { RunResult } from './types';

export interface GitHubCommentOptions {
  token: string;
  owner: string;
  repo: string;
  prNumber: number;
  results: RunResult[];
  updateExisting?: boolean;
}

const COMMENT_MARKER = '<!-- prompt-lock-report -->';

export async function postPRComment(opts: GitHubCommentOptions): Promise<void> {
  const body = formatComment(opts.results);

  if (opts.updateExisting) {
    const existingId = await findExistingComment(opts);
    if (existingId) {
      await githubApi('PATCH', `/repos/${opts.owner}/${opts.repo}/issues/comments/${existingId}`, opts.token, { body });
      return;
    }
  }

  await githubApi('POST', `/repos/${opts.owner}/${opts.repo}/issues/${opts.prNumber}/comments`, opts.token, { body });
}

function formatComment(results: RunResult[]): string {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  const allPassed = failed === 0;

  let md = `${COMMENT_MARKER}\n`;
  md += `## ${allPassed ? '✅' : '❌'} prompt-lock Report\n\n`;
  md += `**${passed}/${total}** prompts passed`;
  if (failed > 0) md += ` · **${failed} failed**`;
  md += '\n\n';

  md += '| Prompt | Status | Assertions | Duration |\n';
  md += '|--------|--------|------------|----------|\n';

  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    const assertPassed = r.assertions.filter(a => a.passed).length;
    const assertTotal = r.assertions.length;
    md += `| ${r.id} | ${icon} | ${assertPassed}/${assertTotal} | ${r.duration}ms |\n`;
  }

  // Show failed assertion details
  const failedResults = results.filter(r => !r.passed);
  if (failedResults.length > 0) {
    md += '\n### Failures\n\n';
    for (const r of failedResults) {
      md += `**${r.id}**\n`;
      const failedAssertions = r.assertions.filter(a => !a.passed);
      for (const a of failedAssertions) {
        md += `- ❌ ${a.name}`;
        if (a.expected) md += ` (expected ${a.expected}, got ${a.actual})`;
        if (a.message) md += ` — ${a.message}`;
        md += '\n';
      }

      // Dataset failures
      if (r.datasetResults) {
        const dsFailed = r.datasetResults.filter(d => !d.passed);
        if (dsFailed.length > 0) {
          md += `- Dataset: ${dsFailed.length}/${r.datasetResults.length} inputs failed\n`;
        }
      }
      md += '\n';
    }
  }

  return md;
}

async function findExistingComment(opts: GitHubCommentOptions): Promise<number | null> {
  try {
    const data = await githubApi(
      'GET',
      `/repos/${opts.owner}/${opts.repo}/issues/${opts.prNumber}/comments?per_page=100`,
      opts.token,
    );
    const comments = JSON.parse(data) as Array<{ id: number; body: string }>;
    const existing = comments.find(c => c.body.includes(COMMENT_MARKER));
    return existing?.id ?? null;
  } catch {
    return null;
  }
}

function githubApi(
  method: string,
  endpoint: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;

    const req = https.request(
      {
        hostname: 'api.github.com',
        path: endpoint,
        method,
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'prompt-lock',
          ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr).toString() } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`GitHub API ${res.statusCode}: ${data.slice(0, 200)}`));
          } else {
            resolve(data);
          }
        });
      },
    );

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}
