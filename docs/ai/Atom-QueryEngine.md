# AI実装メモ: Atom-QueryEngine

**設計**: `../../../50_Mission/MermaidMaker/Atom-QueryEngine.md`

---

## ファイル配置

```
packages/core/src/query/query-engine.ts        本体
packages/core/src/query/query-engine.test.ts   ユニットテスト
packages/core/src/query/index.ts               re-export
```

`packages/core/src/index.ts` から `export * from './query/index.js'` を足して、外部から `import { findPath } from '@akitaroh/mermaid-core'` で使えるようにする。

## 決定log

### 入力は `Graph`（純粋）、テキスト→Graph はQueryEngineの外

`mermaid_parse(text)` で得た Graph を渡してもらう。テキスト直入力にすると毎回 parser を呼ぶことになり、複数 query を続けて呼ぶ時に無駄。

### findPath はループ可

直交したサイクル / 自己ループを含むグラフでも適切に動くこと。**経路上に同じノードを2回通るのは禁止**（visited set）。複数経路ある場合は全列挙する。

### findPath の探索アルゴリズム

DFS + visited。開始 from を含めて経路を構築。to に到達したら配列に push、別経路を試す。指数爆発するケースもあるので、**経路数の上限を設ける**（デフォルト 1000、超えたら打ち切り + warning）。

### validate のチェック項目

| 項目 | 致命度 |
|---|---|
| ノード id 重複 | error |
| エッジの from/to がノードに存在しない | error |
| 孤立ノード（in/out 0） | warning（情報、validity には影響しない） |

`{ valid: boolean; errors: ValidationError[]; warnings: ValidationError[] }` の形が綺麗。設計では `errors[]` のみだったが、warnings も分けたほうがツール側で表示分けできる。**設計にも反映する**。

### graphStats

おまけ。`isConnected` は無向化して BFS（いずれかの始点から全到達できるか）。

### shape の正規化

QueryEngine からは `shape` が `NodeShape` 型として透過的に使える。`'circle' | 'doubleCircle' | 'box' | 'rounded'` をそのまま返す。

## 実装後の追記

### 1. validate に warnings を分離（設計に上げた）

設計の `errors[]` のみだと「孤立ノード」のような情報レベルが扱えない。`{ valid, errors[], warnings[] }` の構造に拡張。`valid` は errors のみで判定。

### 2. findPath の `from === to` ケース

`graph.nodes` に from があり、その時点で to にも一致する → 直で `[[from]]` を返す。テストケース追加。

### 3. findPath の truncated フラグ

設計通り maxPaths（デフォルト 1000）で打ち切り。`{ paths, truncated: boolean }` を返す形に。MCP ツールから AI に渡す時 truncated を伝えれば「全部じゃないよ」が分かる。

### 4. neighbors の重複除去

並行エッジ（同一 source/target が複数ある）でも `Set` で集約してから配列化。

### 5. graphStats の連結性は無向化

有向グラフの「connected」は弱連結 weak connectivity を取った（無向グラフとして見て BFS）。strong connectivity は将来必要なら別関数。

### 6. テスト 19/19 passing

複雑な経路探索・サイクル・truncation・重複除去まで網羅。

