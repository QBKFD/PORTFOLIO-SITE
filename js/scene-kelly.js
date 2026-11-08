// scene-kelly.js: bet sizing on a biased coin, for the Kelly Survival stage.
// Left: 40 bankroll paths over 500 rounds (log scale) on the same coin flips;
// right: expected log growth per round against the bet size, in multiples of
// the Kelly fraction. A slider resizes the bet and every path is re-played on
// the same flips, so the only thing that changes is the sizing. Uses the
// game's mechanics: $1,000 start, stakes floored to whole cents, out below $10.

(function () {
  "use strict";

  var root = document.getElementById("kviz");
  if (!root) return;
  var fan = root.querySelector(".kviz__fan");
  var curve = root.querySelector(".kviz__curve");
  var gf = fan.getContext("2d");
  var gc = curve.getContext("2d");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var slider = document.getElementById("kviz-mult");
  var multEl = document.getElementById("kviz-multv");
  var medEl = document.getElementById("kviz-med");
  var ruinEl = document.getElementById("kviz-ruin");
  var fEl = document.getElementById("kviz-f");
  var newBtn = document.getElementById("kviz-new");

  var ACC = "137,207,240", CORAL = "214,150,140", GREY = "139,140,147", TEXT = "240,240,242";
  var P = 0.55, KELLY = 2 * P - 1, ROUNDS = 500, NP = 40;
  var START = 100000, OUT = 1000;            // cents: $1,000 start, out below $10
  var YMIN = 1, YMAX = 6;                    // log10 dollars: $10 .. $1,000,000

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var flips = [];
  function newCoins(seed) {
    var r = mulberry32(seed);
    flips = [];
    for (var p = 0; p < NP; p++) {
      var a = new Uint8Array(ROUNDS);
      for (var t = 0; t < ROUNDS; t++) a[t] = r() < P ? 1 : 0;
      flips.push(a);
    }
  }

  var paths = [], medianPath = null, mult = 1;
  function frac(m) { return Math.min(1, m * KELLY); }

  function simulate() {
    var f = frac(mult);
    paths = flips.map(function (fl) {
      var b = START, v = new Float64Array(ROUNDS + 1), out = -1;
      v[0] = b;
      for (var t = 0; t < ROUNDS; t++) {
        if (out < 0) {
          var s = Math.floor(f * b);
          b += fl[t] ? s : -s;
          if (b < OUT) out = t + 1;
        }
        v[t + 1] = b;
      }
      return { v: v, out: out };
    });
    medianPath = new Float64Array(ROUNDS + 1);
    var col = new Array(NP);
    for (var t = 0; t <= ROUNDS; t++) {
      for (var p = 0; p < NP; p++) col[p] = paths[p].v[t];
      col.sort(function (a, b) { return a - b; });
      medianPath[t] = (col[NP / 2 - 1] + col[NP / 2]) / 2;
    }
    var finals = paths.map(function (q) { return q.v[ROUNDS]; }).sort(function (a, b) { return a - b; });
    var med = (finals[NP / 2 - 1] + finals[NP / 2]) / 2;
    var outN = paths.filter(function (q) { return q.out >= 0; }).length;
    medEl.textContent = money(med / 100);
    ruinEl.textContent = Math.round(100 * outN / NP) + "%";
    fEl.textContent = (100 * f).toFixed(1).replace(/\.0$/, "") + "%";
    multEl.textContent = mult.toFixed(2) + "× Kelly";
  }

  function money(d) {
    if (d >= 1e6) return "$" + (d / 1e6).toFixed(1) + "M";
    if (d >= 1e4) return "$" + Math.round(d / 1000) + "k";
    if (d >= 1000) return "$" + (d / 1000).toFixed(1) + "k";
    return "$" + Math.round(d);
  }

  // ---- layout ----
  var dpr = 1, FW = 0, FH = 0, CW = 0, CH = 0;
  function size(cv, g) {
    var w = cv.offsetWidth, h = cv.offsetHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [w, h];
  }
  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var a = size(fan, gf); FW = a[0]; FH = a[1];
    var b = size(curve, gc); CW = b[0]; CH = b[1];
  }

  // ---- fan chart ----
  var PADL = 40, PADR = 8, PADT = 8, PADB = 22;
  function fx(t) { return PADL + (FW - PADL - PADR) * t / ROUNDS; }
  function fy(cents) {
    var d = Math.max(cents / 100, Math.pow(10, YMIN));
    var l = Math.log(d) / Math.LN10;
    return PADT + (FH - PADT - PADB) * (1 - (l - YMIN) / (YMAX - YMIN));
  }

  function drawFan(upto) {
    gf.clearRect(0, 0, FW, FH);
    gf.font = "10px 'IBM Plex Mono', ui-monospace, monospace";
    gf.textBaseline = "middle";
    // grid
    var labels = ["$10", "$100", "$1k", "$10k", "$100k", "$1M"];
    for (var i = YMIN; i <= YMAX; i++) {
      var y = fy(Math.pow(10, i) * 100);
      gf.strokeStyle = "rgba(" + GREY + ",0.16)"; gf.lineWidth = 1;
      gf.beginPath(); gf.moveTo(PADL, y); gf.lineTo(FW - PADR, y); gf.stroke();
      gf.fillStyle = "rgba(" + GREY + ",0.85)"; gf.textAlign = "right";
      gf.fillText(labels[i - YMIN], PADL - 6, y);
    }
    gf.textAlign = "center"; gf.textBaseline = "alphabetic";
    [0, 250, 500].forEach(function (t) { gf.fillText(String(t), fx(t), FH - 6); });
    // start level
    gf.setLineDash([3, 4]); gf.strokeStyle = "rgba(" + TEXT + ",0.25)";
    gf.beginPath(); gf.moveTo(PADL, fy(START)); gf.lineTo(FW - PADR, fy(START)); gf.stroke();
    gf.setLineDash([]);
    // paths
    var n = Math.max(1, Math.floor(upto));
    gf.lineWidth = 1;
    paths.forEach(function (q) {
      var dead = q.out >= 0 && q.out <= n;
      gf.strokeStyle = dead ? "rgba(" + CORAL + ",0.42)" : "rgba(" + ACC + ",0.2)";
      gf.beginPath();
      var end = q.out >= 0 ? Math.min(n, q.out) : n;
      for (var t = 0; t <= end; t += 2) {
        var x = fx(t), y = fy(q.v[t]);
        if (t === 0) gf.moveTo(x, y); else gf.lineTo(x, y);
      }
      gf.lineTo(fx(end), fy(q.v[end]));
      gf.stroke();
      if (dead) {                      // a small cross where the bot was knocked out
        var cx = fx(q.out), cy = fy(OUT);
        gf.strokeStyle = "rgba(" + CORAL + ",0.8)";
        gf.beginPath(); gf.moveTo(cx - 3, cy - 3); gf.lineTo(cx + 3, cy + 3);
        gf.moveTo(cx + 3, cy - 3); gf.lineTo(cx - 3, cy + 3); gf.stroke();
      }
    });
    // median
    gf.strokeStyle = "rgba(" + ACC + ",0.95)"; gf.lineWidth = 2.2;
    gf.beginPath();
    for (var t2 = 0; t2 <= n; t2 += 2) {
      var x2 = fx(t2), y2 = fy(medianPath[t2]);
      if (t2 === 0) gf.moveTo(x2, y2); else gf.lineTo(x2, y2);
    }
    gf.stroke();
    if (n >= ROUNDS) {
      gf.fillStyle = "rgba(" + ACC + ",0.95)"; gf.textAlign = "right"; gf.textBaseline = "bottom";
      gf.fillText("median", FW - PADR - 2, fy(medianPath[ROUNDS]) - 5);
    }
  }

  // ---- growth curve ----
  var MMAX = 3, GMIN = -0.02, GMAX = 0.008;
  var CPL = 8, CPR = 10, CPT = 12, CPB = 22;
  function growth(m) {
    var f = frac(m);
    if (f >= 1) return -Infinity;
    return P * Math.log(1 + f) + (1 - P) * Math.log(1 - f);
  }
  function cx(m) { return CPL + (CW - CPL - CPR) * m / MMAX; }
  function cy(g) {
    var v = Math.max(GMIN, Math.min(GMAX, g));
    return CPT + (CH - CPT - CPB) * (1 - (v - GMIN) / (GMAX - GMIN));
  }
  function drawCurve() {
    gc.clearRect(0, 0, CW, CH);
    gc.font = "10px 'IBM Plex Mono', ui-monospace, monospace";
    // zero line
    gc.strokeStyle = "rgba(" + GREY + ",0.35)"; gc.lineWidth = 1;
    gc.beginPath(); gc.moveTo(CPL, cy(0)); gc.lineTo(CW - CPR, cy(0)); gc.stroke();
    // x ticks
    gc.fillStyle = "rgba(" + GREY + ",0.85)"; gc.textAlign = "center"; gc.textBaseline = "alphabetic";
    ["0", "1×", "2×", "3×"].forEach(function (s, i) { gc.fillText(s, cx(i), CH - 6); });
    // shaded region where growth is negative
    gc.fillStyle = "rgba(" + CORAL + ",0.06)";
    gc.fillRect(cx(2.0), CPT, CW - CPR - cx(2.0), CH - CPT - CPB);
    // curve
    gc.strokeStyle = "rgba(" + ACC + ",0.9)"; gc.lineWidth = 2;
    gc.beginPath();
    for (var i = 0; i <= 120; i++) {
      var m = MMAX * i / 120, x = cx(m), y = cy(growth(m));
      if (i === 0) gc.moveTo(x, y); else gc.lineTo(x, y);
    }
    gc.stroke();
    // labels
    gc.fillStyle = "rgba(" + TEXT + ",0.75)"; gc.textAlign = "center"; gc.textBaseline = "bottom";
    gc.fillText("fastest", cx(1), cy(growth(1)) - 8);
    gc.fillStyle = "rgba(" + CORAL + ",0.9)"; gc.textAlign = "left"; gc.textBaseline = "top";
    gc.fillText("growth gone", cx(2.05), cy(0) + 5);
    // current marker
    var g = growth(mult), mx = cx(mult), my = cy(g);
    gc.setLineDash([3, 3]); gc.strokeStyle = "rgba(" + TEXT + ",0.35)"; gc.lineWidth = 1;
    gc.beginPath(); gc.moveTo(mx, CPT); gc.lineTo(mx, CH - CPB); gc.stroke(); gc.setLineDash([]);
    gc.beginPath(); gc.arc(mx, my, 5, 0, 6.2832);
    gc.fillStyle = g < 0 ? "rgba(" + CORAL + ",1)" : "rgba(" + ACC + ",1)"; gc.fill();
    gc.lineWidth = 2; gc.strokeStyle = "#131316"; gc.stroke();
  }

  // ---- reveal animation (paths draw left to right once) ----
  var progress = ROUNDS, raf = 0;
  function animateIn() {
    if (reduce) { progress = ROUNDS; drawFan(progress); return; }
    cancelAnimationFrame(raf);
    var start = null, dur = 1600;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      progress = ROUNDS * (1 - Math.pow(1 - p, 2));
      drawFan(progress);
      if (p < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
  }

  function redraw() { drawFan(progress); drawCurve(); }

  slider.addEventListener("input", function () {
    mult = +slider.value / 100;
    cancelAnimationFrame(raf); progress = ROUNDS;
    simulate(); redraw();
  });
  newBtn.addEventListener("click", function () {
    newCoins((Math.random() * 4294967296) >>> 0);
    simulate(); drawCurve(); animateIn();
  });

  // ---- init ----
  newCoins(20261108);
  mult = +slider.value / 100;
  layout(); simulate(); redraw();

  var rz = 0;
  window.addEventListener("resize", function () {
    if (rz) return;
    rz = requestAnimationFrame(function () { rz = 0; layout(); redraw(); });
  });

  if (!reduce && "IntersectionObserver" in window) {
    progress = 0; drawFan(0);
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { animateIn(); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(root);
  }
})();
