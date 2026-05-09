// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { BoardTabs } from './board-tabs.js';

afterEach(cleanup);

describe('BoardTabs', () => {
  it('renders nothing when boards is empty', () => {
    const { container } = render(
      <BoardTabs boards={[]} activeBoardId={null} onSelect={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one tab per board', () => {
    render(
      <BoardTabs
        boards={[{ id: 'deps' }, { id: 'arch' }, { id: 'flow' }]}
        activeBoardId="deps"
        onSelect={() => {}}
      />
    );
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByText('deps')).toBeTruthy();
    expect(screen.getByText('arch')).toBeTruthy();
    expect(screen.getByText('flow')).toBeTruthy();
  });

  it('marks active tab with aria-selected and active class', () => {
    render(
      <BoardTabs
        boards={[{ id: 'deps' }, { id: 'arch' }]}
        activeBoardId="arch"
        onSelect={() => {}}
      />
    );
    const archTab = screen.getByText('arch');
    expect(archTab.getAttribute('aria-selected')).toBe('true');
    expect(archTab.className).toContain('board-tab--active');
    const depsTab = screen.getByText('deps');
    expect(depsTab.getAttribute('aria-selected')).toBe('false');
    expect(depsTab.className).not.toContain('board-tab--active');
  });

  it('clicking a tab fires onSelect with that id', () => {
    const onSelect = vi.fn();
    render(
      <BoardTabs
        boards={[{ id: 'deps' }, { id: 'arch' }]}
        activeBoardId="deps"
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByText('arch'));
    expect(onSelect).toHaveBeenCalledWith('arch');
  });

  it('renders correctly when activeBoardId is null', () => {
    render(
      <BoardTabs
        boards={[{ id: 'a' }]}
        activeBoardId={null}
        onSelect={() => {}}
      />
    );
    const tab = screen.getByText('a');
    expect(tab.getAttribute('aria-selected')).toBe('false');
  });
});
