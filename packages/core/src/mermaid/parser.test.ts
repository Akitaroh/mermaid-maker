import { describe, it, expect } from 'vitest';
import { parseMermaid } from './parser';

describe('parseMermaid', () => {
  it('最小の有向グラフ', () => {
    const result = parseMermaid('graph LR\nA-->B');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.direction).toBe('LR');
    expect(result.graph.nodes).toEqual([
      { id: 'A', label: 'A', shape: 'box' },
      { id: 'B', label: 'B', shape: 'box' },
    ]);
    expect(result.graph.edges).toHaveLength(1);
    expect(result.graph.edges[0].source).toBe('A');
    expect(result.graph.edges[0].target).toBe('B');
  });

  it('ノード形状: 円・二重円', () => {
    const result = parseMermaid(`graph LR
q0((q0)) -->|a| q1(((q1)))`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const q0 = result.graph.nodes.find((n) => n.id === 'q0');
    const q1 = result.graph.nodes.find((n) => n.id === 'q1');
    expect(q0?.shape).toBe('circle');
    expect(q1?.shape).toBe('doubleCircle');
    expect(result.graph.edges[0].label).toBe('a');
  });

  it('座標コメント抽出', () => {
    const result = parseMermaid(`graph LR
A((q0)) -->|a| B(((q1)))
%% mm-pos: A=100,200 B=300,200`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.positions).toEqual({
      A: { x: 100, y: 200 },
      B: { x: 300, y: 200 },
    });
  });

  it('自己ループ', () => {
    const result = parseMermaid(`graph LR
q0((q0)) -->|a, b| q0`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.edges).toHaveLength(1);
    expect(result.graph.edges[0].source).toBe('q0');
    expect(result.graph.edges[0].target).toBe('q0');
    expect(result.graph.edges[0].label).toBe('a, b');
  });

  it('ヘッダなしはエラー', () => {
    const result = parseMermaid('A-->B');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.line).toBe(1);
  });

  it('TD ヘッダ', () => {
    const result = parseMermaid('graph TD\nA-->B');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.direction).toBe('TD');
  });

  it('複数エッジで同じノードが出てきても1つにまとまる', () => {
    const result = parseMermaid(`graph LR
A((a-label)) --> B
A --> C`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.graph.nodes.filter((n) => n.id === 'A')).toHaveLength(1);
    expect(result.graph.edges).toHaveLength(2);
  });
});
