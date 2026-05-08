import { describe, it, expect } from 'vitest';
import {
  parsePositionComment,
  formatPositionComment,
  extractPositionComments,
  stripPositionComments,
} from './position-store';

describe('position-store', () => {
  it('parsePositionComment: 基本', () => {
    expect(parsePositionComment('%% mm-pos: A=100,200 B=300,200')).toEqual({
      A: { x: 100, y: 200 },
      B: { x: 300, y: 200 },
    });
  });

  it('parsePositionComment: 小数', () => {
    expect(parsePositionComment('%% mm-pos: A=100.5,200.25')).toEqual({
      A: { x: 100.5, y: 200.25 },
    });
  });

  it('parsePositionComment: 負数', () => {
    expect(parsePositionComment('%% mm-pos: A=-50,-100')).toEqual({
      A: { x: -50, y: -100 },
    });
  });

  it('parsePositionComment: 非対象行は空', () => {
    expect(parsePositionComment('graph LR')).toEqual({});
  });

  it('formatPositionComment: 基本', () => {
    expect(formatPositionComment({ A: { x: 100, y: 200 } })).toBe(
      '%% mm-pos: A=100,200',
    );
  });

  it('formatPositionComment: 空', () => {
    expect(formatPositionComment({})).toBe('');
  });

  it('ラウンドトリップ', () => {
    const original = { A: { x: 100, y: 200 }, B: { x: 300.5, y: -200 } };
    expect(parsePositionComment(formatPositionComment(original))).toEqual(original);
  });

  it('extractPositionComments: 複数行マージ', () => {
    const text = `graph LR
A-->B
%% mm-pos: A=1,2
%% mm-pos: B=3,4`;
    expect(extractPositionComments(text)).toEqual({
      A: { x: 1, y: 2 },
      B: { x: 3, y: 4 },
    });
  });

  it('stripPositionComments: 削除', () => {
    const text = `graph LR
A-->B
%% mm-pos: A=1,2`;
    expect(stripPositionComments(text)).toBe('graph LR\nA-->B');
  });
});
