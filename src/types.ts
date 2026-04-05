export interface PromptLockConfig {
  id: string;
  version?: string;
  provider: 'openai' | 'anthropic';
  model: string;
  prompt: string;
  defaultVars?: Record<string, string>;
  assertions: AssertionConfig[];
  options?: PromptLockOptions;
}

export interface PromptLockOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export type AssertionConfig =
  | { type: 'contains'; value: string }
  | { type: 'not-contains'; value: string }
  | { type: 'starts-with'; value: string }
  | { type: 'ends-with'; value: string }
  | { type: 'matches-regex'; pattern: string }
  | { type: 'max-length'; chars: number }
  | { type: 'min-length'; chars: number }
  | { type: 'json-valid' }
  | { type: 'json-schema'; schema: Record<string, unknown> }
  | { type: 'no-hallucination-words'; words?: string[] }
  | { type: 'custom'; name: string; fn: (output: string) => boolean | Promise<boolean> };

export interface AssertionResult {
  type: string;
  name: string;
  passed: boolean;
  expected?: string;
  actual?: string;
  message?: string;
}

export interface RunResult {
  id: string;
  version?: string;
  provider: string;
  model: string;
  prompt: string;
  promptHash: string;
  output: string;
  assertions: AssertionResult[];
  passed: boolean;
  duration: number;
  timestamp: string;
}

export interface SnapshotData {
  id: string;
  version?: string;
  promptHash: string;
  capturedAt: string;
  model: string;
  defaultVars?: Record<string, string>;
  output: string;
  assertionResults: AssertionResult[];
}

export interface DiffResult {
  id: string;
  previousOutput: string;
  currentOutput: string;
  changes: DiffChange[];
  snapshotTimestamp: string;
}

export interface DiffChange {
  added?: boolean;
  removed?: boolean;
  value: string;
}

export interface PromptLockProjectConfig {
  promptsDir: string;
  snapshotDir: string;
  reportDir: string;
  defaultProvider: 'openai' | 'anthropic';
  defaultModel?: string;
  ci: {
    failOnRegression: boolean;
    reportFormat: ('json' | 'html')[];
  };
}

export interface LLMProvider {
  call(prompt: string, options?: PromptLockOptions): Promise<string>;
}
