import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

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
  outfile: `${PLUGIN_OUT_DIR}/main.js`,
  sourcemap: production ? false : 'inline',
  minify: production,
  treeShaking: true,
  logLevel: 'info',
  plugins: [
    {
      name: 'copy-manifest',
      setup(build) {
        build.onStart(() => copyManifest());
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
