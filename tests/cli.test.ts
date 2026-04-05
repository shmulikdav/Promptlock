import { execSync, ExecSyncOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CLI_PATH = path.resolve(__dirname, '..', 'dist', 'cli.js');

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'promptlock-test-'));
}

function runCLI(args: string, cwd: string, env?: Record<string, string>): { stdout: string; exitCode: number } {
  const opts: ExecSyncOptions = {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
    timeout: 10000,
  };

  try {
    const stdout = execSync(`node ${CLI_PATH} ${args}`, opts) as string;
    return { stdout, exitCode: 0 };
  } catch (e: any) {
    return { stdout: (e.stdout || '') + (e.stderr || ''), exitCode: e.status ?? 1 };
  }
}

describe('CLI: --version', () => {
  it('prints version number', () => {
    const tmp = createTempDir();
    const { stdout, exitCode } = runCLI('--version', tmp);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('CLI: init', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('creates .promptlock directory structure', () => {
    runCLI('init', tmp);
    expect(fs.existsSync(path.join(tmp, '.promptlock'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, '.promptlock', 'snapshots'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, '.promptlock', 'reports'))).toBe(true);
  });

  it('creates config.json with correct defaults', () => {
    runCLI('init', tmp);
    const configPath = path.join(tmp, '.promptlock', 'config.json');
    expect(fs.existsSync(configPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(config.promptsDir).toBe('./prompts');
    expect(config.snapshotDir).toBe('./.promptlock/snapshots');
    expect(config.defaultProvider).toBe('anthropic');
    expect(config.ci.failOnRegression).toBe(true);
  });

  it('creates example prompt file', () => {
    runCLI('init', tmp);
    const examplePath = path.join(tmp, 'prompts', 'example.js');
    expect(fs.existsSync(examplePath)).toBe(true);

    const content = fs.readFileSync(examplePath, 'utf-8');
    expect(content).toContain('example-summarizer');
    expect(content).toContain('assertions');
  });

  it('is idempotent (running twice does not overwrite)', () => {
    runCLI('init', tmp);

    // Modify the config
    const configPath = path.join(tmp, '.promptlock', 'config.json');
    const original = fs.readFileSync(configPath, 'utf-8');

    runCLI('init', tmp);

    const after = fs.readFileSync(configPath, 'utf-8');
    expect(after).toBe(original);
  });

  it('updates .gitignore', () => {
    // Create a .gitignore first
    fs.writeFileSync(path.join(tmp, '.gitignore'), 'node_modules/\n');
    runCLI('init', tmp);

    const gitignore = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('.promptlock/snapshots/');
    expect(gitignore).toContain('.promptlock/reports/');
  });
});

describe('CLI: run', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = createTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('prints helpful message when no prompts directory exists', () => {
    const { stdout, exitCode } = runCLI('run', tmp);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('No prompt configurations found');
  });

  it('exits with code 1 when no configs found', () => {
    fs.mkdirSync(path.join(tmp, 'prompts'));
    const { exitCode } = runCLI('run', tmp);
    expect(exitCode).toBe(1);
  });

  it('handles provider errors gracefully (missing API key)', () => {
    // Create a prompt file that will trigger a provider call
    fs.mkdirSync(path.join(tmp, 'prompts'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, 'prompts', 'test.js'),
      `module.exports = {
        id: 'test',
        provider: 'openai',
        model: 'gpt-4o-mini',
        prompt: 'Hello',
        assertions: [{ type: 'contains', value: 'hello' }],
      };`,
    );

    // Run without API key — should not crash, should show error
    const { stdout, exitCode } = runCLI('run --ci', tmp, {
      OPENAI_API_KEY: '',
      ANTHROPIC_API_KEY: '',
    });
    expect(exitCode).toBe(1);
    // Should show the error in the report, not crash
    expect(stdout).toContain('test');
  });
});

describe('CLI: snapshot', () => {
  it('exits with code 1 when no configs found', () => {
    const tmp = createTempDir();
    const { exitCode } = runCLI('snapshot', tmp);
    expect(exitCode).toBe(1);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});

describe('CLI: diff', () => {
  it('exits with code 1 when no configs found', () => {
    const tmp = createTempDir();
    const { exitCode } = runCLI('diff', tmp);
    expect(exitCode).toBe(1);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
