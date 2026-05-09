import { describe, it, expect } from 'vitest';
import { fillMissingPositions } from './layout';
import type { Graph } from '@akitaroh/mermaid-core';

describe('fillMissingPositions', () => {
  it('全ノードに座標が割り当てられる', () => {
    const graph: Graph = {
      direction: 'LR',
      nodes: [
        { id: 'A', label: 'A', shape: 'box' },
        { id: 'B', label: 'B', shape: 'box' },
      ],
      edges: [{ id: 'e0', source: 'A', target: 'B' }],
    };
    const result = fillMissingPositions(graph, {});
    expect(result.A).toBeDefined();
    expect(result.B).toBeDefined();
    expect(Number.isFinite(result.A.x)).toBe(true);
    expect(Number.isFinite(result.A.y)).toBe(true);
  });

  it('既存座標が保持される', () => {
    const graph: Graph = {
      direction: 'LR',
      nodes: [
        { id: 'A', label: 'A', shape: 'box' },
        { id: 'B', label: 'B', shape: 'box' },
      ],
      edges: [{ id: 'e0', source: 'A', target: 'B' }],
    };
    const result = fillMissingPositions(graph, { A: { x: 0, y: 0 } });
    expect(result.A).toEqual({ x: 0, y: 0 });
    expect(result.B).toBeDefined();
  });

  it('自己ループでも例外なし', () => {
    const graph: Graph = {
      direction: 'LR',
      nodes: [{ id: 'A', label: 'A', shape: 'box' }],
      edges: [{ id: 'e0', source: 'A', target: 'A' }],
    };
    const result = fillMissingPositions(graph, {});
    expect(result.A).toBeDefined();
  });

  it('ノード0個', () => {
    const graph: Graph = { direction: 'LR', nodes: [], edges: [] };
    expect(fillMissingPositions(graph, {})).toEqual({});
  });
});
