import { LLMProvider, PromptLockOptions, CustomProviderConfig } from '../types';
import * as https from 'https';
import * as http from 'http';

export function createCustomProvider(config: CustomProviderConfig): LLMProvider {
  return {
    async call(prompt: string, options?: PromptLockOptions & { model?: string }): Promise<string> {
      const body = config.bodyTemplate
        ? JSON.stringify(replaceInObject(config.bodyTemplate, { prompt, model: options?.model ?? '' }))
        : JSON.stringify({
            model: options?.model ?? '',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: options?.maxTokens ?? 1024,
            temperature: options?.temperature,
          });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...config.headers,
      };

      const controller = options?.timeout ? new AbortController() : undefined;
      const timer = controller
        ? setTimeout(() => controller.abort(), options!.timeout)
        : undefined;

      try {
        const responseBody = await httpRequest(config.url, {
          method: 'POST',
          headers,
          body,
          signal: controller?.signal,
        });

        const json = JSON.parse(responseBody);
        return extractResponse(json, config.responsePath);
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          throw new Error(`Custom provider call timed out after ${options!.timeout}ms`);
        }
        throw new Error(`Custom provider error: ${(e as Error).message}`);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}

function extractResponse(json: any, responsePath?: string): string {
  if (responsePath) {
    const parts = responsePath.split('.');
    let value = json;
    for (const part of parts) {
      if (value == null) return '';
      // Handle array index like "choices[0]"
      const match = part.match(/^(\w+)\[(\d+)\]$/);
      if (match) {
        value = value[match[1]]?.[parseInt(match[2])];
      } else {
        value = value[part];
      }
    }
    return typeof value === 'string' ? value : JSON.stringify(value ?? '');
  }

  // Auto-detect common response formats
  // OpenAI-compatible
  if (json.choices?.[0]?.message?.content) {
    return json.choices[0].message.content;
  }
  // Anthropic-compatible
  if (json.content?.[0]?.text) {
    return json.content[0].text;
  }
  // Ollama
  if (json.response) {
    return json.response;
  }
  // Generic: message field
  if (json.message?.content) {
    return json.message.content;
  }
  // Last resort: full JSON
  if (typeof json === 'string') return json;
  return JSON.stringify(json);
}

function replaceInObject(obj: Record<string, unknown>, vars: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = value.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'object' && item !== null
          ? replaceInObject(item as Record<string, unknown>, vars)
          : typeof item === 'string'
            ? item.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
            : item,
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = replaceInObject(value as Record<string, unknown>, vars);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function httpRequest(url: string, opts: {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const transport = urlObj.protocol === 'https:' ? https : http;

    const req = transport.request(urlObj, {
      method: opts.method,
      headers: {
        ...opts.headers,
        'Content-Length': Buffer.byteLength(opts.body).toString(),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        } else {
          resolve(data);
        }
      });
    });

    req.on('error', reject);

    if (opts.signal) {
      opts.signal.addEventListener('abort', () => {
        req.destroy();
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }

    req.write(opts.body);
    req.end();
  });
}
