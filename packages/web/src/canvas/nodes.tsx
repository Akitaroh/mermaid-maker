/**
 * Atom-Canvas - カスタムノード4種（Phase 3: inline label 編集対応）
 * 設計: ../../../50_Mission/Mermaid Maker/Atom-Canvas.md
 */

import { useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';

const NODE_W = 80;
const NODE_H = 60;

export type NodeData = {
  label: string;
  onLabelChange?: (next: string) => void;
};

type CustomNodeProps = {
  data: NodeData;
};

/**
 * Place a source AND a target handle on each of the 4 sides so the user can
 * drag-to-create from any direction, and so existing edges can snap to any side.
 *
 * xyflow requires unique (type, id) per handle on the same node, hence the
 * `s-<pos>` / `t-<pos>` ids. Edges that don't pin a sourceHandle/targetHandle
 * fall back to the closest matching handle by side.
 */
function HandlesAround() {
  const sides: Array<['left' | 'right' | 'top' | 'bottom', Position]> = [
    ['left', Position.Left],
    ['right', Position.Right],
    ['top', Position.Top],
    ['bottom', Position.Bottom],
  ];
  const style = { background: '#888', width: 8, height: 8 };
  return (
    <>
      {sides.map(([key, pos]) => (
        <Handle
          key={`s-${key}`}
          type="source"
          position={pos}
          id={`s-${key}`}
          style={style}
        />
      ))}
      {sides.map(([key, pos]) => (
        <Handle
          key={`t-${key}`}
          type="target"
          position={pos}
          id={`t-${key}`}
          style={style}
        />
      ))}
    </>
  );
}

/**
 * label 表示と編集の切り替え。ダブルクリックで input になる
 */
function EditableLabel({
  label,
  onLabelChange,
  fontSize = 14,
}: {
  label: string;
  onLabelChange?: (next: string) => void;
  fontSize?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);

  useEffect(() => {
    setDraft(label);
  }, [label]);

  if (editing && onLabelChange) {
    return (
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
            setDraft(label);
            setEditing(false);
          }
          e.stopPropagation(); // reactflow のキーボード処理に流さない
        }}
        autoFocus
        className="mm-label-input"
        style={{ fontSize }}
      />
    );
  }

  return (
    <div
      onDoubleClick={(e) => {
        if (onLabelChange) {
          setEditing(true);
          e.stopPropagation();
        }
      }}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        pointerEvents: 'all',
        cursor: onLabelChange ? 'text' : 'default',
      }}
    >
      {label}
    </div>
  );
}

export function CircleNode({ data }: CustomNodeProps) {
  return (
    <div
      className="mm-node mm-circle"
      style={{ width: NODE_W, height: NODE_H, position: 'relative' }}
    >
      <svg width={NODE_W} height={NODE_H} style={{ pointerEvents: 'none' }}>
        <circle
          cx={NODE_W / 2}
          cy={NODE_H / 2}
          r={Math.min(NODE_W, NODE_H) / 2 - 2}
          fill="#fff"
          stroke="#333"
          strokeWidth={2}
        />
      </svg>
      <EditableLabel label={data.label} onLabelChange={data.onLabelChange} />
      <HandlesAround />
    </div>
  );
}

export function DoubleCircleNode({ data }: CustomNodeProps) {
  const r = Math.min(NODE_W, NODE_H) / 2 - 2;
  return (
    <div
      className="mm-node mm-double-circle"
      style={{ width: NODE_W, height: NODE_H, position: 'relative' }}
    >
      <svg width={NODE_W} height={NODE_H} style={{ pointerEvents: 'none' }}>
        <circle
          cx={NODE_W / 2}
          cy={NODE_H / 2}
          r={r}
          fill="#fff"
          stroke="#333"
          strokeWidth={2}
        />
        <circle
          cx={NODE_W / 2}
          cy={NODE_H / 2}
          r={r - 5}
          fill="none"
          stroke="#333"
          strokeWidth={2}
        />
      </svg>
      <EditableLabel label={data.label} onLabelChange={data.onLabelChange} />
      <HandlesAround />
    </div>
  );
}

export function BoxNode({ data }: CustomNodeProps) {
  return (
    <div
      className="mm-node mm-box"
      style={{ width: NODE_W, height: NODE_H, position: 'relative' }}
    >
      <svg width={NODE_W} height={NODE_H} style={{ pointerEvents: 'none' }}>
        <rect
          x={2}
          y={2}
          width={NODE_W - 4}
          height={NODE_H - 4}
          fill="#fff"
          stroke="#333"
          strokeWidth={2}
        />
      </svg>
      <EditableLabel label={data.label} onLabelChange={data.onLabelChange} />
      <HandlesAround />
    </div>
  );
}

export function RoundedNode({ data }: CustomNodeProps) {
  return (
    <div
      className="mm-node mm-rounded"
      style={{ width: NODE_W, height: NODE_H, position: 'relative' }}
    >
      <svg width={NODE_W} height={NODE_H} style={{ pointerEvents: 'none' }}>
        <rect
          x={2}
          y={2}
          width={NODE_W - 4}
          height={NODE_H - 4}
          rx={NODE_H / 2}
          ry={NODE_H / 2}
          fill="#fff"
          stroke="#333"
          strokeWidth={2}
        />
      </svg>
      <EditableLabel label={data.label} onLabelChange={data.onLabelChange} />
      <HandlesAround />
    </div>
  );
}

export const nodeTypes = {
  circle: CircleNode,
  doubleCircle: DoubleCircleNode,
  box: BoxNode,
  rounded: RoundedNode,
};
