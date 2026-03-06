import { describe, it, expect } from 'vitest';
import { parseYaml } from '../watcher/yaml-mini.js';

describe('yaml-mini', () => {
  it('parses flat key: value pairs', () => {
    const result = parseYaml(`id: abc-123
cwd: /Users/test/project
branch: main
summary: Some task description`);
    expect(result).toEqual({
      id: 'abc-123',
      cwd: '/Users/test/project',
      branch: 'main',
      summary: 'Some task description',
    });
  });

  it('skips comments and empty lines', () => {
    const result = parseYaml(`# comment
id: test

cwd: /tmp`);
    expect(result).toEqual({ id: 'test', cwd: '/tmp' });
  });

  it('handles colon in value', () => {
    const result = parseYaml('url: http://localhost:3000');
    expect(result).toEqual({ url: 'http://localhost:3000' });
  });

  it('returns empty object for empty string', () => {
    expect(parseYaml('')).toEqual({});
  });
});
