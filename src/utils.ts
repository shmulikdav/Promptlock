import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([\w.\-]+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

export function hashString(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
}

export function readJsonFile<T>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * Open a file or URL in the user's default browser.
 * Best-effort: returns false if it can't open (e.g. CI, headless, unknown platform).
 */
export function openInBrowser(target: string): boolean {
  // Respect CI environments — never try to open a browser
  if (process.env.CI || process.env.PROMPT_LOCK_NO_OPEN) return false;

  const platform = process.platform;
  let command: string;
  let args: string[];

  if (platform === 'darwin') {
    command = 'open';
    args = [target];
  } else if (platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '""', target];
  } else {
    command = 'xdg-open';
    args = [target];
  }

  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.unref();
    child.on('error', () => {
      // Swallow — opener doesn't exist on this system
    });
    return true;
  } catch {
    return false;
  }
}

export function spinner(message: string): { stop: (finalMessage?: string) => void } {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const interval = setInterval(() => {
    process.stderr.write(`\r${frames[i % frames.length]} ${message}`);
    i++;
  }, 80);

  return {
    stop(finalMessage?: string) {
      clearInterval(interval);
      process.stderr.write(`\r${finalMessage ?? message}${''.padEnd(10)}\n`);
    },
  };
}
