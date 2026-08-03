import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

import { INJECTED_BRIDGE } from './src/injected';
import { fetchHealthData } from './src/healthkit';

/** Matches app.json's splash backgroundColor and the web app's slate-950. */
const BACKGROUND = '#020617';

/**
 * Gives the WebView a stable origin.
 *
 * The whole dashboard persists to localStorage. Content loaded from a raw HTML
 * string or a bare file:// URL has an opaque origin, and iOS will refuse or
 * silently discard storage against it — so the app would appear to work and
 * then lose every workout on relaunch. A fixed https baseUrl avoids that.
 * Nothing is ever fetched from this host; the bundle is entirely self-contained.
 */
const BASE_URL = 'https://enginetrack.local/';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const asset = Asset.fromModule(require('./assets/web/index.html'));
        await asset.downloadAsync();
        const uri = asset.localUri ?? asset.uri;
        const contents = await FileSystem.readAsStringAsync(uri);
        if (!cancelled) setHtml(contents);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load the dashboard.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Answers the web app over the same channel its injected bridge listens on. */
  const reply = useCallback((expression: string) => {
    webViewRef.current?.injectJavaScript(`${expression}; true;`);
  }, []);

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      let message: { kind?: string; id?: string };
      try {
        message = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }

      if (message.kind !== 'healthkit-sync' || !message.id) return;
      const { id } = message;

      try {
        const payload = await fetchHealthData((percent, text) => {
          reply(
            `window.__engineTrackNative.progress(${JSON.stringify(id)}, ${percent}, ${JSON.stringify(text)})`
          );
        });
        reply(
          `window.__engineTrackNative.resolve(${JSON.stringify(id)}, ${JSON.stringify(payload)})`
        );
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Apple Health sync failed.';
        reply(`window.__engineTrackNative.reject(${JSON.stringify(id)}, ${JSON.stringify(detail)})`);
      }
    },
    [reply]
  );

  if (loadError) {
    return (
      <SafeAreaProvider>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Could not load EngineTrack</Text>
          <Text style={styles.errorBody}>{loadError}</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  if (!html) {
    return (
      <SafeAreaProvider>
        <View style={styles.centered}>
          <ActivityIndicator color="#22d3ee" size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html, baseUrl: BASE_URL }}
          injectedJavaScriptBeforeContentLoaded={INJECTED_BRIDGE}
          onMessage={handleMessage}
          // The web app draws its own safe-area padding via env(safe-area-inset-*),
          // so the WebView itself runs edge to edge.
          style={styles.webview}
          contentInsetAdjustmentBehavior="never"
          allowsBackForwardNavigationGestures={false}
          // A dashboard, not a browser: suppress zoom and text-size drift.
          scalesPageToFit={false}
          textZoom={100}
          bounces={false}
          domStorageEnabled
          javaScriptEnabled
        />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
  webview: { flex: 1, backgroundColor: BACKGROUND },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: BACKGROUND,
  },
  errorTitle: { color: '#f1f5f9', fontSize: 17, fontWeight: '700', marginBottom: 8 },
  errorBody: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
});
