# AI実装メモ: Atom-Layout

**設計**: `../../../50_Mission/Mermaid Maker/Atom-Layout.md`

---

## ファイル配置

```
src/canvas/layout.ts
```

## 決定log

### dagre のセットアップ

- `dagre.graphlib.Graph()` でグラフ構築
- `setGraph({ rankdir, nodesep, ranksep })` で方向と間隔指定
- ノードサイズは固定値（width: 80, height: 40）。reactflow の表示と一致させる
- 自己ループは dagre に渡さない（dagre は自己ループの座標を返さないため）

### 既存座標の保持

dagre には**そもそも fixed position 機能がない**ので、自前で対応:
1. dagre に全ノードを渡してレイアウト
2. dagre 結果を PositionMap に変換
3. `existing` の値で上書き（既存座標があるノードは dagre の結果を捨てる）

これは「既存ノードの位置に他のノードが寄ってしまう」問題があるが、Phase 2 では妥協（Phase 3 で改善）。

### 自己ループの扱い

- 自己ループ自体は dagre に渡さない
- ノード位置は他のエッジから計算される
- reactflow 側で自己ループを描く（カスタムエッジで対応）

### LayoutOptions のデフォルト

```typescript
{
  direction: graph.direction,
  nodeSpacing: 100,
  rankSpacing: 150,
  selfLoopOffset: 60,
}
```

## 実装の要点

1. dagre グラフ作成
2. 自己ループでないエッジだけ dagre に渡す
3. layout 実行
4. dagre 結果 → PositionMap 変換
5. `existing` で上書き
