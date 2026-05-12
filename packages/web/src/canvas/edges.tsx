/**
 * Atom-Canvas - エッジ（ラベル編集 + 形状切替 + 並行オフセット + 制御点ドラッグ）
 * 設計: ../../../50_Mission/Mermaid Maker/Atom-Canvas.md
 */

import { useState, useEffect, useRef } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

import type { EdgeShape } from '@akitaroh/mermaid-core';

export type EdgeData = {
  label?: string;
  shape?: EdgeShape;
  offsetIndex?: number;
  controlPoint?: { x: number; y: number };
  onLabelChange?: (next: string) => void;
  onControlPointChange?: (point: { x: number; y: number }) => void;
};

const PARALLEL_OFFSET_PX = 50;

function EditableEdgeLabel({
  label,
  onLabelChange,
  x,
  y,
}: {
  label?: string;
  onLabelChange?: (next: string) => void;
  x: number;
  y: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label ?? '');

  useEffect(() => {
    setDraft(label ?? '');
  }, [label]);

  if (!label && !editing && !onLabelChange) return null;

  return (
    <EdgeLabelRenderer>
      <div
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
          background: 'white',
          padding: '2px 6px',
          fontSize: 12,
          borderRadius: 3,
          border: '1px solid #ccc',
          pointerEvents: 'all',
        }}
        className="nodrag nopan"
        onDoubleClick={(e) => {
          if (onLabelChange) {
            setEditing(true);
            e.stopPropagation();
          }
        }}
      >
        {editing && onLabelChange ? (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              onLabelChange(draft);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onLabelChange(draft);
                setEditing(false);
              } else if (e.key === 'Escape') {
                setDraft(label ?? '');
                setEditing(false);
              }
              e.stopPropagation();
            }}
            autoFocus
            className="mm-label-input"
            style={{ fontSize: 12, width: 80 }}
          />
        ) : (
          <span style={{ cursor: onLabelChange ? 'text' : 'default' }}>
            {label || (onLabelChange ? '+' : '')}
          </span>
        )}
      </div>
    </EdgeLabelRenderer>
  );
}

/**
 * 中間点ドラッグハンドル（選択中のみ表示）
 */
function ControlPointHandle({
  x,
  y,
  onChange,
  reactFlowGetCoord,
}: {
  x: number;
  y: number;
  onChange: (next: { x: number; y: number }) => void;
  reactFlowGetCoord: (clientX: number, clientY: number) => { x: number; y: number };
}) {
  const dragging = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const flow = reactFlowGetCoord(e.clientX, e.clientY);
      onChange(flow);
    };
    const onUp = () => {
      dragging.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onChange, reactFlowGetCoord]);

  return (
    <EdgeLabelRenderer>
      <div
        className="nodrag nopan mm-edge-ctrl-handle"
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#0066cc',
          border: '2px solid white',
          cursor: 'grab',
          pointerEvents: 'all',
        }}
        onMouseDown={(e) => {
          dragging.current = true;
          e.stopPropagation();
          e.preventDefault();
        }}
      />
    </EdgeLabelRenderer>
  );
}

/**
 * 通常エッジ（ラベル編集 + 形状切替 + 並行オフセット + 制御点ドラッグ）
 */
export function LabeledEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps) {
  void source;
  void target;
  const d = data as EdgeData | undefined;
  const shape = d?.shape ?? 'default';
  const offsetIndex = d?.offsetIndex ?? 0;
  const customCtrl = d?.controlPoint;

  // 平行エッジの自動オフセット計算
  const mx = (sourceX + targetX) / 2;
  const my = (sourceY + targetY) / 2;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const autoOffset = offsetIndex * PARALLEL_OFFSET_PX;
  const autoCtrlX = mx + px * autoOffset;
  const autoCtrlY = my + py * autoOffset;

  const ctrlX = customCtrl?.x ?? autoCtrlX;
  const ctrlY = customCtrl?.y ?? autoCtrlY;

  let path: string;
  let labelX = ctrlX;
  let labelY = ctrlY;

  switch (shape) {
    case 'straight':
      path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
      labelX = mx;
      labelY = my;
      break;
    case 'step': {
      const [p, lx, ly] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 0,
      });
      path = p;
      labelX = lx;
      labelY = ly;
      break;
    }
    case 'smoothstep': {
      const [p, lx, ly] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });
      path = p;
      labelX = lx;
      labelY = ly;
      break;
    }
    default:
      // 二次ベジエ: 制御点 (ctrlX, ctrlY) を経由。
      // ラベルは制御点ではなく **曲線上の中点** B(0.5) に置く。
      // 制御点ハンドルは曲線から離れた位置にあるので、これでラベルと
      // ハンドルが重ならず両方クリックできる。
      path = `M ${sourceX} ${sourceY} Q ${ctrlX} ${ctrlY} ${targetX} ${targetY}`;
      labelX = 0.25 * sourceX + 0.5 * ctrlX + 0.25 * targetX;
      labelY = 0.25 * sourceY + 0.5 * ctrlY + 0.25 * targetY;
  }

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} />
      <EditableEdgeLabel
        label={d?.label}
        onLabelChange={d?.onLabelChange}
        x={labelX}
        y={labelY}
      />
      {selected && shape === 'default' && d?.onControlPointChange && (
        <ControlPointHandle
          x={ctrlX}
          y={ctrlY}
          onChange={d.onControlPointChange}
          reactFlowGetCoord={(clientX, clientY) => {
            // viewport coord → flow coord 変換は Canvas 側から渡す
            return { x: clientX, y: clientY };
          }}
        />
      )}
    </>
  );
}

/**
 * 自己ループエッジ
 */
export function SelfLoopEdge({
  id,
  sourceX,
  sourceY,
  data,
  markerEnd,
}: EdgeProps) {
  const d = data as EdgeData | undefined;
  const offsetIndex = d?.offsetIndex ?? 0;
  // 複数自己ループは半径を増やす
  const r = 30 + offsetIndex * 18;
  const cx = sourceX;
  const cy = sourceY - r;

  const startX = cx - r * 0.5;
  const startY = cy + r * 0.866;
  const endX = cx + r * 0.5;
  const endY = cy + r * 0.866;
  const path = `M ${startX} ${startY} A ${r} ${r} 0 1 1 ${endX} ${endY}`;

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} />
      <EditableEdgeLabel
        label={d?.label}
        onLabelChange={d?.onLabelChange}
        x={cx}
        y={cy - r}
      />
    </>
  );
}

export const edgeTypes = {
  default: LabeledEdge,
  selfLoop: SelfLoopEdge,
};
