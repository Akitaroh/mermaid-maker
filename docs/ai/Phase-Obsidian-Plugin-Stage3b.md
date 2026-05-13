# Phase Obsidian-Plugin Stage 3b 実装メモ

> 2026-05-14 / ブランチ: `feat/obsidian-plugin-stage3a` の続き（同ブランチに継続）

## 何を作ったか

Stage 3a の xyflow read-only マウントに**ノードドラッグ → markdown 書戻し**を追加。
ユーザがキャンバス上でノードを動かすと、500ms debounce の後 mermaid source の
末尾コメント `%% mm-pos: A=x,y B=x,y %%` に座標が記録され、ファイルが更新される。

設計ドキュメント: `../../50_Mission/MermaidMaker/Atom-MarkdownWriteBack.md` / `Arrow-MmEditableFlow.md`

## 変更ファイル

```
packages/obsidian/src/
├ atoms/
│  ├ markdown-write-back.ts   [新規] Atom-MarkdownWriteBack
│  └ xyflow-mounter.tsx       [更新] ReactFlowProvider + useReactFlow().getNodes()
└ arrows/
   └ mm-editable-flow.ts      [更新] debounce + emit + writeback 結線
```

## アーキテクチャ拡張

```
xyflow ノードドラッグ
  │
  └─ ReactFlow onNodeDragStop
     │ useReactFlow().getNodes() で全ノードの現在位置取得
     ↓
  onPositionsChange callback → Arrow
     │ scheduleWriteBack(positions)
     │ debounce 500ms
     ↓ (debounce 完了時)
  emitMermaid(graph, positions)
     ↓
  '%%editable%%\n' を prepend
     ↓
  Atom-MarkdownWriteBack
     │ ctx.getSectionInfo(el) で行範囲取得
     │ MarkdownView.editor.replaceRange でコンテンツ部分だけ置換
     ↓
  ファイル更新 → 次回 render で Stage 3a 分岐継続
```

## 重要な実装判断

### 1. `useReactFlow().getNodes()` で全ノード取得

`onNodeDragStop(event, node, nodes)` の第 3 引数 `nodes` は **ドラッグされたノードのみ**。
全ノードの位置を取りたいなら xyflow internal store にアクセスする必要があり、
`useReactFlow()` フック経由が公式パス。

```tsx
function CanvasInner({ onPositionsChange }) {
  const { getNodes } = useReactFlow();  // store hook
  return (
    <ReactFlow ...
      onNodeDragStop={() => {
        onPositionsChange?.(extractPositions(getNodes()));
      }}
    />
  );
}

function MMCanvas(props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
```

`useReactFlow()` は `<ReactFlowProvider>` 配下でのみ動作する点に注意。

実装初版では第 3 引数 `nodes` をそのまま使ってしまい「最後にドラッグした 1 ノード分だけ書き戻され、
他のノード座標が消える」バグになった。詳細: `../../30_Fleeting/xyflow_onNodeDragStopの引数の罠.md`

### 2. `%%editable%%` フラグの prepend は Arrow の責務

`Atom-MermaidEmitter` (core 既存) は `graph + positions` から純粋な mermaid 文字列を
生成するだけで `%%editable%%` を知らない。書き戻し時に Arrow 側で先頭に prepend:

```ts
const newSource = emitMermaid(graph, latestPositions);
const withFlag = `${EDITABLE_FLAG_LINE}\n${newSource}`;
writeBackMmCodeBlock(app, ctx, el, withFlag);
```

これを忘れると次回 render で Stage 2b 分岐に戻り、xyflow が消える。

### 3. debounce 500ms

`scheduleWriteBack` で `setTimeout` ベースの debounce:

```ts
const scheduleWriteBack = (positions) => {
  latestPositions = positions;
  if (pendingTimer !== null) window.clearTimeout(pendingTimer);
  pendingTimer = window.setTimeout(flush, WRITE_BACK_DEBOUNCE_MS);
};
```

連続ドラッグ中は最後の状態だけが書かれる。短すぎる (< 100ms) と editor undo stack が
荒れる、長すぎる (> 1s) とユーザに反映遅延を感じる。500ms は VS Code auto save と同じ
経験値。

### 4. unmount 時に強制 flush

`MarkdownRenderChild.onunload` で pending debounce があれば即実行してから unmount:

```ts
child.onunload = () => {
  if (pendingTimer !== null) {
    window.clearTimeout(pendingTimer);
    flush();
  }
  handle.unmount();
};
```

これでタブ切替・ファイル切替で「書き戻し前に消える」を防止。

### 5. write-back の失敗パス

`Atom-MarkdownWriteBack` は以下のケースで `{ ok: false, reason }` を返す:

- `no-section-info`: `ctx.getSectionInfo(el)` が null（DOM 解除済など）
- `not-markdown-view`: active leaf が MarkdownView でない
- `no-editor`: Reading view で editor 不在（読み専用モード）
- `active-file-mismatch`: active file path と `ctx.sourcePath` が一致しない（別ファイル誤書換防止）

`not-markdown-view` と `active-file-mismatch` は静かに諦め、想定外のエラーだけ
Notice 表示。

### 6. controlled state を諦めた

Stage 3b の初版は controlled state (`useState` + `applyNodeChanges`) で書いたが、
xyflow v12 の挙動として **controlled mode では edge が描画されない**問題に再度ぶつかった
（Stage 3a でも同じ問題。`measured` 設定で対症療法していた）。

最終的に uncontrolled (`defaultNodes`/`defaultEdges`) に戻し、xyflow にノード状態を任せて
`useReactFlow().getNodes()` で読み出す形にした。これがシンプルで edge も正常描画する。

## 確認済み動作

- ノードがドラッグ可能（cursor pointer + 移動可）
- 単一ドラッグ・複数ドラッグ両方で全ノード位置が `%% mm-pos: ... %%` に保存される
- 500ms 後に markdown が更新される（ファイルを再オープンしても座標保持）
- `%%editable%%` フラグが消えず、次回 render も xyflow キャンバス
- 書き戻された markdown は標準 mermaid と互換（コメント行は他の mermaid renderer で無視される）

## 既知の制限・今後の課題

- write-back 後に Obsidian 側で再 render が走り、xyflow が remount される
  ことがある（ガタつき）。v1 では許容
- 編集モード切替 UI は未実装（`%%editable%%` フラグ手書きが必要）→ Stage 3e で UI 化
- ノード追加/削除/ラベル編集は未実装 → Stage 3c
- xyflow ノード内に Obsidian の wikilink を埋め込めない → Stage 3d で MarkdownRenderer 統合

## バンドルサイズ

production build = **417 KB**（Stage 3a の 414 KB + 3 KB 増）

## 関連設計ドキュメント

- `../../50_Mission/MermaidMaker/Atom-MarkdownWriteBack.md`
- `../../50_Mission/MermaidMaker/Atom-XyflowMounter.md`
- `../../50_Mission/MermaidMaker/Arrow-MmEditableFlow.md`
- `../../50_Mission/MermaidMaker/00_MermaidMaker.md` (HOME)

## 関連 Fleeting

- `../../30_Fleeting/xyflow_onNodeDragStopの引数の罠.md`
