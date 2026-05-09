# AI実装メモ: Phase 5.4 App.tsx 統合

**設計**: HOME のロードマップ Phase 5.4 行 + Arrow-SyncDispatcher 関連

---

## ゴール

App.tsx に SessionBridge / BoardStore / BoardTabs を組み込み、`?session=xxx` モードで他タブと同期できる状態を作る。echo server を1枚書いて手元で動作検証する。

## 決定log

### BoardStore は session 有無に関わらず常に「真実の単一ソース」

これまでの App.tsx は `useState<string>(text)` がテキストの真実だった。Phase 5.4 から **BoardStore がテキストの真実**になる:

- `text` = `store.boards[activeBoardId].mermaid`
- `setText(t)` = `store.upsertBoard(activeBoardId, t)`

session 無しでも default board 1個を持つ形にすれば、コードパスを2系統に分けずに済む。

### 初期化フロー

```
session あり → store は空のまま接続。server からの set_board で初期化される
session 無し → useEffect で "default" board を getInitialText() で upsert
```

### LocalStorage 自動保存は session 無し時のみ

session ありなら server が真実なので、localStorage 書き込みは衝突源になる。Phase 7 で per-board localStorage 永続化を入れるが、Phase 5.4 では「session 無し時だけ active board を従来 key に保存」で済ませる。

### URL hash 状態（既存）と session の関係

既存の `?text=base64` URL hash と `?session=xxx` は別系統。同時指定された場合:
- `session` 優先（共有キャンバス用）
- それ以外は従来動作

### Connection status の表示

toolbar の右側に小さく `🟢 connected to abc123` / `🟡 connecting...` / 何も無し（no session）。
WSClient に status 変化イベントが無いので、`useSessionBridge` が `status` を返すのを使う（接続/切断の境界のみ。reconnecting 中の表示は Phase 7）。

### echo server

Phase 6 の WSRelay とは別物。MVPで「2タブ間の同期が動く」ことを示すための簡易実装:

```
scripts/echo-server.ts (root の scripts/、root の devDeps に ws + tsx)
- ws server を NNNN port で起動
- ?session=xxx で接続をグループ化（Map<sessionId, Set<WebSocket>>）
- 受信したメッセージを同 session の他 client に broadcast
- update_board → 他 client に set_board に変換して送る
- sync_state → 他 client に各 board を set_board で送る
```

これで2タブ開けば「片方の編集がもう片方に反映される」が確認できる。

### 動作検証手順

1. ターミナル1: `pnpm echo` → echo server 起動（port 7331）
2. ターミナル2: `pnpm dev` → vite で web 起動（5173）
3. ブラウザタブ1: `http://localhost:5173/?session=test`
4. ブラウザタブ2: `http://localhost:5173/?session=test`
5. タブ1で編集 → debounce 後にタブ2に反映される

## 実装後の追記

### 1. `vite-env.d.ts` 不在で `import.meta.env` が型エラー

`VITE_MM_WS_URL` を ENV 経由で上書きしたかったので `import.meta.env` を使ったが、`vite-env.d.ts` を作って `/// <reference types="vite/client" />` を入れる必要があった。標準的な Vite + TS セットアップの抜け。

### 2. text の真実を BoardStore に一本化したのは正解

最初は「session 有無で2系統」も検討したが、常に BoardStore を真実にすると分岐が消える:
- session 無し → useEffect で default board を seed して終わり
- session 有り → server からの set_board が初期化を担う

App.tsx の本質コード量はほぼ変わらず（既存の `useState<string>` を `useBoardStore` に置き換えただけ）。

### 3. `text` の `useEffect` 依存に `view.activeBoardId` も入れる

active 切替で text が変わる時も再 parse 必要。`[text, view.activeBoardId]` の組で十分。

### 4. localStorage 保存は `if (sessionId) return` で分岐

server が真実モードの時に localStorage 書くと「タブ閉じた後に local に古い値が残る」混乱を生む。Phase 7 で per-board localStorage を入れる時にちゃんと設計する。

### 5. echo server は `node -e` で2-client 動作検証 → PASS

`A → server → B` の経路で `update_board` が `set_board` に変換され B が受信できた。Phase 6 の WSRelay 実装の基盤になる。MCP プロトコル無しでも 2 タブの同期だけは確認できる位置づけ。

### 6. echo server の cache 永続化はスキップ

最後のクライアントが切れたら session ごと破棄。再接続時に過去の board が消えるが MVP では許容。Phase 6 の WSRelay では「session の lifetime は明示 disconnect まで」設計にする。

### 7. 動作確認手順（README に書く候補）

```
ターミナル1: pnpm echo
ターミナル2: pnpm dev
ブラウザタブ1: http://localhost:5173/?session=test
ブラウザタブ2: http://localhost:5173/?session=test
タブ1で編集 → 300ms debounce → タブ2 に反映
```

