import * as path from 'path';
import { loadDataset } from '../src/dataset-loader';

const FIXTURES = path.join(__dirname, 'fixtures');

describe('loadDataset', () => {
  describe('CSV', () => {
    it('parses CSV file with headers', async () => {
      const data = await loadDataset('test-data.csv', FIXTURES);
      expect(data).toHaveLength(3);
      expect(data[0]).toEqual({ text: 'Hello world', language: 'en' });
      expect(data[1]).toEqual({ text: 'Bonjour le monde', language: 'fr' });
      expect(data[2]).toEqual({ text: 'Hola mundo', language: 'es' });
    });
  });

  describe('JSON', () => {
    it('parses JSON array file', async () => {
      const data = await loadDataset('test-data.json', FIXTURES);
      expect(data).toHaveLength(3);
      expect(data[0].text).toBe('Hello world');
      expect(data[2].language).toBe('es');
    });
  });

  describe('errors', () => {
    it('throws on missing file', async () => {
      await expect(loadDataset('nonexistent.csv', FIXTURES))
        .rejects.toThrow('not found');
    });

    it('throws on unsupported extension', async () => {
      await expect(loadDataset('test-data.csv', FIXTURES).then(() =>
        loadDataset('promptlock.yaml', FIXTURES)
      )).rejects.toThrow('Unsupported dataset format');
    });

    it('throws on invalid JSON', async () => {
      const tmpDir = path.join(__dirname, 'fixtures');
      const fs = require('fs');
      const badFile = path.join(tmpDir, 'bad.json');
      fs.writeFileSync(badFile, 'not json');
      try {
        await expect(loadDataset('bad.json', tmpDir))
          .rejects.toThrow('Invalid JSON');
      } finally {
        fs.unlinkSync(badFile);
      }
    });
  });
});
