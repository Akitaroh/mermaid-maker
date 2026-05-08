# AI実装メモ: Atom-GraphOps

**設計**: `../../../50_Mission/Mermaid Maker/Atom-GraphOps.md`

---

## ファイル配置

```
src/graph/graph-ops.ts
src/graph/graph-ops.test.ts
```

`src/graph/` を新設（既存 `src/store/` とは別）。Graph 構造の操作と座標管理を分離する意図。

## 決定log

### ID 生成: 既存 ID をスキャンして衝突回避

```typescript
function generateNodeId(graph: Graph): string {
  const used = new Set(graph.nodes.map(n => n.id));
  let i = 0;
  while (used.has(`n${i}`)) i++;
  return `n${i}`;
}
```

Counter を Graph 内に持たない（純関数を維持するため）。ノード数が膨大になったら工夫するが、Phase 3 では十分。

### removeNode の連鎖削除

ノードを削除する時、source/target が一致するエッジも削除。

```typescript
function removeNode(graph, id) {
  return {
    ...graph,
    nodes: graph.nodes.filter(n => n.id !== id),
    edges: graph.edges.filter(e => e.source !== id && e.target !== id),
  };
}
```

### updateNode/updateEdge: spread で patch

```typescript
function updateNode(graph, id, patch) {
  return {
    ...graph,
    nodes: graph.nodes.map(n => n.id === id ? { ...n, ...patch } : n),
  };
}
```

ID は patch で変更しない（ID 変更は別関数として後付けする想定、Phase 3 では未対応）。

### toggleAcceptState の挙動

box / rounded には何もしない（受理状態の概念がない）。

```typescript
function toggleAcceptState(graph, id) {
  const node = graph.nodes.find(n => n.id === id);
  if (!node) return graph;
  let nextShape: NodeShape;
  if (node.shape === 'circle') nextShape = 'doubleCircle';
  else if (node.shape === 'doubleCircle') nextShape = 'circle';
  else return graph;  // box / rounded は変化なし
  return updateNode(graph, id, { shape: nextShape });
}
```

## 実装の要点

- すべての関数が新しい Graph オブジェクトを返す（不変性）
- 入力 Graph が変化しないことをテストで保証
