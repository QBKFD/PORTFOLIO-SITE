// scene-arena.js: two small scenes for the match-engine stage.
// 1) aviz: a bot process sends answers through the validation boundary into a
//    pure engine, which settles the round and appends to the replay. Faulty bots
//    (garbage, hanging, crashing) cost a strike and a zero bet; three strikes and
//    the bot is out, but the match still finishes and writes its replay.
// 2) hviz: the same seed and the same bots give the same replay, byte for byte.

(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ACC = "137,207,240", CORAL = "214,150,140", GREY = "139,140,147", TEXT = "240,240,242", LINE = "168,172,182";

  // =====================================================================
  // 1) the match engine
  // =====================================================================
  (function arena() {
    var root = document.getElementById("aviz");
    if (!root) return;
    var cv = root.querySelector(".aviz__canvas");
    var g = cv.getContext("2d");
    var buttons = [].slice.call(root.querySelectorAll(".viz__seg button"));

    var NAMES = { honest: "honest bot", garbage: "sends garbage", hang: "hangs", crash: "crashes" };
    var SHORT = { honest: "honest", garbage: "garbage", hang: "hangs", crash: "crashes" };
    var GARBAGE = ['{"f":"all in"}', '{"f":NaN}', '{"f":-3}', '{"f":true}', 'hello?'];
    var bot = "honest";

    // timeline of one round, in seconds
    var T_SEND = 0.5, T_WAIT = 1.0, T_CHECK = 0.3, T_SETTLE = 0.45, T_WRITE = 0.3;
    var st;
    function reset() {
      st = { round: 1, strikes: 0, phase: "send", t: 0, crashed: false, out: false,
             lines: 0, flash: 0, flashCol: ACC, pulse: 0, label: "", status: "", ff: 0, payload: "" };
      nextPayload();
    }
    function nextPayload() {
      st.payload = bot === "garbage" ? GARBAGE[(st.round - 1) % GARBAGE.length]
        : '{"f":' + (0.05 + 0.1 * ((st.round * 7919) % 13) / 13).toFixed(2) + "}";
    }
    function valid() { return bot === "honest"; }

    function statusText() {
      if (st.out) return st.phase === "done" ? "Replay written. Every match ends with one, however it went."
        : "3 strikes: out. The match still finishes and writes its replay.";
      if (st.phase === "send" || st.phase === "wait") {
        if (bot === "hang") return "waiting for an answer…";
        if (bot === "crash") return st.crashed ? "the process has exited…" : "sending the round to the bot…";
        return "the bot answers in JSON";
      }
      if (bot === "honest") return "valid answer: the engine settles the round";
      if (bot === "garbage") return "invalid answer: bet 0 this round, 1 strike";
      if (bot === "hang") return "no answer in time: bet 0 this round, 1 strike";
      return "process exited: bet 0 this round, 1 strike";
    }

    function advance(dt) {
      st.t += dt;
      st.flash = Math.max(0, st.flash - dt * 2.2);
      st.pulse = Math.max(0, st.pulse - dt * 2.5);
      if (st.out) {
        if (st.phase === "ff") {
          st.ff += dt;
          st.round = Math.min(500, Math.round(st.round + dt * 420));
          if (st.ff > 0.9 && st.round >= 500) { st.phase = "done"; st.t = 0; st.lines = 6; }
        } else if (st.phase === "done" && st.t > 2.2) {
          reset();
        } else if (st.phase === "hold" && st.t > 1.6) {
          st.phase = "ff"; st.t = 0; st.ff = 0;
        }
        return;
      }
      switch (st.phase) {
        case "send":
          if (bot === "hang") { st.phase = "wait"; st.t = 0; break; }
          if (bot === "crash") { st.crashed = true; st.phase = "wait"; st.t = 0; break; }
          if (st.t >= T_SEND) { st.phase = "check"; st.t = 0; judge(); }
          break;
        case "wait":
          if (st.t >= (bot === "crash" ? 0.45 : T_WAIT)) { st.phase = "check"; st.t = 0; judge(); }
          break;
        case "check":
          if (st.t >= T_CHECK) { st.phase = "settle"; st.t = 0; }
          break;
        case "settle":
          if (st.t >= T_SETTLE) { st.phase = "write"; st.t = 0; st.pulse = 1; }
          break;
        case "write":
          if (st.t >= T_WRITE) {
            st.lines = (st.lines + 1) % 7;
            if (st.strikes >= 3) { st.out = true; st.phase = "hold"; st.t = 0; break; }
            st.round += 1; st.phase = "send"; st.t = 0; nextPayload();
          }
          break;
      }
    }
    function judge() {
      st.flash = 1;
      if (valid()) { st.flashCol = ACC; }
      else { st.flashCol = CORAL; st.strikes += 1; }
    }

    // ---- layout ----
    var W = 0, H = 0, dpr = 1, L = {};
    function layout() {
      W = cv.offsetWidth; H = cv.offsetHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      L.small = W < 420;
      var bw = Math.min(118, W * 0.25), bh = 52;
      L.cy = Math.round(H * 0.36);
      L.bw = bw; L.bh = bh;
      L.bx = 4 + bw / 2;
      L.rx = W - 4 - 22;
      L.gx = W * 0.44;
      L.ex = W * 0.665;
      L.ew = Math.min(104, W * 0.22);
    }

    function rr(x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }
    function label(text, x, y, col, align) {
      g.fillStyle = col || "rgba(" + GREY + ",0.9)";
      g.textAlign = align || "center"; g.textBaseline = "alphabetic";
      g.fillText(text, x, y);
    }
    function token(x, y, col, text) {
      g.beginPath(); g.arc(x, y, 6, 0, 6.2832); g.fillStyle = col; g.fill();
      if (text) {
        g.font = "10px 'IBM Plex Mono', ui-monospace, monospace";
        label(text, x, y - 12, col);
      }
    }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

    function draw() {
      g.clearRect(0, 0, W, H);
      var cy = L.cy;
      g.font = (L.small ? "9.5px" : "10.5px") + " 'IBM Plex Mono', ui-monospace, monospace";

      // pipe
      g.strokeStyle = "rgba(" + LINE + ",0.22)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(L.bx + L.bw / 2, cy); g.lineTo(L.rx - 22, cy); g.stroke();

      // bot process
      var bx0 = L.bx - L.bw / 2, by0 = cy - L.bh / 2;
      var dead = bot === "crash" && st.crashed;
      rr(bx0, by0, L.bw, L.bh, 7);
      g.fillStyle = "rgba(255,255,255,0.025)"; g.fill();
      g.strokeStyle = dead || st.out ? "rgba(" + CORAL + ",0.7)" : "rgba(" + LINE + ",0.55)"; g.lineWidth = 1; g.stroke();
      label(L.small ? "bot" : "bot process", L.bx, by0 - 9);
      g.font = (L.small ? "10px" : "11px") + " 'IBM Plex Mono', ui-monospace, monospace";
      label(L.small ? SHORT[bot] : NAMES[bot], L.bx, cy + 4, dead ? "rgba(" + CORAL + ",0.9)" : "rgba(" + TEXT + ",0.85)");
      if (dead) {
        g.strokeStyle = "rgba(" + CORAL + ",0.55)"; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(bx0 + 8, by0 + 8); g.lineTo(bx0 + L.bw - 8, by0 + L.bh - 8);
        g.moveTo(bx0 + L.bw - 8, by0 + 8); g.lineTo(bx0 + 8, by0 + L.bh - 8); g.stroke();
      }
      if (bot === "hang" && st.phase === "wait" && !st.out) {       // the clock running out
        var p = Math.min(1, st.t / T_WAIT);
        g.strokeStyle = "rgba(" + CORAL + ",0.85)"; g.lineWidth = 2;
        g.beginPath(); g.arc(bx0 + L.bw - 2, by0 + 2, 9, -Math.PI / 2, -Math.PI / 2 + p * 6.2832); g.stroke();
      }

      // validation boundary
      var gh = 104, fl = st.flash;
      g.fillStyle = fl > 0 ? "rgba(" + st.flashCol + "," + (0.25 + 0.6 * fl).toFixed(3) + ")" : "rgba(" + LINE + ",0.35)";
      g.fillRect(L.gx - 3, cy - gh / 2, 6, gh);
      g.font = (L.small ? "9.5px" : "10.5px") + " 'IBM Plex Mono', ui-monospace, monospace";
      label("validation", L.gx, cy - gh / 2 - 21);
      label("boundary", L.gx, cy - gh / 2 - 8);

      // pure engine
      var ex0 = L.ex - L.ew / 2;
      rr(ex0, cy - L.bh / 2, L.ew, L.bh, 7);
      g.fillStyle = "rgba(" + ACC + "," + (0.03 + 0.12 * st.pulse).toFixed(3) + ")"; g.fill();
      g.strokeStyle = "rgba(" + ACC + "," + (0.45 + 0.5 * st.pulse).toFixed(3) + ")"; g.lineWidth = 1; g.stroke();
      label(L.small ? "engine" : "pure engine", L.ex, cy - L.bh / 2 - 9);
      g.font = (L.small ? "10px" : "11px") + " 'IBM Plex Mono', ui-monospace, monospace";
      label("settle", L.ex, cy + 4, "rgba(" + TEXT + ",0.85)");

      // replay file
      var dw = 40, dh = 54, dx = L.rx - dw / 2, dy = cy - dh / 2;
      g.beginPath();
      g.moveTo(dx, dy); g.lineTo(dx + dw - 11, dy); g.lineTo(dx + dw, dy + 11);
      g.lineTo(dx + dw, dy + dh); g.lineTo(dx, dy + dh); g.closePath();
      g.fillStyle = "rgba(255,255,255,0.03)"; g.fill();
      g.strokeStyle = st.phase === "done" ? "rgba(" + ACC + ",0.9)" : "rgba(" + LINE + ",0.55)"; g.stroke();
      for (var i = 0; i < st.lines; i++) {
        g.fillStyle = "rgba(" + ACC + ",0.55)";
        g.fillRect(dx + 7, dy + 14 + i * 5.5, (i % 3 === 2 ? 14 : 24), 2);
      }
      g.font = (L.small ? "9.5px" : "10.5px") + " 'IBM Plex Mono', ui-monospace, monospace";
      label("replay", L.rx, dy - 9);

      // moving tokens
      if (!st.out) {
        var x0 = L.bx + L.bw / 2 + 8, xg = L.gx - 10, xe = ex0 - 8;
        if (st.phase === "send" && bot !== "hang" && bot !== "crash") {
          var t = ease(Math.min(1, st.t / T_SEND));
          token(lerp(x0, xg, t), cy, valid() ? "rgba(" + ACC + ",1)" : "rgba(" + CORAL + ",1)", st.payload);
        } else if (st.phase === "check" && !valid() && bot === "garbage") {
          var b = Math.min(1, st.t / T_CHECK);                     // the bad answer bounces off
          g.globalAlpha = 1 - b;
          token(xg - 18 * b, cy + 10 * b, "rgba(" + CORAL + ",1)", "");
          g.globalAlpha = 1;
        } else if (st.phase === "settle") {
          var t2 = ease(Math.min(1, st.t / T_SETTLE));
          var ok = valid();
          token(lerp(L.gx + 10, xe, t2), cy, ok ? "rgba(" + ACC + ",1)" : "rgba(" + GREY + ",1)", ok ? "" : "bet 0");
        } else if (st.phase === "write") {
          var t3 = ease(Math.min(1, st.t / T_WRITE));
          token(lerp(L.ex + L.ew / 2 + 6, L.rx - 24, t3), cy, "rgba(" + ACC + ",0.8)", "");
        }
      }

      // readouts
      var y1 = Math.round(H * (L.small ? 0.66 : 0.7));
      g.font = "11.5px 'IBM Plex Mono', ui-monospace, monospace";
      label("round " + st.round + " / 500", 4, y1, "rgba(" + TEXT + ",0.85)", "left");
      var sx = W < 420 ? 4 : W * 0.44 - 30, sy = W < 420 ? y1 + 22 : y1;
      label("strikes", sx, sy, "rgba(" + GREY + ",0.95)", "left");
      for (var k = 0; k < 3; k++) {
        g.beginPath(); g.arc(sx + 66 + k * 16, sy - 4, 5, 0, 6.2832);
        if (k < st.strikes) { g.fillStyle = "rgba(" + CORAL + ",0.95)"; g.fill(); }
        else { g.strokeStyle = "rgba(" + GREY + ",0.6)"; g.lineWidth = 1; g.stroke(); }
      }
      g.font = "12px 'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif";
      var col = st.out ? "rgba(" + CORAL + ",0.95)" : (bot === "honest" ? "rgba(" + ACC + ",0.95)" : "rgba(" + TEXT + ",0.8)");
      if (st.phase === "done") col = "rgba(" + ACC + ",0.95)";
      wrap(statusText(), 4, (W < 420 ? sy : y1) + 26, W - 8, 16, col);
    }
    function wrap(text, x, y, maxW, lh, col) {
      g.fillStyle = col; g.textAlign = "left"; g.textBaseline = "alphabetic";
      var words = text.split(" "), line = "";
      for (var i = 0; i < words.length; i++) {
        var test = line ? line + " " + words[i] : words[i];
        if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = words[i]; y += lh; }
        else line = test;
      }
      if (line) g.fillText(line, x, y);
    }

    // ---- loop: runs only while the scene is on screen ----
    var running = false, visible = false, last = 0, raf = 0;
    function loop(ts) {
      if (!running) return;
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      advance(dt); draw();
      raf = requestAnimationFrame(loop);
    }
    function start() { if (reduce || running) return; running = true; last = 0; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    function staticFrame() {                // reduced motion: one representative frame
      reset();
      if (bot === "hang" || bot === "crash") { st.crashed = bot === "crash"; }
      st.phase = "check"; st.flash = 1; st.flashCol = valid() ? ACC : CORAL;
      st.strikes = valid() ? 0 : 1;
      draw();
    }

    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        buttons.forEach(function (o) { o.classList.toggle("is-active", o === b); });
        bot = b.getAttribute("data-bot");
        reset();
        if (reduce) staticFrame(); else draw();
      });
    });

    layout(); reset();
    if (reduce) staticFrame(); else draw();
    window.addEventListener("resize", function () { layout(); draw(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) start(); else stop();
      }, { threshold: 0.2 }).observe(root);
    } else { start(); }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else if (visible) start();
    });
  })();

  // =====================================================================
  // 2) same seed, same replay
  // =====================================================================
  (function replayHash() {
    var root = document.getElementById("hviz");
    if (!root) return;
    var seedEl = document.getElementById("hviz-seed");
    var aEl = document.getElementById("hviz-a"), bEl = document.getElementById("hviz-b");
    var verdict = document.getElementById("hviz-verdict");
    var againBtn = document.getElementById("hviz-again"), seedBtn = document.getElementById("hviz-seedbtn");

    function randomSeed() {
      var bytes = new Uint8Array(16);
      if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
      else for (var i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
      return [].map.call(bytes, function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join("");
    }
    function fnv32(str) {
      var h = 0x811c9dc5;
      for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      return h >>> 0;
    }
    function mulberry32(a) {
      return function () {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    // play a toy path from the seed and serialise it, the way a replay file would be
    function replay(seed) {
      var r = mulberry32(fnv32(seed)), b = 100000, out = [];
      for (var t = 0; t < 500; t++) {
        var f = Math.floor(r() * 20) / 100, win = r() < 0.53, s = Math.floor(f * b);
        b += win ? s : -s;
        out.push(t + "," + f.toFixed(2) + "," + (win ? 1 : 0) + "," + b);
      }
      return out.join("\n");
    }
    function hash64(str) {                  // two independent FNV-1a lanes, shown as 16 hex digits
      var h1 = 0x811c9dc5, h2 = 0x050c5d1f;
      for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        h1 ^= c; h1 = Math.imul(h1, 0x01000193);
        h2 ^= c; h2 = Math.imul(h2, 0x01000193) ^ (h2 >>> 13);
      }
      var hex = ((h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0"));
      return hex.replace(/(.{4})/g, "$1 ").trim();
    }
    function shortSeed(s) { return "0x" + s.slice(0, 10) + "…" + s.slice(-6); }

    var seed = randomSeed();
    function run() {
      var target = hash64(replay(seed));
      seedEl.textContent = shortSeed(seed);
      if (reduce) { aEl.textContent = target; bEl.textContent = target; verdict.textContent = "identical, byte for byte"; return; }
      verdict.textContent = "replaying…"; verdict.classList.add("is-busy");
      var startTs = null, dur = 700, hexd = "0123456789abcdef";
      function scramble(el, settle, ts) {
        var out = "";
        for (var i = 0; i < target.length; i++) {
          var ch = target[i];
          out += ch === " " || (ts - startTs) > settle * (i + 1) / target.length ? ch : hexd[Math.floor(Math.random() * 16)];
        }
        el.textContent = out;
      }
      function step(ts) {
        if (startTs === null) startTs = ts;
        scramble(aEl, dur * 0.8, ts); scramble(bEl, dur, ts);
        if (ts - startTs < dur + 40) requestAnimationFrame(step);
        else { aEl.textContent = target; bEl.textContent = target; verdict.textContent = "identical, byte for byte"; verdict.classList.remove("is-busy"); }
      }
      requestAnimationFrame(step);
    }
    againBtn.addEventListener("click", run);
    seedBtn.addEventListener("click", function () { seed = randomSeed(); run(); });
    run();
  })();
})();
