import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
import {VitePWA} from 'vite-plugin-pwa';

// Set by `npm run build:mobile`. Emits one self-contained index.html with every
// script, style, font and image inlined, so the iOS WebView can load the whole
// app from a single bundled asset with no file:// sub-requests.
const isMobileBuild = process.env.BUILD_TARGET === 'mobile';

// GitHub Pages serves this from a project subdirectory, not the domain root.
const base = isMobileBuild
  ? './'
  : process.env.GITHUB_ACTIONS
    ? '/enginetrack-web-dashboard/'
    : './';

/**
 * Manifest icon paths need the deployed base prefix baked in.
 *
 * start_url and scope are derived from Vite's `base` automatically, but icon
 * `src` values are not (vite-pwa#713) — they would resolve against the domain
 * root and 404 on a project Pages site. `base` is './' locally, which is not a
 * valid absolute URL path for a manifest, so fall back to '/' there.
 */
const iconBase = base.startsWith('/') ? base : '/';

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

/**
 * Installable-PWA config for the web build only.
 *
 * Deliberately excluded from the mobile build: the WebView loads the bundle
 * from a synthetic https://enginetrack.local/ origin with everything inlined,
 * so a service worker there would have nothing to cache, no origin worth
 * registering against, and would break the self-containment check in
 * scripts/sync-mobile-bundle.mjs.
 */
const pwa = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
  manifest: {
    name: 'EngineTrack Cardio',
    short_name: 'EngineTrack',
    description:
      'Zone 2 aerobic and Norwegian 4x4 interval training analytics from your Apple Health data.',
    theme_color: '#020617',
    background_color: '#020617',
    display: 'standalone',
    orientation: 'portrait',
    icons: [
      { src: `${iconBase}pwa-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${iconBase}pwa-512.png`, sizes: '512x512', type: 'image/png' },
      {
        src: `${iconBase}pwa-512-maskable.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    // Precache the whole app. It is a self-contained dashboard with no runtime
    // API calls, so caching the build output makes it fully offline-capable.
    globPatterns: ['**/*.{js,css,html,woff2,png,ico,svg}'],
    // The chart-heavy bundle is ~900 KB; the 2 MB default would drop it.
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
    navigateFallback: `${iconBase}index.html`,
    cleanupOutdatedCaches: true,
  },
});

export default defineConfig(() => {
  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      ...(isMobileBuild ? [stripWebIcons, viteSingleFile()] : [pwa]),
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
