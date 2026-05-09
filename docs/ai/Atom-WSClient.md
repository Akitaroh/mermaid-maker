# AI実装メモ: Atom-WSClient

**設計**: `../../../50_Mission/MermaidMaker/Atom-WSClient.md`

---

## ファイル配置

```
packages/web/src/ws/ws-client.ts        本体
packages/web/src/ws/ws-client.test.ts   ユニットテスト
packages/web/src/ws/types.ts            ServerMsg / ClientMsg 型定義
```

## 決定log

### Phase 5.2 では「ws通信」だけに集中、Board連携はしない

WSClient はメッセージの**送受信パイプ**に徹する。受信ハンドラを外部から登録できる形にして、BoardStore との結線は呼び出し側（App.tsx もしくは別 Arrow）で行う。

### 再接続戦略

exponential backoff: 1s, 2s, 4s, 8s, ..., max 30s。`onclose` で `wasClean === false` なら再接続。`disconnect()` を明示的に呼んだ場合は再接続しない（フラグで管理）。

### debounce は呼び出し側の責務

「人間の編集を300ms debounceしてからsendする」のは BoardStore 側 or App.tsx 側。WSClient は素直に send する。理由: WSClient を再利用しやすくするため。

### `?session=xxx` パラメータの扱い

WSClient コンストラクタは `url` と `sessionId` を別引数で受ける。内部で `${url}?session=${sessionId}` を組み立てる。

```typescript
createWSClient({ url: 'ws://localhost:7331', sessionId: 'abc123' })
```

### ws ライブラリ未使用、ブラウザ標準 WebSocket

web 側はブラウザ標準 `WebSocket` を使う。`ws` パッケージは Node 専用なのでサーバ側 ([[Atom-WSRelay]]) でだけ使う。

### テスト戦略

`vitest` + `jsdom`。`global.WebSocket` をモッククラスで差し替えて、open/close/error/message を発火させて挙動検証。

### 受信ハンドラは複数登録可能

`onServerMessage(handler)` は登録解除関数を返す形（unsubscribe pattern）。

```typescript
const unsubscribe = client.onServerMessage((msg) => { ... });
unsubscribe(); // 解除
```

複数ハンドラがある時は登録順に呼び出す。エラーがthrowされてもログ出力して次のハンドラに進む。

### status() の状態遷移

```
'connecting' (constructor or reconnect attempt)
  → 'open' (onopen)
  → 'closed' (onclose, disconnect, error → 再接続中も 'connecting' に戻す)
```

`'reconnecting'` を別 status として持つかは迷うが、MVP は `'connecting'` 一本で済ませる。

## 実装後の追記

### 1. テスタビリティのため `WebSocketImpl` 注入を追加

ブラウザ標準 `WebSocket` を直接参照すると `vitest` でテストが書きにくい。`opts.WebSocketImpl` で差し替え可能にした。本番は省略するとデフォルトの `globalThis.WebSocket` を使う。設計ドキュメントには載せていない実装詳細だが、再利用時にも便利。

### 2. backoff パラメータも opts で渡せるように

`initialReconnectDelayMs` / `maxReconnectDelayMs` を opts に追加。テストで小さい値を渡せるようにするため。デフォルトは設計通り 1000ms / 30000ms。

### 3. send while not open は warn + drop

設計に書かれていないエッジケース。実装上の判断:
- **キューに溜める**：再接続時に flood するリスク → やらない
- **throw する**：呼び出し側に防御を強いる → 過剰
- **warn + drop**：MVPで許容、上位レイヤーが status を見て判断

→ Phase 7 で「再接続時に最新 board をresync」する仕組みを入れる時に再考。

### 4. handlers を `Set` で持つ

複数登録 / 解除 / 順序保証が `Set` で素直。`Array` だと unsubscribe の splice が面倒。

### 5. `onerror` ではなく `onclose` で再接続判定

`onerror` は close と必ずペアで来る（onerror → onclose）ので、close 側だけで再接続ロジックを持つ方がシンプル。`!ev.wasClean` で「予期せぬ切断」を判定。

### 6. テスト：`vi.useFakeTimers` で backoff を進める

`vi.advanceTimersByTimeAsync(100)` で WebSocket 再接続のタイマーを進められる。jsdom 環境で動作確認済み（10/10 passing）。

