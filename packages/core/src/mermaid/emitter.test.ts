import { describe, it, expect } from 'vitest';
import { emitMermaid } from './emitter';
import { parseMermaid } from './parser';
import type { Graph } from '../types/schema';

describe('emitMermaid', () => {
  it('最小', () => {
    const graph: Graph = {
      direction: 'LR',
      nodes: [
        { id: 'A', label: 'A', shape: 'box' },
        { id: 'B', label: 'B', shape: 'box' },
      ],
      edges: [{ id: 'e0', source: 'A', target: 'B' }],
    };
    const out = emitMermaid(graph, {});
    expect(out).toContain('graph LR');
    expect(out).toContain('A --> B');
  });

  it('ラベル付きエッジ + 円ノード', () => {
    const graph: Graph = {
      direction: 'LR',
      nodes: [
        { id: 'q0', label: 'q0', shape: 'circle' },
        { id: 'q1', label: 'q1', shape: 'doubleCircle' },
      ],
      edges: [{ id: 'e0', source: 'q0', target: 'q1', label: 'a' }],
    };
    const out = emitMermaid(graph, {});
    expect(out).toContain('q0((q0))');
    expect(out).toContain('q1(((q1)))');
    expect(out).toContain('q0 -->|a| q1');
  });

  it('座標コメント', () => {
    const graph: Graph = {
      direction: 'LR',
      nodes: [{ id: 'A', label: 'A', shape: 'box' }],
      edges: [],
    };
    const out = emitMermaid(graph, { A: { x: 100, y: 200 } });
    expect(out).toContain('%% mm-pos: A=100,200');
  });

  it('ラウンドトリップ: parse → emit → parse', () => {
    const text = `graph LR
    q0((q0))
    q1(((q1)))
    q0 -->|a, b| q0
    q0 -->|b| q1
%% mm-pos: q0=100,200 q1=300,200`;
    const r1 = parseMermaid(text);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const out = emitMermaid(r1.graph, r1.positions);
    const r2 = parseMermaid(out);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.graph.direction).toBe(r1.graph.direction);
    expect(r2.graph.nodes).toHaveLength(r1.graph.nodes.length);
    expect(r2.graph.edges).toHaveLength(r1.graph.edges.length);
    expect(r2.positions).toEqual(r1.positions);
  });
});
