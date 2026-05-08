# AI実装メモ: Atom-PositionStore

**設計**: `../../../50_Mission/Mermaid Maker/Atom-PositionStore.md`

---

## ファイル配置

```
src/store/position-store.ts
```

## 決定log

### 正規表現の方針

- `%% mm-pos:` 行の検出: `/^%%\s*mm-pos:\s*(.+)$/m`
- 各エントリ: `/([A-Za-z0-9_]+)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g`
  - `match.matchAll` を使う（複数エントリ同一行でも対応）

### 複数 mm-pos 行の扱い

- 後勝ちでマージ
- `extractPositionComments` は全行を走査して結合

### stripPositionComments の挙動

- mm-pos 行を**1行ごと削除**
- 行末の改行も同時に削除（連続改行を残さない）

## 実装の要点

- 純関数のみ。React にも reactflow にも依存しない
- 数値は Number でパース。NaN は捨てる（無効エントリはスキップ）
