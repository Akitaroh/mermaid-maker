/**
 * Atom-XyflowMounter
 *
 * 任意の HTMLElement に React + xyflow キャンバスをマウントする Adapter Atom。
 *
 * Stage 3a: read-only でノード/エッジ表示
 * Stage 3b: ノードドラッグ → 全ノード位置を通知
 * Stage 3d: ノードラベルを renderLabel コールバック経由でリッチ描画
 *
 * 設計判断:
 * - uncontrolled (defaultNodes/defaultEdges) + ReactFlowProvider で
 *   useReactFlow().getNodes() を使う構造
 * - renderLabel は React Context (RenderLabelContext) で custom node に伝播
 * - custom node 内で useEffect / MarkdownRenderChild ライフサイクル管理
 */

import { createContext, useContext, useEffect, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeProps,
} from '@xyflow/react';
import type { PositionMap } from '@akitaroh/mermaid-core';
import '@xyflow/react/dist/style.css';

/**
 * ラベル文字列を `el` に描画する関数。
 * 呼び出し側は cleanup（MarkdownRenderChild.unload 等）を返す。
 */
export type RenderLabelFn = (label: string, el: HTMLElement) => () => void;

const RenderLabelContext = createContext<RenderLabelFn | null>(null);

export type MountOptions = {
  nodes: RFNode[];
  edges: RFEdge[];
  theme?: 'light' | 'dark';
  /** Stage 3b: ドラッグ完了時に最新 positions を通知 */
  onPositionsChange?: (positions: PositionMap) => void;
  /** Stage 3d: ノードラベルを Obsidian DOM で描画したい場合のフック */
  renderLabel?: RenderLabelFn;
};

export type MountHandle = {
  unmount: () => void;
  update: (next: { nodes: RFNode[]; edges: RFEdge[] }) => void;
};

function extractPositions(nodes: RFNode[]): PositionMap {
  const map: PositionMap = {};
  for (const n of nodes) {
    map[n.id] = { x: n.position.x, y: n.position.y };
  }
  return map;
}

/**
 * Stage 3d: custom node。
 * data.label を RenderLabelContext 経由の関数で描画する。
 * 関数が提供されていなければ textContent でフォールバック。
 */
function MMNode(props: NodeProps) {
  const renderLabel = useContext(RenderLabelContext);
  const ref = useRef<HTMLDivElement>(null);
  const label = String((props.data as { label?: string })?.label ?? '');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.empty?.() ?? (el.innerHTML = '');
    if (renderLabel) {
      const cleanup = renderLabel(label, el);
      return cleanup;
    }
    el.textContent = label;
    return undefined;
  }, [renderLabel, label]);

  return (
    <>
      <Handle type="target" position={Position.Left} />
      <div ref={ref} className="mm-node-content" />
      <Handle type="source" position={Position.Right} />
    </>
  );
}

const NODE_TYPES = { mm: MMNode };

type InnerProps = {
  nodes: RFNode[];
  edges: RFEdge[];
  theme: 'light' | 'dark';
  draggable: boolean;
  onPositionsChange?: (positions: PositionMap) => void;
};

function CanvasInner({
  nodes,
  edges,
  theme,
  draggable,
  onPositionsChange,
}: InnerProps) {
  const { getNodes } = useReactFlow();
  return (
    <ReactFlow
      defaultNodes={nodes}
      defaultEdges={edges}
      nodeTypes={NODE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.2, includeHiddenNodes: true }}
      nodesDraggable={draggable}
      nodesConnectable={false}
      elementsSelectable={draggable}
      colorMode={theme}
      proOptions={{ hideAttribution: true }}
      onNodeDragStop={() => {
        onPositionsChange?.(extractPositions(getNodes()));
      }}
    >
      <Background gap={16} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export function mountXyflow(parent: HTMLElement, options: MountOptions): MountHandle {
  parent.empty();
  const wrapper = parent.createDiv();
  wrapper.style.cssText = [
    'display: block',
    'box-sizing: border-box',
    'height: 420px',
    'width: 100%',
    'min-width: 320px',
    'border: 1px solid var(--background-modifier-border)',
    'border-radius: 6px',
    'overflow: hidden',
    'position: relative',
  ].join(';');

  const root: Root = createRoot(wrapper);

  let currentNodes = options.nodes;
  let currentEdges = options.edges;
  const draggable = !!options.onPositionsChange;

  const render = () => {
    root.render(
      <RenderLabelContext.Provider value={options.renderLabel ?? null}>
        <ReactFlowProvider>
          <CanvasInner
            nodes={currentNodes}
            edges={currentEdges}
            theme={options.theme === 'dark' ? 'dark' : 'light'}
            draggable={draggable}
            onPositionsChange={options.onPositionsChange}
          />
        </ReactFlowProvider>
      </RenderLabelContext.Provider>,
    );
  };

  render();

  return {
    unmount: () => {
      root.unmount();
    },
    update: (next) => {
      currentNodes = next.nodes;
      currentEdges = next.edges;
      render();
    },
  };
}
