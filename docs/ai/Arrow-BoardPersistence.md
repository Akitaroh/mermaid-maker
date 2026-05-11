# AI実装メモ: Arrow-BoardPersistence

**設計**: `../../../50_Mission/MermaidMaker/Arrow-BoardPersistence.md`

---

## ファイル配置

```
packages/web/src/board/board-persistence.ts        本体（pure factory）
packages/web/src/board/board-persistence.test.ts   ユニットテスト
packages/web/src/board/use-board-persistence.ts    React hook
```

session/ ではなく board/ に置く理由: persistence は「BoardStore の延命」が主目的なので近い場所に置いたほうが認知負荷が低い。session_id を使うが session_bridge とは独立。

## 決定log

### Atom-LocalStore は流用しない、直接 localStorage を読み書く

既存 `local-store.ts` は単一 text 用（key 固定 `mm_text`）。session 単位の JSON 構造とは責務が違う。

別ファイル `board-persistence.ts` で `localStorage.getItem(key)` / `setItem(key, JSON.stringify(...))` を直接叩く。

### writeDebounceMs = 500 ms

SessionBridge の outgoingDebounceMs = 300 より長め。理由:
- localStorage write は同期 I/O で main thread を一瞬ブロックする
- 編集が連続している間は ws 同期が優先、確定したら localStorage、の順で良い

### バージョニング

`{ version: 1, boards, activeBoardId }` の形で書く。後方互換性のため。バージョン違いは「捨てる」（migration は Phase 8+）。

### 復元タイミング

`useEffect` 初回マウント時。同期的に setAll を呼ぶ。**ws 接続より先に復元**することで、サーバから来た sync_request に正しい状態を返せる（自分が真実を持っている保証）。

### timer 注入で testability

`opts.timers?.setTimeout / clearTimeout` で差し替え可能。SessionBridge と同じパターン。

### 不正 JSON / 壊れたデータ

`try/catch` で握りつぶし、`console.warn`。next write が成功すれば自動修復。

### dispose の冪等性

`disposed` フラグで 2 重 dispose 防御。React StrictMode 対応。

## 実装後の追記

### 1. App.tsx の組み込み順序が重要

`useBoardPersistence` を **`useSessionBridge` より先に呼ぶ**。理由:
- persistence は同期的に restore する（useEffect 初回 mount 時）
- session bridge は ws 接続後に server から `sync_request` が来るかも
- restore が先行すれば、`sync_request` への応答に正しい復元状態を返せる

→ React の hook 呼び出し順序がドキュメント上の依存関係になっている。

### 2. session 無し時は no-op

`sessionId === null` → useEffect で何もしない。`setReady(true)` だけして hook の interface を維持。session 無しのローカル運用（既存 localStorage save）はそのまま生きる。

### 3. 「restored」を返すが UI 表示は未活用

将来「✓ 前回の続きから復元」みたいな pill を toolbar に出せる。今回は state のみ持って表示はしない（使う場面で UI 追加）。

### 4. テスト 12/12 passing

memStorage で localStorage を完全モック。round-trip テスト（書く → dispose → 別インスタンスで restore）まで通っている。

### 5. 設計通り Atom-LocalStore は流用しなかった

責務が違う（単一 text 用 vs session 単位 JSON）ので別ファイルに。重複ではなく分離が正解だった。

