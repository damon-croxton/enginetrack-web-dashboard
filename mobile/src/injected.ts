/**
 * JavaScript injected into the WebView before the web app boots.
 *
 * Installs `window.nativeHealthKit`, which is exactly what the web app's
 * `isHealthKitSupported()` looks for. With this present the app takes the real
 * device-sync path; without it (a plain browser) it stays in sample-data mode.
 *
 * Requests are correlated by id so several can be in flight without their
 * replies crossing. The native side answers by evaluating
 * `window.__engineTrackNative.<resolve|reject|progress>(...)`.
 */
export const INJECTED_BRIDGE = `
(function () {
  if (window.nativeHealthKit) return;

  var pending = {};
  var nextId = 1;

  window.__engineTrackNative = {
    resolve: function (id, payload) {
      var entry = pending[id];
      if (!entry) return;
      delete pending[id];
      entry.resolve(payload);
    },
    reject: function (id, message) {
      var entry = pending[id];
      if (!entry) return;
      delete pending[id];
      entry.reject(new Error(message || 'Apple Health sync failed.'));
    },
    progress: function (id, percent, text) {
      var entry = pending[id];
      if (entry && entry.onProgress) entry.onProgress(percent, text);
    },
  };

  window.nativeHealthKit = {
    sync: function (onProgress) {
      return new Promise(function (resolve, reject) {
        var id = String(nextId++);
        pending[id] = { resolve: resolve, reject: reject, onProgress: onProgress };

        // Guard against a native handler that never answers, so the UI can't
        // sit on a spinner forever.
        setTimeout(function () {
          if (pending[id]) {
            delete pending[id];
            reject(new Error('Apple Health sync timed out.'));
          }
        }, 120000);

        window.ReactNativeWebView.postMessage(
          JSON.stringify({ kind: 'healthkit-sync', id: id })
        );
      });
    },
  };

  true;
})();
true;
`;
