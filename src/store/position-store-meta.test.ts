import { describe, it, expect } from 'vitest';
import {
  parseEdgeCtrlComment,
  formatEdgeCtrlComment,
  extractEdgeCtrlComments,
  parseEdgeShapeComment,
  formatEdgeShapeComment,
  extractEdgeShapeComments,
  stripAllMetaComments,
} from './position-store';

describe('edge-ctrl meta', () => {
  it('parse', () => {
    expect(parseEdgeCtrlComment('%% mm-edge-ctrl: e0=100,200 e1=300,400')).toEqual({
      e0: { x: 100, y: 200 },
      e1: { x: 300, y: 400 },
    });
  });

  it('format', () => {
    expect(formatEdgeCtrlComment({ e0: { x: 100, y: 200 } })).toBe(
      '%% mm-edge-ctrl: e0=100,200',
    );
  });

  it('roundtrip', () => {
    const original = { e0: { x: 50.5, y: -100 } };
    expect(parseEdgeCtrlComment(formatEdgeCtrlComment(original))).toEqual(original);
  });
});

describe('edge-shape meta', () => {
  it('parse', () => {
    expect(parseEdgeShapeComment('%% mm-edge-shape: e0=step e1=straight')).toEqual({
      e0: 'step',
      e1: 'straight',
    });
  });

  it('format', () => {
    expect(formatEdgeShapeComment({ e0: 'step' })).toBe('%% mm-edge-shape: e0=step');
  });

  it('roundtrip', () => {
    const original = { e0: 'step' as const, e1: 'smoothstep' as const };
    expect(parseEdgeShapeComment(formatEdgeShapeComment(original))).toEqual(original);
  });

  it('extract from multiline', () => {
    const text = `graph LR
A-->B
%% mm-edge-shape: e0=step
%% mm-edge-shape: e1=straight`;
    expect(extractEdgeShapeComments(text)).toEqual({ e0: 'step', e1: 'straight' });
  });
});

describe('stripAllMetaComments', () => {
  it('全種類のメタコメントを削除', () => {
    const text = `graph LR
A-->B
%% mm-pos: A=1,2
%% mm-edge-shape: e0=step
%% mm-edge-ctrl: e0=10,20`;
    expect(stripAllMetaComments(text)).toBe('graph LR\nA-->B');
  });
});

describe('extract collisions', () => {
  it('mm-pos と mm-edge-ctrl の prefix が混同されない', () => {
    const text = `%% mm-pos: A=1,2
%% mm-edge-ctrl: e0=3,4`;
    expect(extractEdgeCtrlComments(text)).toEqual({ e0: { x: 3, y: 4 } });
  });
});
