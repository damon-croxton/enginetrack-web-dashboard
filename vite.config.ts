import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';

// Set by `npm run build:mobile`. Emits one self-contained index.html with every
// script, style, font and image inlined, so the iOS WebView can load the whole
// app from a single bundled asset with no file:// sub-requests.
const isMobileBuild = process.env.BUILD_TARGET === 'mobile';

/**
 * The favicon and apple-touch-icon are meaningless inside the native shell —
 * iOS uses the app bundle's own icon — and vite-plugin-singlefile does not
 * inline assets referenced from index.html, so leaving them in would emit two
 * dangling file references the WebView could never resolve.
 */
const stripWebIcons = {
  name: 'strip-web-icons',
  transformIndexHtml(html: string) {
    return html.replace(/\s*<link rel="(?:icon|apple-touch-icon)"[^>]*>/g, '');
  },
};

export default defineConfig(() => {
  return {
    base: isMobileBuild ? './' : process.env.GITHUB_ACTIONS ? '/enginetrack-web-dashboard/' : './',
    plugins: [
      react(),
      tailwindcss(),
      ...(isMobileBuild ? [stripWebIcons, viteSingleFile()] : []),
    ],
    build: {
      outDir: isMobileBuild ? 'dist-mobile' : 'dist',
      // Fonts (~30KB each) and icons must become data URIs rather than separate
      // files for the single-file build to actually be self-contained.
      assetsInlineLimit: isMobileBuild ? 10 * 1024 * 1024 : 4096,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
