# MermaidMaker

> A general-purpose Mermaid editor with **bidirectional text↔GUI sync**.
> Edit Mermaid diagrams as text or as draggable nodes — explicit-button sync between them.

🚀 **[Live Demo →](https://mermaid-maker.vercel.app)**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-vercel-black.svg)](https://mermaid-maker.vercel.app)

---

## なぜ作ったか

Mermaid テキストだけだと配置が思うようにいかない。GUI ツールに移るとテキストの再利用性が消える。
**両方からいじれて、明示同期できる**汎用 Mermaid エディタが欲しかった。

## 機能

- ✅ **双方向同期**: テキスト → GUI / GUI → テキスト ボタンで切替
- ✅ **GUI 編集**: ノード追加・形状変更・ドラッグ・ラベル編集（ダブルクリック）・削除（Delete）
- ✅ **平行エッジ自動分離**: 同 source/target を曲げて重ならない
- ✅ **エッジ形状切替**: 直線 / 曲線 / 直角 / 丸角
- ✅ **中間点ドラッグ**: 曲線の経路を調整
- ✅ **クリップボードコピー**: 1 クリックで Mermaid テキストを取得
- ✅ **URL 共有**: state を URL hash に埋め込んで共有
- ✅ **LocalStorage 自動保存**: リロードしても状態が残る

## サポートする Mermaid 構文

- `graph LR` / `graph TD`
- ノード形状: `((label))` / `(((label)))` / `[label]` / `(label)`
- エッジ: `-->` / `-->|label|`
- コメント: `%% mm-pos:` / `%% mm-edge-shape:` / `%% mm-edge-ctrl:`（座標等のメタデータを Mermaid テキストに埋め込み）

## 使い方

```bash
npm install
npm run dev
```

開いた画面の左にテキスト、右に GUI。下のボタンで同期。

## 開発

```bash
npm test          # 単体テスト
npm run build     # production build
npm run preview   # build を確認
```

## 派生プロダクト

- **[AutomataLab](https://github.com/akitaroh/automatalab)** ([Live](https://automatalab-kappa.vercel.app)) — MermaidMaker を土台にした FSM 教育ツール（DFA/NFA シミュレータ付き）

## 設計メソドロジー

[Zettel駆動開発（ZDD）](https://github.com/akitaroh/zdd) で開発。各機能（Atom）が独立した純関数として設計されている。

## License

MIT — see [LICENSE](LICENSE).
