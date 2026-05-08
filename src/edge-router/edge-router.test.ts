import { describe, it, expect } from 'vitest';
import { computeEdgeOffsets } from './edge-router';
import type { Edge } from '../types/schema';

describe('computeEdgeOffsets', () => {
  it('単独エッジ: offset = 0', () => {
    const edges: Edge[] = [{ id: 'e0', source: 'A', target: 'B' }];
    expect(computeEdgeOffsets(edges)).toEqual({ e0: 0 });
  });

  it('平行 2 本: ±1', () => {
    const edges: Edge[] = [
      { id: 'e0', source: 'A', target: 'B' },
      { id: 'e1', source: 'A', target: 'B' },
    ];
    const out = computeEdgeOffsets(edges);
    expect(out.e0).toBe(1);
    expect(out.e1).toBe(-1);
  });

  it('平行 3 本: 0, +1, -1', () => {
    const edges: Edge[] = [
      { id: 'e0', source: 'A', target: 'B' },
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'A', target: 'B' },
    ];
    const out = computeEdgeOffsets(edges);
    expect(out.e0).toBe(0);
    expect(out.e1).toBe(1);
    expect(out.e2).toBe(-1);
  });

  it('A→B と B→A は対向エッジとして反対側に配置', () => {
    const edges: Edge[] = [
      { id: 'e0', source: 'A', target: 'B' },
      { id: 'e1', source: 'B', target: 'A' },
    ];
    const out = computeEdgeOffsets(edges);
    // e0 は canonical (A<B): lane=+1 → offset=+1 → screen 下
    // e1 は reverse (B>A): lane=-1 → offset=+1 → perpendicular flip 後 screen 上
    expect(out.e0).toBe(1);
    expect(out.e1).toBe(1);
  });

  it('A→B 2本 + B→A 1本 は別 lane に並ぶ', () => {
    const edges: Edge[] = [
      { id: 'e0', source: 'A', target: 'B' },
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'A' },
    ];
    const out = computeEdgeOffsets(edges);
    // sorted by id: e0, e1, e2. lanes: 0, +1, -1
    // e0 canonical, lane 0 → offset 0
    // e1 canonical, lane +1 → offset +1 (screen 下)
    // e2 reverse, lane -1 → offset +1 (perpendicular flip → screen 上)
    expect(out.e0).toBe(0);
    expect(out.e1).toBe(1);
    expect(out.e2).toBe(1);
  });

  it('自己ループ複数: 0, 1, 2', () => {
    const edges: Edge[] = [
      { id: 'e0', source: 'A', target: 'A' },
      { id: 'e1', source: 'A', target: 'A' },
      { id: 'e2', source: 'A', target: 'A' },
    ];
    const out = computeEdgeOffsets(edges);
    expect(out.e0).toBe(0);
    expect(out.e1).toBe(1);
    expect(out.e2).toBe(2);
  });

  it('異なるペアは独立', () => {
    const edges: Edge[] = [
      { id: 'e0', source: 'A', target: 'B' },
      { id: 'e1', source: 'C', target: 'D' },
    ];
    expect(computeEdgeOffsets(edges)).toEqual({ e0: 0, e1: 0 });
  });
});
