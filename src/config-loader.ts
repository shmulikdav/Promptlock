import * as fs from 'fs';
import * as path from 'path';
import { PromptLockConfig } from './types';
import { validateConfig, ValidationResult } from './config-validation';

const CONFIG_FILENAMES = ['promptlock.yaml', 'promptlock.yml', 'promptlock.json'];

export async function loadConfigFile(
  filePath: string,
): Promise<PromptLockConfig | PromptLockConfig[]> {
  const ext = path.extname(filePath).toLowerCase();
  const content = await fs.promises.readFile(filePath, 'utf-8');

  let raw: unknown;

  if (ext === '.js') {
    delete require.cache[path.resolve(filePath)];
    raw = require(path.resolve(filePath));
  } else if (ext === '.json') {
    raw = JSON.parse(content);
  } else if (ext === '.yaml' || ext === '.yml') {
    const yaml = require('js-yaml');
    raw = yaml.load(content);
  } else {
    throw new Error(`Unsupported config format: "${ext}". Use .js, .json, .yaml, or .yml`);
  }

  // Validate
  const configs = Array.isArray(raw) ? raw : [raw];
  for (const config of configs) {
    const result = validateConfig(config);
    if (!result.valid) {
      const id = (config as Record<string, unknown>)?.id ?? 'unknown';
      throw new Error(`Invalid config "${id}" in ${filePath}: ${result.errors.join('; ')}`);
    }
  }

  return Array.isArray(raw) ? raw as PromptLockConfig[] : raw as PromptLockConfig;
}

export async function discoverConfigFile(dir: string): Promise<string | null> {
  // Check for promptlock.yaml/.yml/.json in project root
  for (const filename of CONFIG_FILENAMES) {
    const candidate = path.join(dir, filename);
    try {
      await fs.promises.access(candidate);
      return candidate;
    } catch {
      // Not found, try next
    }
  }

  return null;
}
