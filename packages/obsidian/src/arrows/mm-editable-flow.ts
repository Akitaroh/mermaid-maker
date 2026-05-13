/**
 * Arrow-MmEditableFlow (Stage 3b)
 *
 * `mermaid-maker %%editable%%` block を xyflow キャンバスとして描画 +
 * ノードドラッグを debounce 書戻し。
 *
 * Flow:
 *   1. source を Atom-MermaidParser で graph に変換
 *   2. Atom-PositionStore で source 中のコメント座標を抽出
 *   3. Atom-DagreLayout で未指定座標を補完
 *   4. graph + positions を xyflow Node[] / Edge[] に変換
 *   5. Atom-XyflowMounter で React マウント
 *      onPositionsChange を渡してドラッグを受ける
 *   6. ドラッグ毎に debounce 500ms で:
 *      a. emitMermaid(graph, latestPositions)
 *      b. `%%editable%%\n` を prepend
 *      c. Atom-MarkdownWriteBack で editor に書戻す
 *   7. cleanup を MarkdownRenderChild に登録
 */

import { App, MarkdownPostProcessorContext, MarkdownRenderChild, Notice } from 'obsidian';
import {
  parseMermaid,
  extractPositionComments,
  emitMermaid,
  type Graph,
  type Node as MmNode,
  type Edge as MmEdge,
  type PositionMap,
} from '@akitaroh/mermaid-core';
import { fillMissingPositions } from '../atoms/dagre-layout.js';
import { mountXyflow } from '../atoms/xyflow-mounter.js';
import { writeBackMmCodeBlock } from '../atoms/markdown-write-back.js';

const WRITE_BACK_DEBOUNCE_MS = 500;
const EDITABLE_FLAG_LINE = '%%editable%%';

export async function renderMmEditableFlow(
  app: App,
  source: string,
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
): Promise<void> {
  const parseResult = parseMermaid(source);
  if (!parseResult.ok) {
    el.empty();
    const err = el.createEl('pre', {
      text: `MermaidMaker parse error: ${parseResult.errors.map((e) => e.message).join('\n')}`,
    });
    err.style.color = 'var(--text-error)';
    return;
  }

  const graph: Graph = parseResult.graph;
  const stored: PositionMap = extractPositionComments(source);
  const initialPositions = fillMissingPositions(graph, stored, graph.direction);

  const rfNodes = graph.nodes.map((n: MmNode) => ({
    id: n.id,
    position: initialPositions[n.id] ?? { x: 0, y: 0 },
    data: { label: (n.label ?? n.id).replace(/^"|"$/g, '') },
    // xyflow v12: 描画と edge 端点計算の両方を成立させるには
    // style + measured の両方を渡す必要がある（v12 の controlled state 仕様）
    style: { width: 140, height: 56 },
    measured: { width: 140, height: 56 },
  }));
  const rfEdges = graph.edges.map((e: MmEdge) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label ?? undefined,
  }));

  const theme: 'light' | 'dark' = document.body.classList.contains('theme-dark') ? 'dark' : 'light';

  // --- Stage 3b: debounce write-back ----------------------------------------
  let pendingTimer: number | null = null;
  let latestPositions: PositionMap = initialPositions;

  const flush = () => {
    pendingTimer = null;
    const newSource = emitMermaid(graph, latestPositions);
    // %%editable%% を保持しないと次回 render で Stage 2b 分岐に戻ってしまう
    const withFlag = `${EDITABLE_FLAG_LINE}\n${newSource}`;
    const result = writeBackMmCodeBlock(app, ctx, el, withFlag);
    if (!result.ok) {
      console.warn('[mermaid-maker] write-back failed:', result.reason);
      // active-file-mismatch / not-markdown-view は静かに諦める
      // 想定外のものだけ Notice
      if (result.reason !== 'active-file-mismatch' && result.reason !== 'not-markdown-view') {
        new Notice(`MermaidMaker write-back failed: ${result.reason}`);
      }
    }
  };

  const scheduleWriteBack = (positions: PositionMap) => {
    latestPositions = positions;
    if (pendingTimer !== null) window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(flush, WRITE_BACK_DEBOUNCE_MS);
  };

  // --------------------------------------------------------------------------

  const handle = mountXyflow(el, {
    nodes: rfNodes,
    edges: rfEdges,
    theme,
    onPositionsChange: scheduleWriteBack,
  });

  const child = new MarkdownRenderChild(el);
  child.onunload = () => {
    if (pendingTimer !== null) {
      window.clearTimeout(pendingTimer);
      flush(); // unmount 直前に最後の書戻しを保証
    }
    handle.unmount();
  };
  ctx.addChild(child);
}
