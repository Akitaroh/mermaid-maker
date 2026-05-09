# AI実装メモ: Arrow-SyncDispatcher

**設計**: `../../../50_Mission/Mermaid Maker/Arrow-SyncDispatcher.md`

---

## ファイル配置

```
src/app/App.tsx
src/app/main.tsx
src/app/app.css
```

## 決定log

### 状態管理は React useState

Phase 2 では Zustand 等を入れない。状態は 4 つだけ:
- `text: string` - テキストエディタの内容
- `graph: Graph` - 同期済みの AST
- `positions: PositionMap` - ノード座標
- `parseError: ParseError | null` - 直近のパースエラー

### ボタンのラベル

- 「テキスト → GUI 同期 ▶」
- 「GUI → テキスト 同期 ◀」

### 初期サンプル

[[有限オートマトン問題_解答]] の (7) を初期サンプルにする（原体験から取る）:

```
graph LR
    q0((q0))
    q1(((q1)))
    q0 -->|a, b| q0
    q0 -->|b| q1
```

### レイアウト

シンプルな2ペイン + 下部ボタン:

```
+--------------+--------------+
|              |              |
|   <textarea> |   <Canvas>   |
|              |              |
|              |              |
+--------------+--------------+
| [Text→GUI] [GUI→Text] [error msg]   |
+-------------------------------------+
```

横分割は flexbox で 50/50。

## 実装の要点

1. App.tsx: 状態 4 つ + sync 関数 2 つ + UI レイアウト
2. textarea は普通の `<textarea>`（Monaco は Phase 2 では入れない）
3. Canvas は受け身で `positions` を Props で受ける
4. ボタンクリック以外で同期しない

---

## Phase 5.4 統合追加

- `useState<string>(text)` をやめて、`useActiveBoardText(store)` で BoardStore から購読
- `setText(next)` は `store.upsertBoard(activeBoardId, next)` 経由
- session 無し時は `useEffect` で default board を 1 個 seed
- localStorage save は session 無し時のみ動作
- `?session=xxx` モードでは `useSessionBridge` が WSClient 接続 + relay と結線
- BoardTabs を toolbar の上に配置

## Phase 8.1 polish 追加

- `autoLayout()` 関数 + ✨整列 ボタン（`fillMissingPositions(graph, {})` で全ノード再配置 + edgeControls 空に）
- WS_URL を `window.location.host` ベースに自動導出（embedded mode で同 port に自動接続）
- `import.meta.env.VITE_MM_WS_URL` で外部 WS 上書き可能（vite dev モード用）
- `vite-env.d.ts` を追加して `import.meta.env` の型を解決
