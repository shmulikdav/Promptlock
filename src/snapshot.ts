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

  const promptDir = path.join(baseDir, result.id);
  await ensureDir(promptDir);

  // Save timestamped version for history
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const historyPath = path.join(promptDir, `${ts}.json`);
  await writeJsonFile(historyPath, snapshot);

  // Also save as "latest.json" for easy access
  const latestPath = path.join(promptDir, 'latest.json');
  await writeJsonFile(latestPath, snapshot);

  return latestPath;
}

export async function loadSnapshot(
  id: string,
  baseDir: string = DEFAULT_SNAPSHOT_DIR,
): Promise<SnapshotData | null> {
  // Try new format: {id}/latest.json
  const latestPath = path.join(baseDir, id, 'latest.json');
  try {
    const content = await fs.promises.readFile(latestPath, 'utf-8');
    return JSON.parse(content) as SnapshotData;
  } catch {
    // Fall back to old format: {id}.json
    const legacyPath = path.join(baseDir, `${id}.json`);
    try {
      const content = await fs.promises.readFile(legacyPath, 'utf-8');
      return JSON.parse(content) as SnapshotData;
    } catch {
      return null;
    }
  }
}

export async function loadSnapshotHistory(
  id: string,
  baseDir: string = DEFAULT_SNAPSHOT_DIR,
): Promise<SnapshotData[]> {
  const promptDir = path.join(baseDir, id);
  try {
    const files = await fs.promises.readdir(promptDir);
    const snapshots: SnapshotData[] = [];
    for (const file of files.filter(f => f.endsWith('.json') && f !== 'latest.json').sort()) {
      try {
        const content = await fs.promises.readFile(path.join(promptDir, file), 'utf-8');
        snapshots.push(JSON.parse(content) as SnapshotData);
      } catch {
        // skip corrupt files
      }
    }
    return snapshots;
  } catch {
    return [];
  }
}

export async function listSnapshots(
  baseDir: string = DEFAULT_SNAPSHOT_DIR,
): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(baseDir, { withFileTypes: true });
    const ids: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        ids.push(entry.name);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        // Legacy format
        ids.push(entry.name.replace('.json', ''));
      }
    }
    return ids;
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
