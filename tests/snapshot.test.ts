import * as fs from 'fs';
import * as path from 'path';
import { saveSnapshot, loadSnapshot, listSnapshots, loadSnapshotHistory, diffSnapshots } from '../src/snapshot';
import { RunResult, SnapshotData } from '../src/types';

const TEST_SNAPSHOT_DIR = path.join(__dirname, '.test-snapshots');

function makeRunResult(overrides: Partial<RunResult> = {}): RunResult {
  return {
    id: 'test-prompt',
    version: '1.0.0',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    prompt: 'test prompt',
    promptHash: 'sha256:abc123',
    output: 'test output',
    assertions: [
      { type: 'contains', name: 'contains "test"', passed: true },
    ],
    passed: true,
    duration: 100,
    timestamp: '2026-04-05T10:00:00.000Z',
    ...overrides,
  };
}

beforeEach(async () => {
  await fs.promises.rm(TEST_SNAPSHOT_DIR, { recursive: true, force: true });
});

afterAll(async () => {
  await fs.promises.rm(TEST_SNAPSHOT_DIR, { recursive: true, force: true });
});

describe('saveSnapshot', () => {
  it('saves a snapshot file with history', async () => {
    const result = makeRunResult();
    const filePath = await saveSnapshot(result, TEST_SNAPSHOT_DIR);

    expect(filePath).toContain('latest.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(content.id).toBe('test-prompt');
    expect(content.output).toBe('test output');

    // Should also have a timestamped file
    const promptDir = path.join(TEST_SNAPSHOT_DIR, 'test-prompt');
    const files = fs.readdirSync(promptDir);
    expect(files.length).toBeGreaterThanOrEqual(2); // latest.json + timestamp.json
  });
});

describe('loadSnapshot', () => {
  it('loads a saved snapshot', async () => {
    const result = makeRunResult();
    await saveSnapshot(result, TEST_SNAPSHOT_DIR);

    const snapshot = await loadSnapshot('test-prompt', TEST_SNAPSHOT_DIR);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.id).toBe('test-prompt');
    expect(snapshot!.output).toBe('test output');
  });

  it('returns null for nonexistent snapshot', async () => {
    const snapshot = await loadSnapshot('nonexistent', TEST_SNAPSHOT_DIR);
    expect(snapshot).toBeNull();
  });
});

describe('listSnapshots', () => {
  it('lists saved snapshot IDs', async () => {
    await saveSnapshot(makeRunResult({ id: 'prompt-a' }), TEST_SNAPSHOT_DIR);
    await saveSnapshot(makeRunResult({ id: 'prompt-b' }), TEST_SNAPSHOT_DIR);

    const ids = await listSnapshots(TEST_SNAPSHOT_DIR);
    expect(ids).toContain('prompt-a');
    expect(ids).toContain('prompt-b');
    expect(ids).toHaveLength(2);
  });

  it('returns empty array for nonexistent directory', async () => {
    const ids = await listSnapshots('/tmp/nonexistent-dir-12345');
    expect(ids).toEqual([]);
  });
});

describe('loadSnapshotHistory', () => {
  it('returns history of snapshots in chronological order', async () => {
    await saveSnapshot(makeRunResult({ id: 'prompt-x', output: 'v1' }), TEST_SNAPSHOT_DIR);
    // Small delay to get different timestamps
    await new Promise(r => setTimeout(r, 10));
    await saveSnapshot(makeRunResult({ id: 'prompt-x', output: 'v2' }), TEST_SNAPSHOT_DIR);

    const history = await loadSnapshotHistory('prompt-x', TEST_SNAPSHOT_DIR);
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for nonexistent prompt', async () => {
    const history = await loadSnapshotHistory('nonexistent', TEST_SNAPSHOT_DIR);
    expect(history).toEqual([]);
  });
});

describe('snapshot ID sanitization', () => {
  it('sanitizes path traversal characters in ID', async () => {
    const result = makeRunResult({ id: '../../etc/evil' });
    const filePath = await saveSnapshot(result, TEST_SNAPSHOT_DIR);

    // Should NOT write outside the snapshot dir
    expect(filePath).toContain(TEST_SNAPSHOT_DIR);
    expect(filePath).not.toContain('..');
    expect(filePath).toContain('______etc_evil');
  });

  it('sanitizes slashes in ID', async () => {
    const result = makeRunResult({ id: 'my/prompt/name' });
    const filePath = await saveSnapshot(result, TEST_SNAPSHOT_DIR);

    expect(filePath).toContain('my_prompt_name');
    expect(filePath).not.toContain('my/prompt');
  });

  it('preserves safe characters', async () => {
    const result = makeRunResult({ id: 'my-prompt_v2' });
    const filePath = await saveSnapshot(result, TEST_SNAPSHOT_DIR);
    expect(filePath).toContain('my-prompt_v2');
  });
});

describe('diffSnapshots', () => {
  it('shows no changes when outputs are identical', () => {
    const snapshot: SnapshotData = {
      id: 'test',
      promptHash: 'sha256:abc',
      capturedAt: '2026-04-05T10:00:00.000Z',
      model: 'test-model',
      output: 'same output',
      assertionResults: [],
    };

    const diff = diffSnapshots(snapshot, 'same output');
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0].added).toBeUndefined();
    expect(diff.changes[0].removed).toBeUndefined();
    expect(diff.changes[0].value).toBe('same output');
  });

  it('detects additions and removals', () => {
    const snapshot: SnapshotData = {
      id: 'test',
      promptHash: 'sha256:abc',
      capturedAt: '2026-04-05T10:00:00.000Z',
      model: 'test-model',
      output: 'line one\nline two\n',
      assertionResults: [],
    };

    const diff = diffSnapshots(snapshot, 'line one\nline three\n');
    const removed = diff.changes.find((c) => c.removed);
    const added = diff.changes.find((c) => c.added);
    expect(removed).toBeDefined();
    expect(added).toBeDefined();
    expect(removed!.value).toContain('two');
    expect(added!.value).toContain('three');
  });

  it('includes metadata in diff result', () => {
    const snapshot: SnapshotData = {
      id: 'my-prompt',
      promptHash: 'sha256:abc',
      capturedAt: '2026-04-05T10:00:00.000Z',
      model: 'test-model',
      output: 'old output',
      assertionResults: [],
    };

    const diff = diffSnapshots(snapshot, 'new output');
    expect(diff.id).toBe('my-prompt');
    expect(diff.previousOutput).toBe('old output');
    expect(diff.currentOutput).toBe('new output');
    expect(diff.snapshotTimestamp).toBe('2026-04-05T10:00:00.000Z');
  });
});
