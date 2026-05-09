import { describe, it, expect } from 'vitest';
import {
  addNode,
  addEdge,
  updateNode,
  updateEdge,
  removeNode,
  removeEdge,
  toggleAcceptState,
  generateNodeId,
  generateEdgeId,
} from './graph-ops';
import type { Graph } from '../types/schema';

const empty: Graph = { direction: 'LR', nodes: [], edges: [] };

describe('graph-ops', () => {
  describe('addNode', () => {
    it('空 graph にノード追加', () => {
      const { graph, node } = addNode(empty, { label: 'q0', shape: 'circle' });
      expect(graph.nodes).toHaveLength(1);
      expect(node.id).toBe('n0');
      expect(node.label).toBe('q0');
      expect(node.shape).toBe('circle');
    });

    it('連続追加で id が衝突しない', () => {
      const a = addNode(empty, {});
      const b = addNode(a.graph, {});
      expect(a.node.id).toBe('n0');
      expect(b.node.id).toBe('n1');
    });

    it('入力 graph が破壊されない', () => {
      addNode(empty, { label: 'X' });
      expect(empty.nodes).toHaveLength(0);
    });

    it('id 指定衝突時は自動採番', () => {
      const a = addNode(empty, { id: 'n0' });
      const b = addNode(a.graph, { id: 'n0' }); // 衝突
      expect(b.node.id).toBe('n1');
    });
  });

  describe('addEdge', () => {
    it('エッジ追加', () => {
      const { graph: g1 } = addNode(empty, {});
      const { graph: g2 } = addNode(g1, {});
      const { graph: g3, edge } = addEdge(g2, { source: 'n0', target: 'n1', label: 'a' });
      expect(g3.edges).toHaveLength(1);
      expect(edge.id).toBe('e0');
      expect(edge.label).toBe('a');
    });

    it('label 未指定なら label プロパティが付かない', () => {
      const { graph } = addEdge(empty, { source: 'a', target: 'b' });
      expect(graph.edges[0].label).toBeUndefined();
    });
  });

  describe('updateNode', () => {
    it('label 変更', () => {
      const { graph: g1 } = addNode(empty, { label: 'old' });
      const g2 = updateNode(g1, 'n0', { label: 'new' });
      expect(g2.nodes[0].label).toBe('new');
      expect(g2.nodes[0].shape).toBe('circle'); // shape は不変
    });

    it('存在しない id はそのまま', () => {
      const { graph: g1 } = addNode(empty, {});
      const g2 = updateNode(g1, 'nonexistent', { label: 'X' });
      expect(g2).toEqual(g1);
    });
  });

  describe('removeNode', () => {
    it('ノード削除 + 接続エッジも削除', () => {
      const { graph: g1 } = addNode(empty, {});
      const { graph: g2 } = addNode(g1, {});
      const { graph: g3 } = addEdge(g2, { source: 'n0', target: 'n1' });
      const g4 = removeNode(g3, 'n0');
      expect(g4.nodes).toHaveLength(1);
      expect(g4.nodes[0].id).toBe('n1');
      expect(g4.edges).toHaveLength(0);
    });
  });

  describe('removeEdge', () => {
    it('特定エッジ削除', () => {
      const { graph: g1 } = addEdge(empty, { source: 'a', target: 'b' });
      const { graph: g2 } = addEdge(g1, { source: 'a', target: 'c' });
      const g3 = removeEdge(g2, 'e0');
      expect(g3.edges).toHaveLength(1);
      expect(g3.edges[0].id).toBe('e1');
    });
  });

  describe('toggleAcceptState', () => {
    it('circle → doubleCircle', () => {
      const { graph } = addNode(empty, { shape: 'circle' });
      const next = toggleAcceptState(graph, 'n0');
      expect(next.nodes[0].shape).toBe('doubleCircle');
    });

    it('doubleCircle → circle', () => {
      const { graph } = addNode(empty, { shape: 'doubleCircle' });
      const next = toggleAcceptState(graph, 'n0');
      expect(next.nodes[0].shape).toBe('circle');
    });

    it('box は変化なし', () => {
      const { graph } = addNode(empty, { shape: 'box' });
      const next = toggleAcceptState(graph, 'n0');
      expect(next.nodes[0].shape).toBe('box');
    });

    it('存在しない id は変化なし', () => {
      const next = toggleAcceptState(empty, 'nonexistent');
      expect(next).toEqual(empty);
    });
  });

  describe('updateEdge', () => {
    it('label 追加・変更', () => {
      const { graph: g1 } = addEdge(empty, { source: 'a', target: 'b' });
      const g2 = updateEdge(g1, 'e0', { label: 'a' });
      expect(g2.edges[0].label).toBe('a');
    });
  });

  describe('generateNodeId / generateEdgeId', () => {
    it('衝突を避ける', () => {
      const { graph: g1 } = addNode(empty, { id: 'n0' });
      expect(generateNodeId(g1)).toBe('n1');
    });

    it('連番でなくても穴を埋める', () => {
      const { graph: g1 } = addNode(empty, { id: 'n0' });
      const { graph: g2 } = addNode(g1, { id: 'n2' });
      expect(generateNodeId(g2)).toBe('n1');
    });

    it('edge も同様', () => {
      const { graph } = addEdge(empty, { id: 'e0', source: 'a', target: 'b' });
      expect(generateEdgeId(graph)).toBe('e1');
    });
  });
});
