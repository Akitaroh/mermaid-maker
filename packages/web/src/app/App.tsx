/**
 * Arrow-SyncDispatcher (MermaidMaker)
 * Phase 2/3/3.5/4: テキスト↔GUI同期 / GUI編集 / 平行エッジ整理 / 公開準備機能
 * Phase 5.4: BoardStore + SessionBridge + BoardTabs を統合
 *   - text の真実は常に BoardStore（active board の mermaid）
 *   - ?session=xxx があれば WSClient + SessionBridge で他タブ・MCP と同期
 *   - 無ければ default board 1個のローカル運用
 */

import { useEffect, useMemo, useState } from 'react';
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
import { createBoardStore } from '../board/board-store';
import { useBoardStore } from '../board/use-board-store';
import { BoardTabs } from '../board/board-tabs';
import { parseSessionFromUrl } from '../session/url-parser';
import { useSessionBridge } from '../session/use-session-bridge';
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

const DEFAULT_BOARD_ID = 'default';
const WS_URL =
  (import.meta.env.VITE_MM_WS_URL as string | undefined) ??
  'ws://localhost:7331';

function getInitialText(): string {
  // 優先順: URL hash > LocalStorage > DEFAULT
  const fromUrl = readURLState();
  if (fromUrl) return fromUrl;
  const fromLocal = loadText();
  if (fromLocal) return fromLocal;
  return DEFAULT_TEXT;
}

export function App() {
  // 1) BoardStore is the single source of truth for board content.
  const store = useMemo(() => createBoardStore(), []);

  // 2) Detect ?session=xxx; null → local-only mode.
  const sessionInfo = useMemo(
    () => parseSessionFromUrl(window.location.href),
    []
  );
  const sessionId = sessionInfo?.sessionId ?? null;

  // 3) Wire ws bridge if there is a session.
  const { status: wsStatus } = useSessionBridge({
    url: WS_URL,
    sessionId,
    store,
  });

  // 4) Initialize: when no session, ensure default board exists with seed text.
  //    When session exists, leave store empty — server will populate via set_board.
  useEffect(() => {
    if (sessionId) return;
    if (Object.keys(store.getState().boards).length === 0) {
      store.upsertBoard(DEFAULT_BOARD_ID, getInitialText());
    }
  }, [sessionId, store]);

  // 5) Subscribe to active board view.
  const view = useBoardStore(store, (s) => ({
    activeBoardId: s.activeBoardId,
    text: s.activeBoardId
      ? (s.boards[s.activeBoardId]?.mermaid ?? '')
      : '',
    boards: Object.values(s.boards).map((b) => ({ id: b.id })),
  }));

  const text = view.text;
  function setText(next: string) {
    if (!view.activeBoardId) return;
    store.upsertBoard(view.activeBoardId, next);
  }

  // 6) Derived GUI state per current text.
  const [graph, setGraph] = useState<Graph>(emptyGraph);
  const [positions, setPositions] = useState<PositionMap>({});
  const [edgeControls, setEdgeControls] = useState<EdgeControlMap>({});
  const [parseError, setParseError] = useState<ParseError | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string>('');

  // 7) Keep GUI in sync with active board's text.
  //    Re-parse whenever text or activeBoardId changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (text === '') return;
    syncTextToGui(text);
  }, [text, view.activeBoardId]);

  // 8) LocalStorage save: only meaningful in local-only mode.
  useEffect(() => {
    if (sessionId) return;
    const t = setTimeout(() => saveText(text), 300);
    return () => clearTimeout(t);
  }, [text, sessionId]);

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
  }

  return (
    <div className="mm-app">
      <BoardTabs
        boards={view.boards}
        activeBoardId={view.activeBoardId}
        onSelect={(id) => store.setActive(id)}
      />
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
        {sessionId && (
          <span className="mm-session-status" title={`Session: ${sessionId}`}>
            {wsStatus === 'open'
              ? `🟢 session: ${sessionId}`
              : wsStatus === 'connecting'
              ? `🟡 connecting...`
              : `⚪️ session: ${sessionId} (offline)`}
          </span>
        )}
      </div>
    </div>
  );
}
