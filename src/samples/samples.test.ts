import { describe, it, expect } from 'vitest';
import { SAMPLES, getSample } from './samples';
import { parseMermaid } from '../mermaid/parser';

describe('SAMPLES', () => {
  it('複数のサンプルがある', () => {
    expect(SAMPLES.length).toBeGreaterThanOrEqual(3);
  });

  it('各サンプルが parseMermaid で ok', () => {
    for (const sample of SAMPLES) {
      const result = parseMermaid(sample.text);
      expect(result.ok, `sample "${sample.id}" failed to parse`).toBe(true);
    }
  });

  it('getSample で id 検索', () => {
    expect(getSample('flowchart-basic')?.title).toBe('基本フローチャート');
    expect(getSample('nonexistent')).toBeUndefined();
  });
});
