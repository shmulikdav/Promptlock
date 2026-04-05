import * as path from 'path';
import { loadConfigFile, discoverConfigFile } from '../src/config-loader';

const FIXTURES = path.join(__dirname, 'fixtures');

describe('loadConfigFile', () => {
  it('loads YAML config file', async () => {
    const config = await loadConfigFile(path.join(FIXTURES, 'promptlock.yaml'));
    expect(config).toBeDefined();
    const c = Array.isArray(config) ? config[0] : config;
    expect(c.id).toBe('yaml-test');
    expect(c.provider).toBe('openai');
    expect(c.model).toBe('gpt-4o-mini');
    expect(c.assertions).toHaveLength(2);
  });

  it('throws on unsupported format', async () => {
    await expect(loadConfigFile(path.join(FIXTURES, 'test-data.csv')))
      .rejects.toThrow('Unsupported config format');
  });
});

describe('discoverConfigFile', () => {
  it('finds promptlock.yaml in fixtures directory', async () => {
    const found = await discoverConfigFile(FIXTURES);
    expect(found).toContain('promptlock.yaml');
  });

  it('returns null when no config exists', async () => {
    const found = await discoverConfigFile('/tmp');
    expect(found).toBeNull();
  });
});
