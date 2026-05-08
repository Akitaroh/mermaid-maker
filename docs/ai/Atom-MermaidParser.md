# AI実装メモ: Atom-MermaidParser

**設計**: `../../../50_Mission/Mermaid Maker/Atom-MermaidParser.md`

---

## ファイル配置

```
src/mermaid/parser.ts
```

## 決定log

### mermaid 公式パッケージは使わない（Phase 2）

理由:
- mermaid v10 系の `parse()` API はブラウザバンドル前提で扱いにくい
- Phase 2 は `graph LR/TD` の単純構文のみサポートで十分
- 自前 parser の方が**依存軽量・テスト容易・エラーメッセージ自由**

→ Phase 2 は**自前の正規表現ベース parser** で実装。Phase 4 以降で stateDiagram 等の複雑構文に手を広げる時に mermaid 本体導入を再検討。

### 構文サポート（Phase 2）

サポートする構文（最小集合）:

```
graph LR        ← ヘッダ
graph TD

A((label))      ← 円ノード
A(((label)))    ← 二重円
A[label]        ← 箱
A(label)        ← 角丸（() のみは ambiguous なので除外、必要なら別途）
A               ← 形状未指定（box 扱い）

A --> B         ← 矢印（ラベルなし）
A -->|label| B  ← 矢印（ラベルあり）

%% comment      ← コメント（無視、ただし mm-pos: は別途抽出）
```

### ノード ID と形状の対応

ノードは「最初に出現した時点で形状を確定」させる:
- `A((q0)) --> B` の A は circle、label は q0
- `A --> B` のみで A が出てきたら、形状は box（既定）、label は A

同じノード ID が後で異なる形状で出てきた場合は **後勝ち**でラベル/形状を更新（実用上は同じ表記をすべきだが、緩く扱う）。

### エッジ ID

エッジは内部生成 ID（`e0`, `e1`, ...）。Mermaid テキストに ID は出ないので、emit 時にも ID は出さない。

## 実装の要点

1. テキストを行で split
2. 1 行目: `graph LR` or `graph TD` を期待。なければ ParseError
3. 2 行目以降:
   - 空行 / `%%` 行はスキップ（mm-pos は extractPositionComments で別処理）
   - エッジ行（`A --> B` 等）: ノード A, B を登録 + edge 追加
   - ノード単独行: ノード登録のみ
4. PositionMap は `extractPositionComments(text)` を使って取得
