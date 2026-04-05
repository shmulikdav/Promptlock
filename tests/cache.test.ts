import * as fs from 'fs';
import * as path from 'path';
import { OutputCache } from '../src/cache';

const TEST_CACHE_DIR = path.join(__dirname, '.test-cache');

beforeEach(async () => {
  await fs.promises.rm(TEST_CACHE_DIR, { recursive: true, force: true });
});

afterAll(async () => {
  await fs.promises.rm(TEST_CACHE_DIR, { recursive: true, force: true });
});

describe('OutputCache', () => {
  it('returns null for cache miss', async () => {
    const cache = new OutputCache(TEST_CACHE_DIR);
    const result = await cache.get('prompt', 'model');
    expect(result).toBeNull();
  });

  it('stores and retrieves cached output', async () => {
    const cache = new OutputCache(TEST_CACHE_DIR);
    await cache.set('hello world', 'gpt-4o', 'cached response');
    const result = await cache.get('hello world', 'gpt-4o');
    expect(result).toBe('cached response');
  });

  it('returns different results for different prompts', async () => {
    const cache = new OutputCache(TEST_CACHE_DIR);
    await cache.set('prompt-a', 'model', 'response-a');
    await cache.set('prompt-b', 'model', 'response-b');
    expect(await cache.get('prompt-a', 'model')).toBe('response-a');
    expect(await cache.get('prompt-b', 'model')).toBe('response-b');
  });

  it('returns different results for different models', async () => {
    const cache = new OutputCache(TEST_CACHE_DIR);
    await cache.set('same prompt', 'model-a', 'response-a');
    await cache.set('same prompt', 'model-b', 'response-b');
    expect(await cache.get('same prompt', 'model-a')).toBe('response-a');
    expect(await cache.get('same prompt', 'model-b')).toBe('response-b');
  });

  it('persists to disk across instances', async () => {
    const cache1 = new OutputCache(TEST_CACHE_DIR);
    await cache1.set('test', 'model', 'persisted');

    const cache2 = new OutputCache(TEST_CACHE_DIR);
    const result = await cache2.get('test', 'model');
    expect(result).toBe('persisted');
  });

  it('clear removes all entries', async () => {
    const cache = new OutputCache(TEST_CACHE_DIR);
    await cache.set('a', 'model', 'output-a');
    await cache.set('b', 'model', 'output-b');

    await cache.clear();

    expect(await cache.get('a', 'model')).toBeNull();
    expect(await cache.get('b', 'model')).toBeNull();
  });

  it('stats returns correct entry count and size', async () => {
    const cache = new OutputCache(TEST_CACHE_DIR);
    await cache.set('test', 'model', 'some output');

    const stats = await cache.stats();
    expect(stats.entries).toBe(1);
    expect(stats.sizeBytes).toBeGreaterThan(0);
  });

  it('stats returns zero for empty cache', async () => {
    const cache = new OutputCache(TEST_CACHE_DIR);
    const stats = await cache.stats();
    expect(stats.entries).toBe(0);
    expect(stats.sizeBytes).toBe(0);
  });
});
