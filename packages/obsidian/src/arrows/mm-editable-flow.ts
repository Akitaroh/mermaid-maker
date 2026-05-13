/**
 * Arrow-MmEditableFlow (Stage 3a 段階)
 *
 * `mermaid-maker editable` flag が付いた code block を xyflow キャンバスとして
 * 描画する協調 Arrow。Stage 3a では read-only。3b 以降で write-back を足す。
 *
 * Flow (Stage 3a):
 *   1. source を Atom-MermaidParser で graph に変換
 *   2. Atom-PositionStore で source 中のコメント座標を抽出
 *   3. Atom-DagreLayout で未指定座標を補完
 *   4. graph + positions を xyflow Node[] / Edge[] に変換
 *   5. Atom-XyflowMounter で React マウント
 *   6. cleanup を MarkdownRenderChild に登録
 */

import { App, MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';
import {
  parseMermaid,
  extractPositionComments,
  type Graph,
  type Node as MmNode,
  type Edge as MmEdge,
  type PositionMap,
} from '@akitaroh/mermaid-core';
import { fillMissingPositions } from '../atoms/dagre-layout.js';
import { mountXyflow } from '../atoms/xyflow-mounter.js';

export async function renderMmEditableFlow(
  _app: App,
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
  const positions = fillMissingPositions(graph, stored, graph.direction);

  const rfNodes = graph.nodes.map((n: MmNode) => ({
    id: n.id,
    position: positions[n.id] ?? { x: 0, y: 0 },
    data: { label: (n.label ?? n.id).replace(/^"|"$/g, '') },
    draggable: false,
    // xyflow v12: measured を直接与えることで edge 端点計算を成立させる
    measured: { width: 140, height: 56 },
  }));
  const rfEdges = graph.edges.map((e: MmEdge) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label ?? undefined,
  }));

  const theme: 'light' | 'dark' = document.body.classList.contains('theme-dark') ? 'dark' : 'light';

  const handle = mountXyflow(el, { nodes: rfNodes, edges: rfEdges, theme });

  // unload 時の cleanup を Obsidian に預ける
  const child = new MarkdownRenderChild(el);
  child.onunload = () => handle.unmount();
  ctx.addChild(child);
}
