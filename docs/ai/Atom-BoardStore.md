# AI実装メモ: Atom-BoardStore

**設計**: `../../../50_Mission/MermaidMaker/Atom-BoardStore.md`

---

## ファイル配置

```
packages/web/src/board/board-store.ts        本体
packages/web/src/board/board-store.test.ts   ユニットテスト
packages/web/src/board/use-board-store.ts    React hook (useSyncExternalStore)
```

## 決定log

### Observable パターンの最小実装

`zustand` 等のライブラリは入れない。100行未満で書ける。

```typescript
const listeners = new Set<() => void>();
function notify() { for (const l of listeners) l(); }
```

state は immutable に差し替える（`{ ...state, boards: { ...state.boards, [id]: board } }`）。React 側は `useSyncExternalStore` で購読する。

### activeBoardId のセマンティクス

- 初期は `null`（Board がまだ無い状態）
- `upsertBoard(id, ...)` で **初めて Board が出来た瞬間に active に自動設定**（人間に最初に見せるため）
- 既に active があれば変えない（AI が連続で複数 board 作っても active は最初のものを維持）
- `setActive(id)` で明示切替

→ 人間が「Board 増えたけど active が勝手に変わって混乱」を防ぐ。

### removeBoard の扱い

設計では「Phase 7+ で使うかも、MVP では未使用」だが、API は提供しておく（テスト容易性 + 将来の拡張性のため）。active の Board を削除した場合は、残りの最初のBoardを active にする（or null）。

### setAll は「外部から完全置換」用

Phase 7 の localStorage 復元で使う。listener はまとめて1回だけ呼ぶ。

### 内部 mermaid 文字列の比較最適化

`upsertBoard(id, sameText)` で同じ文字列が来た時に notify しない。React の不要再描画を防ぐ。

### React hook は別ファイル

`use-board-store.ts` で `useSyncExternalStore` を使う hook を提供。本体は React 非依存に保つ（テストもReact不要）。

```typescript
export function useBoardStore<T>(store, selector) {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState())
  );
}
```

## 実装後の追記

### 1. listener throw の握りつぶし

WSClient と同じパターン。1つの listener が throw しても他の listener が呼ばれるよう、try/catch + console.error。

### 2. `setActive` の unknown id は warn + no-op

throw すると React の中で予期せず落ちる。Board の存在保証は呼び出し側に強制せず、警告だけ出す。

### 3. `setAll` の activeId 検証

外部から「`activeId='ghost'` で boards に存在しない id」が来たら null にfallback。Phase 7 で localStorage が壊れていた時の防御。

### 4. `useSyncExternalStore` の getServerSnapshot

SSR を使わない前提だが、引数を3つ渡しておかないと React 18 でwarning出る場合がある（環境依存）。`getServerSnapshot` も同じセレクタを返す形で揃えた。

### 5. notify の中で listener.add/delete されたら？

現状は `Set.forEach` 動作（途中追加された listener は同フレームでは呼ばれない、削除された listener はそのフレームの呼び出しから除外される）。MVP は問題なし。再帰 notify したいケースは Phase 7 でCOMP検討。

### 6. テスト17/17 passing

特に「同一文字列 upsert で notify されない」と「setActive 同 id で notify されない」の no-op 最適化が React 不要再描画の抑制に効く。

