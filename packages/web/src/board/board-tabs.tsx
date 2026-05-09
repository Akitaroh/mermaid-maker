/**
 * Atom-BoardTabs
 *
 * 複数 Board のタブ UI（presentational）。
 * 設計: ../../../50_Mission/MermaidMaker/Atom-BoardTabs.md
 */

import './board-tabs.css';

export type BoardTabsProps = {
  boards: { id: string }[];
  activeBoardId: string | null;
  onSelect: (id: string) => void;
};

export function BoardTabs({ boards, activeBoardId, onSelect }: BoardTabsProps) {
  if (boards.length === 0) return null;
  return (
    <div className="board-tabs" role="tablist">
      {boards.map((b) => {
        const isActive = b.id === activeBoardId;
        return (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={
              'board-tab' + (isActive ? ' board-tab--active' : '')
            }
            onClick={() => onSelect(b.id)}
          >
            {b.id}
          </button>
        );
      })}
    </div>
  );
}
