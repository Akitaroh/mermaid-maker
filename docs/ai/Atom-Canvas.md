# AI実装メモ: Atom-Canvas

**設計**: `../../../50_Mission/Mermaid Maker/Atom-Canvas.md`

---

## ファイル配置

```
src/canvas/canvas.tsx          ← メイン Component
src/canvas/nodes.tsx            ← カスタムノード4種
src/canvas/edges.tsx            ← カスタムエッジ（自己ループ）
src/canvas/canvas.css           ← ノード/エッジのスタイル
```

## 決定log

### @xyflow/react を使う

- `react-flow-renderer` は古い、現行は `@xyflow/react`
- v12 以降は context provider が組み込み

### カスタムノードの実装方針

4種:
- `circle`: SVG circle で描画（`<circle>` 要素 + ラベル）
- `doubleCircle`: 2つの円で描画
- `box`: `<rect>` + ラベル
- `rounded`: 角丸の rect

reactflow のノード型は `type` 文字列で振り分ける。

### 自己ループエッジ

reactflow は自己ループに対応してないので、独自カスタムエッジ:
- ノード位置から SVG path で円弧を描く
- ラベルを円弧の上部に配置

### Props と State の流れ

`Canvas` は受け身:
- `graph`, `positions` を props で受ける
- ドラッグ完了で `onPositionsChange` を呼ぶ（全 PositionMap を投げ返す）

reactflow の内部 state（zoom, pan）は Canvas 内部で持つ。`positions` の変更は外部から制御。

## 実装の要点

1. graph + positions → reactflow の `nodes`/`edges` に変換
2. `nodeTypes` でカスタムノード登録
3. `edgeTypes` で `selfLoop` 登録
4. `onNodeDragStop` でドラッグ完了 → `positions` 更新
