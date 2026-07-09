/*!
 * jackmetrics —— jackserver 网站访问量打点 SDK（纯 JS，零依赖）
 *
 * 【签名契约】sig = HMAC-SHA256(trackSecret, `${site}|${path}|${ts}`) 的 hex，
 *   必须与服务端 packages/jackserver/src/middleware/track.rs::verify_sig 完全一致
 *   （分隔符 `|`、字段顺序 site→path→ts、ts 为秒级时间戳、hex 输出）。
 *
 * 【实现】内联纯 JS 的 SHA-256 + HMAC-SHA256（标准 FIPS 180-4 / RFC 2104），
 *   不依赖 Web Crypto（crypto.subtle），因此 http:// + 纯 IP 等非安全上下文也可用。
 *   对照 Node 内置 crypto 的一致性验证见同目录 verify_hmac.js。
 *
 * 【安全说明】trackSecret 嵌入客户端、可被逆向抠出，签名仅用于提高伪造门槛，
 *   不保证密码学级防伪；真正兜底是服务端限流（rate_limit）。
 *   建议定期轮换 track_secret 并同步更新服务端配置。
 */
(function (root) {
  'use strict';

  var options = null;

  /**
   * 初始化 SDK。初始化后自动上报一次当前页 PV；SPA 路由变化也会自动上报。
   * @param {Object} opts
   * @param {string} opts.endpoint      打点端点，如 http://114.124.36.46:7001/api/metrics/track
   * @param {string} opts.site          站点标识（须在服务端 allowed_origins 白名单内）
   * @param {string} opts.trackSecret   签名密钥（与服务端 metrics.track_secret 一致）
   * @param {boolean} [opts.spa=true]   是否监听 SPA 路由变化自动上报
   */
  function init(opts) {
    options = opts || null;
    if (!options) return;
    trackPageView();
    if (options.spa !== false) {
      hookHistory();
    }
  }

  /**
   * 上报一次页面访问。失败静默，不影响站点正常使用。
   * @param {string} [path] 自定义路径，默认取 location.pathname
   * @returns {Promise<void>}
   */
  async function trackPageView(path) {
    if (!options || typeof window === 'undefined') return;
    var p = path || window.location.pathname || '/';
    var ts = Math.floor(Date.now() / 1000);
    var sig = hmacSha256Hex(options.trackSecret, options.site + '|' + p + '|' + ts);
    var payload = {
      site: options.site,
      path: p,
      referer: document.referrer || undefined,
      ts: ts,
      sig: sig,
    };
    try {
      await fetch(options.endpoint, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('[jackmetrics] track failed', e);
      }
    }
  }

  // ===== 纯 JS SHA-256 + HMAC-SHA256（零依赖，非安全上下文可用）=====
  // 所有中间加法项可能是有符号 32 位（JS 位运算语义），但末尾统一 >>> 0 取模 2^32，
  // 与标准无符号实现等价。这是 JS 实现 SHA-256 的标准技巧。

  function utf8ToBytes(str) {
    return new TextEncoder().encode(str);
  }

  // 32 位右旋转。
  function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  // SHA-256：输入 Uint8Array，输出 Uint8Array(32)。
  function sha256Bytes(msg) {
    var H = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    var K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    var l = msg.length;
    var bitLen = l * 8;
    // 补位：msg + 0x80 + 0x00… + 8 字节大端长度，对齐到 64 字节。
    var total = (((l + 1 + 8) + 63) >>> 6) << 6;
    var buf = new Uint8Array(total);
    buf.set(msg);
    buf[l] = 0x80;
    var dv = new DataView(buf.buffer);
    dv.setUint32(total - 4, bitLen >>> 0, false);          // 长度低 32 位
    dv.setUint32(total - 8, Math.floor(bitLen / 0x100000000), false); // 长度高 32 位

    var W = new Array(64);
    for (var blk = 0; blk < total; blk += 64) {
      for (var t = 0; t < 16; t++) {
        W[t] = dv.getUint32(blk + t * 4, false);
      }
      for (var t = 16; t < 64; t++) {
        var s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        var s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (var t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0;
      H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0;
      H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0;
      H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0;
      H[7] = (H[7] + h) >>> 0;
    }

    var out = new Uint8Array(32);
    var odv = new DataView(out.buffer);
    for (var i = 0; i < 8; i++) {
      odv.setUint32(i * 4, H[i], false);
    }
    return out;
  }

  function bytesToHex(bytes) {
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  }

  // HMAC-SHA256(secret, msg) → hex。secret / msg 按字符串 UTF-8 编码。
  function hmacSha256Hex(secret, msg) {
    var blockSize = 64;
    var keyBytes = utf8ToBytes(secret);
    if (keyBytes.length > blockSize) {
      keyBytes = sha256Bytes(keyBytes);
    }
    var paddedKey = new Uint8Array(blockSize);
    paddedKey.set(keyBytes);
    var ipad = new Uint8Array(blockSize);
    var opad = new Uint8Array(blockSize);
    for (var i = 0; i < blockSize; i++) {
      ipad[i] = paddedKey[i] ^ 0x36;
      opad[i] = paddedKey[i] ^ 0x5c;
    }
    var msgBytes = utf8ToBytes(msg);
    var inner = new Uint8Array(blockSize + msgBytes.length);
    inner.set(ipad, 0);
    inner.set(msgBytes, blockSize);
    var innerHash = sha256Bytes(inner);
    var outer = new Uint8Array(blockSize + innerHash.length);
    outer.set(opad, 0);
    outer.set(innerHash, blockSize);
    return bytesToHex(sha256Bytes(outer));
  }

  // 拦截 history API + popstate，SPA 路由变化时上报新 path。
  function hookHistory() {
    if (typeof window === 'undefined' || !window.history) return;
    var origPush = history.pushState;
    var origReplace = history.replaceState;
    history.pushState = function () {
      var ret = origPush.apply(this, arguments);
      queueMicrotask(function () {
        trackPageView();
      });
      return ret;
    };
    history.replaceState = function () {
      var ret = origReplace.apply(this, arguments);
      queueMicrotask(function () {
        trackPageView();
      });
      return ret;
    };
    window.addEventListener('popstate', function () {
      trackPageView();
    });
  }

  var JackMetrics = { init: init, trackPageView: trackPageView };

  // 挂全局（浏览器 <script> 引入）
  root.JackMetrics = JackMetrics;

  // CommonJS（Node 等环境，便于测试）
  if (typeof module !== 'undefined' && module.exports) {
    // 暴露内部签名函数，便于在 Node 下对照标准实现验证一致性（见 verify_hmac.js）。
    JackMetrics._hmacSha256Hex = hmacSha256Hex;
    module.exports = JackMetrics;
  }
})(typeof window !== 'undefined' ? window : this);
