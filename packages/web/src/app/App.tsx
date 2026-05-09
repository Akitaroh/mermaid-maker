/**
 * Arrow-SyncDispatcher (MermaidMaker)
 * Phase 2/3/3.5/4: テキスト↔GUI同期 / GUI編集 / 平行エッジ整理 / 公開準備機能
 */

import { useEffect, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

import { emptyGraph } from '@akitaroh/mermaid-core';
import type {
  EdgeControlMap,
  Graph,
  ParseError,
  PositionMap,
} from '@akitaroh/mermaid-core';
import { parseMermaid } from '@akitaroh/mermaid-core';
import { emitMermaid } from '@akitaroh/mermaid-core';
import { fillMissingPositions } from '../canvas/layout';
import { Canvas } from '../canvas/canvas';
import { copyToClipboard } from '../persistence/clipboard';
import { setURLState, readURLState } from '../persistence/url-state';
import { saveText, loadText } from '../persistence/local-store';
import { SAMPLES, getSample } from '../samples/samples';
import './app.css';

const DEFAULT_TEXT = `graph LR
    start((開始))
    proc[処理する]
    branch[条件OK?]
    fin(((完了)))
    start --> proc
    proc --> branch
    branch -->|Yes| fin
    branch -->|No| proc
%% mm-pos: start=40,80 proc=180,80 branch=320,80 fin=480,80`;

function getInitialText(): string {
  // 優先順: URL hash > LocalStorage > DEFAULT
  const fromUrl = readURLState();
  if (fromUrl) return fromUrl;
  const fromLocal = loadText();
  if (fromLocal) return fromLocal;
  return DEFAULT_TEXT;
}

export function App() {
  const [text, setText] = useState<string>(getInitialText);
  const [graph, setGraph] = useState<Graph>(emptyGraph);
  const [positions, setPositions] = useState<PositionMap>({});
  const [edgeControls, setEdgeControls] = useState<EdgeControlMap>({});
  const [parseError, setParseError] = useState<ParseError | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string>('');

  // 初回マウント時に自動で text→GUI 同期
  useEffect(() => {
    syncTextToGui(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // text 変更を LocalStorage に debounce 保存
  useEffect(() => {
    const t = setTimeout(() => saveText(text), 300);
    return () => clearTimeout(t);
  }, [text]);

  function syncTextToGui(target?: string) {
    const src = target ?? text;
    const result = parseMermaid(src);
    if (!result.ok) {
      setParseError(result.error);
      return;
    }
    setParseError(null);
    const filled = fillMissingPositions(result.graph, result.positions);
    setGraph(result.graph);
    setPositions(filled);
    setEdgeControls(result.edgeControls);
  }

  function syncGuiToText() {
    const next = emitMermaid(graph, positions, { edgeControls });
    setText(next);
  }

  async function handleCopy() {
    const result = await copyToClipboard(text);
    setCopyFeedback(result.ok ? '✓ コピー済み' : '✗ コピー失敗');
    setTimeout(() => setCopyFeedback(''), 2000);
  }

  function handleShareURL() {
    setURLState(text);
    copyToClipboard(location.href).then((r) => {
      setCopyFeedback(r.ok ? '✓ URL をコピー済み' : '✗ URL コピー失敗');
      setTimeout(() => setCopyFeedback(''), 2000);
    });
  }

  function handleSelectSample(id: string) {
    if (!id) return;
    const sample = getSample(id);
    if (!sample) return;
    setText(sample.text);
    syncTextToGui(sample.text);
  }

  return (
    <div className="mm-app">
      <div className="mm-panes">
        <div className="mm-pane mm-pane-text">
          <textarea
            className="mm-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="mm-pane mm-pane-canvas">
          <ReactFlowProvider>
            <Canvas
              graph={graph}
              positions={positions}
              onPositionsChange={setPositions}
              onGraphChange={setGraph}
              edgeControls={edgeControls}
              onEdgeControlsChange={setEdgeControls}
            />
          </ReactFlowProvider>
        </div>
      </div>

      <div className="mm-toolbar">
        <button className="mm-btn" onClick={() => syncTextToGui()}>
          テキスト → GUI 同期 ▶
        </button>
        <button className="mm-btn" onClick={syncGuiToText}>
          ◀ GUI → テキスト 同期
        </button>
        <span className="mm-toolbar-divider" />
        <button className="mm-btn" onClick={handleCopy} title="Mermaid テキストをコピー">
          📋 コピー
        </button>
        <button className="mm-btn" onClick={handleShareURL} title="共有 URL を生成">
          🔗 URL 共有
        </button>
        <span className="mm-toolbar-divider" />
        <span>サンプル:</span>
        <select
          className="mm-sample-select"
          value=""
          onChange={(e) => handleSelectSample(e.target.value)}
        >
          <option value="">選択...</option>
          {SAMPLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
        {copyFeedback && <span className="mm-sim-status mm-sim-status-accepted">{copyFeedback}</span>}
        {parseError && (
          <span className="mm-error">
            {parseError.line ? `Line ${parseError.line}: ` : ''}
            {parseError.message}
          </span>
        )}
      </div>
    </div>
  );
}
