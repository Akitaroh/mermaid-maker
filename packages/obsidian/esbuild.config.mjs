import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';

// BRAT / Obsidian community plugin store はリポルートの manifest.json と
// versions.json を要求するため、プラグイン package の同名ファイルを
// monorepo ルートにも複製する。
const MONOREPO_ROOT = '/Users/akitaroh/Desktop/Akitaroh/_repos/mermaid-maker';
function syncRootManifest() {
  try {
    copyFileSync('manifest.json', `${MONOREPO_ROOT}/manifest.json`);
    copyFileSync('versions.json', `${MONOREPO_ROOT}/versions.json`);
  } catch {
    // ignore
  }
}

const production = process.argv.includes('production');

// Plugin artifacts (main.js, manifest.json) are placed directly into the Vault's
// .obsidian/plugins/<id>/ directory. We deliberately do NOT symlink the entire
// packages/obsidian/ folder, because that exposes node_modules to Obsidian's
// vault scanner.
const PLUGIN_OUT_DIR =
  '/Users/akitaroh/Desktop/Akitaroh/.obsidian/plugins/mermaid-maker';

const ensureDir = (path) => {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
};

const copyManifest = () => {
  ensureDir(PLUGIN_OUT_DIR);
  copyFileSync('manifest.json', `${PLUGIN_OUT_DIR}/manifest.json`);
};

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron'],
  format: 'cjs',
  target: 'es2020',
  platform: 'browser',
  jsx: 'automatic',
  loader: { '.tsx': 'tsx' },
  outfile: `${PLUGIN_OUT_DIR}/main.js`,
  sourcemap: production ? false : 'inline',
  minify: production,
  treeShaking: true,
  logLevel: 'info',
  plugins: [
    {
      name: 'copy-manifest',
      setup(build) {
        build.onStart(() => {
          copyManifest();
          syncRootManifest();
        });
      },
    },
    {
      // esbuild は main.ts に import された CSS をエントリ名の `main.css` で出力する。
      // Obsidian はプラグインフォルダの `styles.css` を自動ロードするので、rename する。
      name: 'rename-css',
      setup(build) {
        build.onEnd(() => {
          const src = `${PLUGIN_OUT_DIR}/main.css`;
          const dst = `${PLUGIN_OUT_DIR}/styles.css`;
          if (existsSync(src)) {
            try { renameSync(src, dst); } catch {}
          }
        });
      },
    },
  ],
});

if (production) {
  await ctx.rebuild();
  await ctx.dispose();
} else {
  await ctx.watch();
  console.log('[mermaid-maker] esbuild watching... (output → Vault plugin dir)');
}
