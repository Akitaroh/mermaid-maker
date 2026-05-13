# Phase Obsidian-Plugin-Spike 実装メモ

> 2026-05-13 → 14 / spike ブランチ: `feat/obsidian-plugin-spike-v2`

## 何を作ったか

`packages/obsidian/` を新設。Obsidian プラグイン本体。Vault 内の既存 ` ```mermaid ` ブロックを後処理し、ノードラベルに含まれる `[[X]]` を Obsidian wikilink としてクリック可能にする。

設計ドキュメント: `../../50_Mission/MermaidMaker/Atom-ObsidianLinkifier.md`

## パッケージ構成

```
packages/obsidian/
├ src/main.ts          ← プラグイン本体（130 行）
├ manifest.json        ← Obsidian plugin manifest
├ tsconfig.json
├ esbuild.config.mjs   ← Vault 直接書き込みビルド
└ package.json         ← devDeps: obsidian, esbuild, typescript
```

- Vault 内 `node_modules` を避けるため、`packages/obsidian/` は `_repos/` 配下（`userIgnoreFilters` で隠れている）
- esbuild の output は `/Users/akitaroh/Desktop/Akitaroh/.obsidian/plugins/mermaid-maker/main.js`
- Vault 側 plugin フォルダには `main.js + manifest.json` 2 ファイルだけ

## ビルド・配布

```bash
pnpm --filter @akitaroh/mermaid-obsidian build    # production
pnpm --filter @akitaroh/mermaid-obsidian dev      # esbuild watch
```

ビルド成果物は **直接 Vault に配置される**ので、symlink 不要。`obsidian plugin:reload id=mermaid-maker` で hot reload 可能。

## 採用したアーキテクチャ

### document-wide MutationObserver + post processor 併用

`registerMarkdownPostProcessor` は Live Preview の inline 描画 code block には呼ばれない（Obsidian の挙動）。Reading view しか対応しないと「ユーザが普段使う Live Preview で機能しない」ので、document-wide MutationObserver を主軸にした。

```ts
async onload() {
  this.scanAll();
  const observer = new MutationObserver(() => this.scanAll());
  observer.observe(document.body, { childList: true, subtree: true });
  this.register(() => observer.disconnect());

  // Reading view 初回描画用の保険
  this.registerMarkdownPostProcessor((el, ctx) => {
    el.querySelectorAll<SVGElement>('.mermaid svg')
      .forEach((svg) => this.linkifySvg(svg, ctx.sourcePath));
  });
}
```

### 二重処理防止

- `WeakSet<SVGElement>` で処理済み SVG を記憶
- `data-mm-linktarget` 属性で各ノードの click handler 二重登録を防止
- `svg.textContent.includes('[[')` の粗チェックで非対象 SVG を即 skip

### sourcePath の解決

MutationObserver 経由だと `ctx.sourcePath` が手元にない。SVG の親要素から `.markdown-source-view` / `.markdown-preview-view` を遡り、`app.workspace.iterateAllLeaves` で対応する MarkdownView を見つけ `file.path` を取得。fallback は active file の path。

## デバッグループ（Obsidian CLI）

開発中、`obsidian` CLI（v1.12+）が完全自動デバッグを成立させた。

```bash
obsidian dev:debug on                      # CDP attach（最初に 1 回）
obsidian plugin:reload id=mermaid-maker    # コード変更後のリロード
obsidian dev:console clear                 # console clear
obsidian open file=_test_mermaid_plugin.md # テストノートを開く
obsidian dev:console limit=20              # ログ取得
obsidian dev:dom selector=".mermaid svg g.node" total
obsidian eval code='document.querySelectorAll("[data-mm-linktarget]").length'
```

人間操作ゼロで「編集→ビルド→リロード→DOM 確認→ログ取得」のループが回せた。

## ハマリどころ

### 1. plugin フォルダを vault 内に symlink すると node_modules を Obsidian が辿る

初回試行で `.obsidian/plugins/mermaid-maker` を `packages/obsidian/` への symlink にしたら Obsidian がハング。`detectAllFileExtensions: true` の vault では特に致命的。

→ symlink ではなく **build artifact のみコピー** する方式に変更。

### 2. registerMarkdownPostProcessor が呼ばれない

詳細は `Atom-ObsidianLinkifier.md` の「主要な設計判断 1」と Fleeting `registerMarkdownPostProcessorの落とし穴.md` 参照。

### 3. Mermaid の `A[[X]]` syntax collision

`A[[X]]` は subroutine shape として消費されるため `[[X]]` 部分が文法トークン扱いで残らない。`A["[[X]]"]` でクォートが必要。

詳細: Fleeting `Mermaidのsyntax_collision.md`

## 確認した動作

- 任意のノートに次のような mermaid ブロックを置いて Live Preview / Reading view 両方で:
  ```
  graph LR
    A["[[ZDDの全工程と人間レビュー境界]]"] --> B["[[自分の言葉で書く]]"]
  ```
- ノード A, B がクリック可能（cursor: pointer + `data-mm-linktarget` 属性）
- クリックで `app.workspace.openLinkText` 経由で対象ノートが開く
- 通常ノード（`C["..."]` で `[[...]]` を含まない）はクリック不可のまま

## 次のステップ（未実装）

- リンクっぽい視覚スタイル（色・ホバー・未解決時の薄表示）
- Mermaid 再描画時の attribute 消失への対策（再 linkify は MutationObserver で拾えるはず、要検証）
- `MarkdownPostProcessorContext.getSectionInfo(el)` でソース markdown を読み、`A[[X]]` の短縮記法対応
- `mermaid-mm` custom code block で xyflow GUI 編集を埋め込み（Stage B 系の本格路線）

## 依存

- `obsidian` (^1.4.11, devDep のみ、external でバンドルから除外)
- `esbuild` (^0.23.0)
- `typescript` (^5.4.0)
- 現時点で `@akitaroh/mermaid-core` には依存しない（Stage 3+ で必要になる予定）
