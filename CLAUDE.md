# MermaidMaker - Project CLAUDE.md

このプロジェクトは [Zettel駆動開発](../../10_Permanent/engineering/Zettel駆動開発.md)（ZDD）で開発される、**汎用 Mermaid テキスト↔GUI 双方向同期エディタ**。

派生プロダクト: [[00_AutomataLab|AutomataLab]]（FSM 教育ツール）。同 Atom 群を再利用している。

## マスター指示

**実装する前に必ず Vault 側の設計ドキュメントを読む**：

- `../../50_Mission/MermaidMaker/00_MermaidMaker.md` — HOME
- `../../50_Mission/MermaidMaker/10_Why.md` / `20_What.md` / `30_How.md`
- `../../50_Mission/MermaidMaker/Atom-*.md` / `Arrow-*.md`

## 役割分担

- **設計（Vault 側）** = 人間の責任領域。AI は触らない
- **実装（このリポジトリ）** = AI の作業領域
- **AI 実装メモ** = `docs/ai/` 配下に決定 log 中心で書く

## 実装ガイドライン

- TypeScript + React + Vite + @xyflow/react + dagre
- ディレクトリ:
  - `src/types/` `src/mermaid/` `src/store/` `src/canvas/` `src/graph/` `src/edge-router/` `src/persistence/` `src/samples/` `src/app/`
- 各 Atom は `src/<domain>/<name>.ts(x)`
- このリポジトリは**汎用 Mermaid エディタ**。FSM 特化機能（Simulator 等）は AutomataLab repo 側に置く

## 派生プロダクトとの境界

- 汎用に役立つ機能のみここに追加
- FSM や特定ドメインの機能は AutomataLab 側で個別に実装
- 共通 Atom を更新したら、AutomataLab 側にも手動同期する（一次ソースは MermaidMaker）

## 設計を変えるとき

設計ドキュメント（Vault 側）を先に修正する。コードから先に直さない。
