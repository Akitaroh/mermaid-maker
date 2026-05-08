# Contributing to MermaidMaker

Thanks for your interest! This is a small personal OSS project — feedback, bug reports and PRs are all welcome.

## Quick start

```bash
git clone https://github.com/Akitaroh/mermaid-maker.git
cd mermaid-maker
npm install
npm run dev      # http://localhost:5173
npm test         # run unit tests
```

Node.js 18+ recommended.

## How to report a bug

Use [Issues](https://github.com/Akitaroh/mermaid-maker/issues) with the bug report template. Include:
- What Mermaid text you used
- What you expected
- What actually happened
- Browser & OS

## How to suggest a feature

Open an Issue with the feature request template. **Mermaid 構文サポート追加要望**は特に歓迎（現状は `graph LR/TD` の最小サブセット）。

## Code style

- TypeScript strict
- 4-space indentation in JSX, 2-space elsewhere (follow existing code)
- Tests go next to the source file (`foo.ts` + `foo.test.ts`)
- Run `npm test` and `npm run build` before opening a PR

## Architecture

This project uses [Zettel-Driven Development (ZDD)](https://github.com/akitaroh/zdd). Each feature is an "Atom" — a pure function module that can be tested in isolation. See `src/` directories:

- `mermaid/` — Mermaid text ↔ Internal AST
- `store/` — Position/edge metadata in `%% mm-pos:` comments
- `canvas/` — reactflow-based GUI rendering
- `graph/` — Graph CRUD pure functions
- `edge-router/` — Parallel edge auto-separation
- `persistence/` — Clipboard / URL hash / LocalStorage
- `samples/` — Sample diagrams

The same Atoms are reused in [AutomataLab](https://github.com/Akitaroh/automatalab) (FSM educational tool).

## License

By contributing you agree your contributions will be licensed under the [MIT License](LICENSE).
