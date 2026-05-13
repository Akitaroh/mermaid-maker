import { Plugin, Notice, TFile } from 'obsidian';

/**
 * MermaidMaker Obsidian plugin — Stage 2c: linkify with polished link UI.
 *
 * 設計判断:
 *   registerMarkdownPostProcessor は Live Preview の inline 描画 code block には
 *   呼ばれない（既知の Obsidian 挙動）。document 全体に MutationObserver を
 *   1 個張り、`.mermaid svg` が現れた瞬間に linkify する方式が主軸。
 *   Reading view 初回描画用の post processor は保険で併用。
 *
 * 視覚スタイル:
 *   - 解決済みリンク: --link-color（CSS 変数）でテキストを塗る
 *   - 未解決リンク: --link-unresolved-color + 薄め
 *   - ホバー: Obsidian の hover preview をトリガ + opacity 変化
 *
 * 副作用防止:
 *   WeakSet で処理済み SVG を記憶、二度走査しない。
 *   data-mm-linktarget 属性で二重 click handler を防止。
 *   ファイル作成/削除/改名イベントで未解決状態を再評価。
 */

const ATTR_TARGET = 'data-mm-linktarget';
const ATTR_RESOLVED = 'data-mm-resolved';
const HOVER_SOURCE = 'mermaid-maker';

export default class MermaidMakerPlugin extends Plugin {
  private processed = new WeakSet<SVGElement>();
  /** 解決状態を後で更新できるよう、active な g 要素を弱参照で覚える */
  private nodes = new Set<WeakRef<SVGGElement>>();

  async onload() {
    console.log('[mermaid-maker] onload');
    new Notice('MermaidMaker loaded');

    this.injectStyles();

    // 既にレンダリング済みの SVG をまず処理
    this.scanAll();

    const observer = new MutationObserver(() => this.scanAll());
    observer.observe(document.body, { childList: true, subtree: true });
    this.register(() => observer.disconnect());

    // Reading view 初回描画用の保険
    this.registerMarkdownPostProcessor((el, ctx) => {
      el.querySelectorAll<SVGElement>('.mermaid svg').forEach((svg) =>
        this.linkifySvg(svg, ctx.sourcePath),
      );
    });

    // ファイル CRUD で未解決状態を再評価
    this.registerEvent(this.app.vault.on('create', () => this.reevaluateAll()));
    this.registerEvent(this.app.vault.on('delete', () => this.reevaluateAll()));
    this.registerEvent(this.app.vault.on('rename', () => this.reevaluateAll()));
    this.registerEvent(
      this.app.metadataCache.on('resolved', () => this.reevaluateAll()),
    );
  }

  onunload() {
    console.log('[mermaid-maker] onunload');
    const style = document.getElementById('mermaid-maker-styles');
    style?.remove();
  }

  private injectStyles() {
    if (document.getElementById('mermaid-maker-styles')) return;
    const style = document.createElement('style');
    style.id = 'mermaid-maker-styles';
    style.textContent = `
      .mermaid svg [${ATTR_TARGET}] {
        cursor: pointer;
        transition: opacity 0.12s ease;
      }
      .mermaid svg [${ATTR_TARGET}] text,
      .mermaid svg [${ATTR_TARGET}] tspan,
      .mermaid svg [${ATTR_TARGET}] foreignObject * {
        fill: var(--link-color);
        color: var(--link-color);
        text-decoration: underline;
        text-decoration-color: var(--link-color);
        text-decoration-thickness: 1px;
        text-underline-offset: 2px;
      }
      .mermaid svg [${ATTR_TARGET}][${ATTR_RESOLVED}="false"] text,
      .mermaid svg [${ATTR_TARGET}][${ATTR_RESOLVED}="false"] tspan,
      .mermaid svg [${ATTR_TARGET}][${ATTR_RESOLVED}="false"] foreignObject * {
        fill: var(--text-muted);
        color: var(--text-muted);
        text-decoration-color: var(--text-muted);
        text-decoration-style: dashed;
        opacity: 0.75;
      }
      .mermaid svg [${ATTR_TARGET}]:hover {
        opacity: 0.85;
      }
      .mermaid svg [${ATTR_TARGET}]:hover text,
      .mermaid svg [${ATTR_TARGET}]:hover tspan {
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);
  }

  private scanAll() {
    const svgs = document.querySelectorAll<SVGElement>('.mermaid svg');
    if (svgs.length === 0) return;
    svgs.forEach((svg) => this.linkifySvg(svg, this.findSourcePath(svg)));
  }

  private findSourcePath(node: Element): string {
    const viewEl = node.closest('.markdown-source-view, .markdown-preview-view');
    if (!viewEl) return this.app.workspace.getActiveFile()?.path ?? '';
    let found = '';
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (found) return;
      const v = leaf.view as { containerEl?: HTMLElement; file?: { path: string } };
      if (v?.containerEl?.contains(viewEl)) {
        found = v.file?.path ?? '';
      }
    });
    return found || this.app.workspace.getActiveFile()?.path || '';
  }

  private linkifySvg(svg: SVGElement, sourcePath: string) {
    if (this.processed.has(svg)) return;

    const allText = svg.textContent ?? '';
    if (!allText.includes('[[')) {
      this.processed.add(svg);
      return;
    }

    const nodeGroups = svg.querySelectorAll<SVGGElement>('g.node, g.nodes > g');
    let linkified = 0;

    nodeGroups.forEach((g) => {
      if (g.hasAttribute(ATTR_TARGET)) return;
      const text = g.textContent ?? '';
      const match = text.match(/\[\[([^\]]+)\]\]/);
      if (!match) return;

      const [target] = match[1].split('|');
      g.setAttribute(ATTR_TARGET, target);
      this.setResolved(g, target, sourcePath);
      this.attachHandlers(g, target, sourcePath);
      this.nodes.add(new WeakRef(g));

      linkified++;
    });

    this.processed.add(svg);

    if (linkified > 0) {
      console.log(
        `[mermaid-maker] linkified ${linkified} node(s) in ${sourcePath || '(unknown)'}`,
      );
    }
  }

  private setResolved(g: SVGGElement, target: string, sourcePath: string) {
    const dest = this.app.metadataCache.getFirstLinkpathDest(target, sourcePath);
    g.setAttribute(ATTR_RESOLVED, dest instanceof TFile ? 'true' : 'false');
  }

  private attachHandlers(g: SVGGElement, target: string, sourcePath: string) {
    g.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.app.workspace.openLinkText(
        target,
        sourcePath,
        (ev as MouseEvent).ctrlKey || (ev as MouseEvent).metaKey,
      );
    });

    // Obsidian の hover preview をトリガ（cmd/ctrl 押下時にプレビュー）
    g.addEventListener('mouseover', (ev) => {
      this.app.workspace.trigger('hover-link', {
        event: ev,
        source: HOVER_SOURCE,
        hoverParent: g,
        targetEl: g,
        linktext: target,
        sourcePath,
      });
    });
  }

  /**
   * Vault のファイル変動で全 g.node の解決状態を再計算する。
   * 弱参照なので detach 済みの要素は自然に消える。
   */
  private reevaluateAll() {
    for (const ref of this.nodes) {
      const g = ref.deref();
      if (!g || !g.isConnected) {
        this.nodes.delete(ref);
        continue;
      }
      const target = g.getAttribute(ATTR_TARGET);
      if (!target) continue;
      const sourcePath = this.findSourcePath(g);
      this.setResolved(g, target, sourcePath);
    }
  }
}
