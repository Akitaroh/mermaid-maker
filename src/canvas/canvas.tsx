/**
 * Atom-Canvas (Phase 3.5)
 * 設計: ../../../50_Mission/Mermaid Maker/Atom-Canvas.md
 */

import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type {
  EdgeControlMap,
  EdgeShape,
  Graph,
  NodeShape,
  PositionMap,
} from '../types/schema';
import {
  addNode,
  addEdge,
  updateNode,
  updateEdge,
  removeNode,
  removeEdge,
  toggleAcceptState,
} from '../graph/graph-ops';
import { computeEdgeOffsets } from '../edge-router/edge-router';
import { nodeTypes } from './nodes';
import { edgeTypes } from './edges';

export type HighlightStatus = 'running' | 'accepted' | 'rejected';

export type CanvasProps = {
  graph: Graph;
  positions: PositionMap;
  onPositionsChange: (next: PositionMap) => void;
  onGraphChange?: (next: Graph) => void;
  edgeControls?: EdgeControlMap;
  onEdgeControlsChange?: (next: EdgeControlMap) => void;
  highlightStates?: Set<string>;
  highlightStatus?: HighlightStatus;
};

const NODE_SHAPE_OPTIONS: NodeShape[] = ['circle', 'doubleCircle', 'box', 'rounded'];
const EDGE_SHAPE_OPTIONS: EdgeShape[] = ['default', 'straight', 'step', 'smoothstep'];

const EDGE_SHAPE_LABEL: Record<EdgeShape, string> = {
  default: '曲線',
  straight: '直線',
  step: '直角',
  smoothstep: '丸角',
};

export function Canvas({
  graph,
  positions,
  onPositionsChange,
  onGraphChange,
  edgeControls = {},
  onEdgeControlsChange,
  highlightStates,
  highlightStatus = 'running',
}: CanvasProps) {
  const editable = !!onGraphChange;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const reactFlow = useReactFlow();

  const handleNodeLabelChange = useCallback(
    (nodeId: string, label: string) => {
      if (!onGraphChange) return;
      onGraphChange(updateNode(graph, nodeId, { label }));
    },
    [graph, onGraphChange],
  );

  const handleEdgeLabelChange = useCallback(
    (edgeId: string, label: string) => {
      if (!onGraphChange) return;
      if (label === '') {
        onGraphChange(updateEdge(graph, edgeId, { label: undefined }));
      } else {
        onGraphChange(updateEdge(graph, edgeId, { label }));
      }
    },
    [graph, onGraphChange],
  );

  const handleControlPointChange = useCallback(
    (edgeId: string, point: { x: number; y: number }) => {
      if (!onEdgeControlsChange) return;
      onEdgeControlsChange({ ...edgeControls, [edgeId]: point });
    },
    [edgeControls, onEdgeControlsChange],
  );

  const edgeOffsets = useMemo(() => computeEdgeOffsets(graph.edges), [graph.edges]);

  const rfNodes: RFNode[] = useMemo(
    () =>
      graph.nodes.map((n) => {
        const isHighlighted = highlightStates?.has(n.id) ?? false;
        let highlightClass = '';
        if (isHighlighted) {
          if (highlightStatus === 'accepted') highlightClass = 'mm-hl-accepted';
          else if (highlightStatus === 'rejected') highlightClass = 'mm-hl-rejected';
          else highlightClass = 'mm-hl-running';
        }
        return {
          id: n.id,
          type: n.shape,
          data: {
            label: n.label,
            onLabelChange: editable
              ? (next: string) => handleNodeLabelChange(n.id, next)
              : undefined,
          },
          position: positions[n.id] ?? { x: 0, y: 0 },
          selected: n.id === selectedNodeId,
          className: highlightClass,
        };
      }),
    [
      graph.nodes,
      positions,
      editable,
      handleNodeLabelChange,
      selectedNodeId,
      highlightStates,
      highlightStatus,
    ],
  );

  // mouse coord → flow coord 変換クロージャを作る
  const screenToFlow = useCallback(
    (clientX: number, clientY: number) => {
      return reactFlow.screenToFlowPosition({ x: clientX, y: clientY });
    },
    [reactFlow],
  );

  const rfEdges: RFEdge[] = useMemo(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.source === e.target ? 'selfLoop' : 'default',
        data: {
          label: e.label,
          shape: e.shape,
          offsetIndex: edgeOffsets[e.id] ?? 0,
          controlPoint: edgeControls[e.id],
          onLabelChange: editable
            ? (next: string) => handleEdgeLabelChange(e.id, next)
            : undefined,
          onControlPointChange: onEdgeControlsChange
            ? (next: { x: number; y: number }) => {
                // ControlPointHandle が screen 座標で渡してくる場合があるので変換
                const flow = screenToFlow(next.x, next.y);
                handleControlPointChange(e.id, flow);
              }
            : undefined,
        },
        selected: e.id === selectedEdgeId,
      })),
    [
      graph.edges,
      editable,
      handleEdgeLabelChange,
      handleControlPointChange,
      onEdgeControlsChange,
      screenToFlow,
      selectedEdgeId,
      edgeControls,
      edgeOffsets,
    ],
  );

  const onNodesChange = (changes: NodeChange[]) => {
    let nextPositions: PositionMap | null = null;
    let nextGraph: Graph | null = null;

    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        if (!nextPositions) nextPositions = { ...positions };
        nextPositions[change.id] = { x: change.position.x, y: change.position.y };
      } else if (change.type === 'select') {
        if (change.selected) setSelectedNodeId(change.id);
        else if (selectedNodeId === change.id) setSelectedNodeId(null);
      } else if (change.type === 'remove' && onGraphChange) {
        nextGraph = removeNode(nextGraph ?? graph, change.id);
      }
    }

    if (nextPositions) onPositionsChange(nextPositions);
    if (nextGraph && onGraphChange) onGraphChange(nextGraph);
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    let nextGraph: Graph | null = null;

    for (const change of changes) {
      if (change.type === 'select') {
        if (change.selected) setSelectedEdgeId(change.id);
        else if (selectedEdgeId === change.id) setSelectedEdgeId(null);
      } else if (change.type === 'remove' && onGraphChange) {
        nextGraph = removeEdge(nextGraph ?? graph, change.id);
      }
    }

    if (nextGraph && onGraphChange) onGraphChange(nextGraph);
  };

  const onConnect = (conn: Connection) => {
    if (!onGraphChange) return;
    if (!conn.source || !conn.target) return;
    const { graph: next } = addEdge(graph, {
      source: conn.source,
      target: conn.target,
    });
    onGraphChange(next);
  };

  const handleAddNode = (shape: NodeShape) => {
    if (!onGraphChange) return;
    const { graph: next, node } = addNode(graph, { shape });
    onGraphChange(next);
    const center = reactFlow.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    onPositionsChange({ ...positions, [node.id]: center });
    setSelectedNodeId(node.id);
  };

  const handleToggleAccept = () => {
    if (!onGraphChange || !selectedNodeId) return;
    onGraphChange(toggleAcceptState(graph, selectedNodeId));
  };

  const handleSetEdgeShape = (shape: EdgeShape) => {
    if (!onGraphChange || !selectedEdgeId) return;
    onGraphChange(updateEdge(graph, selectedEdgeId, { shape }));
  };

  const handleResetEdgeControl = () => {
    if (!onEdgeControlsChange || !selectedEdgeId) return;
    const next = { ...edgeControls };
    delete next[selectedEdgeId];
    onEdgeControlsChange(next);
  };

  const selectedNode = selectedNodeId
    ? graph.nodes.find((n) => n.id === selectedNodeId)
    : null;
  const selectedEdge = selectedEdgeId
    ? graph.edges.find((e) => e.id === selectedEdgeId)
    : null;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {editable && (
        <div className="mm-canvas-toolbar">
          <span className="mm-toolbar-label">追加:</span>
          {NODE_SHAPE_OPTIONS.map((shape) => (
            <button
              key={shape}
              className="mm-tool-btn"
              onClick={() => handleAddNode(shape)}
              title={`${shape} ノードを追加`}
            >
              {shape === 'circle' && '◯'}
              {shape === 'doubleCircle' && '◎'}
              {shape === 'box' && '□'}
              {shape === 'rounded' && '▢'}
            </button>
          ))}
          <span className="mm-toolbar-divider" />
          <button
            className="mm-tool-btn"
            onClick={handleToggleAccept}
            disabled={
              !selectedNode ||
              (selectedNode.shape !== 'circle' &&
                selectedNode.shape !== 'doubleCircle')
            }
            title="受理状態 ◎ をトグル"
          >
            受理 ◯↔︎◎
          </button>
          {selectedEdge && (
            <>
              <span className="mm-toolbar-divider" />
              <span className="mm-toolbar-label">エッジ形状:</span>
              {EDGE_SHAPE_OPTIONS.map((shape) => (
                <button
                  key={shape}
                  className={`mm-tool-btn ${(selectedEdge.shape ?? 'default') === shape ? 'mm-tool-btn-active' : ''}`}
                  onClick={() => handleSetEdgeShape(shape)}
                  title={`エッジを${EDGE_SHAPE_LABEL[shape]}にする`}
                >
                  {EDGE_SHAPE_LABEL[shape]}
                </button>
              ))}
              {edgeControls[selectedEdge.id] && (
                <button
                  className="mm-tool-btn"
                  onClick={handleResetEdgeControl}
                  title="中間点をリセット"
                >
                  中間点リセット
                </button>
              )}
            </>
          )}
          {selectedNode && (
            <span className="mm-selection">
              選択: {selectedNode.id} ({selectedNode.label})
            </span>
          )}
          {selectedEdge && !selectedNode && (
            <span className="mm-selection">
              エッジ: {selectedEdge.id}
              {selectedEdge.label ? ` (${selectedEdge.label})` : ''}
            </span>
          )}
          <span className="mm-help">
            ダブルクリックでラベル編集 / Delete で削除 / 曲線エッジ選択時は青い点をドラッグ
          </span>
        </div>
      )}
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        deleteKeyCode={editable ? ['Delete', 'Backspace'] : null}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
