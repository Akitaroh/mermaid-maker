# AI実装メモ: Phase 8.1 Embedded Canvas

**設計**: HOME のロードマップ Phase 8.1 行 + [[MCP配布時の起動UX問題]]

---

## ゴール

`pnpm dev` を別途立ち上げる摩擦を消す。MCP server プロセス1つで HTTP + WS を同 port で serve し、`mermaid_show` の sessionUrl を開けば即動く状態にする。

## 決定log

### 1 プロセス・1 port で HTTP + WS

Node の `ws` パッケージは既存の `http.Server` に `noServer: true` で attach できる。これで `7331` 1 つで両方賄える。

```typescript
const httpServer = http.createServer(handleStatic);
const wss = new WebSocketServer({ noServer: true });
httpServer.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});
httpServer.listen(7331);
```

### web の WS URL は window.location ベースに

App.tsx の `WS_URL` を hardcoded ではなく:

```typescript
const WS_URL = (() => {
  if (import.meta.env.VITE_MM_WS_URL) return import.meta.env.VITE_MM_WS_URL;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}`;
})();
```

これで HTTP と WS が同 port でサーブされていれば自動で繋がる。Vercel hosted や vite dev で外部 WS を使いたい時は env override。

### web build 成果物を mcp/dist/web/ に copy

mcp の build スクリプト:

```json
"scripts": {
  "build": "pnpm --filter @akitaroh/mermaid-maker-web build && rm -rf dist && tsc && node scripts/copy-web.js"
}
```

`scripts/copy-web.js` は `packages/web/dist/*` を `packages/mcp/dist/web/` にコピーする1スクリプト。

`package.json` の `files` に `dist` を含めれば npm publish 時に web も持っていく。

### 静的配信ハンドラ

最小実装: SPA fallback（`/` 以外すべて → index.html もしくは該当ファイル）。MIME type は拡張子から推定:

```typescript
function handleStatic(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.join(WEB_ROOT, pathname);
  // 安全: webroot 外への traversal 拒否
  if (!filePath.startsWith(WEB_ROOT)) { res.writeHead(403).end(); return; }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback
      return fs.createReadStream(path.join(WEB_ROOT, 'index.html'))
        .pipe(res.writeHead(200, { 'content-type': 'text/html' }));
    }
    res.writeHead(200, { 'content-type': mimeOf(pathname) });
    fs.createReadStream(filePath).pipe(res);
  });
}
```

### sessionUrl の生成

`baseSessionUrl` を opts で受けつつ、デフォルトは `http://localhost:${port}` に。env `MM_WEB_URL` があればそれを使う（外部ホスト指定用）。

### 開発モードとの両立

開発時に vite dev で HMR 効かせたい場合は、従来通り:
- ターミナル1: `pnpm dev`（vite on 5173）
- MCP サーバの `MM_WEB_URL=http://localhost:5173` で env 指定
- web 側は `VITE_MM_WS_URL=ws://localhost:7331` を `.env` で指定

普通の利用では embedded mode で完結。

## 検証手順

1. `pnpm --filter @akitaroh/mermaid-mcp build`（web build → mcp tsc → copy）
2. mcp プロセス起動（`.mcp.json` に登録された tsx 経由でも、build 後の dist/bin.js でも）
3. `mermaid_show` 呼び出し → sessionUrl `http://localhost:7331/?session=xxx`
4. ブラウザで開く → 図が出る、ws 接続も同 port で成功

## 実装後の追記

### 1. WSRelay に attached mode を追加

`opts.httpServer` を渡すと `WebSocketServer({ noServer: true })` で外部 http.Server に attach。`stop()` 時は ws のみ閉じて http は呼び出し側に任せる（lifecycle 分離）。既存テスト（11/11）はそのまま通った。

### 2. core を本格 emit するため `.js` 拡張子を全 import に追加

ESM Native Resolver は `.js` 拡張子必須。core の `import '../types/schema'` を `'../types/schema.js'` に書き換えた。TypeScript は import path をそのまま emit するので、ソース側で `.js` を書いても TS は OK。Vite/Vitest も同じ表記で動く。

### 3. core の package.json を runtime 用に再構成

```json
"main": "./dist/index.js",
"types": "./dist/index.d.ts",
"exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
"files": ["dist", "src"]
```

`src` も含めるのは将来 source map ナビゲーション用。

### 4. mcp build パイプライン

```
build = build:web (= web の vite build)
      + build:tsc (= mcp の tsc emit)
      + build:copy-web (= web/dist → mcp/dist/web)
```

`pnpm --filter @akitaroh/mermaid-mcp build` 1 発で完結。npm publish 時は `dist` だけ持っていけば動く。

### 5. PORT env の名前

`PORT` ではなく `MERMAID_MCP_PORT`。汎用名は他の MCP server と衝突する可能性があるため固有名。

### 6. 動作確認手順

```bash
# 既存の Claude Code 起動の MCP server を /mcp restart で更新
# あるいは Claude Code 再起動
# .mcp.json は dist/bin.js を直接 node で起動するように既に更新済み

# ブラウザで http://localhost:7331/?session=xxx を開く
# (sessionUrl は mermaid_show が自動で返す)
```

vite dev は不要！

### 7. 注意点

- core / web を変更したら `pnpm --filter @akitaroh/mermaid-mcp build` で再 build 必須
- 開発中は `pnpm dev`（vite）+ `MM_WEB_URL=http://localhost:5173` env で MCP 起動するルートも残してある

