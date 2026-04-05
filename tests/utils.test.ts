import { renderTemplate, hashString } from '../src/utils';

describe('renderTemplate', () => {
  it('replaces single variable', () => {
    const result = renderTemplate('Hello {{name}}!', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('replaces multiple variables', () => {
    const result = renderTemplate('{{greeting}} {{name}}!', {
      greeting: 'Hi',
      name: 'Alice',
    });
    expect(result).toBe('Hi Alice!');
  });

  it('replaces same variable multiple times', () => {
    const result = renderTemplate('{{x}} and {{x}}', { x: 'yes' });
    expect(result).toBe('yes and yes');
  });

  it('leaves unknown variables unchanged', () => {
    const result = renderTemplate('Hello {{name}} {{unknown}}!', { name: 'World' });
    expect(result).toBe('Hello World {{unknown}}!');
  });

  it('handles empty variables object', () => {
    const result = renderTemplate('Hello {{name}}!', {});
    expect(result).toBe('Hello {{name}}!');
  });

  it('handles template with no variables', () => {
    const result = renderTemplate('No variables here', { name: 'ignored' });
    expect(result).toBe('No variables here');
  });

  it('handles empty string values', () => {
    const result = renderTemplate('Hello {{name}}!', { name: '' });
    expect(result).toBe('Hello !');
  });
});

describe('hashString', () => {
  it('returns a hex string', () => {
    const hash = hashString('hello');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns consistent hashes for same input', () => {
    const hash1 = hashString('test input');
    const hash2 = hashString('test input');
    expect(hash1).toBe(hash2);
  });

  it('returns different hashes for different inputs', () => {
    const hash1 = hashString('input a');
    const hash2 = hashString('input b');
    expect(hash1).not.toBe(hash2);
  });

  it('handles empty string', () => {
    const hash = hashString('');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
