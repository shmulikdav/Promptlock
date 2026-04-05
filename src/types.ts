// ── Provider Config ──────────────────────────────────────────────────────────

export type ProviderConfig =
  | 'openai'
  | 'anthropic'
  | CustomProviderConfig;

export interface CustomProviderConfig {
  type: 'custom';
  url: string;
  headers?: Record<string, string>;
  bodyTemplate?: Record<string, unknown>;
  responsePath?: string;
}

// ── Token & Cost Tracking ───────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LLMCallResult {
  text: string;
  usage?: TokenUsage;
}

// ── Prompt Config ────────────────────────────────────────────────────────────

export interface PromptLockConfig {
  id: string;
  version?: string;
  provider: ProviderConfig;
  model: string;
  prompt: string;
  defaultVars?: Record<string, string>;
  dataset?: Record<string, string>[] | string;
  assertions: AssertionConfig[];
  options?: PromptLockOptions;
}

export interface PromptLockOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  parallel?: boolean;
  concurrency?: number;
}

// ── Assertions ──────────────────────────────────────────────────────────────

export type AssertionConfig =
  | { type: 'contains'; value: string }
  | { type: 'not-contains'; value: string }
  | { type: 'contains-all'; values: string[] }
  | { type: 'starts-with'; value: string }
  | { type: 'ends-with'; value: string }
  | { type: 'matches-regex'; pattern: string }
  | { type: 'max-length'; chars: number }
  | { type: 'min-length'; chars: number }
  | { type: 'json-valid' }
  | { type: 'json-schema'; schema: Record<string, unknown> }
  | { type: 'no-hallucination-words'; words?: string[] }
  | { type: 'no-duplicates'; separator?: string }
  | { type: 'max-latency'; ms: number }
  | { type: 'max-cost'; dollars: number }
  | { type: 'llm-judge'; judge: { provider: ProviderConfig; model: string }; criteria: string; threshold?: number }
  | { type: 'custom'; name: string; fn: (output: string) => boolean | Promise<boolean> };

export interface AssertionResult {
  type: string;
  name: string;
  passed: boolean;
  expected?: string;
  actual?: string;
  message?: string;
}

// ── Run Result ──────────────────────────────────────────────────────────────

export interface RunResult {
  id: string;
  version?: string;
  provider: string;
  model: string;
  prompt: string;
  promptHash: string;
  output: string;
  defaultVars?: Record<string, string>;
  assertions: AssertionResult[];
  passed: boolean;
  duration: number;
  timestamp: string;
  tokens?: TokenUsage;
  cost?: number;
  datasetResults?: DatasetRunResult[];
}

export interface DatasetRunResult {
  vars: Record<string, string>;
  output: string;
  assertions: AssertionResult[];
  passed: boolean;
  duration: number;
  tokens?: TokenUsage;
  cost?: number;
}

// ── Snapshot ─────────────────────────────────────────────────────────────────

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

// ── Diff ─────────────────────────────────────────────────────────────────────

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

// ── Project Config ──────────────────────────────────────────────────────────

export interface PromptLockProjectConfig {
  promptsDir: string;
  snapshotDir: string;
  reportDir: string;
  defaultProvider: string;
  defaultModel?: string;
  ci: {
    failOnRegression: boolean;
    reportFormat: ('json' | 'html' | 'markdown')[];
  };
}

// ── Provider Interface ──────────────────────────────────────────────────────

export interface LLMProvider {
  call(prompt: string, options?: PromptLockOptions & { model?: string }): Promise<string>;
  callWithMeta?(prompt: string, options?: PromptLockOptions & { model?: string }): Promise<LLMCallResult>;
}
