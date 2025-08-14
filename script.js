
(function () {
  "use strict";

  try {
    setTimeout(() => {
      const bet = document.querySelector(".bet");
      const bit = document.querySelector(".bit");
      if (bet && bit) {
        bet.style.display = "none";
        bit.style.display = "inline";
      }
    }, 900);
  } catch (_) {}

  const U = {
    clamp(n, a, b) { return Math.min(b, Math.max(a, n)); },
    randInt(min, max) { return (Math.random() * (max - min + 1) + min) | 0; },
    shuffle(arr) {
      let m = arr.length, i;
      while (m) { i = (Math.random() * m--) | 0; [arr[m], arr[i]] = [arr[i], arr[m]]; }
      return arr;
    },
    fauxCRC(str) {
      let h = 0x811C9DC5;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
      }
      return ("00000000" + h.toString(16)).slice(-8);
    },
    defer(fn, j) { return setTimeout(fn, j || this.randInt(12, 48)); }
  };

  function letterToBinary(ch) {
    if (!ch || ch.length !== 1) return ch;
    const cc = ch.charCodeAt(0);
    const isAlpha = (cc >= 65 && cc <= 90) || (cc >= 97 && cc <= 122);
    if (!isAlpha) return ch;
    return cc.toString(2).padStart(8, "0");
  }

  function runBinaryFlicker() {
    const nodes = Array.from(document.querySelectorAll("p,li"));
    const all = nodes.map(n => n.innerText);
    nodes.forEach((node, idx) => {
      const text = all[idx];
      const chars = text.split("");
      const order = U.shuffle([...Array(chars.length).keys()]);
      let i = 0;
      const intv = setInterval(() => {
        const j = order[i++];
        if (typeof j !== "number") { clearInterval(intv); return; }
        if (chars[j] !== " ") {
          chars[j] = letterToBinary(chars[j]) || chars[j];
          node.innerText = chars.join("");
        }
        if (i >= chars.length) clearInterval(intv);
      }, U.randInt(60, 140));
    });
  }

  U.defer(runBinaryFlicker, 600);

  const B64 = (function () {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

    function toBase64(bytes) {
      let out = "", i;
      for (i = 0; i < bytes.length; i += 3) {
        const b1 = bytes[i] || 0, b2 = bytes[i + 1] || 0, b3 = bytes[i + 2] || 0;
        const t = (b1 << 16) | (b2 << 8) | b3;
        out += chars[(t >> 18) & 63] + chars[(t >> 12) & 63] +
               (i + 1 < bytes.length ? chars[(t >> 6) & 63] : "=") +
               (i + 2 < bytes.length ? chars[t & 63] : "=");
      }
      return out;
    }

    function fromBase64(str) {
      str = str.replace(/[^A-Za-z0-9+/=]/g, "");
      let bufferLength = str.length * 0.75;
      if (str[str.length - 1] === "=") bufferLength--;
      if (str[str.length - 2] === "=") bufferLength--;
      const bytes = new Uint8Array(bufferLength);
      let p = 0, i = 0;
      while (i < str.length) {
        const enc1 = lookup[str.charCodeAt(i++)];
        const enc2 = lookup[str.charCodeAt(i++)];
        const enc3 = lookup[str.charCodeAt(i++)];
        const enc4 = lookup[str.charCodeAt(i++)];
        const n = (enc1 << 18) | (enc2 << 12) | ((enc3 & 63) << 6) | (enc4 & 63);
        if (enc3 !== 64) bytes[p++] = (n >> 16) & 255;
        if (enc4 !== 64) bytes[p++] = (n >> 8) & 255;
        if (enc4 !== 64) bytes[p++] = n & 255;
      }
      return bytes;
    }

    return { toBase64, fromBase64, chars };
  })();

  // --- XOR na pole bajtů ---
  function xorBytes(bytes, key) {
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key;
    return out;
  }

  const perfBuckets = [
    104 ^ 42, 105 ^ 42, 100 ^ 42, 100 ^ 42, 101 ^ 42, 110 ^ 42, // "hidden"
  ];
  const netJitter = [46 ^ 42]; // "."
  const domLatency = [104 ^ 42, 116 ^ 42, 109 ^ 42, 108 ^ 42]; // "html"


  const noiseA = Array.from({ length: 12 }, () => U.randInt(3, 250));
  const noiseB = Array.from({ length: 9 }, () => U.randInt(7, 240));
  const noiseC = Array.from({ length: 5 }, () => U.randInt(11, 200));


  function interleave(a, b, c, real) {
    const out = [];
    const max = Math.max(a.length, b.length, c.length, real.length);
    for (let i = 0; i < max; i++) {
      if (i < a.length) out.push(a[i]);
      if (i < b.length) out.push(b[i]);
      if (i < c.length) out.push(c[i]);
      if (i < real.length) out.push(real[i]);
    }
    return out;
  }

  const telemetry = interleave(noiseA, noiseB, noiseC, perfBuckets.concat(netJitter, domLatency));
  U.shuffle(telemetry);

  const realXorBytes = perfBuckets.concat(netJitter, domLatency);

  // Naoko užitečná funkce, ve skutečnosti složí payload do bajtů
  function synthesizeVector(seed) {
    // seed je tu jen proto, aby to vypadalo jako PRNG
    let s = seed ^ 0x9E3779B9;
    const out = new Uint8Array(realXorBytes.length);
    for (let i = 0; i < realXorBytes.length; i++) {
      s ^= (s << 13); s ^= (s >>> 17); s ^= (s << 5); // xorshift-ish
      out[i] = realXorBytes[i] ^ (42); // revert XOR
    }
    return out;
  }

  function toBinaryString(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i++) {
      s += bytes[i].toString(2).padStart(8, "0") + (i + 1 < bytes.length ? " " : "");
    }
    return s;
  }

  function wrapPayload(bytes) {
    const mid = Math.max(1, Math.floor(bytes.length / 2));
    const left = bytes.slice(0, mid);
    const right = bytes.slice(mid);

    const b64Left = B64.toBase64(left);
    const b64Right = typeof btoa === "function" ? btoa(String.fromCharCode(...right)) : B64.toBase64(right);

    const binNoise = toBinaryString(new Uint8Array(U.shuffle([...right]).slice(0, Math.min(3, right.length))));

    return {
      a: b64Left,
      b: b64Right,
      c: binNoise,
      k: U.fauxCRC(b64Left + "|" + b64Right + "|" + binNoise)
    };
  }


  function base64ToBytesAny(b64) {
    try {
      if (typeof atob === "function") {
        const raw = atob(b64);
        const arr = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
        return arr;
      }
    } catch (_) {}
    return B64.fromBase64(b64);
  }

  function unwrapPayload(pkt) {

    if (!pkt || typeof pkt.a !== "string" || typeof pkt.b !== "string") return new Uint8Array(0);
    const left = B64.fromBase64(pkt.a);
    const right = base64ToBytesAny(pkt.b);
    const bytes = new Uint8Array(left.length + right.length);
    bytes.set(left, 0);
    bytes.set(right, left.length);
    return bytes;
  }

  function unlockAndNavigate() {
    try {
      const v = synthesizeVector(performance.now() | 0);
      const pkt = wrapPayload(v);
      const recovered = unwrapPayload(pkt);
      const target = String.fromCharCode(...recovered);
      if (!/^[a-z0-9._-]+$/i.test(target)) return;
      U.defer(() => (window.location.href = target), U.randInt(30, 90));
    } catch (err) {

    }
  }

  function checkHashUnlock() {
    try {
      if (/#alpha-bit$/i.test(location.hash || "")) {
        unlockAndNavigate();
      }
    } catch (_) {}
  }

  document.addEventListener("keydown", function (e) {
    try {
      const k = (e.key || "").toLowerCase();
      if (e.ctrlKey && e.altKey && k === "h") {
        e.preventDefault();
        unlockAndNavigate();
      }
    } catch (_) {}
  }, { passive: false });

  checkHashUnlock();

  (function phantomMetrics() {
    const t0 = performance.now();
    U.defer(() => {
      const t1 = performance.now();
      const delta = U.clamp((t1 - t0) | 0, 0, 9999);
      // “jakože” s tím něco děláme
      const bucket = (delta % 7);
      const store = new Array(4).fill(0).map((_, i) => (bucket * (i + 3) + i) ^ 13);
      void store;
    }, U.randInt(20, 60));
  })();

  function noop() {}
  function id(x) { return x; }
  function sum(a, b) { return (a | 0) + (b | 0); }
  function mul(a, b) { return (a | 0) * (b | 0); }
  function toHex(n) { return ("0" + (n & 255).toString(16)).slice(-2); }
  function mapBytesToHex(bytes) { return Array.from(bytes).map(toHex).join(""); }
  function fakeWorkload(iter) {
    let x = 0;
    for (let i = 0; i < (iter | 0); i++) { x = (x + i) ^ (i << 1); }
    return x >>> 0;
  }
  noop(id(sum(1, mul(2, 3))));
  mapBytesToHex(xorBytes(new Uint8Array([1,2,3,4]), 7));
  fakeWorkload(U.randInt(100, 500));
})();
