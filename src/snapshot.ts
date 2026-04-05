import * as fs from 'fs';
import * as path from 'path';
import { diffLines } from 'diff';
import { SnapshotData, RunResult, DiffResult, DiffChange } from './types';
import { ensureDir, writeJsonFile } from './utils';

const DEFAULT_SNAPSHOT_DIR = '.promptlock/snapshots';

export async function saveSnapshot(
  result: RunResult,
  baseDir: string = DEFAULT_SNAPSHOT_DIR,
): Promise<string> {
  const snapshot: SnapshotData = {
    id: result.id,
    version: result.version,
    promptHash: result.promptHash,
    capturedAt: result.timestamp,
    model: result.model,
    defaultVars: result.defaultVars,
    output: result.output,
    assertionResults: result.assertions,
  };

  const filePath = path.join(baseDir, `${result.id}.json`);
  await writeJsonFile(filePath, snapshot);
  return filePath;
}

export async function loadSnapshot(
  id: string,
  baseDir: string = DEFAULT_SNAPSHOT_DIR,
): Promise<SnapshotData | null> {
  const filePath = path.join(baseDir, `${id}.json`);
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content) as SnapshotData;
  } catch {
    return null;
  }
}

export async function listSnapshots(
  baseDir: string = DEFAULT_SNAPSHOT_DIR,
): Promise<string[]> {
  try {
    const files = await fs.promises.readdir(baseDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch {
    return [];
  }
}

export function diffSnapshots(
  previous: SnapshotData,
  currentOutput: string,
): DiffResult {
  const changes = diffLines(previous.output, currentOutput);

  const diffChanges: DiffChange[] = changes.map(change => ({
    added: change.added,
    removed: change.removed,
    value: change.value,
  }));

  return {
    id: previous.id,
    previousOutput: previous.output,
    currentOutput,
    changes: diffChanges,
    snapshotTimestamp: previous.capturedAt,
  };
}
