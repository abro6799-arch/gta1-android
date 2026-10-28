/* Launcher logic: take the player's own GTA 1 ZIP, repackage it as a js-dos
 * bundle in the browser (nothing leaves the device), and run it in DOSBox. */
(function () {
  const $ = (id) => document.getElementById(id);
  const zipInput = $("zipInput"), playBtn = $("playBtn"), foundEl = $("found"), errorEl = $("error");
  const forgetBtn = $("forgetBtn");

  let bundleBlob = null;   // ready-to-run js-dos bundle
  let dosProps = null;     // handle returned by js-dos, used to stop the emulator
  let inGame = false;

  // ---------- tiny IndexedDB helper to remember the bundle ----------
  const DB = "gta1launcher", STORE = "kv";
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function kvGet(k) {
    const db = await idb();
    return new Promise((res, rej) => {
      const q = db.transaction(STORE).objectStore(STORE).get(k);
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
  }
  async function kvSet(k, v) {
    const db = await idb();
    return new Promise((res, rej) => {
      const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).put(v, k);
      t.oncomplete = () => res(); t.onerror = () => rej(t.error);
    });
  }
  async function kvDel(k) {
    const db = await idb();
    return new Promise((res, rej) => {
      const t = db.transaction(STORE, "readwrite"); t.objectStore(STORE).delete(k);
      t.oncomplete = () => res(); t.onerror = () => rej(t.error);
    });
  }

  // ---------- UI helpers ----------
  function showError(msg) { errorEl.textContent = msg; errorEl.hidden = !msg; }
  function showFound(msg) { foundEl.textContent = msg; foundEl.hidden = !msg; }

  // ---------- settings ----------
  function applyCtlSettings() {
    const op = $("optOpacity").value / 100, sc = $("optScale").value / 100;
    document.documentElement.style.setProperty("--ctl-opacity", op);
    document.documentElement.style.setProperty("--ctl-scale", sc);
    window.TouchControls.setHaptics($("optHaptics").checked);
    try { localStorage.setItem("gta1.ctl", JSON.stringify({ op: $("optOpacity").value, sc: $("optScale").value, hp: $("optHaptics").checked })); } catch (e) {}
  }
  try {
    const s = JSON.parse(localStorage.getItem("gta1.ctl") || "null");
    if (s) { $("optOpacity").value = s.op; $("optScale").value = s.sc; $("optHaptics").checked = s.hp; }
  } catch (e) {}
  ["optOpacity", "optScale", "optHaptics"].forEach((id) => $(id).addEventListener("input", applyCtlSettings));
  applyCtlSettings();

  // ---------- build the bundle from the player's zip ----------
  const EXE_RE = /(^|\/)gta\.exe$/i;

  async function prepare(file) {
    showError(""); showFound(""); playBtn.disabled = true; bundleBlob = null;
    showFound("Reading ZIP\u2026");
    let src;
    try { src = await JSZip.loadAsync(file); }
    catch (e) { showFound(""); return showError("That doesn't look like a valid ZIP file."); }

    const names = Object.keys(src.files).filter((n) => !src.files[n].dir);
    const exe = names.find((n) => EXE_RE.test(n));
    if (!exe) {
      showFound("");
      return showError(
        "GTA.EXE wasn't found in that ZIP. This launcher runs the DOS version of GTA 1 " +
        "(GTA.EXE plus its data files). Zip the game folder itself and try again."
      );
    }

    // GTA 1 loads data via "..\gtadata\...", so GTADATA must be a sibling of the
    // folder that holds GTA.EXE (normally GTA\DMADATA\GTA.EXE + GTA\GTADATA\).
    // Keep the whole parent folder, and re-root it as C:\GTA so DOS never sees
    // long folder names. The exe folder is always placed at C:\GTA\DMADATA.
    const slash = exe.lastIndexOf("/");
    const exePrefix = slash >= 0 ? exe.slice(0, slash + 1) : "";          // e.g. "Game/DMADATA/"
    const upSlash = exePrefix ? exePrefix.slice(0, -1).lastIndexOf("/") : -1;
    const parentPrefix = exePrefix ? exePrefix.slice(0, upSlash + 1) : ""; // e.g. "Game/"
    const exeAtRoot = exePrefix === "";
    showFound("Preparing game files\u2026");

    if (!names.some((n) => /(^|\/)gtadata\//i.test(n))) {
      showFound("");
      return showError(
        "GTADATA folder not found in that ZIP. GTA 1 needs it next to the folder " +
        "containing GTA.EXE. Zip the whole game folder (the one that contains both " +
        "DMADATA and GTADATA)."
      );
    }

    const out = new JSZip();
    let count = 0;
    for (const n of names) {
      let dest = null;
      if (exeAtRoot) {
        dest = /^gtadata\//i.test(n) ? "GTA/" + n : "GTA/DMADATA/" + n;
      } else if (n.startsWith(exePrefix)) {
        dest = "GTA/DMADATA/" + n.slice(exePrefix.length);
      } else if (n.startsWith(parentPrefix)) {
        dest = "GTA/" + n.slice(parentPrefix.length);
      }
      if (!dest) continue;
      // DOS names are uppercase; normalizing avoids any case-matching issues
      // (e.g. "gtadata" vs "GTADATA").
      out.file(dest.toUpperCase(), await src.files[n].async("uint8array"), { compression: "STORE" });
      count++;
    }

    const debugOn = $("optDebug").checked;
    const conf = [
      "[sdl]", "autolock=false",
      "[cpu]", "core=auto", "cputype=auto", "cycles=max",
      "[mixer]", "rate=44100", "blocksize=2048", "prebuffer=40",
      "[autoexec]",
      debugOn ? "rem debug" : "@echo off",
      "mount c .",
      "c:",
      "cd GTA\\DMADATA",
      ...(debugOn ? ["dir", "dir ..", "dir ..\\GTADATA\\PLAYER_A.DAT", "pause"] : []),
      "GTA.EXE",
      "exit",
    ].join("\n");
    out.file(".jsdos/dosbox.conf", conf);

    bundleBlob = await out.generateAsync({ type: "blob", compression: "STORE" });
    const hasPlayer = names.some((n) => /(^|\/)gtadata\/player_a\.dat$/i.test(n));
    showFound(
      `Found ${exe} and ${count} files. ` +
      `GTADATA\\PLAYER_A.DAT: ${hasPlayer ? "found" : "NOT FOUND"}. Ready to play.`
    );
    playBtn.disabled = false;

    if ($("optRemember").checked) {
      try { await kvSet("bundle2", bundleBlob); forgetBtn.hidden = false; }
      catch (e) { /* storage full or unavailable: not fatal */ }
    }
  }

  zipInput.addEventListener("change", () => {
    const f = zipInput.files && zipInput.files[0];
    if (f) prepare(f).catch((e) => { showFound(""); showError("Failed to read the ZIP: " + e.message); });
    zipInput.value = "";
  });

  forgetBtn.addEventListener("click", async () => {
    await kvDel("bundle"); await kvDel("bundle2"); bundleBlob = null; playBtn.disabled = true; forgetBtn.hidden = true;
    showFound("Saved game removed from this app.");
  });

  // Restore a remembered bundle on launch.
  // Packages saved by v0.1 ("bundle") were built wrongly; drop them silently.
  kvDel("bundle").catch(() => {});
  kvGet("bundle2").then((b) => {
    if (b) {
      bundleBlob = b; playBtn.disabled = false; forgetBtn.hidden = false;
      showFound("Using the GTA 1 files you added earlier.");
    }
  }).catch(() => {});

  // ---------- run the game ----------
  async function play() {
    if (!bundleBlob) return;
    $("launcher").hidden = true; $("game").hidden = false; inGame = true;
    const url = URL.createObjectURL(bundleBlob);
    const host = $("dos"); host.innerHTML = "";
    try {
      dosProps = Dos(host, {
        url,
        pathPrefix: "vendor/emulators/",
        autoStart: true,
        kiosk: true,
        noCloud: true,
        noNetworking: true,
        backend: "dosbox",
      });
    } catch (e) {
      quit(); return showError("Couldn't start the emulator: " + e.message);
    }
    window.TouchControls.mount($("touch"), host, { haptics: $("optHaptics").checked });
    applyCtlSettings();
  }

  async function quit() {
    window.TouchControls.releaseAll();
    $("pause").hidden = true;
    try { if (dosProps && dosProps.stop) await dosProps.stop(); } catch (e) {}
    dosProps = null; $("dos").innerHTML = "";
    $("game").hidden = true; $("launcher").hidden = false; inGame = false;
  }

  playBtn.addEventListener("click", play);
  $("resumeBtn").addEventListener("click", () => { $("pause").hidden = true; });
  $("escBtn").addEventListener("click", () => { $("pause").hidden = true; window.TouchControls.tap(window.TouchControls.K.ESC, 120); });
  $("quitBtn").addEventListener("click", quit);

  // Called by the Android activity on the system Back button.
  window.onAndroidBack = function () {
    if (!inGame) return "exit";
    $("pause").hidden = !$("pause").hidden;
    window.TouchControls.releaseAll();
    return "handled";
  };
})();
