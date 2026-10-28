/* On-screen touch controls.
 *
 * Buttons send synthetic keyboard events, which js-dos feeds to DOSBox as if
 * a real keyboard were attached. Edit LAYOUT below to change buttons or keys;
 * check GTA 1's own Controls screen for the keys your version expects.
 *
 * Positions are in "vmin" units from the bottom-left/bottom-right corner of the
 * screen so the layout scales with the display.
 */
(function () {
  // keyCode values are the standard DOM ones. js-dos reads event.keyCode.
  const K = {
    UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39,
    CTRL: 17, ALT: 18, SHIFT: 16, SPACE: 32, ENTER: 13, ESC: 27, TAB: 9,
    PGUP: 33, PGDN: 34, F1: 112, F2: 113, F3: 114, F4: 115, F5: 116,
  };
  const CODE = {
    38: "ArrowUp", 40: "ArrowDown", 37: "ArrowLeft", 39: "ArrowRight",
    17: "ControlLeft", 18: "AltLeft", 16: "ShiftLeft", 32: "Space", 13: "Enter",
    27: "Escape", 9: "Tab", 33: "PageUp", 34: "PageDown",
    112: "F1", 113: "F2", 114: "F3", 115: "F4", 116: "F5",
  };
  const KEYNAME = {
    38: "ArrowUp", 40: "ArrowDown", 37: "ArrowLeft", 39: "ArrowRight",
    17: "Control", 18: "Alt", 16: "Shift", 32: " ", 13: "Enter", 27: "Escape",
    9: "Tab", 33: "PageUp", 34: "PageDown",
    112: "F1", 113: "F2", 114: "F3", 115: "F4", 116: "F5",
  };

  // Defaults follow the usual DOS GTA scheme (arrows to drive/steer, Ctrl to
  // fire, Alt to jump, Enter to enter/exit vehicles). Verify in your copy.
  const LAYOUT = {
    stick: { side: "left", x: 4, y: 4, size: 34, keys: { up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT } },
    buttons: [
      { label: "FIRE",  key: K.CTRL,  side: "right", x: 4,  y: 6,  size: 17 },
      { label: "ENTER", key: K.ENTER, side: "right", x: 22, y: 6,  size: 14 },
      { label: "JUMP",  key: K.ALT,   side: "right", x: 4,  y: 26, size: 14 },
      { label: "WPN ◀", key: K.PGUP, side: "right", x: 20, y: 24, size: 11, small: true },
      { label: "WPN ▶", key: K.PGDN, side: "right", x: 32, y: 24, size: 11, small: true },
      { label: "SPACE", key: K.SPACE, side: "right", x: 4,  y: 42, size: 11, small: true },
      { label: "TAB",   key: K.TAB,   side: "right", x: 17, y: 42, size: 11, small: true },
    ],
  };

  let target = null;        // element key events are dispatched on
  const held = new Map();   // keyCode -> count of sources holding it
  let haptics = true;

  function fire(type, keyCode) {
    const t = target || document.body;
    const ev = new KeyboardEvent(type, {
      key: KEYNAME[keyCode] || "", code: CODE[keyCode] || "",
      keyCode, which: keyCode, bubbles: true, cancelable: true, composed: true,
    });
    // Some engines ignore keyCode/which in the init dict.
    try {
      Object.defineProperty(ev, "keyCode", { get: () => keyCode });
      Object.defineProperty(ev, "which", { get: () => keyCode });
    } catch (e) { /* ignore */ }
    t.dispatchEvent(ev);
  }

  function press(keyCode) {
    const n = (held.get(keyCode) || 0) + 1;
    held.set(keyCode, n);
    if (n === 1) fire("keydown", keyCode);
  }
  function release(keyCode) {
    const n = (held.get(keyCode) || 0) - 1;
    if (n <= 0) { held.delete(keyCode); fire("keyup", keyCode); }
    else held.set(keyCode, n);
  }
  function tap(keyCode, ms) {
    press(keyCode);
    setTimeout(() => release(keyCode), ms || 80);
  }
  function releaseAll() {
    for (const k of Array.from(held.keys())) { held.delete(k); fire("keyup", k); }
  }
  function buzz(ms) { if (haptics && navigator.vibrate) navigator.vibrate(ms); }

  function place(el, spec) {
    el.style.position = "absolute";
    el.style[spec.side === "left" ? "left" : "right"] = `calc(${spec.x}vmin + env(safe-area-inset-${spec.side}))`;
    el.style.bottom = `calc(${spec.y}vmin + env(safe-area-inset-bottom))`;
    el.style.width = el.style.height = `calc(${spec.size}vmin * var(--ctl-scale, 1))`;
  }

  function buildButton(root, b) {
    const el = document.createElement("div");
    el.className = "tbtn" + (b.small ? " small" : "");
    el.textContent = b.label;
    place(el, b);
    let pid = null;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault(); if (pid !== null) return;
      pid = e.pointerId; el.setPointerCapture(pid);
      el.classList.add("down"); press(b.key); buzz(12);
    });
    const up = (e) => {
      if (e.pointerId !== pid) return;
      pid = null; el.classList.remove("down"); release(b.key);
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    root.appendChild(el);
  }

  function buildStick(root, s) {
    const el = document.createElement("div");
    el.className = "stick";
    const nub = document.createElement("div"); nub.className = "nub"; el.appendChild(nub);
    place(el, s);
    const active = { up: false, down: false, left: false, right: false };
    let pid = null;
    const DEAD = 0.28;

    function update(e) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      nub.style.transform = `translate(${dx * 60}%, ${dy * 60}%)`;
      const want = { up: dy < -DEAD, down: dy > DEAD, left: dx < -DEAD, right: dx > DEAD };
      for (const dir of Object.keys(want)) {
        if (want[dir] && !active[dir]) { active[dir] = true; press(s.keys[dir]); }
        else if (!want[dir] && active[dir]) { active[dir] = false; release(s.keys[dir]); }
      }
    }
    function end(e) {
      if (e.pointerId !== pid) return;
      pid = null; nub.style.transform = "";
      for (const dir of Object.keys(active)) if (active[dir]) { active[dir] = false; release(s.keys[dir]); }
    }
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault(); if (pid !== null) return;
      pid = e.pointerId; el.setPointerCapture(pid); buzz(8); update(e);
    });
    el.addEventListener("pointermove", (e) => { if (e.pointerId === pid) update(e); });
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    root.appendChild(el);
  }

  window.TouchControls = {
    K,
    mount(rootEl, keyTarget, opts) {
      target = keyTarget;
      haptics = !opts || opts.haptics !== false;
      rootEl.innerHTML = "";
      buildStick(rootEl, LAYOUT.stick);
      LAYOUT.buttons.forEach((b) => buildButton(rootEl, b));
    },
    setHaptics(v) { haptics = !!v; },
    tap, press, release, releaseAll,
  };
})();
