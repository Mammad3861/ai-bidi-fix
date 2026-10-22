import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build, defineConfig, type Plugin } from 'vite';

// Bundle the classic content script independently of the popup. Otherwise
// shared settings imports can make Rollup emit runtime ESM shared chunks.
function contentScriptPlugin(): Plugin {
  return {
    name: 'emit-classic-content-script',
    async generateBundle() {
      const result = await build({
        configFile: false,
        root: resolve(import.meta.dirname, 'src'),
        publicDir: false,
        logLevel: 'silent',
        build: {
          outDir: resolve(import.meta.dirname, 'dist'),
          write: false,
          sourcemap: true,
          cssCodeSplit: false,
          rollupOptions: {
            input: { content: resolve(import.meta.dirname, 'src/content/index.ts') },
            output: {
              format: 'iife',
              inlineDynamicImports: true,
              entryFileNames: 'content.js',
              assetFileNames: (asset) => asset.names.some((name) => name.endsWith('.css'))
                ? 'assets/content.css'
                : 'assets/[name][extname]',
            },
          },
        },
      });
      const bundle = Array.isArray(result) ? result[0] : result;
      if (!bundle || !('output' in bundle)) throw new Error('Content script build produced no output.');
      for (const file of bundle.output) {
        this.emitFile({
          type: 'asset',
          fileName: file.fileName,
          source: file.type === 'chunk' ? file.code : file.source,
        });
        if (file.type === 'chunk') {
          Object.keys(file.modules).filter((id) => !id.startsWith('\0')).forEach((id) => this.addWatchFile(id));
        }
      }
      this.addWatchFile(resolve(import.meta.dirname, 'src/content/styles.css'));
    },
  };
}

function manifestPlugin(): Plugin {
  return {
    name: 'emit-extension-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: readFileSync(resolve(import.meta.dirname, 'manifest.json'), 'utf8'),
      });
    },
  };
}

export default defineConfig({
  root: resolve(import.meta.dirname, 'src'),
  publicDir: resolve(import.meta.dirname, 'public'),
  plugins: [manifestPlugin(), contentScriptPlugin()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        'popup/popup': resolve(import.meta.dirname, 'src/popup/popup.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
