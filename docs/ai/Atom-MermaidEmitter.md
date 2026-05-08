# AI実装メモ: Atom-MermaidEmitter

**設計**: `../../../50_Mission/Mermaid Maker/Atom-MermaidEmitter.md`

---

## ファイル配置

```
src/mermaid/emitter.ts
```

## 決定log

### インデント

ノード行・エッジ行は 4 スペースインデント（Mermaid 慣習）。
コメント行（mm-pos）はインデントなし（行頭から `%%`）。

### 出力するノードの順序

`graph.nodes` の順をそのまま使う（parser が登場順で push しているので、入力順が保たれる）。

### ノード行を**先に出すか**エッジに**インライン化**するか

例:
```
A((q0))
B(((q1)))
A -->|a| B
```
vs
```
A((q0)) -->|a| B(((q1)))
```

**Phase 2 では「ノード単独行を先に列挙」方式**を採用。理由:
- emitter のロジックがシンプル
- ラウンドトリップ性が保証しやすい
- ノードが孤立していてもテキストに残る

### ラベルとエッジ ID

エッジ ID は内部表現のみで Mermaid テキストには出さない（[parser メモ参照](./Atom-MermaidParser.md)）。

## 実装の要点

1. `graph LR` ヘッダ
2. 各ノードを `${id}${shape形式の括弧+label}` で列挙
3. 各エッジを `${source} --> ${target}` または `${source} -->|${label}| ${target}` で列挙
4. positions が空でなければ末尾に `formatPositionComment(positions)` を追加
