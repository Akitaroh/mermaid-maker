# AI実装メモ: Atom-BoardTabs

**設計**: `../../../50_Mission/MermaidMaker/Atom-BoardTabs.md`

---

## ファイル配置

```
packages/web/src/board/board-tabs.tsx        本体
packages/web/src/board/board-tabs.test.tsx   ユニットテスト（@testing-library/react）
packages/web/src/board/board-tabs.css        スタイル
```

## 決定log

### Pure presentational component

state を持たない。`boards` / `activeBoardId` / `onSelect` を props で受け、クリックを onSelect で発火するだけ。BoardStore との結線は呼び出し側（App.tsx）で行う。

### スタイル: 軽量 CSS

`tailwind` 等は入れない。app.css と同じ流派で、専用の `board-tabs.css` を1ファイル足す。

```css
.board-tabs { display: flex; gap: 4px; ... }
.board-tab { padding: 6px 12px; cursor: pointer; ... }
.board-tab--active { border-bottom: 2px solid #3b82f6; ... }
.board-tab--new { animation: highlight 1s ease-out; }
```

### 新 Board ハイライト animation

設計の「新 Board 出現時に短いハイライト」は CSS animation でやる。Phase 5.2 では simple な `--new` クラスを 1秒だけ付与する controller を hook 化（`useBoardArrivalHighlight`）。MVP では実装スキップしてもいい — まず tabs UI のテストが通ればOK。

→ **Phase 5.2 では Tab UI のみ実装、ハイライトは次の polish 段階で追加**。

### テスト: @testing-library/react を追加

これまで RTL を使っていなかったので devDep に追加。Phase 5 以降の React コンポーネント全般で使うため、投資する価値あり。

```
@testing-library/react
@testing-library/jest-dom (任意)
```

### Empty 状態

`boards.length === 0` の時は何も表示しない（高さもゼロ）。プレースホルダ「Board はまだありません」とかは入れない（AI が show する想定なので、表示そのものが起きない）。

## 実装後の追記

### 1. RTL は `@testing-library/react` + `@testing-library/dom`

vitest + jsdom 環境で RTL を初導入。`render` / `screen` / `fireEvent` で素直に書ける。`afterEach(cleanup)` を入れないとテスト間でDOMが残るので注意。

### 2. `aria-selected` 属性で active を表現

CSS class（`board-tab--active`）だけでなく `aria-selected` も付けた。アクセシビリティ + テスト容易性 + デバッグ時の DOM 検査容易性。

### 3. 新 Board ハイライト animation はスキップ

設計の polish 部分。Phase 5.2 では tabs UI 本体のみ。後から追加でき、影響範囲が小さいので「動くもの優先」。

### 4. CSS は CSS Modules ではなく素のglobal

既存 `app.css` も global で書かれているのでそれに合わせた。`board-tabs.css` を import すると Vite が bundle に含める。

### 5. テスト 5/5 passing

UI ロジックは薄いので少数で十分カバー。

