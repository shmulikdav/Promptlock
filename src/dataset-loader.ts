import * as fs from 'fs';
import * as path from 'path';

export async function loadDataset(
  datasetPath: string,
  basePath: string,
): Promise<Record<string, string>[]> {
  const resolved = path.resolve(basePath, datasetPath);
  const ext = path.extname(resolved).toLowerCase();

  let content: string;
  try {
    content = await fs.promises.readFile(resolved, 'utf-8');
  } catch {
    throw new Error(`Dataset file not found: ${resolved}`);
  }

  if (ext === '.json') {
    return parseJsonDataset(content, resolved);
  }

  if (ext === '.csv') {
    return parseCsvDataset(content, resolved);
  }

  throw new Error(`Unsupported dataset format "${ext}". Use .csv or .json`);
}

function parseJsonDataset(content: string, filePath: string): Record<string, string>[] {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in dataset file: ${filePath}`);
  }

  if (!Array.isArray(data)) {
    throw new Error(`Dataset JSON must be an array of objects: ${filePath}`);
  }

  return data.map((item, i) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Dataset item [${i}] must be an object: ${filePath}`);
    }
    const record: Record<string, string> = {};
    for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
      record[key] = String(value);
    }
    return record;
  });
}

function parseCsvDataset(content: string, filePath: string): Record<string, string>[] {
  const Papa = require('papaparse');
  const result = Papa.parse(content.trim(), {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors && result.errors.length > 0) {
    throw new Error(`CSV parse error in ${filePath}: ${result.errors[0].message}`);
  }

  if (!result.data || result.data.length === 0) {
    throw new Error(`Dataset CSV is empty: ${filePath}`);
  }

  return result.data as Record<string, string>[];
}
