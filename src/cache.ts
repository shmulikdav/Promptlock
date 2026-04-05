import * as fs from 'fs';
import * as path from 'path';
import { hashString, ensureDir, writeJsonFile } from './utils';

const DEFAULT_CACHE_DIR = '.promptlock/cache';

interface CacheEntry {
  promptHash: string;
  model: string;
  output: string;
  cachedAt: string;
}

export class OutputCache {
  private dir: string;
  private memCache = new Map<string, string>();

  constructor(cacheDir: string = DEFAULT_CACHE_DIR) {
    this.dir = cacheDir;
  }

  private cacheKey(prompt: string, model: string): string {
    return hashString(`${model}:${prompt}`);
  }

  async get(prompt: string, model: string): Promise<string | null> {
    const key = this.cacheKey(prompt, model);

    // Check memory first
    if (this.memCache.has(key)) {
      return this.memCache.get(key)!;
    }

    // Check disk
    const filePath = path.join(this.dir, `${key}.json`);
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const entry = JSON.parse(content) as CacheEntry;
      this.memCache.set(key, entry.output);
      return entry.output;
    } catch {
      return null;
    }
  }

  async set(prompt: string, model: string, output: string): Promise<void> {
    const key = this.cacheKey(prompt, model);
    this.memCache.set(key, output);

    const entry: CacheEntry = {
      promptHash: `sha256:${hashString(prompt)}`,
      model,
      output,
      cachedAt: new Date().toISOString(),
    };

    const filePath = path.join(this.dir, `${key}.json`);
    await writeJsonFile(filePath, entry);
  }

  async clear(): Promise<void> {
    this.memCache.clear();
    try {
      const files = await fs.promises.readdir(this.dir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.promises.unlink(path.join(this.dir, file));
        }
      }
    } catch {
      // cache dir doesn't exist, nothing to clear
    }
  }

  async stats(): Promise<{ entries: number; sizeBytes: number }> {
    let entries = 0;
    let sizeBytes = 0;
    try {
      const files = await fs.promises.readdir(this.dir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          entries++;
          const stat = await fs.promises.stat(path.join(this.dir, file));
          sizeBytes += stat.size;
        }
      }
    } catch {
      // cache dir doesn't exist
    }
    return { entries, sizeBytes };
  }
}
