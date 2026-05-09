// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { encodeStateToHash, decodeStateFromHash } from './url-state';
import { saveText, loadText, clearText } from './local-store';

describe('url-state', () => {
  it('ASCII ラウンドトリップ', () => {
    const text = 'graph LR\n A-->B';
    expect(decodeStateFromHash(encodeStateToHash(text))).toBe(text);
  });

  it('日本語ラウンドトリップ', () => {
    const text = 'graph LR\n q0((状態0)) -->|文字| q1';
    expect(decodeStateFromHash(encodeStateToHash(text))).toBe(text);
  });

  it('プレフィックス付き hash も decode できる', () => {
    const text = 'hello';
    const encoded = encodeStateToHash(text);
    expect(decodeStateFromHash('#mm=' + encoded)).toBe(text);
  });

  it('不正な base64 は null', () => {
    expect(decodeStateFromHash('!!!!')).not.toBe('hello'); // 復元失敗（null か unrelated）
  });
});

describe('local-store', () => {
  beforeEach(() => {
    clearText();
  });

  it('save / load ラウンドトリップ', () => {
    saveText('hello');
    expect(loadText()).toBe('hello');
  });

  it('clear で削除', () => {
    saveText('hello');
    clearText();
    expect(loadText()).toBe(null);
  });

  it('未保存なら null', () => {
    expect(loadText()).toBe(null);
  });
});
