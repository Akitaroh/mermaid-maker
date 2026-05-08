# AI実装メモ: Atom-Canvas (Phase 3 拡張)

**設計**: `../../../50_Mission/Mermaid Maker/Atom-Canvas.md`

---

## 追加ファイル

```
src/canvas/canvas.tsx          ← 拡張: ツールバー + onGraphChange + onConnect + キーボード
src/canvas/nodes.tsx            ← 拡張: ダブルクリックで inline label 編集
src/canvas/edges.tsx            ← 拡張: ラベル編集 + クリック選択
src/canvas/canvas.css           ← ツールバー、選択ハイライト
```

## 決定log

### onGraphChange を受け取る後方互換 API

```typescript
type CanvasProps = {
  graph: Graph;
  positions: PositionMap;
  onPositionsChange: (next: PositionMap) => void;
  onGraphChange?: (next: Graph) => void;  // 追加（optional）
};
```

未指定なら Phase 2 と同じ「表示・ドラッグだけ」のモード。

### コールバックを reactflow ノードに伝える

reactflow の `data` field 経由で callback を渡す:

```typescript
const rfNodes = graph.nodes.map(n => ({
  id: n.id,
  type: n.shape,
  data: {
    label: n.label,
    onLabelChange: onGraphChange ? (newLabel) => onGraphChange(updateNode(graph, n.id, { label: newLabel })) : undefined,
  },
  position: positions[n.id] ?? { x: 0, y: 0 },
}));
```

ノードコンポーネントは `data.onLabelChange` の有無で編集可能か判定。

### inline label 編集

ダブルクリック → useState で `editing: true` → input 表示 → Enter or onBlur で確定 / Escape でキャンセル。

```tsx
function CircleNode({ data }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);

  return (
    <div onDoubleClick={() => data.onLabelChange && setEditing(true)}>
      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { data.onLabelChange?.(draft); setEditing(false); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { data.onLabelChange?.(draft); setEditing(false); }
            if (e.key === 'Escape') { setDraft(data.label); setEditing(false); }
          }}
          autoFocus
        />
      ) : (
        <text>{data.label}</text>
      )}
    </div>
  );
}
```

### onConnect でエッジ追加

reactflow の `<ReactFlow onConnect={...}>` プロパティ:

```typescript
const onConnect = (conn: Connection) => {
  if (!onGraphChange) return;
  if (!conn.source || !conn.target) return;
  const { graph: next } = addEdge(graph, { source: conn.source, target: conn.target });
  onGraphChange(next);
};
```

### 削除（Delete / Backspace キー）

reactflow の `deleteKeyCode={['Delete', 'Backspace']}` を有効化。
削除時 onNodesChange / onEdgesChange に `type: 'remove'` の change が来るので、それを onGraphChange に変換。

### ツールバー

Canvas の上部に絶対配置:
- 「+ ノード」ボタン → addNode + 画面中央位置を positions に
- 「受理」ボタン → 選択中のノードに toggleAcceptState
- 選択中の id 表示

選択状態は reactflow の `selected: true` change で取得。Canvas 内部 state で保持。

## 実装の要点

1. `Canvas` を edit mode 対応に拡張（onGraphChange の有無で分岐）
2. カスタムノード/エッジに `data.onXxx` 経由でコールバックを渡す
3. ツールバーは Canvas 内の絶対配置（FSM 特化の操作集約点）
4. キーボード削除は reactflow のビルトイン機能を使う
