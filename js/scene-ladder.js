// scene-ladder.js: bootstrap resampling of a reference ladder, for the calibration
// stage. Each bot has a pool of per-path scores (illustrative numbers); every
// resample draws N paths with replacement, the same paths for every bot, and
// takes each bot's median. One dot per resample. The tier order (tier 1 above
// every tier 2 bot, tier 2 above every tier 3 bot) is checked on each resample.
// Few paths and the tiers blur; enough paths and the order holds.

(function () {
  "use strict";

  var root = document.getElementById("lviz");
  if (!root) return;
  var cv = root.querySelector(".lviz__canvas");
  var g = cv.getContext("2d");
  var slider = document.getElementById("lviz-n");
  var nEl = document.getElementById("lviz-nv");
  var heldEl = document.getElementById("lviz-held");
  var runBtn = document.getElementById("lviz-run");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var ACC = "137,207,240", CORAL = "214,150,140", GREY = "139,140,147", TEXT = "240,240,242";
  var NS = [10, 25, 50, 100, 250, 500];
  var R = 200, POOL = 1000, SD = 4.0;
  var BOTS = [
    { name: "house bot", short: "house bot", tier: 1, m: -3.0 },
    { name: "signal-aware estimator", short: "signal-aware", tier: 2, m: -4.5 },
    { name: "windowed half-Kelly", short: "windowed ½-Kelly", tier: 3, m: -6.0 },
    { name: "follow the signal", short: "follow signal", tier: 3, m: -6.5 },
    { name: "never bet", short: "never bet", tier: 3, m: -7.0 },
    { name: "fixed fraction", short: "fixed fraction", tier: 0, m: null }
  ];
  var XMIN = -11, XMAX = 0;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32(1108);
  function gauss() {
    var u = rnd() || 1e-9, v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // per-path score pools (the degenerate bot is drawn off the chart)
  var pools = BOTS.map(function (b) {
    if (b.m === null) return null;
    var a = new Float64Array(POOL);
    for (var i = 0; i < POOL; i++) a[i] = b.m + SD * gauss();
    return a;
  });

  var meds = [], held = 0, shown = 0;
  function resample(N) {
    meds = BOTS.map(function () { return []; });
    held = 0;
    var idx = new Int32Array(N), buf = new Float64Array(N);
    for (var k = 0; k < R; k++) {
      for (var i = 0; i < N; i++) idx[i] = Math.floor(rnd() * POOL);
      var m = BOTS.map(function (b, j) {
        if (!pools[j]) return null;
        for (var i2 = 0; i2 < N; i2++) buf[i2] = pools[j][idx[i2]];
        var s = Array.prototype.slice.call(buf).sort(function (a, c) { return a - c; });
        return N % 2 ? s[(N - 1) / 2] : (s[N / 2 - 1] + s[N / 2]) / 2;
      });
      m.forEach(function (v, j) { if (v !== null) meds[j].push({ v: v, jit: rnd() * 2 - 1 }); });
      var ok = true;
      for (var a = 0; a < BOTS.length; a++) {
        for (var c = 0; c < BOTS.length; c++) {
          if (BOTS[a].tier && BOTS[c].tier && BOTS[a].tier < BOTS[c].tier && !(m[a] > m[c])) ok = false;
        }
      }
      if (ok) held++;
    }
  }

  // ---- layout ----
  var W = 0, H = 0, dpr = 1, LAB = 150, PADR = 12, TOP = 8, AX = 26;
  function layout() {
    W = cv.offsetWidth; H = cv.offsetHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    LAB = W < 460 ? 104 : 158;
  }
  function x(v) { return LAB + (W - LAB - PADR) * (v - XMIN) / (XMAX - XMIN); }
  function rowY(i) { var h = (H - TOP - AX) / BOTS.length; return TOP + h * (i + 0.5); }
  function pct(arr, p) {
    var s = arr.map(function (o) { return o.v; }).sort(function (a, b) { return a - b; });
    return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
  }

  function draw() {
    g.clearRect(0, 0, W, H);
    var small = W < 460;
    g.font = (small ? "10px" : "11px") + " 'IBM Plex Mono', ui-monospace, monospace";
    // axis
    g.textBaseline = "alphabetic"; g.textAlign = "center";
    for (var v = -10; v <= 0; v += 2) {
      var xv = x(v);
      g.strokeStyle = "rgba(" + GREY + ",0.14)"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(xv, TOP); g.lineTo(xv, H - AX + 2); g.stroke();
      g.fillStyle = "rgba(" + GREY + ",0.85)";
      g.fillText(String(v), xv, H - 8);
    }
    // tier bands
    var lastTier = null;
    BOTS.forEach(function (b, i) {
      var y = rowY(i);
      if (b.tier !== lastTier && i > 0) {
        var yb = (rowY(i - 1) + y) / 2;
        g.strokeStyle = "rgba(" + GREY + ",0.22)"; g.setLineDash([2, 4]);
        g.beginPath(); g.moveTo(4, yb); g.lineTo(W - PADR, yb); g.stroke(); g.setLineDash([]);
      }
      lastTier = b.tier;
      // labels
      g.textAlign = "left"; g.textBaseline = "middle";
      g.fillStyle = b.tier === 0 ? "rgba(" + CORAL + ",0.9)" : "rgba(" + TEXT + ",0.85)";
      g.fillText(small ? b.short : b.name, 4, y - (small ? 0 : 6));
      if (!small) {
        g.fillStyle = "rgba(" + GREY + ",0.85)";
        g.fillText(b.tier ? "tier " + b.tier : "degenerate", 4, y + 8);
      }
      if (b.tier === 0) {
        g.fillStyle = "rgba(" + CORAL + ",0.85)"; g.textAlign = "left";
        g.fillText("◀ far off the chart", x(XMIN) + 4, y);
        return;
      }
      // dots
      var col = b.tier === 1 ? ACC : b.tier === 2 ? ACC : GREY;
      var alpha = b.tier === 3 ? 0.4 : b.tier === 2 ? 0.32 : 0.45;
      var list = meds[i] || [], n = Math.min(list.length, Math.floor(shown));
      for (var k = 0; k < n; k++) {
        var d = list[k], xx = x(Math.max(XMIN, Math.min(XMAX, d.v)));
        g.beginPath(); g.arc(xx, y + d.jit * 7, 2.1, 0, 6.2832);
        g.fillStyle = "rgba(" + col + "," + alpha + ")"; g.fill();
      }
      // 95% interval once all resamples are in
      if (shown >= R && list.length) {
        var lo = x(Math.max(XMIN, pct(list, 0.025))), hi = x(Math.min(XMAX, pct(list, 0.975)));
        g.strokeStyle = b.tier === 3 ? "rgba(" + TEXT + ",0.5)" : "rgba(" + ACC + ",0.95)";
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(lo, y + 12); g.lineTo(hi, y + 12);
        g.moveTo(lo, y + 9); g.lineTo(lo, y + 15); g.moveTo(hi, y + 9); g.lineTo(hi, y + 15); g.stroke();
      }
    });
  }

  var raf = 0;
  function play() {
    var N = NS[+slider.value];
    nEl.textContent = String(N);
    resample(N);
    cancelAnimationFrame(raf);
    if (reduce) { shown = R; heldEl.textContent = Math.round(100 * held / R) + "%"; draw(); return; }
    shown = 0; heldEl.textContent = "…";
    var start = null, dur = 1100;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      shown = R * p;
      draw();
      if (p < 1) raf = requestAnimationFrame(step);
      else heldEl.textContent = Math.round(100 * held / R) + "%";
    }
    raf = requestAnimationFrame(step);
  }

  slider.addEventListener("input", play);
  runBtn.addEventListener("click", play);

  layout();
  nEl.textContent = String(NS[+slider.value]);
  var rz = 0;
  window.addEventListener("resize", function () {
    if (rz) return;
    rz = requestAnimationFrame(function () { rz = 0; layout(); draw(); });
  });
  if (!reduce && "IntersectionObserver" in window) {
    draw();
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { play(); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(root);
  } else { play(); }
})();
