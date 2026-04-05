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
  const lines = content.trim().split('\n').filter(line => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error(`Dataset CSV is empty or has no data rows: ${filePath}`);
  }

  const headers = parseCsvLine(lines[0]);
  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    data.push(row);
  }

  return data;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}
