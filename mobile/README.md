# EngineTrack — iOS shell

A thin Expo app that runs the existing Vite dashboard in a WebView and gives it
real Apple HealthKit access. It exists so the dashboard can reach an iPhone via
TestFlight without a Mac or Xcode — EAS builds on cloud macOS.

## How it fits together

```
../src              the dashboard (React + Vite). Unchanged by this shell.
   └─ npm run build:mobile
        → dist-mobile/index.html      one self-contained file, everything inlined
        → mobile/assets/web/index.html  copied here, shipped in the app bundle

App.tsx             loads that file into a WebView
src/injected.ts     installs window.nativeHealthKit before the page boots
src/healthkit.ts    queries HealthKit, returns unclassified workouts
```

The shell deliberately does **no** categorisation. It hands raw workouts to the
web app, which runs them through `src/utils/workoutClassifier.ts` — the same
code an `export.xml` import uses. A workout is therefore classified identically
whether it arrived over the bridge or out of a file.

`assets/web/index.html` is generated, not source, and is gitignored. Run
`npm run build:mobile` in the repo root before any `eas build`.

## Two things worth knowing

**The origin matters.** The dashboard persists everything to `localStorage`.
Content loaded from a raw HTML string or a bare `file://` URL has an opaque
origin and iOS may silently discard storage against it — the app would look fine
and lose every workout on relaunch. `App.tsx` loads with a fixed
`baseUrl: 'https://enginetrack.local/'` to avoid this. Nothing is ever fetched
from that host. **Confirm data survives a cold app restart on the first device
build.**

**Expo Go will not work.** HealthKit is a native module, so you need a
development build.

## Prerequisites

- An Apple Developer Program membership. EAS removes the Mac requirement, not
  this one.
- `npm i -g eas-cli`, then `eas login`.

## Build and ship

```bash
# from the repo root — regenerates the bundled dashboard
npm run build:mobile

cd mobile
npm install

npm run build:dev     # development build, install on your device
npm run build:prod    # production build
npm run submit        # upload to App Store Connect → TestFlight
```

Set `submit.production.ios.ascAppId` in `eas.json` to your App Store Connect app
ID before submitting.

Internal TestFlight testing (your own devices) needs only build processing.
External testing goes through Beta App Review, where Apple guideline 4.2
(minimum functionality) makes a thin WebView wrapper a genuine rejection risk —
so keep this to internal testing.

## Health data

Read-only, and never leaves the device. The app requests workouts, heart rate,
and resting heart rate; it does not write back to Apple Health.
