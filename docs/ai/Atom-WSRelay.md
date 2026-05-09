# AI実装メモ: Atom-WSRelay

**設計**: `../../../50_Mission/MermaidMaker/Atom-WSRelay.md`

---

## ファイル配置

```
packages/mcp/src/relay/ws-relay.ts        本体
packages/mcp/src/relay/ws-relay.test.ts   ユニットテスト
packages/mcp/src/relay/types.ts           ServerMsg / ClientMsg（web 側と揃える）
```

web 側の `packages/web/src/ws/types.ts` と内容は同じだが、依存関係を切り離すため別ファイルで持つ（mcp は core に依存するが web には依存しない）。

## 決定log

### echo server (Phase 5.4) との関係

echo server `scripts/echo-server.ts` は smoke test 専用の最小実装。WSRelay はそれを **API 化 + waitForEdit 追加 + lifecycle 整理** したもの。

役割移譲:
- echo-server.ts は引き続き残す（quick 2-tab smoke test 用）
- WSRelay はプログラマティックに使える（MCPTools から呼ぶ）

### Session lifecycle

設計では「最後の client が切れたら破棄」だったが、MCPTools が `mermaid_show` を呼んだ瞬間に session を作りたい場合がある（client がまだ繋いでない）。

→ **Session は `createSession()` の明示呼び出しで作る**。client 接続時は既存 session に join するか reject。

```typescript
const sid = relay.createSession();  // → "abc123" 採番
console.log(`open: http://localhost:5173/?session=${sid}`);
// クライアントが繋ぎに来る
```

session 破棄: `destroySession(id)` の明示 or 起動プロセス終了時。

### waitForEdit の実装

設計通り、`Map<string, ((mermaid: string) => void)[]>` (`session:board` 複合キー）で待ち受け。タイムアウト付き Promise で reject。

```typescript
relay.waitForEdit(sessionId, boardId, 30_000)
  // → Promise<string> resolve（timeout 内に edit が来たら）
  // → reject（timeout）
```

複数の `waitForEdit` が同時待機する場合、edit が来たら**全員 resolve**（broadcast 的）。

### `update_board` 受信時の挙動

1. session.boards を更新
2. waitForEdit の待機者全員に resolve
3. **他クライアントには broadcast しない**（MCPTools が能動的に show するまで他 tab に流さない設計）

→ 議論あり: echo server は他クライアントに broadcast していたが、WSRelay は **AI 主導の同期**を意図する。「人間が編集 → AI に届く → AI が判断して他 board に反映 or show」のフローが自然。

ただし「人間が複数タブで同 session 開いた時」に同期しないのは違和感あり。**Phase 6 では一旦 broadcast 維持** する（echo server と同じ挙動）。AI 主導モードは Phase 7 以降の選択肢に。

### Origin / Token チェック

localhost 限定だが、**他のブラウザタブ（別 origin）から ws 接続できる**点はリスク。Phase 6 では:
- ws server は `127.0.0.1` バインド（外部ネットワーク shutout）
- Origin チェック: `localhost` 系のみ accept、それ以外 reject

token 認証は MVP 後送り。

### Port 採番

デフォルト `0`（OS割当） or env `MERMAID_MCP_PORT`。実際に listen し始めたら `start()` の resolve で `{ url, port }` を返す。

## 実装後の追記

### 1. テストでの seed タイミング race

新規 client 接続時、サーバが seed の `set_board` / `focus_board` を即送信する。`await connect()` が `open` で resolve するが、その直後に `on('message')` を attach するとすでに seed が届いている可能性がある（イベント発火順）。

→ テスト用 `connect()` 内で **接続と同時に message buffer を attach** する形に。本物の web client（WSClient）は内部で常時 buffer 動作なので問題なし。

### 2. broadcast の `except` 引数で全送信 / 他者送信を統一

`upsertBoard` 経由の broadcast は **全 client** に流す（MCPTools 起点）。`update_board` 受信時は **送信元を除く** （multi-tab parity）。同じ `broadcast(session, except, payload)` で `except: WebSocket | null` で書けた。

### 3. `editWaiters` のキー設計

`Map<sessionId:boardId, EditWaiter[]>` の文字列複合キー。session 破棄時は prefix マッチで一括削除。複数同時 waiter は edit 1回で全員 resolve。timeout は各 Promise 内で個別管理。

### 4. session destroy / stop の close code

- destroySession: 1000（normal closure）
- stop: 1001（going away）

クライアント側で「再接続すべきか」判定できる（1001 なら諦める）。

### 5. Origin ヘッダ不在は許容

Node の ws client や CLI からの接続は Origin を送らない → テストや MCP Inspector で繋ぎたい時に必要。ブラウザは必ず Origin を送るので、`localhost` 系のみ accept で外部タブからは弾ける。

### 6. sessionId は `randomBytes(12).toString('base64url')`

URL safe な 16 文字。既存の url-parser の正規表現 `[A-Za-z0-9_-]+` と互換。

### 7. テスト 11/11 passing

