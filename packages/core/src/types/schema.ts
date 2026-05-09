/**
 * Internal AST schema for MermaidMaker
 * 設計: ../../50_Mission/Mermaid Maker/30_How.md
 */

export type Direction = 'LR' | 'TD';

export type NodeShape = 'circle' | 'doubleCircle' | 'box' | 'rounded';

export type Node = {
  id: string;
  label: string;
  shape: NodeShape;
};

export type EdgeShape = 'default' | 'straight' | 'step' | 'smoothstep';

export type Edge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  shape?: EdgeShape;
};

export type Graph = {
  direction: Direction;
  nodes: Node[];
  edges: Edge[];
};

export type Position = { x: number; y: number };

export type PositionMap = Record<string, Position>;

export type EdgeControlMap = Record<string, Position>;
export type EdgeShapeMap = Record<string, EdgeShape>;

export type ParseError = {
  message: string;
  line?: number;
};

export type ParseResult =
  | {
      ok: true;
      graph: Graph;
      positions: PositionMap;
      edgeControls: EdgeControlMap;
      edgeShapes: EdgeShapeMap;
    }
  | { ok: false; error: ParseError };

export const emptyGraph: Graph = {
  direction: 'LR',
  nodes: [],
  edges: [],
};
