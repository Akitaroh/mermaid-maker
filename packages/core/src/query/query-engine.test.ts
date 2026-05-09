import { describe, expect, it } from 'vitest';
import {
  findPath,
  graphStats,
  listEdges,
  listNodes,
  neighbors,
  validate,
} from './query-engine.js';
import type { Graph } from '../types/schema.js';

const G = (nodes: string[], edges: Array<[string, string, string?]>): Graph => ({
  direction: 'LR',
  nodes: nodes.map((id) => ({ id, label: id, shape: 'box' as const })),
  edges: edges.map(([s, t, l], i) => {
    const e: Graph['edges'][number] = { id: `e${i}`, source: s, target: t };
    if (l !== undefined) e.label = l;
    return e;
  }),
});

describe('listNodes', () => {
  it('returns all nodes with id/label/shape', () => {
    const g = G(['a', 'b'], []);
    expect(listNodes(g)).toEqual([
      { id: 'a', label: 'a', shape: 'box' },
      { id: 'b', label: 'b', shape: 'box' },
    ]);
  });
});

describe('listEdges', () => {
  it('omits label when undefined, includes when present', () => {
    const g = G(['a', 'b'], [['a', 'b'], ['a', 'b', 'lbl']]);
    expect(listEdges(g)).toEqual([
      { from: 'a', to: 'b' },
      { from: 'a', to: 'b', label: 'lbl' },
    ]);
  });
});

describe('findPath', () => {
  it('returns the only direct path', () => {
    const g = G(['a', 'b'], [['a', 'b']]);
    expect(findPath(g, 'a', 'b').paths).toEqual([['a', 'b']]);
  });

  it('returns multiple paths when graph allows', () => {
    // a → b → d, a → c → d
    const g = G(
      ['a', 'b', 'c', 'd'],
      [
        ['a', 'b'],
        ['b', 'd'],
        ['a', 'c'],
        ['c', 'd'],
      ]
    );
    const r = findPath(g, 'a', 'd');
    expect(r.paths.length).toBe(2);
    const sorted = r.paths.map((p) => p.join('-')).sort();
    expect(sorted).toEqual(['a-b-d', 'a-c-d']);
  });

  it('returns empty when no path exists', () => {
    const g = G(['a', 'b'], []);
    expect(findPath(g, 'a', 'b').paths).toEqual([]);
  });

  it('handles cycles without infinite loop (visited set)', () => {
    // a → b → a → ... but we want a → c
    const g = G(
      ['a', 'b', 'c'],
      [
        ['a', 'b'],
        ['b', 'a'],
        ['a', 'c'],
      ]
    );
    const r = findPath(g, 'a', 'c');
    expect(r.paths).toEqual([['a', 'c']]);
  });

  it('respects maxPaths cap and reports truncated', () => {
    // Build a graph with many parallel paths a → mid_i → z (4 paths)
    const g = G(
      ['a', 'm1', 'm2', 'm3', 'm4', 'z'],
      [
        ['a', 'm1'],
        ['a', 'm2'],
        ['a', 'm3'],
        ['a', 'm4'],
        ['m1', 'z'],
        ['m2', 'z'],
        ['m3', 'z'],
        ['m4', 'z'],
      ]
    );
    const r = findPath(g, 'a', 'z', { maxPaths: 2 });
    expect(r.paths.length).toBeLessThanOrEqual(2);
    expect(r.truncated).toBe(true);
  });

  it('returns empty for unknown from or to', () => {
    const g = G(['a', 'b'], [['a', 'b']]);
    expect(findPath(g, 'ghost', 'b').paths).toEqual([]);
    expect(findPath(g, 'a', 'ghost').paths).toEqual([]);
  });

  it('from === to returns the trivial single-node path', () => {
    const g = G(['a'], []);
    expect(findPath(g, 'a', 'a').paths).toEqual([['a']]);
  });
});

describe('neighbors', () => {
  it('separates incoming and outgoing', () => {
    const g = G(
      ['a', 'b', 'c'],
      [
        ['a', 'b'],
        ['c', 'b'],
        ['b', 'a'],
      ]
    );
    expect(neighbors(g, 'b')).toEqual({ in: ['a', 'c'], out: ['a'] });
  });

  it('returns empty arrays for isolated node', () => {
    const g = G(['a'], []);
    expect(neighbors(g, 'a')).toEqual({ in: [], out: [] });
  });

  it('deduplicates parallel edges', () => {
    // Two edges a→b
    const g: Graph = {
      direction: 'LR',
      nodes: [
        { id: 'a', label: 'a', shape: 'box' },
        { id: 'b', label: 'b', shape: 'box' },
      ],
      edges: [
        { id: 'e0', source: 'a', target: 'b' },
        { id: 'e1', source: 'a', target: 'b' },
      ],
    };
    expect(neighbors(g, 'a')).toEqual({ in: [], out: ['b'] });
  });
});

describe('validate', () => {
  it('clean graph is valid with no errors/warnings', () => {
    const g = G(['a', 'b'], [['a', 'b']]);
    const r = validate(g);
    expect(r).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('detects duplicate node ids', () => {
    const g: Graph = {
      direction: 'LR',
      nodes: [
        { id: 'a', label: 'A', shape: 'box' },
        { id: 'a', label: 'A2', shape: 'box' },
      ],
      edges: [],
    };
    const r = validate(g);
    expect(r.valid).toBe(false);
    expect(r.errors[0]?.kind).toBe('duplicate_node');
  });

  it('detects edges to unknown nodes', () => {
    const g: Graph = {
      direction: 'LR',
      nodes: [{ id: 'a', label: 'a', shape: 'box' }],
      edges: [{ id: 'e0', source: 'a', target: 'ghost' }],
    };
    const r = validate(g);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.kind === 'unknown_node')).toBe(true);
  });

  it('warns on isolated nodes but stays valid', () => {
    const g = G(['a', 'b', 'c'], [['a', 'b']]);
    const r = validate(g);
    expect(r.valid).toBe(true);
    expect(r.warnings.length).toBe(1);
    expect(r.warnings[0]?.nodeId).toBe('c');
  });
});

describe('graphStats', () => {
  it('counts nodes and edges', () => {
    const g = G(['a', 'b'], [['a', 'b']]);
    const s = graphStats(g);
    expect(s.nodeCount).toBe(2);
    expect(s.edgeCount).toBe(1);
    expect(s.isConnected).toBe(true);
  });

  it('disconnected components → isConnected false', () => {
    const g = G(['a', 'b', 'c'], [['a', 'b']]);
    expect(graphStats(g).isConnected).toBe(false);
  });

  it('empty graph is trivially connected', () => {
    expect(graphStats(G([], []))).toEqual({
      nodeCount: 0,
      edgeCount: 0,
      isConnected: true,
    });
  });
});
