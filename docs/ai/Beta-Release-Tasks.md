# β リリース期間 (2026-05-14 〜 05-21) タスク追跡

設計: `../../50_Mission/MermaidMaker/00_MermaidMaker.md`

---

## MUST: 公式 store 申請の前提

| ID | タスク | 状態 | メモ |
|---|---|---|---|
| M1 | `normalizePath()` 監査 | 🚧 進行中 | path 触る場所を全 grep、適用箇所があれば修正 |
| M2 | innerHTML 残り検索 | 🚧 進行中 | `el.innerHTML = ''` は Stage 3d で 1 件除去済、念のため再 grep |
| M3 | モバイル動作確認 / `isDesktopOnly` 判断 | ⏸ 保留 | **iPad 等の実機がないため後回し**。実機検証できるタイミングで再開 |
| M4 | 別 repo `Akitaroh/obsidian-mermaid-maker` 作成 | 📝 未着手 | core を inline bundle 戦略 (c) で進める方針 |
| M5 | core 依存処理戦略決定 | 📝 未着手 | **(c) inline bundle 採用** — 新 repo の `src/core/` に core ソース複製、esbuild が全部 bundle |
| M6 | 公式 README 強化 (テキスト部分) | 📝 未着手 | 機能リスト + インストール + 制約 (画像は post-release で OK) |
| M6.2 | スクショ・GIF 整備 (画像) | ⏸ post-release | 審査通過には不要、ユーザ獲得に効く。Kap 等で 30 分程度。詳細: Fleeting `Obsidianプラグインの画像撮影とKap` |
| M7 | community-plugins.json への PR | 📝 未着手 | obsidian-releases fork → entry 追加 → submission checklist |

## SHOULD

| ID | タスク | 状態 |
|---|---|---|
| S1 | 告知文 3 種 下書き | 📝 |
| S2 | P1 手動テスト消化 | 📝 |
| S3 | CHANGELOG.md | 📝 |
| S4 | LICENSE を新 repo root に配置 | 📝 |
| S5 | Notice エラー文言整理 | 📝 |
| S6 | File Recovery 周知 README に追加 | 📝 |
| S7 | ZDD docs 最終化 (Stage 3c/3d 実装メモ docs/ai/) | 📝 |
| S8 | Fleeting 整理 | 📝 |

## COULD（時間あれば）

| ID | タスク |
|---|---|
| C1 | Stage 3e: UI 編集ボタン |
| C2 | ノード形状変更 UI |
| C3 | エッジラベル編集 |
| C4 | Undo / Redo |
| C5 | モバイル動作確認（M3 と統合） |
| C6 | 他プラグインとの干渉確認 |
| C7 | GitHub Issues template |
| C8 | demo GIF / video 作成 |
| C9 | i18n（UI 英語化） |
| C10 | CI セットアップ |

---

## 保留タスクの再開トリガー

- **M3 (モバイル)**: iPad / iPhone を入手 or 借りる機会で実機テスト。実機なしで進める場合は `isDesktopOnly: true` に設定して回避することも可
