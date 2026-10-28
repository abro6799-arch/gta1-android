# GTA 1 Launcher (Android)

An unofficial, offline launcher that runs the **DOS version of GTA 1** on Android
with touch controls. It contains **no game files**. Each player supplies their own
legal copy.

It works by embedding [js-dos](https://js-dos.com) (DOSBox compiled to WebAssembly)
in a WebView, repackaging the player's ZIP into a DOSBox bundle on the device, and
overlaying a virtual stick and buttons that send keyboard input.

## Build

Requires Node 18+, JDK 17 and the Android SDK (or just push to GitHub and use the
included workflow, which uploads the APK as a build artifact).

```
node scripts/fetch-deps.js     # downloads js-dos + JSZip into app/src/main/assets/web/vendor
gradle assembleDebug           # or open the folder in Android Studio
```

The APK lands in `app/build/outputs/apk/debug/app-debug.apk`.

## Playing

1. Zip your own GTA 1 DOS game folder (it must contain `GTA.EXE`) and keep the ZIP on your phone.
2. Open the app, tap **Choose GTA 1 ZIP**, then **Play**.
3. System Back opens a pause menu (resume / send Esc / quit).

The prepared game is remembered inside the app; use "Forget saved game" to remove it.

## Controls

Defaults are in `app/src/main/assets/web/controls.js` (`LAYOUT`): stick = arrow keys,
FIRE = Ctrl, JUMP = Alt, ENTER = Enter, plus weapon, Space and Tab buttons. Check
the in-game controls screen of your version and edit the key codes if they differ.
Opacity, size and vibration are adjustable on the launcher screen.

## Status / known gaps

This was written without being able to build or run it, so treat it as an untested first version.

- **Unverified:** the exact js-dos v8 options and key-event path. If the game starts
  but ignores touch input, check how js-dos listens for keys (`controls.js`, `fire()`)
  and use its command interface (`ci.simulateKeyEvent`) instead.
- **Save games are not persisted yet.** Files written by the game live in memory and
  are lost on quit. Persisting js-dos's changes bundle to IndexedDB is the next step.
- Only the **DOS** version is supported. Windows builds of GTA 1 will not run in DOSBox.
- No app icon yet (default Android icon is used).
- No INTERNET permission, by design.

## Legal

You need to own GTA 1. This project is not affiliated with or endorsed by Rockstar
Games or Take-Two Interactive. js-dos and DOSBox are GPL-licensed; if you distribute
a build, follow their license terms.
