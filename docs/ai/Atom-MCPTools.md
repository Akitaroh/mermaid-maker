# AI実装メモ: Atom-MCPTools

**設計**: `../../../50_Mission/MermaidMaker/Atom-MCPTools.md`

---

## ファイル配置

```
packages/mcp/src/tools/register-tools.ts        本体（registerAllTools(server, deps)）
packages/mcp/src/tools/register-tools.test.ts   ユニットテスト（核ロジックのみ）
```

## 決定log

### `registerAllTools(server, { relay, baseSessionUrl })` の形

`McpServer` インスタンスを受け取って、各ツールを `server.registerTool(...)` で登録する関数。テスト時は `McpServer` を立てずに、登録ロジックを直接呼ぶ形にもできる。

### Web タブを開く URL の生成

`mermaid_show` 初回呼び出しで session を作って URL を返すが、それは「web app の URL + ?session=xxx」。`baseSessionUrl` を opts で受ける（デフォルト `http://localhost:5173`）。env `MM_WEB_URL` で上書き可能。

### Session の暗黙作成

`mermaid_show` が呼ばれた時、まだ session が無ければ自動作成する。session id は MCPTools の中で**プロセス単位で1個だけ**保持する設計（複数 session 同時に持つのは Phase 7 以降）。

→ シンプル化のためこれで進める。複数 session が要るユースケース（同 AI が複数会話を並列に持つ）は将来対応。

### waitForEdit のタイムアウト

デフォルト 600秒（10分）。`timeoutSec` で AI 側からも調整可。MCP プロトコル側の request timeout と整合させる必要があるが、今は default で進める。

### ツール返り値は `content[]` 形式

MCP SDK の `CallToolResult` は `{ content: [{ type: 'text', text: '...' }] }` の構造。JSON を text に詰めて返す方針:

```typescript
return {
  content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
};
```

### Group A（操作系）と Group B（クエリ系）の分離

両者を同じファイルで `registerAll` するが、ロジックは関数で分離:
- `registerSharedCanvasTools(server, ctx)` — Group A
- `registerQueryTools(server)` — Group B

### tool description は AI 向けに親切に

「いつ使うか」「他ツールとの組み合わせ」を入れた description にする。設計ドキュメントの example 参考に。

### ツール名規約

`mermaid_show` `mermaid_get_current` 等、prefix `mermaid_` で揃える。Claude Code の MCP UI で並んだ時に視認しやすい。

## 実装後の追記

### 1. SDK は `registerTool(name, config, handler)` のシグネチャ

`@modelcontextprotocol/sdk@1.29` で `tool(name, ...)` は deprecated、`registerTool` 推奨。`config.inputSchema` は **Zod schema の dictionary**（生 object でなく）。`{ text: z.string() }` のような形。

### 2. `CallToolResult` の content は `[{ type: 'text', text: ... }]`

JSON 結果を `JSON.stringify(value, null, 2)` で text にして詰める。エラー時は `isError: true` も付ける。

### 3. parseOrFail のジェネリクス推論が壊れた

`ReturnType<typeof parseMermaid> extends { ok: true; graph: infer G } ? G : never` で書いたら推論失敗。素直に `Graph` 型を import して `{ graph: Graph }` の方が良い。

### 4. session を MCPTools 内で 1個だけ持つ

設計通り。`SessionState` に `sessionId: string | null` を持ち、`mermaid_show` 初回で `relay.createSession()` する。relay 側に session 破棄が起きた場合は再作成（`hasSession` で確認）。

### 5. Group A / Group B 関数分離

将来 Group A だけ無効化したい（pure query MCP として配布したい）等、選択肢を残せる。

### 6. ツール description の verbose 化

設計の通り「いつ使うか」「他ツールとの組み合わせ」を含めた。SDK が JSON Schema として AI に流すので、tool description が長くても自動で読み取られる。

### 7. bin smoke test PASS

stdio で `initialize` → `tools/list` → `mermaid_show` を投げたところ、12 ツール全部 listed、`mermaid_show` が `sessionUrl` を含む JSON を返した。**MCP プロトコル準拠で動作確認済み**。

